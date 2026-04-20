import React from 'react';
import SystemBox from './SystemBox';
import ResizeHandle from './ResizeHandle';
import { getFrameTotalTime, formatTime } from '../plannerHelpers';

export default function CanvasFrame({ frame }) {
  const totalT = getFrameTotalTime(frame);

  return (
    <div
      className="canvas-node canvas-frame"
      data-frame-id={frame.id}
      style={{ left: frame.x, top: frame.y, width: frame.w || 600 }}
    >
      <div className="frame-drag-bar">
        <span className="frame-label">{frame.label || ''}</span>
        {totalT > 0 && <span className="frame-time">{formatTime(totalT)}</span>}
      </div>
      <div className="frame-body">
        {frame.systems.map((sys) => (
          <SystemBox key={sys.id} system={sys} />
        ))}
      </div>
      {frame.note && <div className="frame-note">{frame.note}</div>}
      <ResizeHandle directions={['r', 'b', 'rb']} />
    </div>
  );
}
