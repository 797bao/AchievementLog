import React from 'react';
import SystemBox from './SystemBox';
import ResizeHandle from './ResizeHandle';

export default function LooseSystem({ system, selected }) {
  return (
    <div
      className={`canvas-node loose-system${selected ? ' selected' : ''}`}
      data-sys-id={system.id}
      style={{ left: system.x, top: system.y, width: system.w || 280, height: system.h || undefined }}
    >
      <SystemBox system={system} />
      <ResizeHandle directions={['l', 'r', 't', 'b', 'tl', 'tr', 'bl', 'rb']} />
    </div>
  );
}
