import React, { useState } from 'react';
import ColorPicker from './ColorPicker';
import { STATUS_COLORS, STATUS_LABELS, STATUSES } from '../plannerData';

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
function TaskMenu({ targetId, targetData, onOpenModal, onUpdateTaskStatus, onDeleteTask, onStartArrow, onClose }) {
  const [showStatus, setShowStatus] = useState(false);

  const handleEdit = () => {
    onOpenModal({
      type: 'edit-task',
      title: 'Edit Task',
      targetId,
      fields: [
        { key: 'name', label: 'Name', type: 'text', value: targetData?.name || '' },
        { key: 'time', label: 'Expected Time', type: 'text', value: targetData?.time || '', placeholder: 'e.g. 2h, 30m' },
        { key: 'type', label: 'Icon Type', type: 'icon-select', value: targetData?.type || 'script' },
        { key: 'status', label: 'Status', type: 'status-select', value: targetData?.status || 'planned' },
      ],
    });
    onClose();
  };

  const handleStatusSelect = (status) => {
    onUpdateTaskStatus(targetId, status);
    onClose();
  };

  const handleArrow = () => {
    onStartArrow(targetId);
    onClose();
  };

  const handleDelete = () => {
    onDeleteTask(targetId);
    onClose();
  };

  return (
    <>
      <div className="ctx-item" onClick={handleEdit}>&#9998; Edit Task</div>
      <div className="ctx-sep" />
      <div className="ctx-item" onClick={() => setShowStatus(!showStatus)}>
        &#9679; Status {showStatus ? '\u25BE' : '\u25B8'}
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
      <div className="ctx-sep" />
      <div className="ctx-item" onClick={handleArrow}>&#10140; Draw Arrow</div>
      <div className="ctx-sep" />
      <div className="ctx-item ctx-danger" onClick={handleDelete}>&#128465; Delete</div>
    </>
  );
}

/* ─── System context menu ─── */
function SystemMenu({ targetId, targetData, onOpenModal, onCreateSubSystem, onUpdateSystemColors, onDeleteSystem, onStartArrow, onClose }) {
  const [showColors, setShowColors] = useState(false);
  const [headerBg, setHeaderBg] = useState(targetData?.headerBg || '#23262e');
  const [headerText, setHeaderText] = useState(targetData?.headerText || '#e8eaed');

  const handleRename = () => {
    onOpenModal({
      type: 'rename-system',
      title: 'Rename System',
      targetId,
      fields: [{ key: 'name', label: 'Name', type: 'text', value: targetData?.name || '' }],
    });
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

  const handleArrow = () => {
    onStartArrow(targetId);
    onClose();
  };

  const handleDelete = () => {
    onDeleteSystem(targetId);
    onClose();
  };

  return (
    <>
      <div className="ctx-item" onClick={handleRename}>&#9998; Rename</div>
      <div className="ctx-item" onClick={handleAddSub}>&#10010; New Sub-System</div>
      <div className="ctx-sep" />
      <div className="ctx-item" onClick={() => setShowColors(!showColors)}>
        &#127912; Edit Colors {showColors ? '\u25BE' : '\u25B8'}
      </div>
      {showColors && (
        <div className="ctx-color-panel">
          <ColorPicker label="Header Background" value={headerBg} defaultValue="" onChange={handleBgChange} />
          <div className="ctx-color-spacer" />
          <ColorPicker label="Header Text" value={headerText} defaultValue="" onChange={handleTextChange} />
        </div>
      )}
      <div className="ctx-sep" />
      <div className="ctx-item" onClick={handleArrow}>&#10140; Draw Arrow</div>
      <div className="ctx-sep" />
      <div className="ctx-item ctx-danger" onClick={handleDelete}>&#128465; Delete</div>
    </>
  );
}

/* ─── Frame context menu ─── */
function FrameMenu({ targetId, targetData, onOpenModal, onDeleteFrame, onStartArrow, onClose }) {
  const handleRename = () => {
    onOpenModal({
      type: 'rename-frame',
      title: 'Rename Frame',
      targetId,
      fields: [{ key: 'label', label: 'Label', type: 'text', value: targetData?.label || '' }],
    });
    onClose();
  };

  const handleArrow = () => {
    onStartArrow(targetId);
    onClose();
  };

  const handleDelete = () => {
    onDeleteFrame(targetId);
    onClose();
  };

  return (
    <>
      <div className="ctx-item" onClick={handleRename}>&#9998; Rename</div>
      <div className="ctx-sep" />
      <div className="ctx-item" onClick={handleArrow}>&#10140; Draw Arrow</div>
      <div className="ctx-sep" />
      <div className="ctx-item ctx-danger" onClick={handleDelete}>&#128465; Delete</div>
    </>
  );
}

/* ─── Main ContextMenu component ─── */
export default function ContextMenu({
  x, y, type = 'canvas', targetId, targetData,
  onNewTask, onNewSystem, onNewFrame,
  onOpenModal,
  onUpdateTaskStatus,
  onCreateSubSystem, onUpdateSystemColors,
  onDeleteTask, onDeleteSystem, onDeleteFrame,
  onStartArrow,
  onClose,
}) {
  return (
    <div className="context-menu" style={{ left: x, top: y }}>
      {type === 'canvas' && (
        <CanvasMenu onNewTask={onNewTask} onNewSystem={onNewSystem} onNewFrame={onNewFrame} onClose={onClose} />
      )}
      {type === 'task' && (
        <TaskMenu
          targetId={targetId} targetData={targetData}
          onOpenModal={onOpenModal} onUpdateTaskStatus={onUpdateTaskStatus}
          onDeleteTask={onDeleteTask} onStartArrow={onStartArrow} onClose={onClose}
        />
      )}
      {type === 'system' && (
        <SystemMenu
          targetId={targetId} targetData={targetData}
          onOpenModal={onOpenModal} onCreateSubSystem={onCreateSubSystem}
          onUpdateSystemColors={onUpdateSystemColors} onDeleteSystem={onDeleteSystem}
          onStartArrow={onStartArrow} onClose={onClose}
        />
      )}
      {type === 'frame' && (
        <FrameMenu
          targetId={targetId} targetData={targetData}
          onOpenModal={onOpenModal} onDeleteFrame={onDeleteFrame}
          onStartArrow={onStartArrow} onClose={onClose}
        />
      )}
    </div>
  );
}
