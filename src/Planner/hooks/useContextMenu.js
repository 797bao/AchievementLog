import { useState, useCallback, useEffect } from 'react';

export default function useContextMenu() {
  // { x, y, canvasX, canvasY, type: 'canvas'|'task'|'system', targetId, targetData }
  const [contextMenu, setContextMenu] = useState(null);

  const showContextMenu = useCallback((opts) => {
    setContextMenu({
      x: opts.screenX,
      y: opts.screenY,
      canvasX: opts.canvasX || 0,
      canvasY: opts.canvasY || 0,
      type: opts.type || 'canvas',
      targetId: opts.targetId || null,
      targetData: opts.targetData || null,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e) => {
      if (!e.target.closest('.context-menu') && !e.target.closest('.color-picker-popover')) {
        setContextMenu(null);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [contextMenu]);

  return { contextMenu, showContextMenu, closeContextMenu };
}
