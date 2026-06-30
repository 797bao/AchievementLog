import React, { useEffect } from 'react';

/**
 * Full-screen image viewer. Closes on Esc / click on the backdrop /
 * click on the × button. The Delete action removes the underlying image
 * node from the editor (the parent handles that via onDelete).
 */
export default function DocLightbox({ src, alt, onClose, onDelete }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="doc-lightbox" onClick={onClose}>
      <button
        className="doc-lightbox-close"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        title="Close (Esc)"
      >&times;</button>
      <button
        className="doc-lightbox-delete"
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm('Delete this image? You can undo with Ctrl+Z.')) {
            onDelete();
          }
        }}
        title="Delete image"
      >🗑 Delete</button>
      <img
        src={src}
        alt={alt || ''}
        className="doc-lightbox-img"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
