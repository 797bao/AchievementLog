import React, { useState } from 'react';
import ColorPicker from './ColorPicker';
import { STATUS_COLORS, STATUS_LABELS, STATUSES } from '../plannerData';

/* ─── Canvas context menu (right-click on empty space) ─── */
function CanvasMenu({ onNewTask, onNewSystem, onNewFrame, onAddImage, canvasX, canvasY, onClose }) {
  const act = (fn) => { fn(); onClose(); };
  return (
    <>
      <div className="ctx-item" onClick={() => act(onNewTask)}>&#10010; New Task</div>
      <div className="ctx-sep" />
      <div className="ctx-item" onClick={() => act(onNewSystem)}>&#9744; New System</div>
      <div className="ctx-item" onClick={() => act(onNewFrame)}>&#9634; New Frame</div>
      <div className="ctx-sep" />
      <div className="ctx-item" onClick={() => { onAddImage(null, canvasX, canvasY); onClose(); }}>&#128247; Add Image</div>
    </>
  );
}

/* ─── Task context menu ─── */
function TaskMenu({ targetId, targetData, onOpenModal, onUpdateTaskStatus, onDeleteTask, onStartArrow, onClose }) {
  const [showStatus, setShowStatus] = useState(false);

  const handleEdit = () => {
    onOpenModal({
      type: 'edit-task',
      targetId,
      fields: [
        { key: 'name', label: 'Name', type: 'text', value: targetData?.name || '' },
        { key: 'description', label: 'Description', type: 'textarea', value: targetData?.description || '' },
        { key: 'sprint', label: 'Sprint', type: 'sprint-select', value: targetData?.sprint || '' },
        { key: 'type', label: 'Icon Type', type: 'icon-select', value: targetData?.type || 'script' },
        { key: 'time', label: 'Expected Time', type: 'text', value: targetData?.time || '', placeholder: 'e.g. 2h, 30m' },
        { key: 'timeLogs', label: 'Time Logs', type: 'time-logs', value: targetData?.timeLogs || [] },
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
function SystemMenu({ targetId, targetData, onOpenModal, onCreateSubSystem, onUpdateSystemColors, onDeleteSystem, onStartArrow, onAddImage, onClose }) {
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

  const handleAddImage = () => {
    if (onAddImage) onAddImage(targetId);
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
      <div className="ctx-item" onClick={handleAddImage}>&#128247; Add Image</div>
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

/* ─── Image context menu ─── */
function ImageMenu({ targetId, targetData, onUpdateImage, onUpdateLooseImage, onDeleteImage, onDeleteLooseImage, onMoveImageLayer, onDetachImage, canvasX, canvasY, onClose }) {
  const isLoose = !!targetData?.isLoose;
  const sysId = targetData?.sysId;
  const imgId = targetId;
  const priority = targetData?.zIndex || 0;

  const doUpdate = (updates) => {
    if (isLoose) onUpdateLooseImage(imgId, updates);
    else onUpdateImage(sysId, imgId, updates);
  };

  const handleFlipH = () => { doUpdate({ flipH: !targetData?.flipH }); onClose(); };
  const handleFlipV = () => { doUpdate({ flipV: !targetData?.flipV }); onClose(); };

  const handlePriorityUp = () => {
    doUpdate({ zIndex: priority + 1 });
    onClose();
  };
  const handlePriorityDown = () => {
    doUpdate({ zIndex: Math.max(0, priority - 1) });
    onClose();
  };

  const handleDetach = () => {
    if (sysId && onDetachImage) onDetachImage(sysId, imgId, canvasX || 100, canvasY || 100);
    onClose();
  };

  const handleDelete = () => {
    if (isLoose) onDeleteLooseImage(imgId);
    else onDeleteImage(sysId, imgId);
    onClose();
  };

  return (
    <>
      <div className="ctx-item ctx-info">Priority: {priority}</div>
      <div className="ctx-item" onClick={handlePriorityUp}>&#9650; Priority Up (higher = on top)</div>
      <div className="ctx-item" onClick={handlePriorityDown}>&#9660; Priority Down</div>
      <div className="ctx-sep" />
      <div className="ctx-item" onClick={handleFlipH}>&#8596; Flip Horizontal{targetData?.flipH ? ' \u2713' : ''}</div>
      <div className="ctx-item" onClick={handleFlipV}>&#8597; Flip Vertical{targetData?.flipV ? ' \u2713' : ''}</div>
      {!isLoose && sysId && (
        <>
          <div className="ctx-sep" />
          <div className="ctx-item" onClick={handleDetach}>&#10548; Detach from System</div>
        </>
      )}
      <div className="ctx-sep" />
      <div className="ctx-item ctx-danger" onClick={handleDelete}>&#128465; Delete Image</div>
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
  canvasX, canvasY,
  onNewTask, onNewSystem, onNewFrame,
  onOpenModal,
  onUpdateTaskStatus,
  onCreateSubSystem, onUpdateSystemColors,
  onDeleteTask, onDeleteSystem, onDeleteFrame,
  onStartArrow,
  onAddImage, onUpdateImage, onUpdateLooseImage, onDeleteImage, onDeleteLooseImage, onMoveImageLayer, onDetachImage,
  onClose,
}) {
  return (
    <div className="context-menu" style={{ left: x, top: y }}>
      {type === 'canvas' && (
        <CanvasMenu onNewTask={onNewTask} onNewSystem={onNewSystem} onNewFrame={onNewFrame} onAddImage={onAddImage} canvasX={canvasX} canvasY={canvasY} onClose={onClose} />
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
          onStartArrow={onStartArrow} onAddImage={onAddImage} onClose={onClose}
        />
      )}
      {type === 'frame' && (
        <FrameMenu
          targetId={targetId} targetData={targetData}
          onOpenModal={onOpenModal} onDeleteFrame={onDeleteFrame}
          onStartArrow={onStartArrow} onClose={onClose}
        />
      )}
      {type === 'image' && (
        <ImageMenu
          targetId={targetId} targetData={targetData}
          canvasX={canvasX} canvasY={canvasY}
          onUpdateImage={onUpdateImage} onUpdateLooseImage={onUpdateLooseImage}
          onDeleteImage={onDeleteImage} onDeleteLooseImage={onDeleteLooseImage}
          onMoveImageLayer={onMoveImageLayer} onDetachImage={onDetachImage}
          onClose={onClose}
        />
      )}
    </div>
  );
}
