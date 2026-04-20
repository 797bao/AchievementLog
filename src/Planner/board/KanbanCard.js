import React from 'react';
import { STATUS_COLORS } from '../plannerData';
import { iconFor, sprintShort, getTaskExpectedTime, getTaskLoggedTime, formatTime } from '../plannerHelpers';

export default function KanbanCard({
  task,
  systemName,
  parentName,
  showSystem,
  onDragStart,
  onDragEnd,
  onOpenModal,
  onDeleteTask,
}) {
  const expectedMins = getTaskExpectedTime(task);
  const loggedMins = getTaskLoggedTime(task);
  const statusCls = 'status-' + (task.status || 'planned');

  const openEdit = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (onOpenModal) {
      onOpenModal({
        type: 'edit-task',
        targetId: task.id,
        fields: [
          { key: 'name', label: 'Name', type: 'text', value: task.name || '' },
          { key: 'description', label: 'Description', type: 'textarea', value: task.description || '' },
          { key: 'sprint', label: 'Sprint', type: 'sprint-select', value: task.sprint || '' },
          { key: 'type', label: 'Icon Type', type: 'icon-select', value: task.type || 'script' },
          { key: 'time', label: 'Expected Time', type: 'text', value: task.time || '', placeholder: 'e.g. 2h, 30m' },
          { key: 'timeLogs', label: 'Time Logs', type: 'time-logs', value: task.timeLogs || [] },
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
      className={`kanban-card${task.status === 'done' ? ' kanban-card-done' : ''}`}
      draggable
      data-task-id={task.id}
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={openEdit}
      onContextMenu={openEdit}
    >
      <div
        className="kanban-card-status-bar"
        style={{ backgroundColor: STATUS_COLORS[task.status] || STATUS_COLORS.planned }}
      />
      <div className="kanban-card-content">
        <div className="kanban-card-top">
          <img className="kanban-card-icon" src={iconFor(task.type)} alt={task.type} />
          <div className="kanban-card-name">{task.name}</div>
          <div className="kanban-card-btns">
            <button className="kc-btn" onClick={openEdit} title="Edit">&#9998;</button>
            <button className="kc-btn kc-del" onClick={handleDelete} title="Delete">&#128465;</button>
          </div>
        </div>
        {task.description && (
          <div className="kanban-card-desc">{task.description}</div>
        )}
        <div className="kanban-card-meta">
          {showSystem && systemName && (
            <span className="kanban-card-system">{systemName}</span>
          )}
          {parentName && <span className="kanban-card-parent">{parentName}</span>}
          {expectedMins > 0 && (
            <span className={`kanban-card-time ${statusCls}`}>
              {formatTime(loggedMins)}/{formatTime(expectedMins)}
            </span>
          )}
          {task.sprint && <span className={`kanban-card-sprint ${statusCls}`}>{sprintShort(task.sprint)}</span>}
        </div>
      </div>
    </div>
  );
}
