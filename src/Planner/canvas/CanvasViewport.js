import React, { useRef, useState, useEffect, useCallback } from 'react';
import CanvasFrame from './CanvasFrame';
import StandaloneNode from './StandaloneNode';
import LooseSystem from './LooseSystem';
import LooseTask from './LooseTask';
import LooseImage from './LooseImage';
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
  onResizeSubNode,
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
  onAddImage,
  onAddLooseImage,
  onUpdateImage,
  onUpdateLooseImage,
  onDeleteImage,
  onDeleteLooseImage,
  onMoveImageLayer,
  onDetachImage,
}) {
  const vpRef = useRef(null);
  const mapInnerRef = useRef(null);
  // Always-fresh milestone ref to avoid stale closure in mouseDown
  const milestoneRef = useRef(milestone);
  milestoneRef.current = milestone;

  // Arrow drawing mode: { fromId } or null
  const [arrowMode, setArrowMode] = useState(null);
  // Arrow preview: canvas coordinates of the current mouse position
  const [arrowPreview, setArrowPreview] = useState(null);

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
      const sys = findTask(state.sysId, milestone);
      if (sys && onOpenBoard) onOpenBoard(state.sysId, sys.name);
    } else if (state.type === 'system') {
      const sys = findTask(state.id, milestone);
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
  const imgDragRef = useRef(null);

  // Cancel arrow mode on Escape + highlight source element + track mouse for preview
  useEffect(() => {
    if (!arrowMode) {
      setArrowPreview(null);
      return;
    }
    // Highlight source element
    const container = mapInnerRef.current;
    if (container) {
      const srcEl =
        container.querySelector('[data-frame-id="' + arrowMode.fromId + '"]') ||
        container.querySelector('[data-sys-id="' + arrowMode.fromId + '"]') ||
        container.querySelector('[data-task-id="' + arrowMode.fromId + '"]');
      if (srcEl) srcEl.classList.add('arrow-source-highlight');
    }

    const keyHandler = (e) => { if (e.key === 'Escape') setArrowMode(null); };
    const moveHandler = (e) => {
      if (!vpRef.current) return;
      const rect = vpRef.current.getBoundingClientRect();
      const cp = screenToCanvas(e.clientX, e.clientY, rect);
      setArrowPreview({ x: cp.x, y: cp.y });
    };

    document.addEventListener('keydown', keyHandler);
    window.addEventListener('mousemove', moveHandler);
    return () => {
      document.removeEventListener('keydown', keyHandler);
      window.removeEventListener('mousemove', moveHandler);
      // Remove source highlight
      if (container) {
        const highlighted = container.querySelector('.arrow-source-highlight');
        if (highlighted) highlighted.classList.remove('arrow-source-highlight');
      }
    };
  }, [arrowMode, screenToCanvas]);

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

    // Image resize handle
    const imgResize = e.target.closest('[data-pimg-resize]');
    if (imgResize) {
      const wrap = imgResize.closest('.planner-img-wrap');
      if (wrap) {
        const imgId = wrap.dataset.imgId;
        const isLoose = !!wrap.dataset.imgLoose;
        const sysId = wrap.dataset.imgSys || null;
        let imgData = null;
        const ms = milestoneRef.current;
        if (isLoose) {
          imgData = (ms.looseImages || []).find((i) => i.id === imgId);
        } else if (sysId) {
          const sys = findTask(sysId, ms);
          imgData = sys && sys.images ? sys.images.find((i) => i.id === imgId) : null;
        }
        if (imgData) {
          imgDragRef.current = { mode: 'resize', isLoose, sysId, imgId, startX: e.clientX, startY: e.clientY, startW: imgData.w, startH: imgData.h };
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    }

    // Image drag (center-to-cursor)
    const imgWrap = e.target.closest('.planner-img-wrap');
    if (imgWrap) {
      const imgId = imgWrap.dataset.imgId;
      const isLoose = !!imgWrap.dataset.imgLoose;
      const sysId = imgWrap.dataset.imgSys || null;
      let imgData = null;
      const ms = milestoneRef.current;
      if (isLoose) {
        imgData = (ms.looseImages || []).find((i) => i.id === imgId);
      } else if (sysId) {
        const sys = findTask(sysId, ms);
        imgData = sys && sys.images ? sys.images.find((i) => i.id === imgId) : null;
      }
      if (imgData) {
        // Standard offset drag — no snap, maintain click offset
        imgDragRef.current = {
          mode: 'drag', isLoose, sysId, imgId,
          startMouseX: e.clientX, startMouseY: e.clientY,
          startImgX: imgData.x, startImgY: imgData.y,
        };
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    const rh = e.target.closest('.resize-handle');
    if (rh) {
      const node = rh.closest('.resizable-node') || rh.closest('.canvas-node') || rh.closest('.system-box');
      if (!node) { e.preventDefault(); return; }
      resizeRef.current = {
        el: node,
        dir: rh.dataset.resize,
        startX: e.clientX,
        startY: e.clientY,
        startW: node.offsetWidth,
        startH: node.offsetHeight,
        frameId: node.dataset.frameId || null,
        sysId: node.dataset.sysId || null,
        isSubNode: !node.classList.contains('canvas-node'),
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

    // Image interactions
    if (imgDragRef.current) {
      const ref = imgDragRef.current;
      const wrap = document.querySelector('[data-img-id="' + ref.imgId + '"]');
      if (!wrap) { imgDragRef.current = null; return; }
      if (ref.mode === 'drag') {
        const dx = (e.clientX - ref.startMouseX) / mapZoom;
        const dy = (e.clientY - ref.startMouseY) / mapZoom;
        const newX = ref.startImgX + dx;
        const newY = ref.startImgY + dy;
        wrap.style.left = newX + 'px';
        wrap.style.top = newY + 'px';
        ref._curX = newX;
        ref._curY = newY;
      } else if (ref.mode === 'resize') {
        const dx = (e.clientX - ref.startX) / mapZoom;
        const ratio = ref.startH / ref.startW;
        const newW = Math.max(30, ref.startW + dx);
        const newH = newW * ratio;
        wrap.style.width = newW + 'px';
        wrap.style.height = newH + 'px';
        ref._curW = newW;
        ref._curH = newH;
      }
      return;
    }

    if (resizeRef.current) {
      const rs = resizeRef.current;
      const dx = (e.clientX - rs.startX) / mapZoom;
      const dy = (e.clientY - rs.startY) / mapZoom;
      const minW = rs.isSubNode ? 120 : 200;
      if (rs.dir.indexOf('r') > -1) rs.el.style.width = Math.max(minW, rs.startW + dx) + 'px';
      if (rs.dir.indexOf('b') > -1) rs.el.style.height = Math.max(100, rs.startH + dy) + 'px';
      return;
    }
    dragMouseMove(e);
  }, [isPanning, movePan, mapZoom, dragMouseMove]);

  const handleMouseUp = useCallback((e) => {
    if (e.button === 1) { endPan(1); return; }
    if (e.button === 0) endPan(0);

    // Persist image interactions
    if (imgDragRef.current) {
      const ref = imgDragRef.current;
      const updateFn = ref.isLoose ? onUpdateLooseImage : onUpdateImage;
      if (ref.mode === 'drag' && ref._curX !== undefined) {
        if (ref.isLoose) {
          updateFn(ref.imgId, { x: ref._curX, y: ref._curY });
        } else {
          updateFn(ref.sysId, ref.imgId, { x: ref._curX, y: ref._curY });
        }
      } else if (ref.mode === 'resize' && ref._curW !== undefined) {
        if (ref.isLoose) {
          updateFn(ref.imgId, { w: ref._curW, h: ref._curH });
        } else {
          updateFn(ref.sysId, ref.imgId, { w: ref._curW, h: ref._curH });
        }
      }
      imgDragRef.current = null;
      return;
    }

    if (resizeRef.current) {
      const rs = resizeRef.current;
      const newW = parseFloat(rs.el.style.width);
      const newH = parseFloat(rs.el.style.height);
      if (rs.frameId && onResizeFrame) onResizeFrame(rs.frameId, newW);
      else if (rs.sysId && rs.el.closest('.loose-system') && onResizeLooseSystem) onResizeLooseSystem(rs.sysId, newW);
      else if (rs.sysId && rs.isSubNode && onResizeSubNode) onResizeSubNode(rs.sysId, newW, newH);
      resizeRef.current = null;
      return;
    }
    if (vpRef.current) dragMouseUp(e, vpRef.current.getBoundingClientRect());
  }, [endPan, dragMouseUp, onResizeFrame, onResizeLooseSystem, onResizeSubNode, onUpdateImage, onUpdateLooseImage]);

  const handleWheel_ = useCallback((e) => {
    e.preventDefault();
    if (vpRef.current) handleWheel(e, vpRef.current.getBoundingClientRect());
  }, [handleWheel]);

  const handleContextMenu = useCallback((e) => {
    if (e.target.closest('.map-controls,.kanban-card')) return;
    e.preventDefault();

    const rect = vpRef.current.getBoundingClientRect();
    const cp = screenToCanvas(e.clientX, e.clientY, rect);

    // Image (loose or system-parented)
    const imgEl = e.target.closest('.planner-img-wrap');
    if (imgEl) {
      const imgId = imgEl.dataset.imgId;
      const isLoose = !!imgEl.dataset.imgLoose;
      if (isLoose) {
        const imgData = (milestone.looseImages || []).find((i) => i.id === imgId);
        if (imgData) {
          showContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: cp.x, canvasY: cp.y, type: 'image', targetId: imgId, targetData: { ...imgData, isLoose: true } });
          return;
        }
      } else {
        const sysId = imgEl.dataset.imgSys;
        const sys = findTask(sysId, milestone);
        const imgData = sys && sys.images ? sys.images.find((i) => i.id === imgId) : null;
        if (imgData) {
          showContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: cp.x, canvasY: cp.y, type: 'image', targetId: imgId, targetData: { ...imgData, sysId } });
          return;
        }
      }
    }

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

  // sysId: string = add to system; null = add as loose image at (canvasX, canvasY)
  const handleAddImage = useCallback((sysId, canvasX, canvasY) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      try {
        const { uploadPlannerImage } = await import('../helpers/imageUpload');
        const { url, width, height } = await uploadPlannerImage(file);
        // Scale to fit max 200px on longest side, preserve aspect ratio
        let w = width, h = height;
        if (w > 200 || h > 200) {
          if (w >= h) { h = Math.round((h / w) * 200); w = 200; }
          else { w = Math.round((w / h) * 200); h = 200; }
        }
        if (sysId) {
          onAddImage(sysId, { url, w, h });
        } else {
          onAddLooseImage({ url, w, h, x: canvasX || 100, y: canvasY || 100 });
        }
      } catch (err) {
        console.error('Image upload failed:', err);
      }
    };
    input.click();
  }, [onAddImage, onAddLooseImage]);

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
          preview={arrowMode && arrowPreview ? { fromId: arrowMode.fromId, toX: arrowPreview.x, toY: arrowPreview.y } : null}
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
        {(milestone.looseImages || []).map((img) => (
          <LooseImage key={img.id} image={img} />
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
          canvasX={contextMenu.canvasX} canvasY={contextMenu.canvasY}
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
          onAddImage={handleAddImage}
          onUpdateImage={onUpdateImage}
          onUpdateLooseImage={onUpdateLooseImage}
          onDeleteImage={onDeleteImage}
          onDeleteLooseImage={onDeleteLooseImage}
          onMoveImageLayer={onMoveImageLayer}
          onDetachImage={onDetachImage}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
