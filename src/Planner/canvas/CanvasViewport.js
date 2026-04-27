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
import useCanvasSelection from '../hooks/useCanvasSelection';
import { findTask, deepCloneWithNewIds } from '../plannerHelpers';
import { CLICK_THRESHOLD } from '../plannerData';

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
  onPasteElements,
  onDeleteSelected,
  onMoveSelected,
  onDropSelected,
  onBulkSetSprint,
}) {
  const vpRef = useRef(null);
  const mapInnerRef = useRef(null);
  const milestoneRef = useRef(milestone);
  milestoneRef.current = milestone;

  // Arrow drawing mode
  const [arrowMode, setArrowMode] = useState(null);
  const [arrowPreview, setArrowPreview] = useState(null);

  // Selection & clipboard
  const { selection, select, toggleSelect, selectMany, clearSelection, isSelected } = useCanvasSelection();
  const clipboardRef = useRef(null);
  const [hasClip, setHasClip] = useState(false);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  // Clear stale selection when switching to a different milestone — old IDs
  // referenced items that no longer exist on this canvas, which broke drag math.
  const lastMilestoneIdRef = useRef(milestone.id);
  useEffect(() => {
    if (lastMilestoneIdRef.current !== milestone.id) {
      clearSelection();
      lastMilestoneIdRef.current = milestone.id;
    }
  }, [milestone.id, clearSelection]);

  // Right-click drag selection box
  const rightDragRef = useRef(null);
  const suppressContextMenuRef = useRef(false);
  const [selectionBox, setSelectionBox] = useState(null);

  const {
    mapZoom,
    screenToCanvas,
    startPan,
    movePan,
    endPan,
    isPanning,
    handleWheel,
    zoomAtPoint,
    zoomAtCenter,
    resetView,
    transformStyle,
    zoomPercent,
  } = useCanvasPanZoom();

  // Touch state
  const touchRef = useRef({
    longPressTimer: null,
    startX: 0,
    startY: 0,
    moved: false,
    pinch: null,           // { startDist, startZoom, midX, midY } when 2 fingers
    longPressFired: false, // suppresses synthetic mousedown after long-press
  });

  const handleMapClick = useCallback((state) => {
    // Arrow mode is handled directly in handleMouseDown so any element edge counts as a target
    if (state.type === 'standalone' && state.sysId) {
      const sys = findTask(state.sysId, milestone);
      if (sys && onOpenBoard) onOpenBoard(state.sysId, sys.name);
    } else if (state.type === 'system') {
      const sys = findTask(state.id, milestone);
      if (sys && onOpenBoard) onOpenBoard(state.id, sys.name);
    } else if (state.type === 'frame') {
      const frame = milestone.frames.find((f) => f.id === state.id);
      if (frame && onOpenBoard) onOpenBoard(state.id, frame.label || 'Frame');
    } else if (state.type === 'task') {
      // Left-click on a task opens the edit modal (parity with right-click → Edit)
      const task = findTask(state.id, milestone);
      if (task && onOpenModal) {
        onOpenModal({
          type: 'edit-task',
          targetId: state.id,
          fields: [
            { key: 'name', label: 'Name', type: 'text', value: task.name || '' },
            { key: 'description', label: 'Description', type: 'textarea', value: task.description || '' },
            { key: 'sprint', label: 'Sprint', type: 'sprint-select', value: task.sprint || '' },
            { key: 'type', label: 'Icon Type', type: 'icon-select', value: task.type || 'script' },
            { key: 'time', label: 'Expected Time', type: 'text', value: task.time || '', placeholder: 'e.g. 2h, 30m' },
            { key: 'timeLogs', label: 'Time Logs', type: 'time-logs', value: task.timeLogs || [] },
            { key: 'status', label: 'Status', type: 'status-select', value: task.status || 'planned' },
          ],
        });
      }
    }
  }, [milestone, onOpenBoard, onOpenModal]);

  const { onMouseDown: dragMouseDown, onMouseMove: dragMouseMove, onMouseUp: dragMouseUp } = useCanvasDrag({
    mapZoom,
    screenToCanvas: (sx, sy) => screenToCanvas(sx, sy, vpRef.current.getBoundingClientRect()),
    onDropTask,
    onDropSystem,
    onMoveFrame,
    onMapClick: handleMapClick,
    selectionRef,
    onMoveSelected,
    onDropSelected,
  });

  const { contextMenu, showContextMenu, closeContextMenu } = useContextMenu();

  const resizeRef = useRef(null);
  const imgDragRef = useRef(null);

  // ─── Arrow mode effect ───
  useEffect(() => {
    if (!arrowMode) { setArrowPreview(null); return; }
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
      if (container) {
        const highlighted = container.querySelector('.arrow-source-highlight');
        if (highlighted) highlighted.classList.remove('arrow-source-highlight');
      }
    };
  }, [arrowMode, screenToCanvas]);

  const handleStartArrow = useCallback((fromId) => { setArrowMode({ fromId }); }, []);

  // ─── Identify element under cursor for selection ───
  const identifyElement = useCallback((e) => {
    const imgEl = e.target.closest('.planner-img-wrap');
    if (imgEl) return { id: imgEl.dataset.imgId, type: 'image' };
    const taskEl = e.target.closest('.task-item') || e.target.closest('.loose-task');
    if (taskEl) return { id: taskEl.dataset.taskId, type: 'task' };
    const subGrp = e.target.closest('.sub-group');
    if (subGrp) return { id: subGrp.dataset.sysId, type: 'system' };
    const sysBox = e.target.closest('.system-box');
    if (sysBox) return { id: sysBox.dataset.sysId, type: 'system' };
    const frameEl = e.target.closest('.canvas-frame') || e.target.closest('.standalone-node');
    if (frameEl) return { id: frameEl.dataset.frameId, type: 'frame' };
    return null;
  }, []);

  // ─── Copy selected elements to clipboard ───
  const copyToClipboard = useCallback(() => {
    const ms = milestoneRef.current;
    const sel = selectionRef.current;
    if (!sel.length) return;

    const tasks = [];
    const systems = [];
    const frames = [];
    const images = [];

    sel.forEach(({ id, type }) => {
      if (type === 'task') {
        const t = findTask(id, ms);
        if (t) tasks.push(JSON.parse(JSON.stringify(t)));
      } else if (type === 'system') {
        const s = findTask(id, ms);
        if (s) systems.push(JSON.parse(JSON.stringify(s)));
      } else if (type === 'frame') {
        const f = ms.frames.find((fr) => fr.id === id);
        if (f) frames.push(JSON.parse(JSON.stringify(f)));
      } else if (type === 'image') {
        const loose = (ms.looseImages || []).find((i) => i.id === id);
        if (loose) { images.push(JSON.parse(JSON.stringify(loose))); return; }
        // Search in systems
        for (const frame of ms.frames) {
          for (const sys of frame.systems) {
            const img = (sys.images || []).find((i) => i.id === id);
            if (img) { images.push(JSON.parse(JSON.stringify(img))); return; }
          }
        }
        (ms.looseSystems || []).forEach((sys) => {
          const img = (sys.images || []).find((i) => i.id === id);
          if (img) images.push(JSON.parse(JSON.stringify(img)));
        });
      }
    });

    clipboardRef.current = { tasks, systems, frames, images };
    setHasClip(tasks.length + systems.length + frames.length + images.length > 0);
  }, []);

  // ─── Paste from clipboard ───
  const pasteFromClipboard = useCallback((canvasX, canvasY) => {
    if (!clipboardRef.current || !onPasteElements) return;
    const clip = clipboardRef.current;
    const hasContent = (clip.tasks.length + clip.systems.length + clip.frames.length + clip.images.length) > 0;
    if (!hasContent) return;

    // Pass raw clipboard data — pasteElements in usePlannerState handles cloning + new IDs
    onPasteElements(clip, { x: canvasX || 0, y: canvasY || 0 });
    // Drop the stale selection from the copy source so newly pasted items can
    // be dragged individually (their IDs aren't in the old selection anyway,
    // but this also avoids any leftover multi-drag intent on identical IDs).
    clearSelection();
  }, [onPasteElements, clearSelection]);

  // ─── Compute elements inside a screen-space selection box ───
  const computeSelectionFromBox = useCallback((box) => {
    if (!mapInnerRef.current) return [];
    const hits = [];
    const check = (el, id, type) => {
      const r = el.getBoundingClientRect();
      if (r.right < box.x1 || r.left > box.x2 || r.bottom < box.y1 || r.top > box.y2) return;
      hits.push({ id, type });
    };
    // Frames (outermost)
    mapInnerRef.current.querySelectorAll('.canvas-frame[data-frame-id]').forEach((el) => {
      check(el, el.dataset.frameId, 'frame');
    });
    mapInnerRef.current.querySelectorAll('.standalone-node[data-frame-id]').forEach((el) => {
      check(el, el.dataset.frameId, 'frame');
    });
    // Loose systems
    mapInnerRef.current.querySelectorAll('.loose-system [data-sys-id]').forEach((el) => {
      check(el, el.dataset.sysId, 'system');
    });
    // Loose tasks
    mapInnerRef.current.querySelectorAll('.loose-task[data-task-id]').forEach((el) => {
      check(el, el.dataset.taskId, 'task');
    });
    // Loose images
    mapInnerRef.current.querySelectorAll('.planner-img-wrap[data-img-loose]').forEach((el) => {
      check(el, el.dataset.imgId, 'image');
    });
    return hits;
  }, []);

  // ─── Mouse handlers ───
  const handleMouseDown = useCallback((e) => {
    // Don't process mouseDown inside context menu — prevents clearing selection before copy
    if (e.target.closest('.context-menu')) return;

    // Reset right-drag suppress flag on any new mouse interaction
    suppressContextMenuRef.current = false;

    if (e.button === 1) {
      e.preventDefault();
      startPan(e.clientX, e.clientY, true);
      return;
    }

    // Right-click: start selection box drag
    if (e.button === 2) {
      rightDragRef.current = { startX: e.clientX, startY: e.clientY, isDragging: false };
      return;
    }

    if (e.button !== 0) return;

    // Arrow mode — resolve target directly here so any part of a frame/system/task counts
    if (arrowMode) {
      const nodeEl = e.target.closest('.task-item,.loose-task,.sub-group,.system-box,.canvas-frame,.standalone-node');
      if (!nodeEl) { setArrowMode(null); return; }
      // Prefer most-specific id (task → sub-group → system → frame)
      const taskEl = e.target.closest('.task-item') || e.target.closest('.loose-task');
      const subGrpEl = e.target.closest('.sub-group');
      const sysEl = e.target.closest('.system-box');
      const frameEl = e.target.closest('.canvas-frame') || e.target.closest('.standalone-node');
      const toId =
        (taskEl && taskEl.dataset.taskId) ||
        (subGrpEl && subGrpEl.dataset.sysId) ||
        (sysEl && sysEl.dataset.sysId) ||
        (frameEl && frameEl.dataset.frameId) ||
        null;
      if (toId && toId !== arrowMode.fromId) {
        onAddArrow(arrowMode.fromId, toId);
      }
      setArrowMode(null);
      e.preventDefault();
      return;
    }

    // Shift+click: toggle selection
    if (e.shiftKey) {
      const elem = identifyElement(e);
      if (elem) {
        toggleSelect(elem.id, elem.type);
        e.preventDefault();
        return;
      }
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
        if (isLoose) imgData = (ms.looseImages || []).find((i) => i.id === imgId);
        else if (sysId) {
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

    // Image drag
    const imgWrap = e.target.closest('.planner-img-wrap');
    if (imgWrap) {
      const imgId = imgWrap.dataset.imgId;
      const isLoose = !!imgWrap.dataset.imgLoose;
      const sysId = imgWrap.dataset.imgSys || null;
      let imgData = null;
      const ms = milestoneRef.current;
      if (isLoose) imgData = (ms.looseImages || []).find((i) => i.id === imgId);
      else if (sysId) {
        const sys = findTask(sysId, ms);
        imgData = sys && sys.images ? sys.images.find((i) => i.id === imgId) : null;
      }
      if (imgData) {
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

    // Resize handle
    const rh = e.target.closest('.resize-handle');
    if (rh) {
      const node = rh.closest('.resizable-node') || rh.closest('.canvas-node') || rh.closest('.system-box');
      if (!node) { e.preventDefault(); return; }
      resizeRef.current = {
        el: node, dir: rh.dataset.resize,
        startX: e.clientX, startY: e.clientY,
        startW: node.offsetWidth, startH: node.offsetHeight,
        // Capture current inline position so top/left handles can shift the origin
        startLeft: parseFloat(node.style.left) || 0,
        startTop: parseFloat(node.style.top) || 0,
        frameId: node.dataset.frameId || null,
        sysId: node.dataset.sysId || null,
        isSubNode: !node.classList.contains('canvas-node'),
      };
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Clear selection when clicking empty canvas (before pan)
    if (!e.target.closest('.task-item,.loose-task,.system-box,.canvas-frame,.standalone-node,.planner-img-wrap,.map-controls')) {
      clearSelection();
    }

    if (dragMouseDown(e)) return;

    if (!e.target.closest('.map-controls')) {
      startPan(e.clientX, e.clientY, false);
      e.preventDefault();
    }
  }, [dragMouseDown, startPan, arrowMode, identifyElement, toggleSelect, clearSelection, onAddArrow]);

  const handleMouseMove = useCallback((e) => {
    // Right-click drag → selection box
    if (rightDragRef.current) {
      const rd = rightDragRef.current;
      const dx = e.clientX - rd.startX;
      const dy = e.clientY - rd.startY;
      if (!rd.isDragging && (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD)) {
        rd.isDragging = true;
      }
      if (rd.isDragging) {
        setSelectionBox({
          x1: Math.min(rd.startX, e.clientX),
          y1: Math.min(rd.startY, e.clientY),
          x2: Math.max(rd.startX, e.clientX),
          y2: Math.max(rd.startY, e.clientY),
        });
      }
      return;
    }

    if (isPanning()) { movePan(e.clientX, e.clientY); return; }

    // Image interactions
    if (imgDragRef.current) {
      const ref = imgDragRef.current;
      const wrap = document.querySelector('[data-img-id="' + ref.imgId + '"]');
      if (!wrap) { imgDragRef.current = null; return; }
      if (ref.mode === 'drag') {
        const dx = (e.clientX - ref.startMouseX) / mapZoom;
        const dy = (e.clientY - ref.startMouseY) / mapZoom;
        wrap.style.left = (ref.startImgX + dx) + 'px';
        wrap.style.top = (ref.startImgY + dy) + 'px';
        ref._curX = ref.startImgX + dx;
        ref._curY = ref.startImgY + dy;
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
      const minH = 100;
      // Right / bottom edges grow from the top-left origin (unchanged)
      if (rs.dir.indexOf('r') > -1) rs.el.style.width = Math.max(minW, rs.startW + dx) + 'px';
      if (rs.dir.indexOf('b') > -1) rs.el.style.height = Math.max(minH, rs.startH + dy) + 'px';
      // Left / top edges resize AND shift the origin so the OPPOSITE edge stays put.
      // Sub-nodes (flex-laid-out systems inside a frame) have no x/y to shift.
      if (rs.dir.indexOf('l') > -1) {
        const newW = Math.max(minW, rs.startW - dx);
        const shift = rs.startW - newW;
        rs.el.style.width = newW + 'px';
        if (!rs.isSubNode) rs.el.style.left = (rs.startLeft + shift) + 'px';
      }
      if (rs.dir.indexOf('t') > -1) {
        const newH = Math.max(minH, rs.startH - dy);
        const shift = rs.startH - newH;
        rs.el.style.height = newH + 'px';
        if (!rs.isSubNode) rs.el.style.top = (rs.startTop + shift) + 'px';
      }
      return;
    }
    dragMouseMove(e);
  }, [isPanning, movePan, mapZoom, dragMouseMove]);

  const handleMouseUp = useCallback((e) => {
    // Right-click drag end → finalize selection box
    if (e.button === 2) {
      const rd = rightDragRef.current;
      rightDragRef.current = null;
      if (rd && rd.isDragging) {
        // Suppress the context menu that fires right after this mouseup
        // Flag stays true until next mouseDown resets it — no unreliable setTimeout
        suppressContextMenuRef.current = true;

        if (selectionBox) {
          const hits = computeSelectionFromBox(selectionBox);
          if (e.shiftKey) {
            const existing = selectionRef.current;
            const merged = [...existing];
            hits.forEach((h) => {
              if (!merged.find((m) => m.id === h.id)) merged.push(h);
            });
            selectMany(merged);
          } else {
            selectMany(hits);
          }
          setSelectionBox(null);
        }
      }
      return;
    }

    if (e.button === 1) { endPan(1); return; }
    if (e.button === 0) endPan(0);

    // Persist image interactions
    if (imgDragRef.current) {
      const ref = imgDragRef.current;
      const updateFn = ref.isLoose ? onUpdateLooseImage : onUpdateImage;
      if (ref.mode === 'drag' && ref._curX !== undefined) {
        if (ref.isLoose) updateFn(ref.imgId, { x: ref._curX, y: ref._curY });
        else updateFn(ref.sysId, ref.imgId, { x: ref._curX, y: ref._curY });
      } else if (ref.mode === 'resize' && ref._curW !== undefined) {
        if (ref.isLoose) updateFn(ref.imgId, { w: ref._curW, h: ref._curH });
        else updateFn(ref.sysId, ref.imgId, { w: ref._curW, h: ref._curH });
      }
      imgDragRef.current = null;
      return;
    }

    if (resizeRef.current) {
      const rs = resizeRef.current;
      const newW = parseFloat(rs.el.style.width);
      const newH = parseFloat(rs.el.style.height);
      const newLeft = parseFloat(rs.el.style.left) || 0;
      const newTop = parseFloat(rs.el.style.top) || 0;
      const posDx = newLeft - rs.startLeft;
      const posDy = newTop - rs.startTop;
      if (rs.frameId && onResizeFrame) onResizeFrame(rs.frameId, newW, newH, posDx, posDy);
      else if (rs.sysId && rs.el.closest('.loose-system') && onResizeLooseSystem) onResizeLooseSystem(rs.sysId, newW, newH, posDx, posDy);
      else if (rs.sysId && rs.isSubNode && onResizeSubNode) onResizeSubNode(rs.sysId, newW, newH);
      resizeRef.current = null;
      return;
    }
    if (vpRef.current) dragMouseUp(e, vpRef.current.getBoundingClientRect());
  }, [endPan, dragMouseUp, onResizeFrame, onResizeLooseSystem, onResizeSubNode, onUpdateImage, onUpdateLooseImage, selectionBox, computeSelectionFromBox, selectMany]);

  const handleWheel_ = useCallback((e) => {
    e.preventDefault();
    if (vpRef.current) handleWheel(e, vpRef.current.getBoundingClientRect());
  }, [handleWheel]);

  const handleContextMenu = useCallback((e) => {
    if (e.target.closest('.map-controls,.kanban-card')) return;
    e.preventDefault();

    // Suppress after right-click drag selection
    if (suppressContextMenuRef.current) return;
    if (rightDragRef.current && rightDragRef.current.isDragging) return;

    const rect = vpRef.current.getBoundingClientRect();
    const cp = screenToCanvas(e.clientX, e.clientY, rect);

    // Image
    const imgEl = e.target.closest('.planner-img-wrap');
    if (imgEl) {
      const imgId = imgEl.dataset.imgId;
      const isLoose = !!imgEl.dataset.imgLoose;
      if (isLoose) {
        const imgData = (milestone.looseImages || []).find((i) => i.id === imgId);
        if (imgData) {
          if (!isSelected(imgId)) { clearSelection(); select(imgId, 'image'); }
          showContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: cp.x, canvasY: cp.y, type: 'image', targetId: imgId, targetData: { ...imgData, isLoose: true } });
          return;
        }
      } else {
        const sysId = imgEl.dataset.imgSys;
        const sys = findTask(sysId, milestone);
        const imgData = sys && sys.images ? sys.images.find((i) => i.id === imgId) : null;
        if (imgData) {
          if (!isSelected(imgId)) { clearSelection(); select(imgId, 'image'); }
          showContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: cp.x, canvasY: cp.y, type: 'image', targetId: imgId, targetData: { ...imgData, sysId } });
          return;
        }
      }
    }

    // Task
    const taskEl = e.target.closest('.task-item') || e.target.closest('.loose-task');
    if (taskEl) {
      const taskId = taskEl.dataset.taskId;
      if (!isSelected(taskId)) { clearSelection(); select(taskId, 'task'); }
      showContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: cp.x, canvasY: cp.y, type: 'task', targetId: taskId, targetData: findTask(taskId, milestone) });
      return;
    }

    // Sub-group (must be checked before .system-box since sub-groups are nested inside them)
    const subGrp = e.target.closest('.sub-group');
    if (subGrp) {
      const sysId = subGrp.dataset.sysId;
      if (!isSelected(sysId)) { clearSelection(); select(sysId, 'system'); }
      showContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: cp.x, canvasY: cp.y, type: 'system', targetId: sysId, targetData: findTask(sysId, milestone) });
      return;
    }

    // System
    const sysBox = e.target.closest('.system-box');
    if (sysBox) {
      const sysId = sysBox.dataset.sysId;
      if (!isSelected(sysId)) { clearSelection(); select(sysId, 'system'); }
      showContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: cp.x, canvasY: cp.y, type: 'system', targetId: sysId, targetData: findTask(sysId, milestone) });
      return;
    }

    // Frame
    const frameEl = e.target.closest('.canvas-frame');
    if (frameEl) {
      const frameId = frameEl.dataset.frameId;
      if (!isSelected(frameId)) { clearSelection(); select(frameId, 'frame'); }
      const frame = milestone.frames.find((f) => f.id === frameId);
      showContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: cp.x, canvasY: cp.y, type: 'frame', targetId: frameId, targetData: frame });
      return;
    }

    // Standalone
    const standaloneEl = e.target.closest('.standalone-node');
    if (standaloneEl) {
      const frameId = standaloneEl.dataset.frameId;
      if (!isSelected(frameId)) { clearSelection(); select(frameId, 'frame'); }
      const frame = milestone.frames.find((f) => f.id === frameId);
      showContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: cp.x, canvasY: cp.y, type: 'frame', targetId: frameId, targetData: frame });
      return;
    }

    // Canvas (empty space)
    showContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: cp.x, canvasY: cp.y, type: 'canvas' });
  }, [screenToCanvas, showContextMenu, milestone, isSelected, clearSelection, select]);

  // ─── Global mouse listeners ───
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ─── Touch input → existing mouse pipeline ───
  // Strategy:
  //   • Touchstart only ARMs the long-press timer; it does NOT call
  //     handleMouseDown. That avoids opening an in-flight drag we'd then have
  //     to spuriously close (which previously triggered onMapClick → edit
  //     modal, swallowing the contextmenu we wanted from the long-press).
  //   • First real movement past tolerance lazily fires handleMouseDown with
  //     the START coordinates (so existing drag/pan code initialises with the
  //     correct grab offset), then handleMouseMove with the live coordinates.
  //   • Plain taps (no movement, no long-press) DON'T preventDefault — we let
  //     the browser synthesise mousedown/mouseup/click naturally, which runs
  //     handleMouseDown + handleMouseUp through React just like a mouse click,
  //     so the existing left-click-to-edit behaviour still works.
  //   • Long-press (~500 ms still finger) fires handleContextMenu directly
  //     and arms a flag so the eventual touchend preventDefaults the browser's
  //     synthetic click (otherwise a click would fire on top of the context
  //     menu the moment the user lifts).
  //   • Two fingers → pinch-zoom; cancels any in-flight gesture.
  useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;

    const LONG_PRESS_MS = 500;
    const TAP_MOVE_TOLERANCE = 10;

    const fakeEvent = (touch, button, base) => ({
      button,
      clientX: touch.clientX,
      clientY: touch.clientY,
      target: document.elementFromPoint(touch.clientX, touch.clientY) || (base && base.target),
      shiftKey: !!(base && base.shiftKey),
      ctrlKey: !!(base && base.ctrlKey),
      metaKey: !!(base && base.metaKey),
      preventDefault: () => {},
      stopPropagation: () => {},
    });

    const distance = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const cancelLongPress = () => {
      const tr = touchRef.current;
      if (tr.longPressTimer) { clearTimeout(tr.longPressTimer); tr.longPressTimer = null; }
    };

    const onTouchStart = (e) => {
      const tr = touchRef.current;

      // 2-finger pinch
      if (e.touches.length === 2) {
        cancelLongPress();
        // If a 1-finger drag was in progress, end it cleanly
        if (tr.dragInited) {
          handleMouseUp(fakeEvent(e.changedTouches[0], 0, e));
          tr.dragInited = false;
        }
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        tr.pinch = {
          startDist: distance(t1, t2),
          startZoom: mapZoom,
          midX: (t1.clientX + t2.clientX) / 2,
          midY: (t1.clientY + t2.clientY) / 2,
        };
        e.preventDefault();
        return;
      }

      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      tr.startX = touch.clientX;
      tr.startY = touch.clientY;
      tr.startTarget = touch.target;
      tr.moved = false;
      tr.longPressFired = false;
      tr.dragInited = false;

      // Capture a pointer snapshot so the timer callback has all it needs.
      const startSnapshot = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        target: document.elementFromPoint(touch.clientX, touch.clientY),
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
      };

      tr.longPressTimer = setTimeout(() => {
        if (touchRef.current.moved || touchRef.current.dragInited) return;
        touchRef.current.longPressFired = true;
        // Build a fresh fake event from the captured snapshot — `e` is no
        // longer the active event by the time the timer fires.
        const synthetic = {
          button: 2,
          clientX: startSnapshot.clientX,
          clientY: startSnapshot.clientY,
          target: startSnapshot.target,
          shiftKey: startSnapshot.shiftKey,
          ctrlKey: startSnapshot.ctrlKey,
          metaKey: startSnapshot.metaKey,
          preventDefault: () => {},
          stopPropagation: () => {},
        };
        handleContextMenu(synthetic);
      }, LONG_PRESS_MS);
      // No preventDefault here — let the browser synthesise click for plain
      // taps. We'll preventDefault in touchend if we end up handling the gesture.
    };

    const onTouchMove = (e) => {
      const tr = touchRef.current;

      if (tr.pinch && e.touches.length >= 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const newDist = distance(t1, t2);
        const targetZoom = Math.max(0.2, Math.min(3, tr.pinch.startZoom * (newDist / tr.pinch.startDist)));
        const liveRatio = targetZoom / mapZoom;
        if (Math.abs(liveRatio - 1) > 0.001 && vpRef.current) {
          zoomAtPoint(liveRatio, tr.pinch.midX, tr.pinch.midY, vpRef.current.getBoundingClientRect());
        }
        e.preventDefault();
        return;
      }

      if (e.touches.length !== 1) return;
      // After long-press has fired, ignore further movement — the user is
      // navigating the context menu (or about to lift).
      if (tr.longPressFired) { e.preventDefault(); return; }

      const touch = e.touches[0];
      const dx = touch.clientX - tr.startX;
      const dy = touch.clientY - tr.startY;

      if (!tr.moved && Math.hypot(dx, dy) > TAP_MOVE_TOLERANCE) {
        tr.moved = true;
        cancelLongPress();
        // NOW initialise the drag, using the ORIGINAL start coords so the
        // grab offset matches where the finger first landed.
        const startTouch = { clientX: tr.startX, clientY: tr.startY };
        handleMouseDown(fakeEvent(startTouch, 0, e));
        tr.dragInited = true;
      }
      if (tr.dragInited) {
        handleMouseMove(fakeEvent(touch, 0, e));
        e.preventDefault();
      }
    };

    const onTouchEnd = (e) => {
      const tr = touchRef.current;
      cancelLongPress();

      // End of pinch
      if (tr.pinch && e.touches.length < 2) {
        tr.pinch = null;
        if (e.touches.length === 1) {
          // One finger remains — treat as a fresh touchstart so the user can
          // continue with a single-touch gesture.
          const touch = e.touches[0];
          tr.startX = touch.clientX;
          tr.startY = touch.clientY;
          tr.moved = false;
          tr.longPressFired = false;
          tr.dragInited = false;
        }
        e.preventDefault();
        return;
      }

      // Long-press: contextmenu already opened. Suppress the synthesised click.
      if (tr.longPressFired) {
        tr.longPressFired = false;
        e.preventDefault();
        return;
      }

      // Drag ended: we handled the gesture, suppress the synthesised click too.
      if (tr.dragInited) {
        const touch = e.changedTouches[0];
        handleMouseUp(fakeEvent(touch, 0, e));
        tr.dragInited = false;
        e.preventDefault();
        return;
      }

      // Plain tap: do nothing. Browser synthesises mousedown→mouseup→click,
      // which runs handleMouseDown + handleMouseUp via React's listeners and
      // ends up calling onMapClick → edit modal, etc.
    };

    const opts = { passive: false };
    vp.addEventListener('touchstart', onTouchStart, opts);
    vp.addEventListener('touchmove', onTouchMove, opts);
    vp.addEventListener('touchend', onTouchEnd, opts);
    vp.addEventListener('touchcancel', onTouchEnd, opts);

    return () => {
      cancelLongPress();
      vp.removeEventListener('touchstart', onTouchStart, opts);
      vp.removeEventListener('touchmove', onTouchMove, opts);
      vp.removeEventListener('touchend', onTouchEnd, opts);
      vp.removeEventListener('touchcancel', onTouchEnd, opts);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleContextMenu, mapZoom, zoomAtPoint]);

  // ─── Keyboard: Ctrl+C, Ctrl+V, Delete, Escape ───
  useEffect(() => {
    const handler = (e) => {
      if (hidden) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      const k = e.key.toLowerCase();

      // Escape → clear selection
      if (e.key === 'Escape' && selectionRef.current.length > 0) {
        clearSelection();
        return;
      }

      // Ctrl+C → copy
      if ((e.ctrlKey || e.metaKey) && k === 'c' && !e.shiftKey) {
        if (selectionRef.current.length > 0) {
          e.preventDefault();
          copyToClipboard();
        }
        return;
      }

      // Ctrl+V → paste
      if ((e.ctrlKey || e.metaKey) && k === 'v' && !e.shiftKey) {
        if (clipboardRef.current) {
          e.preventDefault();
          // Paste at viewport center
          if (vpRef.current) {
            const rect = vpRef.current.getBoundingClientRect();
            const cp = screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2, rect);
            pasteFromClipboard(cp.x, cp.y);
          }
        }
        return;
      }

      // Delete / Backspace → delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectionRef.current.length > 0) {
        e.preventDefault();
        if (onDeleteSelected) onDeleteSelected(selectionRef.current);
        clearSelection();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [hidden, clearSelection, copyToClipboard, pasteFromClipboard, screenToCanvas, onDeleteSelected]);

  const handleAuxClick = useCallback((e) => {
    if (e.button === 1) e.preventDefault();
  }, []);

  const handleDeleteArrowDirect = useCallback((arrowId) => {
    if (onDeleteArrow) onDeleteArrow(arrowId);
  }, [onDeleteArrow]);

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
        let w = width, h = height;
        if (w > 200 || h > 200) {
          if (w >= h) { h = Math.round((h / w) * 200); w = 200; }
          else { w = Math.round((w / h) * 200); h = 200; }
        }
        if (sysId) onAddImage(sysId, { url, w, h });
        else onAddLooseImage({ url, w, h, x: canvasX || 100, y: canvasY || 100 });
      } catch (err) {
        console.error('Image upload failed:', err);
      }
    };
    input.click();
  }, [onAddImage, onAddLooseImage]);

  // ─── Context menu copy/paste handlers ───
  const handleCopy = useCallback(() => {
    copyToClipboard();
  }, [copyToClipboard]);

  /**
   * Wrap a single-item delete handler so that if the target is part of a
   * multi-selection, the entire selection is deleted in one shot. Otherwise
   * falls through to the normal single-item delete.
   */
  const handleBulkAwareDelete = useCallback((id, singleHandler) => {
    const sel = selectionRef.current;
    if (sel.length > 1 && sel.some((s) => s.id === id) && onDeleteSelected) {
      onDeleteSelected(sel);
      clearSelection();
      return;
    }
    if (singleHandler) singleHandler(id);
  }, [onDeleteSelected, clearSelection]);

  const handleDeleteTask = useCallback((id) => handleBulkAwareDelete(id, onDeleteTask), [handleBulkAwareDelete, onDeleteTask]);
  const handleDeleteSystem = useCallback((id) => handleBulkAwareDelete(id, onDeleteSystem), [handleBulkAwareDelete, onDeleteSystem]);
  const handleDeleteFrame = useCallback((id) => handleBulkAwareDelete(id, onDeleteFrame), [handleBulkAwareDelete, onDeleteFrame]);
  const handleDeleteLooseImage = useCallback((id) => handleBulkAwareDelete(id, onDeleteLooseImage), [handleBulkAwareDelete, onDeleteLooseImage]);

  const handlePaste = useCallback((cx, cy) => {
    pasteFromClipboard(cx, cy);
  }, [pasteFromClipboard]);

  const hasClipboard = hasClip;

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
        <ArrowLayer
          arrows={milestone.arrows || []}
          containerRef={mapInnerRef}
          onDeleteArrow={handleDeleteArrowDirect}
          preview={arrowMode && arrowPreview ? { fromId: arrowMode.fromId, toX: arrowPreview.x, toY: arrowPreview.y } : null}
        />

        {milestone.frames.map((frame) =>
          frame.standalone ? (
            <StandaloneNode key={frame.id} frame={frame} selected={isSelected(frame.id)} />
          ) : (
            <CanvasFrame key={frame.id} frame={frame} selected={isSelected(frame.id)} />
          )
        )}
        {(milestone.looseSystems || []).map((sys) => (
          <LooseSystem key={sys.id} system={sys} selected={isSelected(sys.id)} />
        ))}
        {(milestone.looseTasks || []).map((task) => (
          <LooseTask key={task.id} task={task} selected={isSelected(task.id)} />
        ))}
        {(milestone.looseImages || []).map((img) => (
          <LooseImage key={img.id} image={img} selected={isSelected(img.id)} />
        ))}
      </div>

      {/* Selection box overlay */}
      {selectionBox && (
        <div className="selection-box" style={{
          position: 'fixed',
          left: selectionBox.x1, top: selectionBox.y1,
          width: selectionBox.x2 - selectionBox.x1,
          height: selectionBox.y2 - selectionBox.y1,
        }} />
      )}

      {arrowMode && (
        <div className="arrow-mode-indicator">
          Click a target element to draw arrow &middot; <span onClick={() => setArrowMode(null)}>ESC to cancel</span>
        </div>
      )}

      <div className="map-controls">
        <button className="map-ctrl-btn" onClick={() => vpRef.current && zoomAtCenter(-0.1, vpRef.current.getBoundingClientRect())}>&#8722;</button>
        <div className="map-zoom-label">{zoomPercent}%</div>
        <button className="map-ctrl-btn" onClick={() => vpRef.current && zoomAtCenter(0.1, vpRef.current.getBoundingClientRect())}>+</button>
        <button className="map-ctrl-btn" onClick={resetView} style={{ fontSize: 11 }}>&#x27F2;</button>
      </div>

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
          onDeleteTask={handleDeleteTask}
          onDeleteSystem={handleDeleteSystem}
          onDeleteFrame={handleDeleteFrame}
          onStartArrow={handleStartArrow}
          onAddImage={handleAddImage}
          onUpdateImage={onUpdateImage}
          onUpdateLooseImage={onUpdateLooseImage}
          onDeleteImage={onDeleteImage}
          onDeleteLooseImage={handleDeleteLooseImage}
          onMoveImageLayer={onMoveImageLayer}
          onDetachImage={onDetachImage}
          onCopy={handleCopy}
          onPaste={handlePaste}
          hasClipboard={hasClipboard}
          onBulkSetSprint={onBulkSetSprint}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
