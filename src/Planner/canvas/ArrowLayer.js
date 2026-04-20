import React, { useState, useEffect, useCallback } from 'react';

function findNodeEl(container, nodeId) {
  if (!container || !nodeId) return null;
  try {
    return (
      container.querySelector('[data-frame-id="' + nodeId + '"]') ||
      container.querySelector('[data-sys-id="' + nodeId + '"]') ||
      container.querySelector('[data-task-id="' + nodeId + '"]')
    );
  } catch (e) {
    return null;
  }
}

function edgePoint(cx, cy, hw, hh, tx, ty) {
  var dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  var sx = Math.abs(dx) > 0 ? hw / Math.abs(dx) : 9999;
  var sy = Math.abs(dy) > 0 ? hh / Math.abs(dy) : 9999;
  var t = Math.min(sx, sy);
  return { x: cx + dx * t, y: cy + dy * t };
}

export default function ArrowLayer({ arrows, containerRef, onDeleteArrow, preview }) {
  const [paths, setPaths] = useState([]);
  const [previewPath, setPreviewPath] = useState(null);

  const computePaths = useCallback(() => {
    if (!containerRef || !containerRef.current) {
      setPaths([]);
      setPreviewPath(null);
      return;
    }
    var container = containerRef.current;
    var cRect = container.getBoundingClientRect();
    if (!cRect || cRect.width === 0) { setPaths([]); setPreviewPath(null); return; }

    var scale = cRect.width / (container.scrollWidth || cRect.width) || 1;
    var result = [];

    if (arrows && arrows.length > 0) {
      for (var i = 0; i < arrows.length; i++) {
        var a = arrows[i];
        var fromEl = findNodeEl(container, a.fromId);
        var toEl = findNodeEl(container, a.toId);
        if (!fromEl || !toEl) continue;

        var fr = fromEl.getBoundingClientRect();
        var tr = toEl.getBoundingClientRect();

        var fcx = (fr.left + fr.width / 2 - cRect.left) / scale;
        var fcy = (fr.top + fr.height / 2 - cRect.top) / scale;
        var tcx = (tr.left + tr.width / 2 - cRect.left) / scale;
        var tcy = (tr.top + tr.height / 2 - cRect.top) / scale;

        var s = edgePoint(fcx, fcy, fr.width / 2 / scale, fr.height / 2 / scale, tcx, tcy);
        var e = edgePoint(tcx, tcy, tr.width / 2 / scale, tr.height / 2 / scale, fcx, fcy);

        result.push({ id: a.id, x1: s.x, y1: s.y, x2: e.x, y2: e.y });
      }
    }

    setPaths(result);

    // Compute preview arrow
    if (preview && preview.fromId) {
      var srcEl = findNodeEl(container, preview.fromId);
      if (srcEl) {
        var sr = srcEl.getBoundingClientRect();
        var scx = (sr.left + sr.width / 2 - cRect.left) / scale;
        var scy = (sr.top + sr.height / 2 - cRect.top) / scale;
        var ep = edgePoint(scx, scy, sr.width / 2 / scale, sr.height / 2 / scale, preview.toX, preview.toY);
        setPreviewPath({ x1: ep.x, y1: ep.y, x2: preview.toX, y2: preview.toY });
      } else {
        setPreviewPath(null);
      }
    } else {
      setPreviewPath(null);
    }
  }, [arrows, containerRef, preview]);

  useEffect(() => {
    var raf = requestAnimationFrame(computePaths);
    return function() { cancelAnimationFrame(raf); };
  }, [computePaths]);

  var handleCtx = useCallback(function(ev, arrowId) {
    ev.preventDefault();
    ev.stopPropagation();
    if (onDeleteArrow) onDeleteArrow(arrowId);
  }, [onDeleteArrow]);

  if (paths.length === 0 && !previewPath) return null;

  return React.createElement('svg', {
    style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 0 }
  },
    React.createElement('defs', null,
      React.createElement('marker', { id: 'arrowhead', markerWidth: 10, markerHeight: 8, refX: 9, refY: 4, orient: 'auto', markerUnits: 'userSpaceOnUse' },
        React.createElement('polygon', { points: '0 0, 10 4, 0 8', fill: '#5f6368' })
      ),
      React.createElement('marker', { id: 'arrowhead-hover', markerWidth: 10, markerHeight: 8, refX: 9, refY: 4, orient: 'auto', markerUnits: 'userSpaceOnUse' },
        React.createElement('polygon', { points: '0 0, 10 4, 0 8', fill: '#ea4335' })
      ),
      React.createElement('marker', { id: 'arrowhead-preview', markerWidth: 10, markerHeight: 8, refX: 9, refY: 4, orient: 'auto', markerUnits: 'userSpaceOnUse' },
        React.createElement('polygon', { points: '0 0, 10 4, 0 8', fill: '#8ab4f8' })
      )
    ),
    // Existing arrows
    paths.map(function(p) {
      return React.createElement('g', { key: p.id, className: 'arrow-group' },
        React.createElement('line', {
          x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2,
          stroke: 'transparent', strokeWidth: 14,
          style: { cursor: 'pointer', pointerEvents: 'auto' },
          onContextMenu: function(ev) { handleCtx(ev, p.id); }
        }),
        React.createElement('line', {
          className: 'arrow-line',
          x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2,
          stroke: '#5f6368', strokeWidth: 2, strokeDasharray: '6,4',
          markerEnd: 'url(#arrowhead)', pointerEvents: 'none'
        })
      );
    }),
    // Preview arrow (while drawing)
    previewPath && React.createElement('line', {
      key: 'preview',
      x1: previewPath.x1, y1: previewPath.y1,
      x2: previewPath.x2, y2: previewPath.y2,
      stroke: '#8ab4f8', strokeWidth: 2, strokeDasharray: '4,4',
      markerEnd: 'url(#arrowhead-preview)', pointerEvents: 'none',
      opacity: 0.7
    })
  );
}
