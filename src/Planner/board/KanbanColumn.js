import React from 'react';
import { STATUS_LABELS } from '../plannerData';
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

  return (
    <div className="kanban-col">
      <div className={`kanban-col-header ${headerClass}`}>
        {STATUS_LABELS[status]} {items.length}
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
