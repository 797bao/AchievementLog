import React from 'react';
import TaskItem from './TaskItem';
import { getProgress, getProgressClass, getTotalTime, getLoggedTime, formatTime } from '../plannerHelpers';

export default function SubGroup({ group }) {
  const prog = getProgress(group);
  const progClass = getProgressClass(prog.pct);
  const expectedT = getTotalTime(group);
  const loggedT = getLoggedTime(group);

  return (
    <div className={`sub-group${prog.pct === 100 ? ' group-done' : ''}`} data-sys-id={group.id}>
      <div className="sub-group-header">
        <div className="sub-group-name">{group.name}</div>
        <span className="sub-group-time">{formatTime(loggedT)}/{formatTime(expectedT)}</span>
        <div className={`sub-group-badge ${progClass}`}>
          {prog.done}/{prog.total}
        </div>
      </div>
      <div className="sub-group-items">
        {(group.children || []).map((item) =>
          item.isGroup ? (
            <SubGroup key={item.id} group={item} />
          ) : (
            <TaskItem key={item.id} task={item} />
          )
        )}
      </div>
    </div>
  );
}
