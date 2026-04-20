import React from 'react';
import { iconFor, getTaskExpectedTime, getTaskLoggedTime, formatTime } from '../plannerHelpers';
import { STATUS_COLORS } from '../plannerData';

export default function LooseTask({ task }) {
  const isDone = task.status === 'done';
  const expectedMins = getTaskExpectedTime(task);
  const loggedMins = getTaskLoggedTime(task);
  const statusCls = 'status-' + (task.status || 'planned');

  return (
    <div
      className={`canvas-node loose-task${isDone ? ' task-done' : ''}`}
      data-task-id={task.id}
      style={{ left: task.x, top: task.y }}
    >
      <div
        className="task-status-bar loose"
        style={{ backgroundColor: STATUS_COLORS[task.status] || STATUS_COLORS.planned }}
      />
      <img className="task-icon" src={iconFor(task.type)} alt={task.type} />
      <span className={`task-name${isDone ? ' done' : ''}`}>{task.name}</span>
      {expectedMins > 0 && (
        <span className={`task-time ${statusCls}`}>
          {loggedMins > 0 ? `${formatTime(loggedMins)}/` : ''}{formatTime(expectedMins)}
        </span>
      )}
    </div>
  );
}
