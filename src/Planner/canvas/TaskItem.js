import React from 'react';
import { iconFor, sprintShort } from '../plannerHelpers';
import { STATUS_COLORS } from '../plannerData';

export default function TaskItem({ task }) {
  const isDone = task.status === 'done';

  return (
    <div className="task-item" data-task-id={task.id}>
      <div
        className="task-status-bar"
        style={{ backgroundColor: STATUS_COLORS[task.status] || STATUS_COLORS.planned }}
      />
      <img className="task-icon" src={iconFor(task.type)} alt={task.type} />
      <div className={`task-name${isDone ? ' done' : ''}`}>{task.name}</div>
      {task.time && <span className="task-time">{task.time}</span>}
      {task.sprint && <span className="task-sprint">{sprintShort(task.sprint)}</span>}
    </div>
  );
}
