import React from 'react';
import { getAllLeaves, getProgressColor, monthLabel } from './plannerHelpers';

export default function PlannerSidebar({
  milestones,
  activeMilestoneIdx,
  boardMonth,
  sprintStats,
  isSprintOverview,
  msCollapsed,
  onSwitchMilestone,
  onChangeSidebarMonth,
  onOpenSprintOverview,
  onToggleMilestones,
}) {
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
            <span>Time est.</span>
            <span className="sval">{sprintStats.timeEst}</span>
          </div>
        </div>
        <button
          className={`sprint-board-btn${isSprintOverview ? ' active' : ''}`}
          onClick={onOpenSprintOverview}
        >
          {isSprintOverview ? '\u2713 Sprint Board Open' : 'Open Sprint Board'}
        </button>
      </div>

      {/* Milestones section */}
      <div className="sb-section">
        <div className="ms-header" onClick={onToggleMilestones}>
          <span className={`ms-toggle${msCollapsed ? ' collapsed' : ''}`}>&#9660;</span>
          <div className="sb-section-title" style={{ margin: 0 }}>
            Milestones
          </div>
        </div>
        <div className={`ms-list${msCollapsed ? ' collapsed' : ''}`}>
          {milestones.map((m, idx) => {
            const leaves = getAllLeaves(m);
            const done = leaves.filter((l) => l.status === 'done').length;
            const pct = leaves.length > 0 ? Math.round((done / leaves.length) * 100) : 0;
            const isActive = idx === activeMilestoneIdx;

            return (
              <div
                key={m.id}
                className={`ms-item${isActive ? ' active' : ''}`}
                onClick={() => onSwitchMilestone(idx)}
              >
                <div className="ms-item-info">
                  <div className="ms-item-name">
                    MS{idx + 1}: {m.name.replace(/Milestone \d+: /, '')}
                  </div>
                  <div className="ms-item-bar">
                    <div
                      className="ms-item-fill"
                      style={{ width: `${pct}%`, background: getProgressColor(pct) }}
                    />
                  </div>
                </div>
                <div className="ms-item-pct">{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
