import React from 'react';
import { getProgress, getProgressColor } from '../plannerHelpers';

export default function StandaloneNode({ frame }) {
  const sys = frame.systems[0];
  const prog = getProgress(sys);

  return (
    <div
      className="canvas-node standalone-node"
      data-frame-id={frame.id}
      data-sys-id={sys.id}
      style={{ left: frame.x, top: frame.y, width: frame.w || 300 }}
    >
      <div className="root-name">{sys.name}</div>
      <div className="root-progress-bar">
        <div
          className="root-progress-fill"
          style={{ width: `${prog.pct}%`, background: getProgressColor(prog.pct) }}
        />
      </div>
      <div className="root-pct">
        {prog.done}/{prog.total} &middot; {prog.pct}%
      </div>
    </div>
  );
}
