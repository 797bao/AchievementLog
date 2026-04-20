import React from 'react';
import SystemBox from './SystemBox';
import ResizeHandle from './ResizeHandle';

export default function LooseSystem({ system }) {
  return (
    <div
      className="canvas-node loose-system"
      data-sys-id={system.id}
      style={{ left: system.x, top: system.y, width: system.w || 280 }}
    >
      <SystemBox system={system} />
      <ResizeHandle directions={['r', 'b']} />
    </div>
  );
}
