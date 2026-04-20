import React, { useRef, useEffect, useCallback } from 'react';
import CanvasFrame from './CanvasFrame';
import StandaloneNode from './StandaloneNode';
import LooseSystem from './LooseSystem';
import LooseTask from './LooseTask';
import ContextMenu from './ContextMenu';
import useCanvasPanZoom from '../hooks/useCanvasPanZoom';
import useCanvasDrag from '../hooks/useCanvasDrag';
import useContextMenu from '../hooks/useContextMenu';

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
}) {
  const vpRef = useRef(null);

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
  }, [milestone, onOpenBoard]);

  const { onMouseDown: dragMouseDown, onMouseMove: dragMouseMove, onMouseUp: dragMouseUp, isDragging } = useCanvasDrag({
    mapZoom,
    screenToCanvas: (sx, sy) => screenToCanvas(sx, sy, vpRef.current.getBoundingClientRect()),
    onDropTask,
    onDropSystem,
    onMoveFrame,
    onMapClick: handleMapClick,
  });

  const { contextMenu, showContextMenu, closeContextMenu } = useContextMenu();

  // Resize state
  const resizeRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    // Middle-click pan
    if (e.button === 1) {
      e.preventDefault();
      startPan(e.clientX, e.clientY, true);
      return;
    }
    if (e.button !== 0) return;

    // Resize handles
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

    // Try drag
    if (dragMouseDown(e)) return;

    // Otherwise: pan
    if (!e.target.closest('.map-controls')) {
      startPan(e.clientX, e.clientY, false);
      e.preventDefault();
    }
  }, [dragMouseDown, startPan]);

  const handleMouseMove = useCallback((e) => {
    // Pan
    if (isPanning()) {
      movePan(e.clientX, e.clientY);
      return;
    }

    // Resize
    if (resizeRef.current) {
      const rs = resizeRef.current;
      const dx = (e.clientX - rs.startX) / mapZoom;
      const dy = (e.clientY - rs.startY) / mapZoom;
      if (rs.dir.indexOf('r') > -1) {
        rs.el.style.width = Math.max(200, rs.startW + dx) + 'px';
      }
      if (rs.dir.indexOf('b') > -1) {
        rs.el.style.height = Math.max(100, rs.startH + dy) + 'px';
      }
      return;
    }

    // Drag
    dragMouseMove(e);
  }, [isPanning, movePan, mapZoom, dragMouseMove]);

  const handleMouseUp = useCallback((e) => {
    if (e.button === 1) { endPan(1); return; }
    if (e.button === 0) endPan(0);

    // Resize finish
    if (resizeRef.current) {
      const rs = resizeRef.current;
      const newW = parseFloat(rs.el.style.width);
      if (rs.frameId && onResizeFrame) {
        onResizeFrame(rs.frameId, newW);
      }
      if (rs.sysId && rs.el.closest('.loose-system') && onResizeLooseSystem) {
        onResizeLooseSystem(rs.sysId, newW);
      }
      resizeRef.current = null;
      return;
    }

    // Drag finish
    if (vpRef.current) {
      dragMouseUp(e, vpRef.current.getBoundingClientRect());
    }
  }, [endPan, dragMouseUp, onResizeFrame, onResizeLooseSystem]);

  const handleWheel_ = useCallback((e) => {
    e.preventDefault();
    if (vpRef.current) {
      handleWheel(e, vpRef.current.getBoundingClientRect());
    }
  }, [handleWheel]);

  const handleContextMenu = useCallback((e) => {
    if (e.target.closest('.task-item,.kanban-card,.loose-task,.map-controls')) return;
    e.preventDefault();
    const rect = vpRef.current.getBoundingClientRect();
    const cp = screenToCanvas(e.clientX, e.clientY, rect);
    showContextMenu(e.clientX, e.clientY, cp.x, cp.y);
  }, [screenToCanvas, showContextMenu]);

  // Register global listeners
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Prevent middle-click autoscroll
  const handleAuxClick = useCallback((e) => {
    if (e.button === 1) e.preventDefault();
  }, []);

  return (
    <div
      className={`map-viewport${hidden ? ' hidden' : ''}`}
      ref={vpRef}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel_}
      onContextMenu={handleContextMenu}
      onAuxClick={handleAuxClick}
    >
      <div className="map-inner" style={{ transform: transformStyle }}>
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

      {/* Zoom controls */}
      <div className="map-controls">
        <button
          className="map-ctrl-btn"
          onClick={() => vpRef.current && zoomAtCenter(-0.1, vpRef.current.getBoundingClientRect())}
        >
          &#8722;
        </button>
        <div className="map-zoom-label">{zoomPercent}%</div>
        <button
          className="map-ctrl-btn"
          onClick={() => vpRef.current && zoomAtCenter(0.1, vpRef.current.getBoundingClientRect())}
        >
          +
        </button>
        <button className="map-ctrl-btn" onClick={resetView} style={{ fontSize: 11 }}>
          &#x27F2;
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onNewTask={() => onCreateTask(contextMenu.canvasX, contextMenu.canvasY)}
          onNewSystem={() => onCreateSystem(contextMenu.canvasX, contextMenu.canvasY)}
          onNewFrame={() => onCreateFrame(contextMenu.canvasX, contextMenu.canvasY)}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
