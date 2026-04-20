import React from 'react';
import TaskItem from './TaskItem';
import ResizeHandle from './ResizeHandle';
import { getProgress, getProgressClass, getTotalTime, getLoggedTime, formatTime } from '../plannerHelpers';

export default function SubGroup({ group }) {
  const prog = getProgress(group);
  const progClass = getProgressClass(prog.pct);
  const expectedT = getTotalTime(group);
  const loggedT = getLoggedTime(group);

  const style = {};
  if (group.w) { style.width = group.w; style.flex = 'none'; }
  if (group.h) { style.height = group.h; }

  return (
    <div className={`sub-group resizable-node${prog.pct === 100 ? ' group-done' : ''}`} data-sys-id={group.id} style={style}>
      <div className="sub-group-header">
        <div className="sub-group-name">{group.name}</div>
        <span className={`sub-group-time${loggedT > expectedT && expectedT > 0 ? ' time-over' : ''}`}>{formatTime(loggedT)}/{formatTime(expectedT)}</span>
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
      <ResizeHandle directions={['r', 'b', 'rb']} />
    </div>
  );
}
