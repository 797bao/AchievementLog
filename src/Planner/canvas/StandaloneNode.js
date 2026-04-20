import React from 'react';
import SystemBox from './SystemBox';
import ResizeHandle from './ResizeHandle';

export default function StandaloneNode({ frame }) {
  const sys = frame.systems[0];
  if (!sys) return null;

  return (
    <div
      className="canvas-node standalone-node"
      data-frame-id={frame.id}
      data-sys-id={sys.id}
      style={{ left: frame.x, top: frame.y, width: frame.w || 300 }}
    >
      <SystemBox system={sys} />
      <ResizeHandle directions={['r', 'b', 'rb']} />
    </div>
  );
}
