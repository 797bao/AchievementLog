import React from 'react';

/**
 * Renders chart.js-style point shapes as small SVGs.
 * pointStyle: 'circle' | 'rectRot' | 'rect' | 'triangle' | 'rectRounded' | 'cross' | 'crossRot'
 * bg: fill color (use '#000000' or 'none' for stroke-only)
 * border: stroke color
 * size: pixel size (default 10)
 */
function ShapeIcon({ pointStyle = 'circle', bg = '#fff', border = '#fff', size = 10 }) {
  const half = size / 2;
  const isStroke = bg === '#000000' || bg === 'none' || bg === 'transparent';
  const fill = isStroke ? 'none' : bg;
  const stroke = border;
  const sw = 1.5; // stroke width

  const svgProps = {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    style: { display: 'block', flexShrink: 0 },
  };

  switch (pointStyle.toLowerCase()) {
    case 'rectrot': // diamond (square rotated 45°)
      return (
        <svg {...svgProps}>
          <rect
            x={half - half * 0.7}
            y={half - half * 0.7}
            width={size * 0.7}
            height={size * 0.7}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            transform={`rotate(45 ${half} ${half})`}
          />
        </svg>
      );

    case 'rect': // square
      return (
        <svg {...svgProps}>
          <rect
            x={sw / 2}
            y={sw / 2}
            width={size - sw}
            height={size - sw}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
        </svg>
      );

    case 'triangle':
      return (
        <svg {...svgProps}>
          <polygon
            points={`${half},${sw} ${size - sw},${size - sw} ${sw},${size - sw}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
        </svg>
      );

    case 'rectrounded':
      return (
        <svg {...svgProps}>
          <rect
            x={sw / 2}
            y={sw / 2}
            width={size - sw}
            height={size - sw}
            rx={size * 0.25}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
        </svg>
      );

    case 'cross':
      return (
        <svg {...svgProps}>
          <line x1={half} y1={sw} x2={half} y2={size - sw} stroke={stroke} strokeWidth={sw} />
          <line x1={sw} y1={half} x2={size - sw} y2={half} stroke={stroke} strokeWidth={sw} />
        </svg>
      );

    case 'crossrot':
      return (
        <svg {...svgProps}>
          <line x1={sw} y1={sw} x2={size - sw} y2={size - sw} stroke={stroke} strokeWidth={sw} />
          <line x1={size - sw} y1={sw} x2={sw} y2={size - sw} stroke={stroke} strokeWidth={sw} />
        </svg>
      );

    case 'circle':
    default:
      return (
        <svg {...svgProps}>
          <circle
            cx={half}
            cy={half}
            r={half - sw / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
        </svg>
      );
  }
}

export default ShapeIcon;
