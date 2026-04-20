import React, { useState } from 'react';
import ColorPicker from './ColorPicker';
import { TYPE_ICON_FILES, STATUS_COLORS, STATUS_LABELS, STATUSES } from '../plannerData';
import { iconFor } from '../plannerHelpers';

/* ─── Canvas context menu (right-click on empty space) ─── */
function CanvasMenu({ onNewTask, onNewSystem, onNewFrame, onClose }) {
  const act = (fn) => { fn(); onClose(); };
  return (
    <>
      <div className="ctx-item" onClick={() => act(onNewTask)}>&#10010; New Task</div>
      <div className="ctx-sep" />
      <div className="ctx-item" onClick={() => act(onNewSystem)}>&#9744; New System</div>
      <div className="ctx-item" onClick={() => act(onNewFrame)}>&#9634; New Frame</div>
    </>
  );
}

/* ─── Task context menu ─── */
function TaskMenu({ targetId, targetData, onRenameTask, onChangeTaskIcon, onSetTaskTime, onUpdateTaskStatus, onClose }) {
  const [showIcons, setShowIcons] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  const handleRename = () => {
    const newName = window.prompt('Rename task:', targetData?.name || '');
    if (newName !== null && newName.trim()) {
      onRenameTask(targetId, newName.trim());
    }
    onClose();
  };

  const handleSetTime = () => {
    const newTime = window.prompt('Set expected time (e.g. 2h, 30m, 1.5h):', targetData?.time || '');
    if (newTime !== null) {
      onSetTaskTime(targetId, newTime.trim() || null);
    }
    onClose();
  };

  const handleIconSelect = (type) => {
    onChangeTaskIcon(targetId, type);
    onClose();
  };

  const handleStatusSelect = (status) => {
    onUpdateTaskStatus(targetId, status);
    onClose();
  };

  return (
    <>
      <div className="ctx-item" onClick={handleRename}>&#9998; Rename</div>
      <div className="ctx-item" onClick={() => setShowIcons(!showIcons)}>
        &#127912; Change Icon {showIcons ? '▾' : '▸'}
      </div>
      {showIcons && (
        <div className="ctx-icon-grid">
          {Object.entries(TYPE_ICON_FILES).map(([type, src]) => (
            <div
              key={type}
              className={`ctx-icon-item${targetData?.type === type ? ' active' : ''}`}
              onClick={() => handleIconSelect(type)}
              title={type}
            >
              <img src={src} alt={type} className="ctx-icon-img" />
              <span className="ctx-icon-label">{type}</span>
            </div>
          ))}
        </div>
      )}
      <div className="ctx-sep" />
      <div className="ctx-item" onClick={handleSetTime}>&#9201; Set Time</div>
      <div className="ctx-sep" />
      <div className="ctx-item" onClick={() => setShowStatus(!showStatus)}>
        &#9679; Status {showStatus ? '▾' : '▸'}
      </div>
      {showStatus && (
        <div className="ctx-status-list">
          {STATUSES.map((s) => (
            <div
              key={s}
              className={`ctx-status-item${targetData?.status === s ? ' active' : ''}`}
              onClick={() => handleStatusSelect(s)}
            >
              <div className="ctx-status-dot" style={{ background: STATUS_COLORS[s] }} />
              {STATUS_LABELS[s]}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ─── System context menu ─── */
function SystemMenu({ targetId, targetData, onRenameSystem, onCreateSubSystem, onUpdateSystemColors, onClose }) {
  const [showColors, setShowColors] = useState(false);
  const [headerBg, setHeaderBg] = useState(targetData?.headerBg || '#23262e');
  const [headerText, setHeaderText] = useState(targetData?.headerText || '#e8eaed');

  const handleRename = () => {
    const newName = window.prompt('Rename system:', targetData?.name || '');
    if (newName !== null && newName.trim()) {
      onRenameSystem(targetId, newName.trim());
    }
    onClose();
  };

  const handleAddSub = () => {
    onCreateSubSystem(targetId);
    onClose();
  };

  const handleBgChange = (color) => {
    setHeaderBg(color);
    onUpdateSystemColors(targetId, { headerBg: color });
  };

  const handleTextChange = (color) => {
    setHeaderText(color);
    onUpdateSystemColors(targetId, { headerText: color });
  };

  return (
    <>
      <div className="ctx-item" onClick={handleRename}>&#9998; Rename</div>
      <div className="ctx-item" onClick={handleAddSub}>&#10010; New Sub-System</div>
      <div className="ctx-sep" />
      <div className="ctx-item" onClick={() => setShowColors(!showColors)}>
        &#127912; Edit Colors {showColors ? '▾' : '▸'}
      </div>
      {showColors && (
        <div className="ctx-color-panel">
          <ColorPicker
            label="Header Background"
            value={headerBg}
            onChange={handleBgChange}
          />
          <div className="ctx-color-spacer" />
          <ColorPicker
            label="Header Text"
            value={headerText}
            onChange={handleTextChange}
          />
        </div>
      )}
    </>
  );
}

/* ─── Main ContextMenu component ─── */
export default function ContextMenu({
  x, y, type = 'canvas', targetId, targetData,
  // Canvas actions
  onNewTask, onNewSystem, onNewFrame,
  // Task actions
  onRenameTask, onChangeTaskIcon, onSetTaskTime, onUpdateTaskStatus,
  // System actions
  onRenameSystem, onCreateSubSystem, onUpdateSystemColors,
  // Common
  onClose,
}) {
  return (
    <div className="context-menu" style={{ left: x, top: y }}>
      {type === 'canvas' && (
        <CanvasMenu
          onNewTask={onNewTask}
          onNewSystem={onNewSystem}
          onNewFrame={onNewFrame}
          onClose={onClose}
        />
      )}
      {type === 'task' && (
        <TaskMenu
          targetId={targetId}
          targetData={targetData}
          onRenameTask={onRenameTask}
          onChangeTaskIcon={onChangeTaskIcon}
          onSetTaskTime={onSetTaskTime}
          onUpdateTaskStatus={onUpdateTaskStatus}
          onClose={onClose}
        />
      )}
      {type === 'system' && (
        <SystemMenu
          targetId={targetId}
          targetData={targetData}
          onRenameSystem={onRenameSystem}
          onCreateSubSystem={onCreateSubSystem}
          onUpdateSystemColors={onUpdateSystemColors}
          onClose={onClose}
        />
      )}
    </div>
  );
}
