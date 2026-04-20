import React, { useMemo } from 'react';
import { MONTH_NAMES } from './plannerData';
import {
  getAllLeaves,
  parseTime,
  formatTime,
  getTaskExpectedTime,
  getTaskLoggedTime,
} from './plannerHelpers';

/* ─── Type colors & labels ─── */
const TYPE_COLORS = {
  art: '#e91e63',
  anim: '#9c27b0',
  script: '#D7681F',
  fx: '#ff9800',
  rig: '#009688',
  scene: '#795548',
  props: '#607d8b',
  ui: '#00bcd4',
  prefab: '#3f51b5',
  system: '#E8985A',
};

const TYPE_LABELS = {
  art: 'Art',
  anim: 'Animation',
  script: 'Programming',
  fx: 'Effects',
  rig: 'Rigging',
  scene: 'Scene',
  props: 'Properties',
  ui: 'UI',
  prefab: 'Prefab',
  system: 'System',
};

/* ─── Helpers ─── */
function parseMonthKey(mk) {
  if (!mk) return { year: 0, month: 0 };
  const parts = mk.split('-');
  return { year: parseInt(parts[0]), month: parseInt(parts[1]) };
}

function monthKeyLabel(mk) {
  const { year, month } = parseMonthKey(mk);
  return (MONTH_NAMES[month] || '?') + ' ' + year;
}

function monthKeyShort(mk) {
  const { month } = parseMonthKey(mk);
  return MONTH_NAMES[month] || '?';
}

function sortMonthKeys(keys) {
  return [...keys].sort((a, b) => {
    const pa = parseMonthKey(a);
    const pb = parseMonthKey(b);
    return pa.year !== pb.year ? pa.year - pb.year : pa.month - pb.month;
  });
}

