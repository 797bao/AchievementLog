import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  passesDateRangeFilter,
  sumMinutesInRange,
  sumTodayMinutes,
  todayDateStr,
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
  globalDayRequest, // {date: 'YYYY-MM-DD', ts: number} — Planner uses this to pop us into Global view scoped to one day
}) {
  // ── Filter / view-mode state ──
  // Date range filter (default: today → today, disabled). When enabled, applies
  // the visibility rule from passesDateRangeFilter to whatever set is on screen.
  const [filterEnabled, setFilterEnabled] = useState(false);
  const [filterStart, setFilterStart] = useState(() => todayDateStr());
  const [filterEnd, setFilterEnd] = useState(() => todayDateStr());
  // Global view mode — when true, the kanban shows ALL leaf tasks across every
  // milestone (regardless of which board the user is "in"), still subject to
  // the date-range filter.
  const [globalView, setGlobalView] = useState(false);

  // External "open Global view scoped to date" requests (e.g. from Metrics).
  const lastReqRef = useRef(null);
  useEffect(() => {
    if (!globalDayRequest) return;
    if (globalDayRequest === lastReqRef.current) return;
    lastReqRef.current = globalDayRequest;
    setGlobalView(true);
    setFilterEnabled(true);
    setFilterStart(globalDayRequest.date);
    setFilterEnd(globalDayRequest.date);
  }, [globalDayRequest]);

  // Including globalView lets BoardView render even when no underlying
  // sprint/system board is active — needed for the metrics drill-in.
  const isActive = isSprintOverview || !!currentBoardId || globalView;

  // Helper: apply current date filter to a list of leaves
  const applyFilter = (leaves) =>
    filterEnabled ? leaves.filter((l) => passesDateRangeFilter(l, filterStart, filterEnd)) : leaves;

  // Sprint overview spans ALL milestones — sprint is a global, time-based concept
  const sprintData = useMemo(() => {
    if (!isSprintOverview) return null;
    const sourceMilestones = milestones || [milestone];
    let allLeaves = [];
    sourceMilestones.forEach((m) => { allLeaves = allLeaves.concat(getAllLeaves(m)); });
    const sprintLeaves = allLeaves.filter((l) => l.sprint === mk);
    const filtered = filterEnabled ? sprintLeaves.filter((l) => passesDateRangeFilter(l, filterStart, filterEnd)) : sprintLeaves;

    const done = filtered.filter((l) => l.status === 'done').length;
    let timeEst = 0;
    let timeLogged = 0;
    filtered.forEach((l) => {
      timeEst += getTaskExpectedTime(l);
      timeLogged += getTaskLoggedTime(l);
    });
    const todayMins = sumTodayMinutes(sprintLeaves);
    const rangeMins = filterEnabled ? sumMinutesInRange(sprintLeaves, filterStart, filterEnd) : todayMins;
    return {
      filtered,
      count: filtered.length,
      done,
      timeEst: formatTime(timeEst),
      timeLogged: formatTime(timeLogged),
      todayMins,
      rangeMins,
    };
  }, [isSprintOverview, milestone, milestones, mk, filterEnabled, filterStart, filterEnd]);

  // Global data: all leaves across every milestone, optionally date-filtered.
  const globalData = useMemo(() => {
    if (!globalView) return null;
    const sourceMilestones = milestones || [milestone];
    let allLeaves = [];
    sourceMilestones.forEach((m) => { allLeaves = allLeaves.concat(getAllLeaves(m)); });
    const filtered = filterEnabled ? allLeaves.filter((l) => passesDateRangeFilter(l, filterStart, filterEnd)) : allLeaves;
    const done = filtered.filter((l) => l.status === 'done').length;
    const total = filtered.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    let expectedT = 0, loggedT = 0;
    filtered.forEach((l) => { expectedT += getTaskExpectedTime(l); loggedT += getTaskLoggedTime(l); });
    const todayMins = sumTodayMinutes(allLeaves);
    const rangeMins = filterEnabled ? sumMinutesInRange(allLeaves, filterStart, filterEnd) : todayMins;
    return {
      filtered, count: total, done, prog: { done, total, pct },
      expectedT: formatTime(expectedT), loggedT: formatTime(loggedT),
      rawExpected: expectedT, rawLogged: loggedT,
      todayMins, rangeMins,
    };
  }, [globalView, milestone, milestones, filterEnabled, filterStart, filterEnd]);

  const systemData = useMemo(() => {
    if (!currentBoardId) return null;

    const buildData = (rawLeaves, extras) => {
      const allLeaves = applyFilter(rawLeaves);
      const done = allLeaves.filter((l) => l.status === 'done').length;
      const total = allLeaves.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      let expectedT = 0, loggedT = 0;
      allLeaves.forEach((l) => { expectedT += getTaskExpectedTime(l); loggedT += getTaskLoggedTime(l); });
      const todayMins = sumTodayMinutes(rawLeaves);
      const rangeMins = filterEnabled ? sumMinutesInRange(rawLeaves, filterStart, filterEnd) : todayMins;
      return {
        allLeaves,
        prog: { done, total, pct },
        expectedT: formatTime(expectedT),
        loggedT: formatTime(loggedT),
        rawExpected: expectedT,
        rawLogged: loggedT,
        todayMins,
        rangeMins,
        ...extras,
      };
    };

    const node = findTask(currentBoardId, milestone);
    if (node) return buildData(getLeaves(node), { node, isFrame: false });

    const frame = milestone.frames.find((f) => f.id === currentBoardId);
    if (frame) {
      let rawLeaves = [];
      frame.systems.forEach((sys) => { rawLeaves = rawLeaves.concat(getLeaves(sys)); });
      (frame.tasks || []).forEach((t) => rawLeaves.push(t));
      return buildData(rawLeaves, { node: null, frame, isFrame: true });
    }
    return null;
  }, [currentBoardId, milestone, filterEnabled, filterStart, filterEnd]);

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

  // Shared filter / view-mode bar — reused across sprint, system/frame, and global views.
  const FilterBar = ({ todayMins, rangeMins }) => (
    <div className="board-filter-row">
      <div className="board-filter-group board-filter-range">
        <label className="board-filter-label">From</label>
        <input
          type="date"
          className="tl-date board-filter-date"
          value={filterStart}
          onChange={(e) => { setFilterStart(e.target.value); if (!filterEnabled) setFilterEnabled(true); }}
        />
        <label className="board-filter-label">To</label>
        <input
          type="date"
          className="tl-date board-filter-date"
          value={filterEnd}
          onChange={(e) => { setFilterEnd(e.target.value); if (!filterEnabled) setFilterEnabled(true); }}
        />
        <button
          className={`board-filter-btn${filterEnabled ? ' active' : ''}`}
          onClick={() => setFilterEnabled((v) => !v)}
          title="Toggle date-range filter"
        >
          {filterEnabled ? 'Filter ON' : 'Filter OFF'}
        </button>
        <button
          className="board-filter-btn"
          onClick={() => { const t = todayDateStr(); setFilterStart(t); setFilterEnd(t); setFilterEnabled(true); }}
          title="Set range to today"
        >
          Today
        </button>
        <button
          className={`board-filter-btn${globalView ? ' active' : ''}`}
          onClick={() => setGlobalView((v) => !v)}
          title="Toggle global view (all tasks across every milestone)"
        >
          &#127760; {globalView ? 'Global ON' : 'Global'}
        </button>
        <span className="board-filter-today-total" title="Time logged in the current range (or today, if filter is off)">
          {filterEnabled ? 'Range' : 'Today'}: <span className="val">{formatTime(filterEnabled ? rangeMins : todayMins)}</span>
        </span>
      </div>
    </div>
  );

  // ── GLOBAL VIEW ── takes priority over the underlying board.
  if (globalView && globalData) {
    return (
      <div className={`board-view${isActive ? ' active' : ''}`}>
        <div className="board-header">
          <button className="board-back" onClick={() => { setGlobalView(false); onCloseBoard(); }}>&#9664; Map</button>
          <div className="board-title">&#127760; Global</div>
          <div style={{ width: 100 }} />
        </div>
        <div className="board-stats">
          <span className="val">{globalData.prog.done}/{globalData.prog.total}</span> tasks &middot;{' '}
          <span className="val">{globalData.prog.pct}%</span> &middot;{' '}
          <span className={`val${globalData.rawLogged > globalData.rawExpected && globalData.rawExpected > 0 ? ' time-over' : ''}`}>{globalData.loggedT}</span>/{globalData.expectedT}
        </div>
        <FilterBar todayMins={globalData.todayMins} rangeMins={globalData.rangeMins} />
        <KanbanBoard
          items={globalData.filtered} showSystem={true}
          boardKey={`global_${filterEnabled ? filterStart + '_' + filterEnd : 'all'}`} taskOrder={taskOrder}
          onStatusChange={onStatusChange} onUpdateTaskOrder={onUpdateTaskOrder}
          getSystemName={getSystemName} getParentName={() => ''}
          onOpenModal={onOpenModal} onDeleteTask={onDeleteTask}
        />
      </div>
    );
  }

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
          <FilterBar todayMins={sprintData.todayMins} rangeMins={sprintData.rangeMins} />
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
          <FilterBar todayMins={systemData.todayMins} rangeMins={systemData.rangeMins} />
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
