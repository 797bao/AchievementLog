import { useRef, useCallback } from 'react';
import { CLICK_THRESHOLD } from '../plannerData';
import { snapToGrid } from '../plannerHelpers';

export default function useCanvasDrag({ mapZoom, screenToCanvas, onDropTask, onDropSystem, onMoveFrame, onMapClick }) {
  const dragRef = useRef(null);

  const createGhost = (el, e) => {
    const r = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.id = 'drag-ghost';
    ghost.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;pointer-events:none;z-index:10000;opacity:.85;box-shadow:0 12px 32px rgba(0,0,0,.5);border-radius:10px;transform:rotate(1deg) scale(1.02);transition:none;`;
    document.body.appendChild(ghost);
    return { el: ghost, ox: e.clientX - r.left, oy: e.clientY - r.top };
  };

  const removeGhost = () => {
    const g = document.getElementById('drag-ghost');
    if (g) g.remove();
  };

  const clearDropHighlights = () => {
    document.querySelectorAll('.drop-highlight').forEach((el) => el.classList.remove('drop-highlight'));
  };

  const findDropTargetAt = (sx, sy, dragType, dragId) => {
    const ghost = document.getElementById('drag-ghost');
    if (ghost) ghost.style.display = 'none';
    const el = document.elementFromPoint(sx, sy);
    if (ghost) ghost.style.display = '';
    if (!el) return null;

    if (dragType === 'task') {
      const sg = el.closest('.sub-group');
      if (sg && sg.dataset.sysId !== dragId) return { type: 'subgroup', id: sg.dataset.sysId, el: sg };
      const sb = el.closest('.system-box');
      if (sb && sb.dataset.sysId !== dragId) return { type: 'system', id: sb.dataset.sysId, el: sb };
    }
    if (dragType === 'system') {
      // Allow dropping system into another system (nested)
      const sb = el.closest('.system-box');
      if (sb && sb.dataset.sysId !== dragId) return { type: 'system', id: sb.dataset.sysId, el: sb };
      // Allow dropping system into a frame
      const fr = el.closest('.canvas-frame');
      if (fr) return { type: 'frame', id: fr.dataset.frameId, el: fr };
    }
    return null;
  };

  const highlightDropTarget = (e) => {
    clearDropHighlights();
    const state = dragRef.current;
    if (!state) return;
    const target = findDropTargetAt(e.clientX, e.clientY, state.type, state.id);
    if (target) target.el.classList.add('drop-highlight');
  };

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return false;

    // Check resize handles (handled separately)
    if (e.target.closest('.resize-handle')) return false;

    // Check draggable elements (most specific first)
    const taskEl = e.target.closest('.task-item');
    const looseTaskEl = e.target.closest('.loose-task');
    const subGroupHeader = e.target.closest('.sub-group-header');
    const sysHeader = e.target.closest('.system-box-header');
    const frameDragBar = e.target.closest('.frame-drag-bar');
    const standaloneEl = e.target.closest('.standalone-node');

    // Compute grab offset in screen pixels from element's top-left
    const initDrag = (type, id, srcEl, extras = {}) => {
      const r = srcEl.getBoundingClientRect();
      dragRef.current = {
        type,
        id,
        srcEl,
        mouseX: e.clientX,
        mouseY: e.clientY,
        grabScreenOx: e.clientX - r.left,
        grabScreenOy: e.clientY - r.top,
        ghost: null,
        dragging: false,
        ...extras,
      };
      e.preventDefault();
      return true;
    };

    if (taskEl) return initDrag('task', taskEl.dataset.taskId, taskEl);
    if (looseTaskEl) return initDrag('task', looseTaskEl.dataset.taskId, looseTaskEl);
    if (subGroupHeader) {
      const sg = subGroupHeader.closest('.sub-group');
      return initDrag('system', sg.dataset.sysId, sg);
    }
    if (sysHeader) {
      const sb = sysHeader.closest('.system-box');
      return initDrag('system', sb.dataset.sysId, sb);
    }
    if (frameDragBar) {
      const fr = frameDragBar.closest('.canvas-frame');
      return initDrag('frame', fr.dataset.frameId, fr);
    }
    if (standaloneEl) {
      return initDrag('standalone', standaloneEl.dataset.frameId, standaloneEl, {
        sysId: standaloneEl.dataset.sysId,
      });
    }

    return false; // Not a drag target
  }, []);

  const onMouseMove = useCallback((e) => {
    const state = dragRef.current;
    if (!state) return false;

    const dx = e.clientX - state.mouseX;
    const dy = e.clientY - state.mouseY;

    if (!state.dragging) {
      if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) {
        state.dragging = true;
        state.ghost = createGhost(state.srcEl, e);
        state.srcEl.classList.add('canvas-dragging');
      }
      return true;
    }

    // Move ghost
    state.ghost.el.style.left = (e.clientX - state.ghost.ox) + 'px';
    state.ghost.el.style.top = (e.clientY - state.ghost.oy) + 'px';
    highlightDropTarget(e);
    return true;
  }, []);

  const onMouseUp = useCallback((e, vpRect) => {
    const state = dragRef.current;
    if (!state) return false;
    dragRef.current = null;
    clearDropHighlights();

    if (!state.dragging) {
      // It was a click
      if (onMapClick) onMapClick(state, e);
      return true;
    }

    state.srcEl.classList.remove('canvas-dragging');
    removeGhost();

    // Compute canvas position adjusted for grab offset
    const rawCp = screenToCanvas(e.clientX, e.clientY, vpRect);
    const cp = {
      x: snapToGrid(rawCp.x - state.grabScreenOx / mapZoom),
      y: snapToGrid(rawCp.y - state.grabScreenOy / mapZoom),
    };

    const target = findDropTargetAt(e.clientX, e.clientY, state.type, state.id);

    if (state.type === 'frame' || state.type === 'standalone') {
      const ddx = (e.clientX - state.mouseX) / mapZoom;
      const ddy = (e.clientY - state.mouseY) / mapZoom;
      if (onMoveFrame) onMoveFrame(state.id, snapToGrid(ddx), snapToGrid(ddy));
    } else if (state.type === 'system') {
      if (onDropSystem) onDropSystem(state.id, target, cp);
    } else if (state.type === 'task') {
      if (onDropTask) onDropTask(state.id, target, cp);
    }

    return true;
  }, [mapZoom, screenToCanvas, onDropTask, onDropSystem, onMoveFrame, onMapClick]);

  const isDragging = useCallback(() => {
    return dragRef.current !== null;
  }, []);

  return { onMouseDown, onMouseMove, onMouseUp, isDragging };
}
