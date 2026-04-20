import React from 'react';
import { MONTH_NAMES, STATUS_COLORS } from '../plannerData';
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
  onOpenModal,
  onDeleteTask,
}) {
  const isAssigned = task.sprint === mk;

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onOpenModal) {
      onOpenModal({
        type: 'edit-task',
        title: 'Edit Task',
        targetId: task.id,
        fields: [
          { key: 'name', label: 'Name', type: 'text', value: task.name || '' },
          { key: 'time', label: 'Expected Time', type: 'text', value: task.time || '', placeholder: 'e.g. 2h, 30m' },
          { key: 'type', label: 'Icon Type', type: 'icon-select', value: task.type || 'script' },
          { key: 'status', label: 'Status', type: 'status-select', value: task.status || 'planned' },
        ],
      });
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDeleteTask) onDeleteTask(task.id);
  };

  return (
    <div
      className="kanban-card"
      draggable
      data-task-id={task.id}
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onContextMenu={handleContextMenu}
    >
      <div
        className="kanban-card-status-bar"
        style={{ backgroundColor: STATUS_COLORS[task.status] || STATUS_COLORS.planned }}
      />
      <div className="kanban-card-content">
        <div className="kanban-card-top">
          <img className="kanban-card-icon" src={iconFor(task.type)} alt={task.type} />
          <div className="kanban-card-name">{task.name}</div>
        </div>
        <div className="kanban-card-meta">
          {showSystem && systemName && (
            <span className="kanban-card-system">{systemName}</span>
          )}
          {parentName && <span className="kanban-card-parent">{parentName}</span>}
          {task.time && <span className="kanban-card-time">{task.time}</span>}
          {task.sprint && <span>{sprintShort(task.sprint)}</span>}
        </div>
        <div className="kanban-card-actions">
          {!isAssigned ? (
            <button className="assign-btn" onClick={(e) => { e.stopPropagation(); onAssign(task.id); }}>
              + {MONTH_NAMES[boardMonth.month]}
            </button>
          ) : (
            <button className="assign-btn assigned" onClick={(e) => { e.stopPropagation(); onUnassign(task.id); }}>
              &#10003; {MONTH_NAMES[boardMonth.month]}
            </button>
          )}
          <button className="assign-btn delete-btn" onClick={handleDelete} title="Delete task">
            &#128465;
          </button>
        </div>
      </div>
    </div>
  );
}
