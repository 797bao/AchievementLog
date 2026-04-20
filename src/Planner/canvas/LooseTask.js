import React from 'react';
import { iconFor } from '../plannerHelpers';

export default function LooseTask({ task }) {
  const isDone = task.status === 'done';

  return (
    <div
      className="canvas-node loose-task"
      data-task-id={task.id}
      style={{ left: task.x, top: task.y }}
    >
      <img className="task-icon" src={iconFor(task.type)} alt={task.type} />
      <span className={`task-name${isDone ? ' done' : ''}`}>{task.name}</span>
    </div>
  );
}
