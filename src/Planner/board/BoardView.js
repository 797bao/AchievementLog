import React, { useMemo } from 'react';
import KanbanBoard from './KanbanBoard';
import {
  getAllLeaves,
  getLeaves,
  getProgress,
  getTotalTime,
  getLoggedTime,
  formatTime,
  findTask,
  findSystemForTask,
  findParentName,
  getTaskExpectedTime,
  getTaskLoggedTime,
  monthKey,
  monthLabel,
} from '../plannerHelpers';

export default function BoardView({
  milestone,
  isSprintOverview,
  currentBoardId,
  currentBoardPath,
  boardMonth,
  mk,
  taskOrder,
  onCloseBoard,
  onChangeSidebarMonth,
  onStatusChange,
  onUpdateTaskOrder,
  onOpenModal,
  onDeleteTask,
  onCreateTaskInSystem,
}) {
  const isActive = isSprintOverview || !!currentBoardId;

  const sprintData = useMemo(() => {
    if (!isSprintOverview) return null;
    const allLeaves = getAllLeaves(milestone);
    const filtered = allLeaves.filter((l) => l.sprint === mk);
    const done = filtered.filter((l) => l.status === 'done').length;
    let timeEst = 0;
    let timeLogged = 0;
    filtered.forEach((l) => {
      timeEst += getTaskExpectedTime(l);
      timeLogged += getTaskLoggedTime(l);
    });
    return { filtered, count: filtered.length, done, timeEst: formatTime(timeEst), timeLogged: formatTime(timeLogged) };
  }, [isSprintOverview, milestone, mk]);

  const systemData = useMemo(() => {
    if (!currentBoardId) return null;
    const node = findTask(currentBoardId, milestone);
    if (!node) return null;
    const allLeaves = getLeaves(node);
    const prog = getProgress(node);
    const expectedT = getTotalTime(node);
    const loggedT = getLoggedTime(node);
    return { node, allLeaves, prog, expectedT: formatTime(expectedT), loggedT: formatTime(loggedT) };
  }, [currentBoardId, milestone]);

  const boardKey = isSprintOverview
    ? `sprint_${milestone.id}_${mk}`
    : `sys_${currentBoardId}`;

  const getSystemName = (tid) => {
    const sys = findSystemForTask(tid, milestone);
    return sys ? sys.name : '';
  };

  const getParentNameForTask = (tid) => {
    if (!currentBoardId) return '';
    const node = findTask(currentBoardId, milestone);
    if (!node) return '';
    return findParentName(tid, node) || '';
  };

  const handleNewTask = () => {
    if (onOpenModal) {
      onOpenModal({
        type: 'new-task-in-system',
        title: 'New Task',
        targetId: currentBoardId,
        fields: [
          { key: 'name', label: 'Name', type: 'text', value: '', placeholder: 'Task name' },
          { key: 'description', label: 'Description', type: 'textarea', value: '' },
          { key: 'time', label: 'Expected Time', type: 'text', value: '', placeholder: 'e.g. 2h, 30m' },
          { key: 'type', label: 'Icon Type', type: 'icon-select', value: 'script' },
          { key: 'status', label: 'Status', type: 'status-select', value: 'planned' },
        ],
      });
    }
  };

  if (!isActive) return null;

  return (
    <div className={`board-view${isActive ? ' active' : ''}`}>
      {isSprintOverview && sprintData && (
        <>
          <div className="board-header">
            <button className="board-back" onClick={onCloseBoard}>&#9664; Map</button>
            <div>
              <div className="board-title">Sprint: {monthLabel(boardMonth.year, boardMonth.month)}</div>
              <div className="board-subtitle">{milestone.name}</div>
            </div>
          </div>
          <div className="board-stats">
            <span className="val">{sprintData.count}</span> assigned &middot;{' '}
            <span className="val">{sprintData.done}</span> completed &middot;{' '}
            <span className="val">{sprintData.timeLogged}</span> / {sprintData.timeEst}
          </div>
          <div className="board-month-nav">
            <button className="bm-btn" onClick={() => onChangeSidebarMonth(-1)}>&#9664;</button>
            <div className="bm-label">{monthLabel(boardMonth.year, boardMonth.month)}</div>
            <button className="bm-btn" onClick={() => onChangeSidebarMonth(1)}>&#9654;</button>
          </div>
          <KanbanBoard
            items={sprintData.filtered} showSystem={true}
            boardKey={boardKey} taskOrder={taskOrder}
            onStatusChange={onStatusChange} onUpdateTaskOrder={onUpdateTaskOrder}
            getSystemName={getSystemName} getParentName={() => ''}
            onOpenModal={onOpenModal} onDeleteTask={onDeleteTask}
          />
        </>
      )}

      {currentBoardId && systemData && (
        <>
          <div className="board-header">
            <button className="board-back" onClick={onCloseBoard}>&#9664; Map</button>
            <div className="board-title">{currentBoardPath}</div>
            <button className="board-new-task-btn" onClick={handleNewTask}>+ New Task</button>
          </div>
          <div className="board-stats">
            <span className="val">{systemData.prog.done}/{systemData.prog.total}</span> tasks &middot;{' '}
            <span className="val">{systemData.prog.pct}%</span> &middot;{' '}
            <span className="val">{systemData.loggedT}</span>/{systemData.expectedT}
          </div>
          <KanbanBoard
            items={systemData.allLeaves} showSystem={false}
            boardKey={boardKey} taskOrder={taskOrder}
            onStatusChange={onStatusChange} onUpdateTaskOrder={onUpdateTaskOrder}
            getSystemName={() => ''} getParentName={getParentNameForTask}
            onOpenModal={onOpenModal} onDeleteTask={onDeleteTask}
          />
        </>
      )}
    </div>
  );
}
