import React, { useState, useEffect } from 'react';
import {
  getAllLeaves,
  getProgressColor,
  monthLabel,
  getMilestoneTotalTime,
  getMilestoneLoggedTime,
  formatTime,
} from './plannerHelpers';

export default function PlannerSidebar({
  milestones,
  activeMilestoneIdx,
  boardMonth,
  sprintStats,
  isSprintOverview,
  isMetricsView,
  msCollapsed,
  onSwitchMilestone,
  onChangeSidebarMonth,
  onOpenSprintOverview,
  onOpenMetrics,
  onToggleMilestones,
  onCreateMilestone,
  onRenameMilestone,
  onDeleteMilestone,
  onMoveMilestone,
}) {
  const [msCtxMenu, setMsCtxMenu] = useState(null);

  // Close milestone context menu on outside click
  useEffect(() => {
    if (!msCtxMenu) return;
    const handler = () => setMsCtxMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [msCtxMenu]);

  return (
    <div className="planner-sidebar">
      {/* Sprint section */}
      <div className="sb-section">
        <div className="sb-section-title">Sprint</div>
        <div className="sprint-nav">
          <button className="sprint-nav-btn" onClick={() => onChangeSidebarMonth(-1)}>
            &#9664;
          </button>
          <div className="sprint-label">
            {monthLabel(boardMonth.year, boardMonth.month)}
          </div>
          <button className="sprint-nav-btn" onClick={() => onChangeSidebarMonth(1)}>
            &#9654;
          </button>
        </div>
        <div className="sprint-stats-box">
          <div className="sprint-stat-row">
            <span>Assigned</span>
            <span className="sval">{sprintStats.assigned}</span>
          </div>
          <div className="sprint-stat-row">
            <span>Completed</span>
            <span className="sval">{sprintStats.completed}</span>
          </div>
          <div className="sprint-stat-row">
            <span>In Progress</span>
            <span className="sval">{sprintStats.inProgress}</span>
          </div>
          <div className="sprint-stat-row">
            <span>Time</span>
            <span className="sval">{sprintStats.timeLogged} / {sprintStats.timeEst}</span>
          </div>
        </div>
        <button
          className={`sprint-board-btn${isSprintOverview ? ' active' : ''}`}
          onClick={onOpenSprintOverview}
        >
          {isSprintOverview ? '\u2713 Sprint Board Open' : 'Open Sprint Board'}
        </button>
      </div>

      {/* Metrics section */}
      <div className="sb-section">
        <button
          className={`sprint-board-btn metrics-btn${isMetricsView ? ' active' : ''}`}
          onClick={onOpenMetrics}
        >
          {isMetricsView ? '\u2713 Metrics Open' : '\u2630 Metrics'}
        </button>
      </div>

      {/* Milestones section */}
      <div className="sb-section">
        <div className="ms-header" onClick={onToggleMilestones}>
          <span className={`ms-toggle${msCollapsed ? ' collapsed' : ''}`}>&#9660;</span>
          <div className="sb-section-title" style={{ margin: 0, flex: 1 }}>
            Milestones
          </div>
          <button
            className="ms-add-btn"
            onClick={(e) => { e.stopPropagation(); onCreateMilestone(); }}
            title="New Milestone"
          >
            +
          </button>
        </div>
        <div className={`ms-list${msCollapsed ? ' collapsed' : ''}`}>
          {milestones.map((m, idx) => {
            const leaves = getAllLeaves(m);
            const done = leaves.filter((l) => l.status === 'done').length;
            const pct = leaves.length > 0 ? Math.round((done / leaves.length) * 100) : 0;
            const isActive = idx === activeMilestoneIdx;
            const totalT = getMilestoneTotalTime(m);
            const loggedT = getMilestoneLoggedTime(m);

            return (
              <div
                key={m.id}
                className={`ms-item${isActive ? ' active' : ''}`}
                onClick={() => onSwitchMilestone(idx)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMsCtxMenu({ msId: m.id, msName: m.name, x: e.clientX, y: e.clientY });
                }}
              >
                <div className="ms-item-info">
                  <div className="ms-item-name">
                    {m.name}
                  </div>
                  <div className="ms-item-bar">
                    <div
                      className="ms-item-fill"
                      style={{ width: `${pct}%`, background: getProgressColor(pct) }}
                    />
                  </div>
                  {totalT > 0 && (
                    <div className="ms-item-time">
                      {formatTime(loggedT)} / {formatTime(totalT)}
                    </div>
                  )}
                </div>
                <div className="ms-item-pct">{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Milestone context menu */}
      {msCtxMenu && (
        <div
          className="ms-ctx-menu"
          style={{ left: msCtxMenu.x, top: msCtxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="ms-ctx-item"
            onClick={() => {
              onMoveMilestone(msCtxMenu.msId, -1);
              setMsCtxMenu(null);
            }}
          >
            &#9650; Move Up
          </div>
          <div
            className="ms-ctx-item"
            onClick={() => {
              onMoveMilestone(msCtxMenu.msId, 1);
              setMsCtxMenu(null);
            }}
          >
            &#9660; Move Down
          </div>
          <div
            className="ms-ctx-item"
            onClick={() => {
              onRenameMilestone(msCtxMenu.msId, msCtxMenu.msName);
              setMsCtxMenu(null);
            }}
          >
            &#9998; Rename
          </div>
          {milestones.length > 1 && (
            <div
              className="ms-ctx-item ms-ctx-danger"
              onClick={() => {
                onDeleteMilestone(msCtxMenu.msId, msCtxMenu.msName);
                setMsCtxMenu(null);
              }}
            >
              &#128465; Delete
            </div>
          )}
        </div>
      )}
    </div>
  );
}
