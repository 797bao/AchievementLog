import React, { useRef } from 'react';
import { NodeViewWrapper } from '@tiptap/react';

/**
 * Custom React NodeView for editor videos. Renders a native <video controls>
 * element with the same hover-revealed alignment toolbar + resize handle as
 * the image view. Two side-by-side videos work the same way: drag both to
 * ~50% width, set both to "float left".
 */
export default function VideoNodeView({ node, updateAttributes }) {
  const vidRef = useRef(null);

  const startResize = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const v = vidRef.current;
    if (!v) return;
    const startX = e.clientX;
    const startW = v.offsetWidth;
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const newW = Math.max(120, Math.round(startW + dx));
      updateAttributes({ width: `${newW}px` });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
  };

  const setAlign = (next) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    updateAttributes({ align: next });
  };

  const align = node.attrs.align;
  const width = node.attrs.width;
  const wrapClass = `doc-vid-wrap${align ? ` doc-vid-align-${align}` : ''}`;

  return (
    <NodeViewWrapper className={wrapClass} data-drag-handle>
      <video
        ref={vidRef}
        src={node.attrs.src}
        controls
        preload="metadata"
        style={width ? { width } : undefined}
        className="doc-vid"
      />
      {/* Reuse the image controls' styling — same look, same behavior. */}
      <div className="doc-img-controls" contentEditable={false}>
        <button type="button" className={`doc-img-ctrl${!align ? ' active' : ''}`}
          onMouseDown={setAlign(null)} title="Block (default)">▭</button>
        <button type="button" className={`doc-img-ctrl${align === 'left' ? ' active' : ''}`}
          onMouseDown={setAlign('left')} title="Float left">◧</button>
        <button type="button" className={`doc-img-ctrl${align === 'center' ? ' active' : ''}`}
          onMouseDown={setAlign('center')} title="Center">▣</button>
        <button type="button" className={`doc-img-ctrl${align === 'right' ? ' active' : ''}`}
          onMouseDown={setAlign('right')} title="Float right">◨</button>
      </div>
      <div className="doc-img-resize" onMouseDown={startResize} contentEditable={false} title="Drag to resize" />
    </NodeViewWrapper>
  );
}
