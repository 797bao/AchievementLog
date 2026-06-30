import React, { useRef } from 'react';
import { NodeViewWrapper } from '@tiptap/react';

/**
 * Custom React NodeView for editor images. Wraps the <img> in a div that
 * shows a resize handle (bottom-right) and a small alignment toolbar
 * (top-right) on hover. The hover-only controls keep the surface clean
 * while reading, but everything's one hover away while editing.
 *
 * Resize → updates the node's `width` attribute (persisted in the doc).
 * Align  → updates the node's `align` attribute: null|left|center|right.
 *          Combined with width, the user can drag two images to ~50% each,
 *          set both to "left", and they'll sit side-by-side via float.
 */
export default function ImageNodeView({ node, updateAttributes }) {
  const imgRef = useRef(null);

  const startResize = (e) => {
    // Prevent the editor from interpreting this as a click on the image
    // (which would open the lightbox). stopPropagation handles that;
    // preventDefault keeps the browser from starting a text selection.
    e.preventDefault();
    e.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    const startX = e.clientX;
    const startW = img.offsetWidth;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const newW = Math.max(60, Math.round(startW + dx));
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
  const wrapClass = `doc-img-wrap${align ? ` doc-img-align-${align}` : ''}`;

  return (
    <NodeViewWrapper className={wrapClass} data-drag-handle>
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt || ''}
        style={width ? { width } : undefined}
        className="doc-img"
      />
      {/* Alignment toolbar — top-right, hover-revealed. contentEditable=false
          so ProseMirror treats the buttons as widget UI, not document text. */}
      <div className="doc-img-controls" contentEditable={false}>
        <button
          type="button"
          className={`doc-img-ctrl${!align ? ' active' : ''}`}
          onMouseDown={setAlign(null)}
          title="Block (default)"
        >▭</button>
        <button
          type="button"
          className={`doc-img-ctrl${align === 'left' ? ' active' : ''}`}
          onMouseDown={setAlign('left')}
          title="Float left (for side-by-side)"
        >◧</button>
        <button
          type="button"
          className={`doc-img-ctrl${align === 'center' ? ' active' : ''}`}
          onMouseDown={setAlign('center')}
          title="Center"
        >▣</button>
        <button
          type="button"
          className={`doc-img-ctrl${align === 'right' ? ' active' : ''}`}
          onMouseDown={setAlign('right')}
          title="Float right"
        >◨</button>
      </div>
      {/* Resize handle — bottom-right, hover-revealed. */}
      <div
        className="doc-img-resize"
        onMouseDown={startResize}
        contentEditable={false}
        title="Drag to resize"
      />
    </NodeViewWrapper>
  );
}
