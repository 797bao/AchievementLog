import React from 'react';
import { iconFor } from '../plannerHelpers';
import { STATUS_COLORS } from '../plannerData';

export default function LooseTask({ task }) {
  const isDone = task.status === 'done';

  return (
    <div
      className="canvas-node loose-task"
      data-task-id={task.id}
      style={{ left: task.x, top: task.y }}
    >
      <div
        className="task-status-bar loose"
        style={{ backgroundColor: STATUS_COLORS[task.status] || STATUS_COLORS.planned }}
      />
      <img className="task-icon" src={iconFor(task.type)} alt={task.type} />
      <span className={`task-name${isDone ? ' done' : ''}`}>{task.name}</span>
      {task.time && <span className="task-time">{task.time}</span>}
    </div>
  );
}
