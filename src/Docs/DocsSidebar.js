import React, { useMemo, useState } from 'react';

/**
 * Left sidebar: lists docs in MANUAL order (persisted to /docs_order in
 * Firebase). Drag a row up or down to reorder; editing a doc no longer
 * shuffles the list. New docs land at the top; orphans (no order entry yet)
 * fall to the bottom sorted by updatedAt.
 */
export default function DocsSidebar({
  docs, docsOrder, activeDocId, onSelect, onNew, onExit, onDelete, onReorder,
  width, onResize, minWidth = 180, maxWidth = 420,
}) {
  // Compute the visible list:
  //   1) docs that appear in docsOrder, in that order
  //   2) any docs not in docsOrder (new since last reorder), by updatedAt desc
  const orderedEntries = useMemo(() => {
    const all = Object.entries(docs || {});
    const byId = new Map(all);
    const seen = new Set();
    const inOrder = [];
    for (const id of (docsOrder || [])) {
      if (byId.has(id)) {
        inOrder.push([id, byId.get(id)]);
        seen.add(id);
      }
    }
    const orphans = all.filter(([id]) => !seen.has(id))
      .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
    return [...inOrder, ...orphans];
  }, [docs, docsOrder]);

  // Drag-drop state — which id is being dragged, and which target+position
  // is currently hovered (so we can draw a drop indicator).
  const [draggingId, setDraggingId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // { id, position: 'before'|'after' }

  // Resize handle behavior (unchanged) ──────────────────────────────────
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

  // Drag handlers — native HTML5 drag and drop ──────────────────────────
  const onDragStart = (id) => (e) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  };
  const onDragOver = (id) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Decide before/after based on mouse Y vs the row's midpoint
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY > midY ? 'after' : 'before';
    setDropTarget((prev) => (prev && prev.id === id && prev.position === position) ? prev : { id, position });
  };
  const onDragLeave = () => {
    // Don't clear too aggressively — the next row's dragover will replace it.
  };
  const onDrop = (id) => (e) => {
    e.preventDefault();
    const fromId = e.dataTransfer.getData('text/plain') || draggingId;
    if (fromId && fromId !== id && onReorder) {
      const pos = (dropTarget && dropTarget.id === id) ? dropTarget.position : 'before';
      onReorder(fromId, id, pos);
    }
    setDraggingId(null);
    setDropTarget(null);
  };
  const onDragEnd = () => { setDraggingId(null); setDropTarget(null); };

  return (
    <aside className="docs-sidebar" style={width ? { width } : undefined}>
      {onExit && (
        <button className="docs-exit-btn" onClick={onExit} title="Back to main site">
          &#9664; Back to Main
        </button>
      )}

      <div className="docs-sidebar-header">
        <span className="docs-sidebar-title">Docs</span>
        <button className="docs-new-btn" onClick={onNew} title="New doc">+ New</button>
      </div>

      <ul className="docs-list">
        {orderedEntries.length === 0 && (
          <li className="docs-empty">No docs yet — start one.</li>
        )}
        {orderedEntries.map(([docId, doc]) => {
          const title = (doc && doc.title) || 'Untitled';
          const updatedAt = doc && doc.updatedAt;
          const isDragging = draggingId === docId;
          const dropBefore = dropTarget && dropTarget.id === docId && dropTarget.position === 'before';
          const dropAfter  = dropTarget && dropTarget.id === docId && dropTarget.position === 'after';
          return (
            <li
              key={docId}
              className={`docs-list-item${docId === activeDocId ? ' active' : ''}${isDragging ? ' dragging' : ''}${dropBefore ? ' drop-before' : ''}${dropAfter ? ' drop-after' : ''}`}
              draggable
              onDragStart={onDragStart(docId)}
              onDragOver={onDragOver(docId)}
              onDragLeave={onDragLeave}
              onDrop={onDrop(docId)}
              onDragEnd={onDragEnd}
              onClick={() => onSelect(docId)}
            >
              <div className="docs-list-title">{title}</div>
              {updatedAt && (
                <div className="docs-list-meta">{formatRelativeDate(updatedAt)}</div>
              )}
              <button
                className="docs-list-del"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete "${title}"? This cannot be undone.`)) {
                    onDelete(docId);
                  }
                }}
              >&times;</button>
            </li>
          );
        })}
      </ul>

      {onResize && (
        <div
          className="docs-sidebar-resize"
          onMouseDown={onResizeMouseDown}
          title="Drag to resize"
        />
      )}
    </aside>
  );
}

function formatRelativeDate(ts) {
  const now = Date.now();
  const diff = now - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}
