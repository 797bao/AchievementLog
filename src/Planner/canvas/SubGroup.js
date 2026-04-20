import React from 'react';
import TaskItem from './TaskItem';
import { getProgress, getProgressClass } from '../plannerHelpers';

export default function SubGroup({ group }) {
  const prog = getProgress(group);
  const progClass = getProgressClass(prog.pct);

  return (
    <div className="sub-group" data-sys-id={group.id}>
      <div className="sub-group-header">
        <div className="sub-group-name">{group.name}</div>
        <div className={`sub-group-badge ${progClass}`}>
          {prog.done}/{prog.total}
        </div>
      </div>
      <div className="sub-group-items">
        {(group.children || []).map((item) => (
          <TaskItem key={item.id} task={item} />
        ))}
      </div>
    </div>
  );
}
