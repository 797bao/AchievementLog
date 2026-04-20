import React, { useRef, useState, useEffect, useCallback } from 'react';
import CanvasFrame from './CanvasFrame';
import StandaloneNode from './StandaloneNode';
import LooseSystem from './LooseSystem';
import LooseTask from './LooseTask';
import ContextMenu from './ContextMenu';
import ArrowLayer from './ArrowLayer';
import useCanvasPanZoom from '../hooks/useCanvasPanZoom';
import useCanvasDrag from '../hooks/useCanvasDrag';
import useContextMenu from '../hooks/useContextMenu';
import { findTask } from '../plannerHelpers';

export default function CanvasViewport({
  milestone,
  hidden,
  onOpenBoard,
  onMoveFrame,
  onDropSystem,
  onDropTask,
  onResizeFrame,
  onResizeLooseSystem,
  onCreateTask,
  onCreateSystem,
  onCreateFrame,
  onRenameTask,
  onChangeTaskIcon,
  onSetTaskTime,
  onUpdateTaskStatus,
  onUpdateTask,
  onDeleteTask,
  onDeleteSystem,
  onDeleteFrame,
  onCreateSubSystem,
  onRenameSystem,
  onUpdateSystemColors,
  onAddArrow,
  onDeleteArrow,
  onOpenModal,
}) {
  const vpRef = useRef(null);
  const mapInnerRef = useRef(null);

  // Arrow drawing mode: { fromId } or null
  const [arrowMode, setArrowMode] = useState(null);

  const {
    mapZoom,
    screenToCanvas,
    startPan,
    movePan,
    endPan,
    isPanning,
    handleWheel,
    zoomAtCenter,
    resetView,
    transformStyle,
    zoomPercent,
  } = useCanvasPanZoom();

  const handleMapClick = useCallback((state) => {
    // If in arrow mode, complete the arrow
    if (arrowMode) {
      const toId = state.id || state.sysId;
      if (toId && toId !== arrowMode.fromId) {
        onAddArrow(arrowMode.fromId, toId);
      }
      setArrowMode(null);
      return;
    }

    if (state.type === 'standalone' && state.sysId) {
      const sys = milestone.frames
        .flatMap((f) => f.systems)
        .find((s) => s.id === state.sysId);
      if (sys && onOpenBoard) onOpenBoard(state.sysId, sys.name);
    } else if (state.type === 'system') {
      const allSystems = [
        ...milestone.frames.flatMap((f) => f.systems),
        ...(milestone.looseSystems || []),
      ];
      const sys = allSystems.find((s) => s.id === state.id);
      if (sys && onOpenBoard) onOpenBoard(state.id, sys.name);
    }
  }, [milestone, onOpenBoard, arrowMode, onAddArrow]);

  const { onMouseDown: dragMouseDown, onMouseMove: dragMouseMove, onMouseUp: dragMouseUp } = useCanvasDrag({
    mapZoom,
    screenToCanvas: (sx, sy) => screenToCanvas(sx, sy, vpRef.current.getBoundingClientRect()),
    onDropTask,
    onDropSystem,
    onMoveFrame,
    onMapClick: handleMapClick,
  });

  const { contextMenu, showContextMenu, closeContextMenu } = useContextMenu();

  const resizeRef = useRef(null);

  // Cancel arrow mode on Escape
  useEffect(() => {
    if (!arrowMode) return;
    const handler = (e) => { if (e.key === 'Escape') setArrowMode(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [arrowMode]);

  const handleStartArrow = useCallback((fromId) => {
    setArrowMode({ fromId });
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (e.button === 1) {
      e.preventDefault();
      startPan(e.clientX, e.clientY, true);
      return;
    }
    if (e.button !== 0) return;

    // Arrow mode: clicking on empty canvas cancels
    if (arrowMode) {
      // Check if clicking on a draggable element to complete arrow (handled in handleMapClick via drag click)
      // If clicking on empty space, cancel
      const nodeEl = e.target.closest('.task-item,.loose-task,.system-box,.canvas-frame,.standalone-node');
      if (!nodeEl) {
        setArrowMode(null);
        return;
      }
      // Let drag system handle the click→release→mapClick path
    }

    const rh = e.target.closest('.resize-handle');
    if (rh) {
      const node = rh.closest('.canvas-node');
      resizeRef.current = {
        el: node,
        dir: rh.dataset.resize,
        startX: e.clientX,
        startY: e.clientY,
        startW: node.offsetWidth,
        startH: node.offsetHeight,
        frameId: node.dataset.frameId || null,
        sysId: node.dataset.sysId || null,
      };
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (dragMouseDown(e)) return;

    if (!e.target.closest('.map-controls')) {
      startPan(e.clientX, e.clientY, false);
      e.preventDefault();
    }
  }, [dragMouseDown, startPan, arrowMode]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning()) { movePan(e.clientX, e.clientY); return; }
    if (resizeRef.current) {
      const rs = resizeRef.current;
      const dx = (e.clientX - rs.startX) / mapZoom;
      const dy = (e.clientY - rs.startY) / mapZoom;
      if (rs.dir.indexOf('r') > -1) rs.el.style.width = Math.max(200, rs.startW + dx) + 'px';
      if (rs.dir.indexOf('b') > -1) rs.el.style.height = Math.max(100, rs.startH + dy) + 'px';
      return;
    }
    dragMouseMove(e);
  }, [isPanning, movePan, mapZoom, dragMouseMove]);

  const handleMouseUp = useCallback((e) => {
    if (e.button === 1) { endPan(1); return; }
    if (e.button === 0) endPan(0);
    if (resizeRef.current) {
      const rs = resizeRef.current;
      const newW = parseFloat(rs.el.style.width);
      if (rs.frameId && onResizeFrame) onResizeFrame(rs.frameId, newW);
      if (rs.sysId && rs.el.closest('.loose-system') && onResizeLooseSystem) onResizeLooseSystem(rs.sysId, newW);
      resizeRef.current = null;
      return;
    }
    if (vpRef.current) dragMouseUp(e, vpRef.current.getBoundingClientRect());
  }, [endPan, dragMouseUp, onResizeFrame, onResizeLooseSystem]);

  const handleWheel_ = useCallback((e) => {
    e.preventDefault();
    if (vpRef.current) handleWheel(e, vpRef.current.getBoundingClientRect());
  }, [handleWheel]);

  const handleContextMenu = useCallback((e) => {
    if (e.target.closest('.map-controls,.kanban-card')) return;
    e.preventDefault();

    const rect = vpRef.current.getBoundingClientRect();
    const cp = screenToCanvas(e.clientX, e.clientY, rect);

    // Task
    const taskEl = e.target.closest('.task-item') || e.target.closest('.loose-task');
    if (taskEl) {
      const taskId = taskEl.dataset.taskId;
      showContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: cp.x, canvasY: cp.y, type: 'task', targetId: taskId, targetData: findTask(taskId, milestone) });
      return;
    }

    // System
    const sysBox = e.target.closest('.system-box');
    if (sysBox) {
      const sysId = sysBox.dataset.sysId;
      showContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: cp.x, canvasY: cp.y, type: 'system', targetId: sysId, targetData: findTask(sysId, milestone) });
      return;
    }

    // Frame
    const frameEl = e.target.closest('.canvas-frame');
    if (frameEl) {
      const frameId = frameEl.dataset.frameId;
      const frame = milestone.frames.find((f) => f.id === frameId);
      showContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: cp.x, canvasY: cp.y, type: 'frame', targetId: frameId, targetData: frame });
      return;
    }

    // Standalone node (treat as system for context menu)
    const standaloneEl = e.target.closest('.standalone-node');
    if (standaloneEl) {
      const frameId = standaloneEl.dataset.frameId;
      const frame = milestone.frames.find((f) => f.id === frameId);
      showContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: cp.x, canvasY: cp.y, type: 'frame', targetId: frameId, targetData: frame });
      return;
    }

    // Canvas (empty space)
    showContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: cp.x, canvasY: cp.y, type: 'canvas' });
  }, [screenToCanvas, showContextMenu, milestone]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleAuxClick = useCallback((e) => {
    if (e.button === 1) e.preventDefault();
  }, []);

  const handleDeleteArrowDirect = useCallback((arrowId) => {
    if (onDeleteArrow) onDeleteArrow(arrowId);
  }, [onDeleteArrow]);

  return (
    <div
      className={`map-viewport${hidden ? ' hidden' : ''}${arrowMode ? ' arrow-mode' : ''}`}
      ref={vpRef}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel_}
      onContextMenu={handleContextMenu}
      onAuxClick={handleAuxClick}
    >
      <div className="map-inner" ref={mapInnerRef} style={{ transform: transformStyle }}>
        {/* Arrow SVG layer (behind nodes) */}
        <ArrowLayer
          arrows={milestone.arrows || []}
          containerRef={mapInnerRef}
          onDeleteArrow={handleDeleteArrowDirect}
        />

        {milestone.frames.map((frame) =>
          frame.standalone ? (
            <StandaloneNode key={frame.id} frame={frame} />
          ) : (
            <CanvasFrame key={frame.id} frame={frame} />
          )
        )}
        {(milestone.looseSystems || []).map((sys) => (
          <LooseSystem key={sys.id} system={sys} />
        ))}
        {(milestone.looseTasks || []).map((task) => (
          <LooseTask key={task.id} task={task} />
        ))}
      </div>

      {/* Arrow mode indicator */}
      {arrowMode && (
        <div className="arrow-mode-indicator">
          Click a target element to draw arrow &middot; <span onClick={() => setArrowMode(null)}>ESC to cancel</span>
        </div>
      )}

      {/* Zoom controls */}
      <div className="map-controls">
        <button className="map-ctrl-btn" onClick={() => vpRef.current && zoomAtCenter(-0.1, vpRef.current.getBoundingClientRect())}>&#8722;</button>
        <div className="map-zoom-label">{zoomPercent}%</div>
        <button className="map-ctrl-btn" onClick={() => vpRef.current && zoomAtCenter(0.1, vpRef.current.getBoundingClientRect())}>+</button>
        <button className="map-ctrl-btn" onClick={resetView} style={{ fontSize: 11 }}>&#x27F2;</button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y}
          type={contextMenu.type} targetId={contextMenu.targetId} targetData={contextMenu.targetData}
          onNewTask={() => onCreateTask(contextMenu.canvasX, contextMenu.canvasY)}
          onNewSystem={() => onCreateSystem(contextMenu.canvasX, contextMenu.canvasY)}
          onNewFrame={() => onCreateFrame(contextMenu.canvasX, contextMenu.canvasY)}
          onOpenModal={onOpenModal}
          onUpdateTaskStatus={onUpdateTaskStatus}
          onCreateSubSystem={onCreateSubSystem}
          onUpdateSystemColors={onUpdateSystemColors}
          onDeleteTask={onDeleteTask}
          onDeleteSystem={onDeleteSystem}
          onDeleteFrame={onDeleteFrame}
          onStartArrow={handleStartArrow}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
