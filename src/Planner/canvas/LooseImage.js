import React from 'react';

export default function LooseImage({ image, selected }) {
  const transform = [
    image.flipH ? 'scaleX(-1)' : '',
    image.flipV ? 'scaleY(-1)' : '',
  ].filter(Boolean).join(' ') || 'none';

  return (
    <div
      className={`planner-img-wrap planner-img-loose${selected ? ' selected' : ''}`}
      data-img-id={image.id}
      data-img-loose="1"
      style={{
        position: 'absolute',
        left: image.x,
        top: image.y,
        width: image.w,
        height: image.h,
        transform,
        transformOrigin: 'center center',
        zIndex: image.zIndex || 0,
        pointerEvents: 'auto',
      }}
    >
      <img
        src={image.url}
        alt=""
        className="planner-img"
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 4, pointerEvents: 'none' }}
      />
      <div className="pimg-resize" data-pimg-resize="1" />
    </div>
  );
}
