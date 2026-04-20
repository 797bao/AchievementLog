import React from 'react';
import SubGroup from './SubGroup';
import TaskItem from './TaskItem';
import {
  getProgress,
  getProgressColor,
  getProgressClass,
  getTotalTime,
  getDoneTime,
  formatTime,
} from '../plannerHelpers';

export default function SystemBox({ system }) {
  const prog = getProgress(system);
  const progClass = getProgressClass(prog.pct);
  const totalT = getTotalTime(system);
  const doneT = getDoneTime(system);

  const groups = (system.children || []).filter((c) => c.isGroup);
  const loose = (system.children || []).filter((c) => !c.isGroup);

  return (
    <div className="system-box" data-sys-id={system.id}>
      <div className="system-box-header">
        <div className="system-box-name">{system.name}</div>
        <div className={`system-box-badge ${progClass}`}>
          {prog.done}/{prog.total}
        </div>
      </div>
      <div className="system-box-progress">
        <div
          className="system-box-progress-fill"
          style={{ width: `${prog.pct}%`, background: getProgressColor(prog.pct) }}
        />
      </div>
      <div className="system-box-body">
        {groups.map((g) => (
          <SubGroup key={g.id} group={g} />
        ))}
        {loose.length > 0 && (
          <div className="loose-items">
            {loose.map((item) => (
              <TaskItem key={item.id} task={item} />
            ))}
          </div>
        )}
      </div>
      <div className="system-box-time">
        <span>{formatTime(doneT)} / {formatTime(totalT)}</span>
        <span>{prog.pct}%</span>
      </div>
    </div>
  );
}
