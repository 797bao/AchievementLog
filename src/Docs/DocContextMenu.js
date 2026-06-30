import React, { useEffect, useRef } from 'react';

/**
 * Floating context menu shown on right-click when text is selected in the
 * editor. Positioned at the cursor; closes on outside click / Escape /
 * action.
 *
 * Designed to replace the persistent toolbar — keeps the writing area clean
 * and only surfaces formatting commands when they're actually wanted.
 */
export default function DocContextMenu({ editor, x, y, onClose }) {
  const rootRef = useRef(null);

  // Close on outside click or Esc.
  useEffect(() => {
    const onDocDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (!editor) return null;

  // Clamp position to viewport so the menu never falls off-screen.
  const MENU_W = 220;
  const MENU_H = 380; // generous estimate
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(margin, Math.min(x, vw - MENU_W - margin));
  const top = Math.max(margin, Math.min(y, vh - MENU_H - margin));

  // Helpers: every action runs through this so the menu auto-closes after.
  const run = (fn) => {
    fn();
    onClose();
  };

  const Item = ({ active, onClick, children, kbd }) => (
    <button
      type="button"
      className={`doc-ctx-item${active ? ' active' : ''}`}
      onClick={onClick}
    >
      <span className="doc-ctx-item-label">{children}</span>
      {kbd && <span className="doc-ctx-item-kbd">{kbd}</span>}
    </button>
  );

  const Sep = () => <div className="doc-ctx-sep" />;
  const SectionTitle = ({ children }) => (
    <div className="doc-ctx-section">{children}</div>
  );

  // Active-state helpers
  const isBold = editor.isActive('bold');
  const isItalic = editor.isActive('italic');
  const isCode = editor.isActive('code');
  const isStrike = editor.isActive('strike');
  const isH1 = editor.isActive('heading', { level: 1 });
  const isH2 = editor.isActive('heading', { level: 2 });
  const isH3 = editor.isActive('heading', { level: 3 });
  const isCodeBlock = editor.isActive('codeBlock');
  const isQuote = editor.isActive('blockquote');
  const isLink = editor.isActive('link');
  const curFontSize = editor.getAttributes('textStyle').fontSize || null;

  return (
    <div
      ref={rootRef}
      className="doc-context-menu"
      style={{ left, top, width: MENU_W }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <SectionTitle>Format</SectionTitle>
      <div className="doc-ctx-inline-row">
        <button className={`doc-ctx-inline${isBold ? ' active' : ''}`}
          onClick={() => run(() => editor.chain().focus().toggleBold().run())} title="Bold (Ctrl+B)"><strong>B</strong></button>
        <button className={`doc-ctx-inline${isItalic ? ' active' : ''}`}
          onClick={() => run(() => editor.chain().focus().toggleItalic().run())} title="Italic (Ctrl+I)"><em>I</em></button>
        <button className={`doc-ctx-inline${isCode ? ' active' : ''}`}
          onClick={() => run(() => editor.chain().focus().toggleCode().run())} title="Inline code">&lt;/&gt;</button>
        <button className={`doc-ctx-inline${isStrike ? ' active' : ''}`}
          onClick={() => run(() => editor.chain().focus().toggleStrike().run())} title="Strikethrough"><s>S</s></button>
      </div>

      <Sep />
      <SectionTitle>Turn into</SectionTitle>
      <Item active={!isH1 && !isH2 && !isH3 && !isCodeBlock && !isQuote}
        onClick={() => run(() => editor.chain().focus().setParagraph().run())}>Paragraph</Item>
      <Item active={isH1}
        onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}>Heading 1</Item>
      <Item active={isH2}
        onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}>Heading 2</Item>
      <Item active={isH3}
        onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}>Heading 3</Item>
      <Item active={isCodeBlock}
        onClick={() => run(() => editor.chain().focus().toggleCodeBlock().run())}>Code block</Item>
      <Item active={isQuote}
        onClick={() => run(() => editor.chain().focus().toggleBlockquote().run())}>Quote</Item>

      <Sep />
      <SectionTitle>Font size</SectionTitle>
      <Item active={!curFontSize}
        onClick={() => run(() => editor.chain().focus().unsetFontSize().run())}>Normal</Item>
      <Item active={curFontSize === '13px'}
        onClick={() => run(() => editor.chain().focus().setFontSize('13px').run())}>Small</Item>
      <Item active={curFontSize === '20px'}
        onClick={() => run(() => editor.chain().focus().setFontSize('20px').run())}>Large</Item>
      <Item active={curFontSize === '24px'}
        onClick={() => run(() => editor.chain().focus().setFontSize('24px').run())}>Extra Large</Item>

      <Sep />
      <Item active={isLink}
        onClick={() => {
          const prev = editor.getAttributes('link').href;
          const url = window.prompt('URL', prev || 'https://');
          if (url === null) { onClose(); return; }
          if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
          } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          }
          onClose();
        }}>{isLink ? 'Edit link' : 'Add link'}</Item>
    </div>
  );
}
