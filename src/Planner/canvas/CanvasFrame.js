import React from 'react';
import SystemBox from './SystemBox';
import TaskItem from './TaskItem';
import ResizeHandle from './ResizeHandle';
import { getFrameTotalTime, getFrameLoggedTime, formatTime } from '../plannerHelpers';

export default function CanvasFrame({ frame }) {
  const totalT = getFrameTotalTime(frame);
  const loggedT = getFrameLoggedTime(frame);
  const showTime = totalT > 0 || loggedT > 0;
  const frameTasks = frame.tasks || [];

  return (
    <div
      className="canvas-node canvas-frame"
      data-frame-id={frame.id}
      style={{ left: frame.x, top: frame.y, width: frame.w || 600 }}
    >
      <div className="frame-drag-bar">
        <span className="frame-label">{frame.label || ''}</span>
        {showTime && <span className={`frame-time${loggedT > totalT && totalT > 0 ? ' time-over' : ''}`}>{formatTime(loggedT)} / {formatTime(totalT)}</span>}
      </div>
      <div className="frame-body">
        {frame.systems.map((sys) => (
          <SystemBox key={sys.id} system={sys} resizable />
        ))}
        {frameTasks.length > 0 && (
          <div className="frame-tasks">
            {frameTasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
      <ResizeHandle directions={['r', 'b', 'rb']} />
    </div>
  );
}
