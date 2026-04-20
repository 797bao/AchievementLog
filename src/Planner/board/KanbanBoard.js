import React from 'react';
import { STATUSES } from '../plannerData';
import KanbanColumn from './KanbanColumn';
import useKanbanDragDrop from '../hooks/useKanbanDragDrop';

export default function KanbanBoard({
  items,
  showSystem,
  boardKey,
  taskOrder,
  onStatusChange,
  onUpdateTaskOrder,
  getSystemName,
  getParentName,
  onOpenModal,
  onDeleteTask,
}) {
  const { onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop } = useKanbanDragDrop({
    onStatusChange,
    boardKey,
    taskOrder,
    onUpdateTaskOrder,
    statuses: STATUSES,
  });

  const getItemsForStatus = (status) => {
    let filtered = items.filter((l) => (l.status || 'planned') === status);
    const orderKey = boardKey + '_' + status;
    if (taskOrder[orderKey]) {
      const ordered = [];
      taskOrder[orderKey].forEach((id) => {
        const found = filtered.find((i) => i.id === id);
        if (found) ordered.push(found);
      });
      filtered.forEach((i) => {
        if (!ordered.includes(i)) ordered.push(i);
      });
      filtered = ordered;
    }
    return filtered;
  };

  return (
    <div className="kanban">
      {STATUSES.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          items={getItemsForStatus(status)}
          showSystem={showSystem}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          getSystemName={getSystemName}
          getParentName={getParentName}
          onOpenModal={onOpenModal}
          onDeleteTask={onDeleteTask}
        />
      ))}
    </div>
  );
}
