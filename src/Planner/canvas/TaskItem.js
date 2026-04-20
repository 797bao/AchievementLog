import React from 'react';
import { iconFor, sprintShort, getTaskExpectedTime, getTaskLoggedTime, formatTime } from '../plannerHelpers';
import { STATUS_COLORS } from '../plannerData';

export default function TaskItem({ task }) {
  const isDone = task.status === 'done';
  const expectedMins = getTaskExpectedTime(task);
  const loggedMins = getTaskLoggedTime(task);
  const statusCls = 'status-' + (task.status || 'planned');

  return (
    <div className={`task-item${isDone ? ' task-done' : ''}`} data-task-id={task.id}>
      <div
        className="task-status-bar"
        style={{ backgroundColor: STATUS_COLORS[task.status] || STATUS_COLORS.planned }}
      />
      <img className="task-icon" src={iconFor(task.type)} alt={task.type} />
      <div className={`task-name ${statusCls}${isDone ? ' done' : ''}`}>{task.name}</div>
      {(expectedMins > 0 || loggedMins > 0) && (
        <span className={`task-time ${statusCls}${loggedMins > expectedMins && expectedMins > 0 ? ' time-over' : ''}`}>
          {loggedMins > 0 ? `${formatTime(loggedMins)}/` : ''}{formatTime(expectedMins)}
        </span>
      )}
      {task.sprint && <span className={`task-sprint ${statusCls}`}>{sprintShort(task.sprint)}</span>}
    </div>
  );
}
