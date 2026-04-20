import React from 'react';
import { MONTH_NAMES } from '../plannerData';
import { iconFor, sprintShort } from '../plannerHelpers';

export default function KanbanCard({
  task,
  systemName,
  parentName,
  showSystem,
  mk,
  boardMonth,
  onDragStart,
  onDragEnd,
  onAssign,
  onUnassign,
}) {
  const isAssigned = task.sprint === mk;

  return (
    <div
      className="kanban-card"
      draggable
      data-task-id={task.id}
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
    >
      <div className="kanban-card-top">
        <img className="kanban-card-icon" src={iconFor(task.type)} alt={task.type} />
        <div className="kanban-card-name">{task.name}</div>
      </div>
      <div className="kanban-card-meta">
        {showSystem && systemName && (
          <span className="kanban-card-system">{systemName}</span>
        )}
        {parentName && <span className="kanban-card-parent">{parentName}</span>}
        {task.time && <span>{task.time}</span>}
        {task.sprint && <span>{sprintShort(task.sprint)}</span>}
      </div>
      <div className="kanban-card-actions">
        {!isAssigned ? (
          <button
            className="assign-btn"
            onClick={(e) => { e.stopPropagation(); onAssign(task.id); }}
          >
            + {MONTH_NAMES[boardMonth.month]}
          </button>
        ) : (
          <button
            className="assign-btn assigned"
            onClick={(e) => { e.stopPropagation(); onUnassign(task.id); }}
          >
            &#10003; {MONTH_NAMES[boardMonth.month]}
          </button>
        )}
      </div>
    </div>
  );
}
