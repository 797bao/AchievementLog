import { useState, useCallback } from 'react';

/**
 * Manages a set of selected canvas elements.
 * Each entry: { id: string, type: 'task'|'system'|'frame'|'image' }
 */
export default function useCanvasSelection() {
  const [selection, setSelection] = useState([]);

  const select = useCallback((id, type) => {
    setSelection([{ id, type }]);
  }, []);

  const toggleSelect = useCallback((id, type) => {
    setSelection((prev) => {
      const exists = prev.find((s) => s.id === id);
      if (exists) return prev.filter((s) => s.id !== id);
      return [...prev, { id, type }];
    });
  }, []);

  const selectMany = useCallback((items) => {
    setSelection(items);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection([]);
  }, []);

  const isSelected = useCallback((id) => {
    return selection.some((s) => s.id === id);
  }, [selection]);

  return {
    selection,
    select,
    toggleSelect,
    selectMany,
    clearSelection,
    isSelected,
  };
}
