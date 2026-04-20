import { useCallback } from 'react';

function getDragAfterElement(col, y) {
  const cards = Array.from(col.querySelectorAll('.kanban-card:not(.dragging)'));
  let closest = null;
  let closestOff = Number.NEGATIVE_INFINITY;
  cards.forEach((card) => {
    const box = card.getBoundingClientRect();
    const off = y - box.top - box.height / 2;
    if (off < 0 && off > closestOff) {
      closestOff = off;
      closest = card;
    }
  });
  return closest;
}

export default function useKanbanDragDrop({ onStatusChange, boardKey, taskOrder, onUpdateTaskOrder, statuses }) {
  const onDragStart = useCallback((e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
  }, []);

  const onDragEnd = useCallback((e) => {
    e.currentTarget.classList.remove('dragging');
    // Clear all drag-over highlights and indicators
    document.querySelectorAll('.drag-over').forEach((c) => c.classList.remove('drag-over'));
    document.querySelectorAll('.drop-indicator').forEach((d) => d.remove());
  }, []);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const col = e.currentTarget;
    col.classList.add('drag-over');

    // Remove existing indicators
    document.querySelectorAll('.drop-indicator').forEach((d) => d.remove());

    const after = getDragAfterElement(col, e.clientY);
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    if (after) {
      col.insertBefore(indicator, after);
    } else {
      col.appendChild(indicator);
    }
  }, []);

  const onDragLeave = useCallback((e) => {
    const col = e.currentTarget;
    if (!col.contains(e.relatedTarget)) {
      col.classList.remove('drag-over');
      col.querySelectorAll('.drop-indicator').forEach((d) => d.remove());
    }
  }, []);

  const onDrop = useCallback((e, newStatus) => {
    e.preventDefault();
    const col = e.currentTarget;
    col.classList.remove('drag-over');
    col.querySelectorAll('.drop-indicator').forEach((d) => d.remove());

    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId || !newStatus) return;

    // Update task status
    onStatusChange(taskId, newStatus);

    // Update card ordering
    const after = getDragAfterElement(col, e.clientY);
    const orderKey = boardKey + '_' + newStatus;
    const existing = col.querySelectorAll('.kanban-card:not(.dragging)');
    const newOrder = [];
    let inserted = false;

    existing.forEach((c) => {
      const cid = c.getAttribute('data-task-id');
      if (after && c === after && !inserted) {
        newOrder.push(taskId);
        inserted = true;
      }
      if (cid !== taskId) newOrder.push(cid);
    });
    if (!inserted) newOrder.push(taskId);

    onUpdateTaskOrder(orderKey, newOrder);

    // Clean up other columns' order
    statuses.forEach((s) => {
      if (s === newStatus) return;
      const ok = boardKey + '_' + s;
      if (taskOrder[ok]) {
        onUpdateTaskOrder(ok, taskOrder[ok].filter((id) => id !== taskId));
      }
    });
  }, [boardKey, taskOrder, onStatusChange, onUpdateTaskOrder, statuses]);

  return { onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop };
}
