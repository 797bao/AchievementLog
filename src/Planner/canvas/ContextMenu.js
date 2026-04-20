import React from 'react';

export default function ContextMenu({ x, y, onNewTask, onNewSystem, onNewFrame, onClose }) {
  const handleClick = (action) => {
    action();
    onClose();
  };

  return (
    <div className="context-menu" style={{ left: x, top: y }}>
      <div className="ctx-item" onClick={() => handleClick(onNewTask)}>
        &#10010; New Task
      </div>
      <div className="ctx-sep" />
      <div className="ctx-item" onClick={() => handleClick(onNewSystem)}>
        &#9744; New System
      </div>
      <div className="ctx-item" onClick={() => handleClick(onNewFrame)}>
        &#9634; New Frame
      </div>
    </div>
  );
}
