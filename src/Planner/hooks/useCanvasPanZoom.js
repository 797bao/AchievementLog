import { useState, useCallback, useRef } from 'react';

export default function useCanvasPanZoom() {
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [mapZoom, setMapZoom] = useState(1);

  // Refs for mid-drag state (not reactive)
  const panRef = useRef({ isPanning: false, isMidPanning: false, start: { x: 0, y: 0 }, startOffset: { x: 0, y: 0 } });

  const screenToCanvas = useCallback((sx, sy, vpRect) => {
    return {
      x: (sx - vpRect.left - mapPan.x) / mapZoom,
      y: (sy - vpRect.top - mapPan.y) / mapZoom,
    };
  }, [mapPan, mapZoom]);

  const startPan = useCallback((clientX, clientY, isMiddle = false) => {
    const ref = panRef.current;
    if (isMiddle) {
      ref.isMidPanning = true;
    } else {
      ref.isPanning = true;
    }
    ref.start = { x: clientX, y: clientY };
    ref.startOffset = { x: mapPan.x, y: mapPan.y };
  }, [mapPan]);

  const movePan = useCallback((clientX, clientY) => {
    const ref = panRef.current;
    if (!ref.isPanning && !ref.isMidPanning) return false;
    const newX = ref.startOffset.x + (clientX - ref.start.x);
    const newY = ref.startOffset.y + (clientY - ref.start.y);
    setMapPan({ x: newX, y: newY });
    return true;
  }, []);

  const endPan = useCallback((button) => {
    const ref = panRef.current;
    if (button === 1) { ref.isMidPanning = false; }
    if (button === 0) { ref.isPanning = false; }
  }, []);

  const isPanning = useCallback(() => {
    const ref = panRef.current;
    return ref.isPanning || ref.isMidPanning;
  }, []);

  const handleWheel = useCallback((e, vpRect) => {
    const mx = e.clientX - vpRect.left;
    const my = e.clientY - vpRect.top;
    const delta = e.deltaY > 0 ? -0.08 : 0.08;

    setMapZoom((oldZoom) => {
      const newZoom = Math.max(0.2, Math.min(3, oldZoom + delta));
      const ratio = newZoom / oldZoom;
      setMapPan((oldPan) => ({
        x: mx - (mx - oldPan.x) * ratio,
        y: my - (my - oldPan.y) * ratio,
      }));
      return newZoom;
    });
  }, []);

  /**
   * Zoom around an arbitrary screen point by an absolute ratio.
   * Used by pinch-gesture handlers — they compute the scale change from
   * finger distance, not by accumulating deltas.
   */
  const zoomAtPoint = useCallback((scaleRatio, screenX, screenY, vpRect) => {
    const mx = screenX - vpRect.left;
    const my = screenY - vpRect.top;
    setMapZoom((oldZoom) => {
      const newZoom = Math.max(0.2, Math.min(3, oldZoom * scaleRatio));
      const ratio = newZoom / oldZoom;
      setMapPan((oldPan) => ({
        x: mx - (mx - oldPan.x) * ratio,
        y: my - (my - oldPan.y) * ratio,
      }));
      return newZoom;
    });
  }, []);

  const zoomAtCenter = useCallback((delta, vpRect) => {
    const cx = vpRect.width / 2;
    const cy = vpRect.height / 2;
    setMapZoom((oldZoom) => {
      const newZoom = Math.max(0.2, Math.min(3, oldZoom + delta));
      const ratio = newZoom / oldZoom;
      setMapPan((oldPan) => ({
        x: cx - (cx - oldPan.x) * ratio,
        y: cy - (cy - oldPan.y) * ratio,
      }));
      return newZoom;
    });
  }, []);

  const resetView = useCallback(() => {
    setMapPan({ x: 0, y: 0 });
    setMapZoom(1);
  }, []);

  const transformStyle = `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapZoom})`;
  const zoomPercent = Math.round(mapZoom * 100);

  return {
    mapPan,
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
  };
}
