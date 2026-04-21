import React, { useMemo, useState } from 'react';
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
  wasLoggedToday,
  passesTodayFilter,
  sumTodayMinutes,
} from '../plannerHelpers';

export default function BoardView({
  milestone,
  milestones,
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
  // "Today Only" filter state (sprint view only)
  const [todayOnly, setTodayOnly] = useState(false);

  // Sprint overview spans ALL milestones — sprint is a global, time-based concept
  const sprintData = useMemo(() => {
    if (!isSprintOverview) return null;
    const sourceMilestones = milestones || [milestone];
    let allLeaves = [];
    sourceMilestones.forEach((m) => { allLeaves = allLeaves.concat(getAllLeaves(m)); });
    const sprintLeaves = allLeaves.filter((l) => l.sprint === mk);
    const filtered = todayOnly ? sprintLeaves.filter(passesTodayFilter) : sprintLeaves;

    const done = filtered.filter((l) => l.status === 'done').length;
    let timeEst = 0;
    let timeLogged = 0;
    filtered.forEach((l) => {
      timeEst += getTaskExpectedTime(l);
      timeLogged += getTaskLoggedTime(l);
    });
    const todayMins = sumTodayMinutes(sprintLeaves);
    return {
      filtered,
      count: filtered.length,
      done,
      timeEst: formatTime(timeEst),
      timeLogged: formatTime(timeLogged),
      todayMins,
    };
  }, [isSprintOverview, milestone, milestones, mk, todayOnly]);

  const systemData = useMemo(() => {
    if (!currentBoardId) return null;

    // Try as system/node first
    const node = findTask(currentBoardId, milestone);
    if (node) {
      const rawLeaves = getLeaves(node);
      const allLeaves = todayOnly ? rawLeaves.filter(passesTodayFilter) : rawLeaves;
      // Recompute progress/time from the visible set so the header reflects the filter
      const done = allLeaves.filter((l) => l.status === 'done').length;
      const total = allLeaves.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      let expectedT = 0, loggedT = 0;
      allLeaves.forEach((l) => { expectedT += getTaskExpectedTime(l); loggedT += getTaskLoggedTime(l); });
      const todayMins = sumTodayMinutes(rawLeaves);
      return { node, allLeaves, prog: { done, total, pct }, expectedT: formatTime(expectedT), loggedT: formatTime(loggedT), rawExpected: expectedT, rawLogged: loggedT, isFrame: false, todayMins };
    }

    // Try as frame
    const frame = milestone.frames.find((f) => f.id === currentBoardId);
    if (frame) {
      let rawLeaves = [];
      frame.systems.forEach((sys) => { rawLeaves = rawLeaves.concat(getLeaves(sys)); });
      (frame.tasks || []).forEach((t) => rawLeaves.push(t));
      const allLeaves = todayOnly ? rawLeaves.filter(passesTodayFilter) : rawLeaves;
      const done = allLeaves.filter((l) => l.status === 'done').length;
      const total = allLeaves.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      let expectedT = 0, loggedT = 0;
      allLeaves.forEach((l) => { expectedT += getTaskExpectedTime(l); loggedT += getTaskLoggedTime(l); });
      const todayMins = sumTodayMinutes(rawLeaves);
      return { node: null, frame, allLeaves, prog: { done, total, pct }, expectedT: formatTime(expectedT), loggedT: formatTime(loggedT), rawExpected: expectedT, rawLogged: loggedT, isFrame: true, todayMins };
    }

    return null;
  }, [currentBoardId, milestone, todayOnly]);

  const boardKey = isSprintOverview
    ? `sprint_all_${mk}`
    : `sys_${currentBoardId}`;

  const getSystemName = (tid) => {
    // Search active milestone first, then fall back to all milestones (sprint view spans all)
    let sys = findSystemForTask(tid, milestone);
    if (!sys && milestones) {
      for (const m of milestones) {
        sys = findSystemForTask(tid, m);
        if (sys) break;
      }
    }
    return sys ? sys.name : '';
  };

  const getParentNameForTask = (tid) => {
    if (!currentBoardId) return '';
    const node = findTask(currentBoardId, milestone);
    if (!node) return '';
    return findParentName(tid, node) || '';
  };

  const handleTitleClick = () => {
    if (!onOpenModal || !systemData) return;
    if (systemData.isFrame) {
      onOpenModal({
        type: 'rename-frame',
        title: 'Rename Frame',
        targetId: currentBoardId,
        fields: [{ key: 'label', label: 'Label', type: 'text', value: systemData.frame?.label || '' }],
      });
    } else {
      onOpenModal({
        type: 'rename-system',
        title: 'Rename System',
        targetId: currentBoardId,
        fields: [{ key: 'name', label: 'Name', type: 'text', value: systemData.node?.name || '' }],
      });
    }
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
            <div className="board-filter-group">
              <button
                className={`board-filter-btn${todayOnly ? ' active' : ''}`}
                onClick={() => setTodayOnly((v) => !v)}
                title="Show only tasks with a log entry from today (+ unstarted tasks)"
              >
                &#128197; Today Only
              </button>
              <span className="board-filter-today-total" title="Total time logged today for this view">
                Today: <span className="val">{formatTime(sprintData.todayMins)}</span>
              </span>
            </div>
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
            <div className="board-title board-title-editable" onClick={handleTitleClick} title="Click to rename">
              {systemData.isFrame ? (systemData.frame?.label || 'Frame') : (systemData.node?.name || currentBoardPath)}
            </div>
            <button className="board-new-task-btn" onClick={handleNewTask}>+ New Task</button>
          </div>
          <div className="board-stats">
            <span className="val">{systemData.prog.done}/{systemData.prog.total}</span> tasks &middot;{' '}
            <span className="val">{systemData.prog.pct}%</span> &middot;{' '}
            <span className={`val${systemData.rawLogged > systemData.rawExpected && systemData.rawExpected > 0 ? ' time-over' : ''}`}>{systemData.loggedT}</span>/{systemData.expectedT}
          </div>
          <div className="board-filter-row">
            <div className="board-filter-group">
              <button
                className={`board-filter-btn${todayOnly ? ' active' : ''}`}
                onClick={() => setTodayOnly((v) => !v)}
                title="Show only tasks with a log entry from today (+ unstarted tasks)"
              >
                &#128197; Today Only
              </button>
              <span className="board-filter-today-total" title="Total time logged today for this view">
                Today: <span className="val">{formatTime(systemData.todayMins)}</span>
              </span>
            </div>
          </div>
          <KanbanBoard
            items={systemData.allLeaves} showSystem={!!systemData.isFrame}
            boardKey={boardKey} taskOrder={taskOrder}
            onStatusChange={onStatusChange} onUpdateTaskOrder={onUpdateTaskOrder}
            getSystemName={getSystemName} getParentName={systemData.isFrame ? () => '' : getParentNameForTask}
            onOpenModal={onOpenModal} onDeleteTask={onDeleteTask}
          />
        </>
      )}
    </div>
  );
}