/* ─── Bar Chart (SVG) ─── */
function BarChart({ data }) {
  if (data.length === 0) return <div className="metrics-empty">No sprint data yet</div>;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barW = 36;
  const gap = 6;
  const chartH = 150;
  const labelH = 30;
  const topPad = 20;
  const leftPad = 10;
  const chartW = leftPad + data.length * (barW + gap) + 10;

  return (
    <svg
      width={Math.max(chartW, 200)}
      height={chartH + labelH + topPad}
      className="metrics-bar-svg"
    >
      {/* Horizontal grid lines */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={leftPad}
          x2={chartW}
          y1={topPad + chartH * (1 - f)}
          y2={topPad + chartH * (1 - f)}
          stroke="#3c3f47"
          strokeDasharray="4,4"
        />
      ))}

      {data.map((d, i) => {
        const barH = maxVal > 0 ? (d.value / maxVal) * chartH : 0;
        const x = leftPad + i * (barW + gap);
        const y = topPad + chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} fill="#E8985A" rx={3} />
            {d.value > 0 && (
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                fill="#e8eaed"
                fontSize={9}
                fontWeight={600}
              >
                {formatTime(d.value)}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={topPad + chartH + 14}
              textAnchor="middle"
              fill="#9aa0a6"
              fontSize={9}
            >
              {d.shortLabel}
            </text>
            <text
              x={x + barW / 2}
              y={topPad + chartH + 25}
              textAnchor="middle"
              fill="#5f6368"
              fontSize={8}
            >
              {d.yearLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Pie Chart (SVG) ─── */
function PieChart({ segments }) {
  if (segments.length === 0) return <div className="metrics-empty">No category data</div>;

  const total = segments.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="metrics-empty">No logged hours yet</div>;

  const cx = 70;
  const cy = 70;
  const r = 60;
  let currentAngle = -Math.PI / 2;

  const paths = segments.map((seg) => {
    const angle = (seg.value / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    currentAngle += angle;
    const x2 = cx + r * Math.cos(currentAngle);
    const y2 = cy + r * Math.sin(currentAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    // Handle full circle (single segment = 100%)
    let d;
    if (segments.length === 1) {
      d = `M ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx + r - 0.01} ${cy}`;
    } else {
      d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    }

    return { ...seg, d, pct: Math.round((seg.value / total) * 100) };
  });

  return (
    <div className="metrics-pie-wrap">
      <svg width={140} height={140} className="metrics-pie-svg">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} stroke="#1a1b1e" strokeWidth={1.5} />
        ))}
      </svg>
      <div className="metrics-pie-legend">
        {paths.map((p, i) => (
          <div key={i} className="metrics-legend-row">
            <div className="metrics-legend-dot" style={{ background: p.color }} />
            <span className="metrics-legend-label">{p.label}</span>
            <span className="metrics-legend-val">{formatTime(p.value)}</span>
            <span className="metrics-legend-pct">{p.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main MetricsView ─── */
export default function MetricsView({ milestones, onClose }) {
  const metrics = useMemo(() => {
    // Collect all tasks across all milestones
    let allTasks = [];
    milestones.forEach((ms) => {
      allTasks = allTasks.concat(getAllLeaves(ms));
    });

    const totalTasks = allTasks.length;
    const doneTasks = allTasks.filter((t) => t.status === 'done').length;
    let totalExpected = 0;
    let totalLogged = 0;
    allTasks.forEach((t) => {
      totalExpected += getTaskExpectedTime(t);
      totalLogged += getTaskLoggedTime(t);
    });

    // Hours per sprint (from timeLogs)
    const sprintHours = {};
    allTasks.forEach((t) => {
      if (!t.timeLogs) return;
      t.timeLogs.forEach((log) => {
        if (!log.month) return;
        const mins = parseTime(log.duration);
        sprintHours[log.month] = (sprintHours[log.month] || 0) + mins;
      });
    });

    const sortedMonths = sortMonthKeys(Object.keys(sprintHours));
    const barData = sortedMonths.map((mk) => {
      const { year, month } = parseMonthKey(mk);
      return {
        label: monthKeyLabel(mk),
        shortLabel: monthKeyShort(mk),
        yearLabel: String(year),
        value: sprintHours[mk],
      };
    });

    // Hours by task type
    const typeHours = {};
    allTasks.forEach((t) => {
      const logged = getTaskLoggedTime(t);
      if (logged > 0) {
        const typ = t.type || 'script';
        typeHours[typ] = (typeHours[typ] || 0) + logged;
      }
    });

    const pieSegments = Object.keys(typeHours)
      .sort((a, b) => typeHours[b] - typeHours[a])
      .map((typ) => ({
        label: TYPE_LABELS[typ] || typ,
        value: typeHours[typ],
        color: TYPE_COLORS[typ] || '#9aa0a6',
      }));

    return {
      totalTasks,
      doneTasks,
      pct: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
      totalExpected: formatTime(totalExpected),
      totalLogged: formatTime(totalLogged),
      totalLoggedMins: totalLogged,
      totalExpectedMins: totalExpected,
      barData,
      pieSegments,
    };
  }, [milestones]);

  return (
    <div className="metrics-view">
      <div className="metrics-header">
        <button className="board-back" onClick={onClose}>&#9664; Map</button>
        <div className="board-title">Metrics</div>
      </div>

      {/* Summary cards */}
      <div className="metrics-summary">
        <div className="metrics-card">
          <div className="metrics-card-val">{metrics.totalTasks}</div>
          <div className="metrics-card-label">Total Tasks</div>
        </div>
        <div className="metrics-card">
          <div className="metrics-card-val">{metrics.doneTasks}</div>
          <div className="metrics-card-label">Completed</div>
        </div>
        <div className="metrics-card">
          <div className="metrics-card-val">{metrics.pct}%</div>
          <div className="metrics-card-label">Progress</div>
        </div>
        <div className="metrics-card">
          <div className="metrics-card-val">{metrics.totalLogged}</div>
          <div className="metrics-card-label">Hours Logged</div>
        </div>
        <div className="metrics-card">
          <div className="metrics-card-val">{metrics.totalExpected}</div>
          <div className="metrics-card-label">Hours Estimated</div>
        </div>
      </div>

      {/* Sprint Hours Bar Chart */}
      <div className="metrics-section">
        <div className="metrics-section-title">Hours Logged Per Sprint</div>
        <div className="metrics-chart-container">
          <BarChart data={metrics.barData} />
        </div>
      </div>

      {/* Category Breakdown Pie Chart */}
      <div className="metrics-section">
        <div className="metrics-section-title">Hours by Category</div>
        <PieChart segments={metrics.pieSegments} />
      </div>
    </div>
  );
}
