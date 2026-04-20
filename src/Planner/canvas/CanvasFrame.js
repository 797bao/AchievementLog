import React from 'react';
import SystemBox from './SystemBox';
import ResizeHandle from './ResizeHandle';
import { getFrameTotalTime, getFrameLoggedTime, formatTime } from '../plannerHelpers';

export default function CanvasFrame({ frame }) {
  const totalT = getFrameTotalTime(frame);
  const loggedT = getFrameLoggedTime(frame);
  const showTime = totalT > 0 || loggedT > 0;

  return (
    <div
      className="canvas-node canvas-frame"
      data-frame-id={frame.id}
      style={{ left: frame.x, top: frame.y, width: frame.w || 600 }}
    >
      <div className="frame-drag-bar">
        <span className="frame-label">{frame.label || ''}</span>
        {showTime && <span className="frame-time">{formatTime(loggedT)} / {formatTime(totalT)}</span>}
      </div>
      <div className="frame-body">
        {frame.systems.map((sys) => (
          <SystemBox key={sys.id} system={sys} resizable />
        ))}
      </div>
      {/* frame.note removed */}
      <ResizeHandle directions={['r', 'b', 'rb']} />
    </div>
  );
}
