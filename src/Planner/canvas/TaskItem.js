import React from 'react';
import { iconFor, sprintShort } from '../plannerHelpers';

export default function TaskItem({ task }) {
  const isDone = task.status === 'done';

  return (
    <div className="task-item" data-task-id={task.id}>
      <img className="task-icon" src={iconFor(task.type)} alt={task.type} />
      <div className={`task-name${isDone ? ' done' : ''}`}>{task.name}</div>
      {task.sprint && <span className="task-sprint">{sprintShort(task.sprint)}</span>}
    </div>
  );
}
