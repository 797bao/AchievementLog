import React, { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { MONTH_NAMES } from './plannerData';
import {
  getAllLeaves,
  parseTime,
  formatTime,
  getTaskExpectedTime,
  getTaskLoggedTime,
  iconFor,
} from './plannerHelpers';

/* ─── Type colors & labels (the 7 canonical task types) ───
   Vivid, harmonized palette. Most colors stay close to their originals so
   the chart still has real punch — only the three that were noticeably
   "louder" than the rest (neon green, pure red, lemon yellow) get nudged
   down so all segments live at roughly the same saturation level. */
const TYPE_COLORS = {
  anim:   '#5ECDE9',  // cyan (kept — already balanced)
  art:    '#4DBE48',  // green — was #3ECE38, less neon, more leaf-green
  fx:     '#DB900B',  // amber (kept)
  misc:   '#A775D4',  // violet (kept)
  rig:    '#DC4A4A',  // red — was #EC1F1F, warmer/less fluorescent
  scene:  '#DBC34D',  // yellow — was #EDD655, leans amber so it stops vibrating
  script: '#7585D3',  // indigo (kept)
};

/** Format minutes as a decimal-hour string (e.g. 195 → "3.25h"), used by
 *  the daily bar totals where "3h 15m" felt too noisy. Rounds to 2 decimals
 *  and trims trailing zeros so 60 → "1h", 90 → "1.5h", 195 → "3.25h". */
function formatHoursDecimal(mins) {
  if (!mins || mins <= 0) return '0';
  const h = Math.round((mins / 60) * 100) / 100;
  return h + 'h';
}

/** Luminance-based text color picker — white on dark fills, near-black on light. */
function bestTextOn(hex) {
  if (typeof hex !== 'string' || hex.length < 7) return '#fff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // ITU-R BT.601 luma — close enough for picking text color.
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 165 ? '#1a1b1e' : '#fff';
}

const TYPE_LABELS = {
  anim:   'Animation',
  art:    'Art',
  fx:     'Effects',
  misc:   'Misc',
  rig:    'Rigging',
  scene:  'Scene',
  script: 'Programming',
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

/** Round `val` (minutes) UP to a "nice" axis maximum that divides evenly into 4 ticks. */
function niceMaxMinutes(val) {
  if (val <= 0) return 60;
  const steps = [15, 30, 60, 90, 120, 180, 240, 360, 480, 600, 720, 960, 1440, 2880];
  for (const s of steps) {
    if (val <= s * 4) return s * 4;
  }
  return Math.ceil(val / 720) * 720; // very large datasets: 12h chunks
}

/* ─── Stacked Bar Chart (SVG) ─── */
function BarChart({ data, onBarClick, emptyMessage, enabledTypes }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  // Filter segments per bar by the enabledTypes set (if provided), then
  // recompute totals and percentages so the visible totals reflect the filter.
  const filteredData = useMemo(() => {
    if (!enabledTypes) return data;
    return data.map((d) => {
      const segs = d.segments.filter((s) => enabledTypes.has(s.type));
      const total = segs.reduce((sum, s) => sum + s.value, 0);
      const segments = segs.map((s) => ({
        ...s,
        pct: total > 0 ? (s.value / total) * 100 : 0,
      }));
      // Daily bars carry a per-task list — filter that to enabled types too.
      const tasks = Array.isArray(d.tasks)
        ? d.tasks.filter((t) => enabledTypes.has(t.type))
        : d.tasks;
      return { ...d, value: total, segments, tasks };
    });
  }, [data, enabledTypes]);
  data = filteredData;
  // Track the container width so the chart fills it instead of being a fixed size.
  const wrapRef = useRef(null);
  const [containerW, setContainerW] = useState(0);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setContainerW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (data.length === 0) return <div className="metrics-empty">{emptyMessage || 'No sprint data yet'}</div>;

  // Daily view (>12 bars) is dense — narrow bars, no hover highlight,
  // no per-bar value labels (too cramped to read).
  const dense = data.length > 12;
  const rawMax = Math.max(...data.map((d) => d.value), 1);
  const maxVal = niceMaxMinutes(rawMax);

  const chartH = 280;
  const labelH = 30;
  const topPad = 22;
  const leftPad = 12;
  const yAxisW = 52; // room for "12h 30m"-style hour labels on the left

  // Fit bars to container width: each bar's slot is (barW + gap), so
  // barW = innerW / N - gap, clamped to a sane range.
  const innerW = Math.max(0, containerW - yAxisW - leftPad - 12);
  const slot = data.length > 0 ? innerW / data.length : 50;
  const minBar = dense ? 6 : 18;
  const maxBar = dense ? 28 : 90;
  const barW = Math.max(minBar, Math.min(slot - (dense ? 4 : 8), maxBar));
  const gap = Math.max(2, slot - barW);
  const chartW = leftPad + data.length * (barW + gap) + 10;
  const totalW = yAxisW + chartW;

  return (
    <div className="metrics-bar-wrap" ref={wrapRef}>
      <svg
        width={Math.max(totalW, 200)}
        height={chartH + labelH + topPad}
        className="metrics-bar-svg"
      >
        {/* Y-axis grid lines + hour labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = topPad + chartH * (1 - f);
          const minutes = Math.round(maxVal * f);
          return (
            <g key={f}>
              <line
                x1={yAxisW}
                x2={yAxisW + chartW}
                y1={y}
                y2={y}
                stroke="#3c3f47"
                strokeDasharray={f === 0 ? '0' : '4,4'}
              />
              <text
                x={yAxisW - 6}
                y={y + 3}
                textAnchor="end"
                fill="#5f6368"
                fontSize={10}
              >
                {f === 0 ? '0' : formatTime(minutes)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const totalH = maxVal > 0 ? (d.value / maxVal) * chartH : 0;
          const x = yAxisW + leftPad + i * (barW + gap);
          const isHover = hoverIdx === i;
          // Stack segments from the bottom up
          let yCursor = topPad + chartH;
          return (
            <g
              key={i}
              // Empty bars don't participate in hover — hovering one shouldn't
              // dim every other bar around it.
              onMouseEnter={d.value > 0 ? () => setHoverIdx(i) : undefined}
              onMouseLeave={d.value > 0 ? () => setHoverIdx((h) => (h === i ? null : h)) : undefined}
              onClick={onBarClick && d.value > 0 ? () => onBarClick(d) : undefined}
              style={{
                cursor: onBarClick && d.value > 0 ? 'pointer' : 'default',
                // No drop-shadow / glow — the opacity fade on the other bars
                // already conveys focus. Cleaner, more "data-tool" looking.
              }}
            >
              {d.segments.map((seg, j) => {
                const segH = maxVal > 0 ? (seg.value / maxVal) * chartH : 0;
                const isFirst = j === 0;
                const isLast = j === d.segments.length - 1;
                const segY = yCursor - segH;
                const rect = (
                  <rect
                    key={seg.type}
                    x={x}
                    y={segY}
                    width={barW}
                    height={segH}
                    fill={seg.color}
                    opacity={hoverIdx === null || isHover ? 1 : (dense ? 0.55 : 0.45)}
                    // Flat edges everywhere — segments fuse into one cohesive
                    // bar instead of looking like floating tiles.
                  />
                );
                yCursor = segY;
                return rect;
              })}
              {/* Inline per-segment hour labels (spacious mode only).
                  No halo — text color flips automatically based on the
                  segment's luminance so it's always readable. */}
              {!dense && (() => {
                let cursor = topPad + chartH;
                return d.segments.map((seg) => {
                  const segH = maxVal > 0 ? (seg.value / maxVal) * chartH : 0;
                  const segMid = cursor - segH / 2;
                  cursor -= segH;
                  if (segH < 13) return null;
                  return (
                    <text
                      key={'lbl-' + seg.type}
                      x={x + barW / 2}
                      y={segMid + 3}
                      textAnchor="middle"
                      fill={bestTextOn(seg.color)}
                      fontSize={10}
                      fontWeight={600}
                      pointerEvents="none"
                    >
                      {formatTime(seg.value)}
                    </text>
                  );
                });
              })()}
              {/* Bar total above the bar — shown in BOTH modes now. Smaller in
                  dense (daily) mode to avoid neighbour-bar overlap. */}
              {d.value > 0 && (
                <text
                  x={x + barW / 2}
                  y={topPad + chartH - totalH - 6}
                  textAnchor="middle"
                  fill={isHover ? '#fff' : '#e8eaed'}
                  fontSize={dense ? 9 : 10}
                  fontWeight={600}
                  pointerEvents="none"
                >
                  {dense ? formatHoursDecimal(d.value) : formatTime(d.value)}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={topPad + chartH + 14}
                textAnchor="middle"
                fill={d.isCurrent ? '#E8985A' : (isHover ? '#e8eaed' : '#9aa0a6')}
                fontSize={dense ? 9 : 10}
                fontWeight={d.isCurrent || isHover ? 700 : 400}
              >
                {d.shortLabel}
              </text>
              {d.yearLabel && (
                <text
                  x={x + barW / 2}
                  y={topPad + chartH + 26}
                  textAnchor="middle"
                  fill={d.isCurrent ? '#E8985A' : '#5f6368'}
                  fontSize={9}
                  fontWeight={d.isCurrent ? 700 : 400}
                >
                  {d.yearLabel}
                </text>
              )}
              {/* Invisible wide hit target so the user can hover the gap
                  below the bar too. Only rendered for bars with data — empty
                  days have no hit target so they don't capture hover events. */}
              {d.value > 0 && (
                <rect
                  x={x - gap / 2}
                  y={topPad}
                  width={barW + gap}
                  height={chartH + labelH}
                  fill="transparent"
                  pointerEvents="all"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip only shows in daily (dense) mode — monthly hours are inline
          on the bar, so no tooltip is needed there. */}
      {dense && hoverIdx !== null && data[hoverIdx] && data[hoverIdx].value > 0 && (
        <BarTooltip
          bar={data[hoverIdx]}
          left={yAxisW + leftPad + hoverIdx * (barW + gap) + barW + 18}
          top={topPad}
          chartW={totalW}
          idx={hoverIdx}
          barW={barW}
          gap={gap}
          leftPad={yAxisW + leftPad}
        />
      )}

    </div>
  );
}

/* ─── Top-of-chart legend with icons. Clicking an entry toggles the filter. ─── */
function CategoryLegend({ enabledTypes, onToggleType }) {
  return (
    <div className="metrics-cat-legend">
      {Object.keys(TYPE_LABELS).map((typ) => {
        const enabled = enabledTypes.has(typ);
        return (
          <button
            key={typ}
            type="button"
            className={`metrics-cat-pill${enabled ? ' active' : ''}`}
            onClick={() => onToggleType(typ)}
            title={enabled ? `Hide ${TYPE_LABELS[typ]}` : `Show ${TYPE_LABELS[typ]}`}
            style={{ '--cat-color': TYPE_COLORS[typ] }}
          >
            <img src={iconFor(typ)} alt="" className="metrics-cat-icon" />
            <span className="metrics-cat-label">{TYPE_LABELS[typ]}</span>
          </button>
        );
      })}
    </div>
  );
}

function BarTooltip({ bar, left, top, chartW, idx, barW, gap, leftPad }) {
  // If the tooltip would fall off the right edge, anchor to the LEFT of the bar instead.
  const isDaily = Array.isArray(bar.tasks);
  const TOOLTIP_W = isDaily ? 280 : 220;
  const flipLeft = left + TOOLTIP_W > chartW;
  const x = flipLeft
    ? leftPad + idx * (barW + gap) - TOOLTIP_W - 18
    : left;
  return (
    <div
      className="metrics-tooltip"
      style={{ left: Math.max(0, x), top, width: TOOLTIP_W }}
    >
      <div className="metrics-tt-title">{bar.label}</div>
      <div className="metrics-tt-total">Total: <strong>{formatTime(bar.value)}</strong></div>
      <div className="metrics-tt-rows">
        {isDaily
          ? bar.tasks.map((t) => (
              <div key={t.id} className="metrics-tt-row metrics-tt-task-row">
                <img className="metrics-tt-task-icon" src={iconFor(t.type)} alt="" style={{ background: TYPE_COLORS[t.type] || '#9aa0a6' }} />
                <span className="metrics-tt-label" title={t.name}>{t.name}</span>
                <span className="metrics-tt-val">{formatTime(t.mins)}</span>
              </div>
            ))
          : bar.segments.map((seg) => (
              <div key={seg.type} className="metrics-tt-row">
                <span className="metrics-tt-dot" style={{ background: seg.color }} />
                <span className="metrics-tt-label">{seg.label}</span>
                <span className="metrics-tt-val">{formatTime(seg.value)}</span>
                <span className="metrics-tt-pct">{Math.round(seg.pct)}%</span>
              </div>
            ))}
      </div>
    </div>
  );
}

/* ─── Pie Chart (SVG) ─── */
function PieChart({ segments, size = 140, showLegend = true }) {
  if (segments.length === 0) return <div className="metrics-empty">No category data</div>;

  const total = segments.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="metrics-empty">No logged hours yet</div>;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - Math.max(2, size * 0.04); // small inset so the stroke isn't clipped
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

  // A native title gives a free per-segment hover tooltip without adding state.
  const tooltipFor = (p) => `${p.label}: ${formatTime(p.value)} (${p.pct}%)`;

  return (
    <div className="metrics-pie-wrap">
      <svg width={size} height={size} className="metrics-pie-svg">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} stroke="#1a1b1e" strokeWidth={1.5}>
            <title>{tooltipFor(p)}</title>
          </path>
        ))}
      </svg>
      {showLegend && (
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
      )}
    </div>
  );
}

/* ─── Main MetricsView ─── */
export default function MetricsView({ milestones, onClose, onOpenGlobalDay }) {
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

    // Hours per sprint × per category (so we can stack)
    const sprintByType = {};   // { monthKey: { type: minutes } }
    allTasks.forEach((t) => {
      if (!t.timeLogs) return;
      const typ = t.type || 'misc';
      t.timeLogs.forEach((log) => {
        if (!log.month) return;
        const mins = parseTime(log.duration);
        if (!sprintByType[log.month]) sprintByType[log.month] = {};
        sprintByType[log.month][typ] = (sprintByType[log.month][typ] || 0) + mins;
      });
    });

    const sortedMonths = sortMonthKeys(Object.keys(sprintByType));
    // For "is this the current sprint?" detection on the x-axis label.
    const _now = new Date();
    const _curY = _now.getFullYear();
    const _curM = _now.getMonth();
    const barData = sortedMonths.map((mk) => {
      const { year, month } = parseMonthKey(mk);
      const breakdown = sprintByType[mk] || {};
      const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
      // Sort largest segment first so the visually-tallest sits on top.
      const segments = Object.keys(breakdown)
        .sort((a, b) => breakdown[b] - breakdown[a])
        .map((typ) => ({
          type: typ,
          label: TYPE_LABELS[typ] || typ,
          color: TYPE_COLORS[typ] || '#9aa0a6',
          value: breakdown[typ],
          pct: total > 0 ? (breakdown[typ] / total) * 100 : 0,
        }));
      return {
        key: mk,                   // identifies the bar for drill-down
        label: monthKeyLabel(mk),
        shortLabel: monthKeyShort(mk),
        yearLabel: String(year),
        value: total,
        segments,
        isCurrent: year === _curY && month === _curM,
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
      allTasks,
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

  // ── Drill-down: clicking a monthly bar swaps the chart for a per-day view ──
  const [drilledMonth, setDrilledMonth] = useState(null); // 'YYYY-M' or null

  // ── Category filter: every type starts enabled. Clicking a legend pill toggles it. ──
  const [enabledTypes, setEnabledTypes] = useState(() => new Set(Object.keys(TYPE_LABELS)));
  const toggleType = useCallback((typ) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typ)) next.delete(typ); else next.add(typ);
      // Don't allow clicking the last enabled category off — keep at least one.
      if (next.size === 0) return prev;
      return next;
    });
  }, []);

  const dailyData = useMemo(() => {
    if (!drilledMonth) return null;
    const { year, month } = parseMonthKey(drilledMonth);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Pull a timestamp out of a log entry — prefers loggedAt, falls back to id.
    const logTs = (log) => {
      if (log.loggedAt) {
        const parsed = Date.parse(log.loggedAt);
        if (!isNaN(parsed)) return parsed;
      }
      if (typeof log.id === 'string' && log.id.startsWith('tl-')) {
        const parts = log.id.split('-');
        const n = parseInt(parts[1], 10);
        if (!isNaN(n) && n > 0) return n;
      }
      return null;
    };

    // Bucket every log whose loggedAt falls in this calendar month into both
    //   { day → type → minutes }  (for the stacked bar segments)
    //   { day → taskId → {id, name, type, mins} }  (for the per-day tooltip)
    const dayByType = {};
    const dayByTask = {};
    metrics.allTasks.forEach((t) => {
      if (!t.timeLogs) return;
      const typ = t.type || 'misc';
      t.timeLogs.forEach((log) => {
        const ts = logTs(log);
        if (ts == null) return;
        const d = new Date(ts);
        if (d.getFullYear() !== year || d.getMonth() !== month) return;
        const day = d.getDate();
        const mins = parseTime(log.duration);
        if (!dayByType[day]) dayByType[day] = {};
        dayByType[day][typ] = (dayByType[day][typ] || 0) + mins;
        if (!dayByTask[day]) dayByTask[day] = {};
        if (!dayByTask[day][t.id]) {
          dayByTask[day][t.id] = { id: t.id, name: t.name || '(untitled)', type: typ, mins: 0 };
        }
        dayByTask[day][t.id].mins += mins;
      });
    });

    const bars = [];
    const _now = new Date();
    const _isCurMonth = _now.getFullYear() === year && _now.getMonth() === month;
    const _curDay = _now.getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const breakdown = dayByType[day] || {};
      const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
      const segments = Object.keys(breakdown)
        .sort((a, b) => breakdown[b] - breakdown[a])
        .map((typ) => ({
          type: typ,
          label: TYPE_LABELS[typ] || typ,
          color: TYPE_COLORS[typ] || '#9aa0a6',
          value: breakdown[typ],
          pct: total > 0 ? (breakdown[typ] / total) * 100 : 0,
        }));
      const tasks = Object.values(dayByTask[day] || {})
        .sort((a, b) => b.mins - a.mins);
      // Local-time YYYY-MM-DD string used by the date-range filter when this
      // day's bar is clicked to open Global view scoped to that day.
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      // Day-of-week (Mon, Tue, …) — anchors the eye with weekday context.
      const dow = new Date(year, month, day).toLocaleDateString('en-US', { weekday: 'short' });
      bars.push({
        key: `${year}-${month}-${day}`,
        dateStr,
        label: `${MONTH_NAMES[month]} ${day}, ${year}`,
        shortLabel: String(day),
        yearLabel: dow,
        value: total,
        segments,
        tasks,                     // ← drives the daily tooltip
        isCurrent: _isCurMonth && day === _curDay,
      });
    }
    return bars;
  }, [drilledMonth, metrics.allTasks]);

  return (
    <div className="metrics-view">
      <div className="metrics-header">
        <button className="board-back" onClick={onClose}>&#9664; Map</button>
        <div className="board-title">Metrics</div>
      </div>

      {/* Summary cards row */}
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

      {/* Hours Bar Chart — clicking a month swaps to a daily breakdown */}
      <div className="metrics-section metrics-bar-section">
        <div className="metrics-section-title metrics-section-title-row">
          {drilledMonth ? (
            <>
              <button className="metrics-back-btn" onClick={() => setDrilledMonth(null)}>
                &#9664; Back
              </button>
              <span>{monthKeyLabel(drilledMonth)} </span>
            </>
          ) : (
            <span style ={{paddingLeft:20}}>Hours Logged Per Sprint <span className="metrics-section-hint">(click a bar to drill in)</span></span>
          )}
        </div>
        <CategoryLegend enabledTypes={enabledTypes} onToggleType={toggleType} />
        <div className="metrics-chart-container">
          {drilledMonth
            ? <BarChart key={`daily-${drilledMonth}`} data={dailyData || []} emptyMessage="No logged hours this month" enabledTypes={enabledTypes} />
            : <BarChart key="monthly" data={metrics.barData} onBarClick={(bar) => setDrilledMonth(bar.key)} enabledTypes={enabledTypes} />}
        </div>
      </div>

      {/* Hours by Category — pie chart sits at the bottom, sized to fit. */}
      <div className="metrics-section metrics-pie-bottom-section">
        <div className="metrics-section-title">Hours by Category</div>
        <PieChart segments={metrics.pieSegments} size={140} showLegend={true} />
      </div>
    </div>
  );
}
