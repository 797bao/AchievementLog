import { useState, useCallback, useEffect } from 'react';

export default function useContextMenu() {
  const [contextMenu, setContextMenu] = useState(null); // { x, y, canvasX, canvasY }

  const showContextMenu = useCallback((screenX, screenY, canvasX, canvasY) => {
    setContextMenu({ x: screenX, y: screenY, canvasX, canvasY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e) => {
      if (!e.target.closest('.context-menu')) {
        setContextMenu(null);
      }
    };
    // Delay to prevent the same click from closing
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
