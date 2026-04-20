import React from 'react';
import TaskItem from './TaskItem';
import { getProgress, getProgressClass, getTotalTime, formatTime } from '../plannerHelpers';

export default function SubGroup({ group }) {
  const prog = getProgress(group);
  const progClass = getProgressClass(prog.pct);
  const totalT = getTotalTime(group);

  return (
    <div className="sub-group" data-sys-id={group.id}>
      <div className="sub-group-header">
        <div className="sub-group-name">{group.name}</div>
        <span className="sub-group-time">{formatTime(totalT)}</span>
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
