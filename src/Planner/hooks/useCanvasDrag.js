import { useRef, useCallback } from 'react';
import { CLICK_THRESHOLD } from '../plannerData';

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

    if (taskEl) {
      dragRef.current = { type: 'task', id: taskEl.dataset.taskId, srcEl: taskEl, mouseX: e.clientX, mouseY: e.clientY, ghost: null, dragging: false };
      e.preventDefault();
      return true;
    }
    if (looseTaskEl) {
      dragRef.current = { type: 'task', id: looseTaskEl.dataset.taskId, srcEl: looseTaskEl, mouseX: e.clientX, mouseY: e.clientY, ghost: null, dragging: false };
      e.preventDefault();
      return true;
    }
    if (subGroupHeader) {
      const sg = subGroupHeader.closest('.sub-group');
      dragRef.current = { type: 'system', id: sg.dataset.sysId, srcEl: sg, mouseX: e.clientX, mouseY: e.clientY, ghost: null, dragging: false };
      e.preventDefault();
      return true;
    }
    if (sysHeader) {
      const sb = sysHeader.closest('.system-box');
      dragRef.current = { type: 'system', id: sb.dataset.sysId, srcEl: sb, mouseX: e.clientX, mouseY: e.clientY, ghost: null, dragging: false };
      e.preventDefault();
      return true;
    }
    if (frameDragBar) {
      const fr = frameDragBar.closest('.canvas-frame');
      dragRef.current = { type: 'frame', id: fr.dataset.frameId, srcEl: fr, mouseX: e.clientX, mouseY: e.clientY, ghost: null, dragging: false };
      e.preventDefault();
      return true;
    }
    if (standaloneEl) {
      dragRef.current = {
        type: 'standalone',
        id: standaloneEl.dataset.frameId,
        sysId: standaloneEl.dataset.sysId,
        srcEl: standaloneEl,
        mouseX: e.clientX,
        mouseY: e.clientY,
        ghost: null,
        dragging: false,
      };
      e.preventDefault();
      return true;
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

    const cp = screenToCanvas(e.clientX, e.clientY, vpRect);
    const target = findDropTargetAt(e.clientX, e.clientY, state.type, state.id);

    if (state.type === 'frame' || state.type === 'standalone') {
      const ddx = (e.clientX - state.mouseX) / mapZoom;
      const ddy = (e.clientY - state.mouseY) / mapZoom;
      if (onMoveFrame) onMoveFrame(state.id, ddx, ddy);
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
