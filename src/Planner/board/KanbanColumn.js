import React from 'react';
import { STATUS_LABELS } from '../plannerData';
import { getTaskLoggedTime, formatTime } from '../plannerHelpers';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({
  status,
  items,
  showSystem,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  getSystemName,
  getParentName,
  onOpenModal,
  onDeleteTask,
}) {
  const headerClass = status === 'progress' ? 'kh-progress' : `kh-${status}`;

  // Total minutes logged on tasks currently in this column
  const totalLoggedMins = items.reduce((sum, t) => sum + getTaskLoggedTime(t), 0);

  return (
    <div className="kanban-col">
      <div
        className={`kanban-col-header ${headerClass}`}
        title={totalLoggedMins > 0 ? `Total time logged: ${formatTime(totalLoggedMins)}` : undefined}
      >
        {STATUS_LABELS[status]} {items.length}
        {totalLoggedMins > 0 && (
          <span className="kanban-col-time"> &middot; {formatTime(totalLoggedMins)}</span>
        )}
      </div>
      <div
        className="kanban-cards"
        data-status={status}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, status)}
      >
        {items.length === 0 && <div className="kanban-empty">No tasks</div>}
        {items.map((item) => (
          <KanbanCard
            key={item.id}
            task={item}
            systemName={getSystemName ? getSystemName(item.id) : ''}
            parentName={getParentName ? getParentName(item.id) : ''}
            showSystem={showSystem}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onOpenModal={onOpenModal}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>
    </div>
  );
}
