import React, { useMemo, useState, useEffect } from 'react';

/**
 * Right rail TOC. Walks the ProseMirror JSON for heading nodes and renders
 * them as a nested list. Clicking scrolls to the corresponding heading in the
 * editor DOM. Headings are matched by their text content + nth-of-its-kind
 * occurrence, since the editor doesn't add IDs on its own.
 */
export default function DocToc({
  content,
  width, onResize, minWidth = 140, maxWidth = 360,
}) {
  const headings = useMemo(() => extractHeadings(content), [content]);

  // Scroll spy: the entry for the section the reader is in wears the accent.
  // "In" means the last heading that has crossed a line ~96px below the top of
  // whatever scrolls the doc, so a heading counts once its section is what you
  // are reading, not the moment it peeks in at the bottom. At the end of the
  // doc the last entry wins outright, because a short final section never
  // reaches that line on its own. Headings in the JSON and the h1-h3 elements
  // in the editor render in the same order, so entry i is element i; if the
  // counts disagree (mid-edit) it falls back to the same text+nth match that
  // scrollTo uses.
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const editorRoot = document.querySelector('.doc-editor-content');
      if (!editorRoot) return;
      const els = Array.from(editorRoot.querySelectorAll('h1, h2, h3'));
      if (!els.length) return;

      let scroller = editorRoot;
      while (scroller && scroller !== document.body) {
        const o = getComputedStyle(scroller).overflowY;
        if (o === 'auto' || o === 'scroll') break;
        scroller = scroller.parentElement;
      }
      const inPane = scroller && scroller !== document.body;
      const topLine = (inPane ? scroller.getBoundingClientRect().top : 0) + 96;
      const atEnd = inPane
        ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
        : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

      let current = 0;
      if (atEnd) current = els.length - 1;
      else for (let i = 0; i < els.length; i++) {
        if (els[i].getBoundingClientRect().top <= topLine) current = i; else break;
      }

      let idx = current;
      if (els.length !== headings.length) {
        const lvl = Number(els[current].tagName.slice(1));
        const txt = normText(els[current].textContent);
        let nth = 0;
        for (let k = 0; k < current; k++)
          if (Number(els[k].tagName.slice(1)) === lvl && normText(els[k].textContent) === txt) nth++;
        idx = headings.findIndex(h => h.level === lvl && h.text === txt && h.idx === nth);
        if (idx < 0) idx = Math.min(current, headings.length - 1);
      }
      setActiveIdx(idx);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    update();
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [headings]);

  const onResizeMouseDown = (e) => {
    if (!onResize) return;
    const startX = e.clientX;
    const startW = width || minWidth;
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const next = Math.max(minWidth, Math.min(maxWidth, startW + dx));
      onResize(next);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  const resizeHandle = onResize ? (
    <div className="docs-toc-resize" onMouseDown={onResizeMouseDown} title="Drag to resize" />
  ) : null;

  if (headings.length === 0) {
    return (
      <aside className="docs-toc" style={width ? { width } : undefined}>
        <div className="docs-toc-title">Contents</div>
        <div className="docs-toc-empty">Add headings to populate.</div>
        {resizeHandle}
      </aside>
    );
  }

  const scrollTo = (h) => {
    const editorRoot = document.querySelector('.doc-editor-content');
    if (!editorRoot) return;
    const matches = editorRoot.querySelectorAll(`h${h.level}`);
    let nth = 0;
    for (const el of matches) {
      if (normText(el.textContent) === h.text) {
        if (nth === h.idx) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        nth++;
      }
    }
  };

  return (
    <aside className="docs-toc" style={width ? { width } : undefined}>
      <div className="docs-toc-title">Contents</div>
      <ul className="docs-toc-list">
        {headings.map((h, i) => (
          <li
            key={i}
            className={`docs-toc-item docs-toc-h${h.level}${i === activeIdx ? ' active' : ''}`}
            onClick={() => scrollTo(h)}
          >
            {h.text || <em>Untitled section</em>}
          </li>
        ))}
      </ul>
      {resizeHandle}
    </aside>
  );
}

/**
 * Walks ProseMirror JSON depth-first and returns a flat list of
 * { level, text, idx } where idx is the 0-based occurrence count of headings
 * with the same text+level (so duplicate titles still scroll correctly).
 */
function extractHeadings(content) {
  if (!content) return [];
  const out = [];
  const seenCount = {}; // `${level}:${text}` → count, used to assign idx
  const walk = (node) => {
    if (!node) return;
    if (node.type === 'heading') {
      const level = (node.attrs && node.attrs.level) || 1;
      const text = normText(collectText(node));
      const key = `${level}:${text}`;
      const idx = seenCount[key] || 0;
      seenCount[key] = idx + 1;
      out.push({ level, text, idx });
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(walk);
    }
  };
  walk(content);
  return out;
}

/**
 * Both sides of the match have to be normalised the SAME way. The DOM side was
 * trimmed and the JSON side was not, so a heading authored as "Goal: " never
 * matched the "Goal:" the browser reports and clicking it did nothing at all.
 * Worse, idx was counted on the raw text while the DOM was counted on the
 * trimmed text, so "Result: " and "Result:" were two different keys over one
 * set of elements and every later entry pointed one heading too high.
 */
function normText(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function collectText(node) {
  if (!node) return '';
  if (node.text) return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map(collectText).join('');
  }
  return '';
}
