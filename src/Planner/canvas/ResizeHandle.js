import React from 'react';

export default function ResizeHandle({ directions = ['r', 'b', 'rb'] }) {
  return (
    <>
      {directions.map((dir) => (
        <div
          key={dir}
          className={`resize-handle resize-${dir}`}
          data-resize={dir}
        />
      ))}
    </>
  );
}
