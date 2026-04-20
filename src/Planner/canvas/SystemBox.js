import React from 'react';
import SubGroup from './SubGroup';
import TaskItem from './TaskItem';
import {
  getProgress,
  getProgressColor,
  getProgressClass,
  getTotalTime,
  getLoggedTime,
  formatTime,
} from '../plannerHelpers';

export default function SystemBox({ system, depth = 0 }) {
  const prog = getProgress(system);
  const progClass = getProgressClass(prog.pct);
  const expectedT = getTotalTime(system);
  const loggedT = getLoggedTime(system);

  // Separate children into groups (isGroup) and loose tasks
  const groups = (system.children || []).filter((c) => c.isGroup);
  const loose = (system.children || []).filter((c) => !c.isGroup);

  // Custom header colors
  const headerStyle = {};
  if (system.headerBg) headerStyle.backgroundColor = system.headerBg;
  const nameStyle = {};
  if (system.headerText) nameStyle.color = system.headerText;

  // Prevent infinite recursion
  if (depth > 5) return <div className="system-box-overflow">Max nesting depth</div>;

  return (
    <div className={`system-box${prog.pct === 100 ? ' system-done' : ''}`} data-sys-id={system.id}>
      <div className="system-box-header" style={headerStyle}>
        <div className="system-box-name" style={nameStyle}>{system.name}</div>
        {expectedT > 0 && (
          <div className="system-box-time-pill">{formatTime(loggedT)}/{formatTime(expectedT)}</div>
        )}
        {prog.total > 0 && (
          <div className={`system-box-badge ${progClass}`}>
            {prog.done}/{prog.total}
          </div>
        )}
      </div>
      <div className="system-box-progress">
        <div
          className="system-box-progress-fill"
          style={{ width: `${prog.pct}%`, background: getProgressColor(prog.pct) }}
        />
      </div>
      <div className="system-box-body">
        {groups.map((g) => {
          // If this sub-group itself contains nested groups, render as SystemBox
          const hasNestedGroups = (g.children || []).some((c) => c.isGroup);
          return hasNestedGroups ? (
            <div key={g.id} className="nested-system-wrapper">
              <SystemBox system={g} depth={depth + 1} />
            </div>
          ) : (
            <SubGroup key={g.id} group={g} />
          );
        })}
        {loose.length > 0 && (
          <div className="loose-items">
            {loose.map((item) => (
              <TaskItem key={item.id} task={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
