import React, { useMemo } from 'react';
import KanbanBoard from './KanbanBoard';
import { MONTH_NAMES } from '../plannerData';
import {
  getAllLeaves,
  getLeaves,
  getProgress,
  getTotalTime,
  getDoneTime,
  formatTime,
  findTask,
  findSystemForTask,
  findParentName,
  parseTime,
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
  onAssign,
  onUnassign,
}) {
  const isActive = isSprintOverview || !!currentBoardId;

  // Sprint board data
  const sprintData = useMemo(() => {
    if (!isSprintOverview) return null;
    const allLeaves = getAllLeaves(milestone);
    const filtered = allLeaves.filter((l) => l.sprint === mk);
    const done = filtered.filter((l) => l.status === 'done').length;
    let timeEst = 0;
    filtered.forEach((l) => { timeEst += parseTime(l.time); });
    return { filtered, count: filtered.length, done, timeEst: formatTime(timeEst) };
  }, [isSprintOverview, milestone, mk]);

  // System board data
  const systemData = useMemo(() => {
    if (!currentBoardId) return null;
    const node = findTask(currentBoardId, milestone);
    if (!node) return null;
    const allLeaves = getLeaves(node);
    const prog = getProgress(node);
    const totalT = getTotalTime(node);
    const doneT = getDoneTime(node);
    return { node, allLeaves, prog, totalT: formatTime(totalT), doneT: formatTime(doneT) };
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

  if (!isActive) return null;

  return (
    <div className={`board-view${isActive ? ' active' : ''}`}>
      {isSprintOverview && sprintData && (
        <>
          <div className="board-header">
            <button className="board-back" onClick={onCloseBoard}>
              &#9664; Map
            </button>
            <div>
              <div className="board-title">
                Sprint: {monthLabel(boardMonth.year, boardMonth.month)}
              </div>
              <div className="board-subtitle">{milestone.name}</div>
            </div>
          </div>
          <div className="board-stats">
            <span className="val">{sprintData.count}</span> assigned &middot;{' '}
            <span className="val">{sprintData.done}</span> completed &middot;{' '}
            <span className="val">{sprintData.timeEst}</span> est.
          </div>
          <div className="board-month-nav">
            <button className="bm-btn" onClick={() => onChangeSidebarMonth(-1)}>
              &#9664;
            </button>
            <div className="bm-label">
              {monthLabel(boardMonth.year, boardMonth.month)}
            </div>
            <button className="bm-btn" onClick={() => onChangeSidebarMonth(1)}>
              &#9654;
            </button>
          </div>
          <KanbanBoard
            items={sprintData.filtered}
            showSystem={true}
            mk={mk}
            boardMonth={boardMonth}
            boardKey={boardKey}
            taskOrder={taskOrder}
            onStatusChange={onStatusChange}
            onUpdateTaskOrder={onUpdateTaskOrder}
            onAssign={onAssign}
            onUnassign={onUnassign}
            getSystemName={getSystemName}
            getParentName={() => ''}
          />
        </>
      )}

      {currentBoardId && systemData && (
        <>
          <div className="board-header">
            <button className="board-back" onClick={onCloseBoard}>
              &#9664; Map
            </button>
            <div className="board-title">{currentBoardPath}</div>
          </div>
          <div className="board-stats">
            <span className="val">{systemData.prog.done}/{systemData.prog.total}</span> tasks &middot;{' '}
            <span className="val">{systemData.prog.pct}%</span> &middot;{' '}
            <span className="val">{systemData.doneT}</span>/{systemData.totalT}
          </div>
          <KanbanBoard
            items={systemData.allLeaves}
            showSystem={false}
            mk={mk}
            boardMonth={boardMonth}
            boardKey={boardKey}
            taskOrder={taskOrder}
            onStatusChange={onStatusChange}
            onUpdateTaskOrder={onUpdateTaskOrder}
            onAssign={onAssign}
            onUnassign={onUnassign}
            getSystemName={() => ''}
            getParentName={getParentNameForTask}
          />
        </>
      )}
    </div>
  );
}
