import React, { useMemo, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { LOG_START_DATE, LOG_TAGS } from './hooks/useLogFirebase';

/* ─── Date helpers (all local-time; keys are YYYY-MM-DD) ─── */

const pad2 = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayKey = () => toKey(new Date());

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Months from LOG_START_DATE through the CURRENT month, newest first.
 *  The current month lists ALL its days (from the start date onward),
 *  including future ones — so tomorrow can be planned ahead. Past months
 *  list every day they had. Days are oldest-first inside a month. */
function buildMonths() {
  const start = fromKey(LOG_START_DATE);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tKey = toKey(today);

  const months = [];
  let cur = new Date(today.getFullYear(), today.getMonth(), 1);
  const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cur >= startMonth) {
    const monthKey = `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}`;
    const label = `${MONTH_NAMES[cur.getMonth()]} ${cur.getFullYear()}`;
    const lastDay = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const from = start > cur ? start : new Date(cur);

    const days = [];
    for (let d = new Date(from); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const key = toKey(d);
      days.push({ key, future: key > tKey });
    }
    months.push({ monthKey, label, days });
    cur = new Date(cur.getFullYear(), cur.getMonth() - 1, 1);
  }
  return months;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayLabel(key) {
  const d = fromKey(key);
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${DOW[d.getDay()]}`;
}

function dayTitle(key) {
  const d = fromKey(key);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** True when the entry has any text in planned or a tag field. */
function hasContent(entry) {
  if (!entry) return false;
  if (entry.planned && entry.planned.trim()) return true;
  return LOG_TAGS.some(({ key }) => entry[key] && entry[key].trim());
}

/* ─── Tag presentation: icon + accent color per classifier ─── */

const TAG_STYLE = {
  coreMechanics: { icon: '</>',          color: '#5c8ce0', code: true }, // programming-script glyph, blue
  gameFeel:      { icon: '\u{1F3AE}',    color: '#56c8e8' },   // 🎮 teal (user-picked swatch)
  visuals:       { icon: '\u{1F3A8}',    color: '#5cd99a' },   // 🎨 green
  ui:            { icon: '\u{1F5A5}\u{FE0F}', color: '#e87bb8' },  // 🖥️ screen, pink
  ideation:      { icon: '\u{1F4A1}',    color: '#e8cf5c' },   // 💡 yellow
};

/** Faint tint + border derived from the tag's accent color (hex + alpha). */
const tagChipStyle = (color) => ({
  color,
  background: `${color}14`,
  border: `1px solid ${color}3d`,
});

/* ─── Left rail: always-visible month/day tree ─── */

export function LogRail({ entries, selectedDay, onSelectDay }) {
  const months = useMemo(buildMonths, []);
  // Current (first) month expanded; older months collapsed by default.
  const [collapsed, setCollapsed] = useState(() =>
    new Set(months.slice(1).map((m) => m.monthKey))
  );
  const tKey = todayKey();

  const toggle = useCallback((monthKey) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  }, []);

  return (
    <aside className="log-rail">
      <div className="log-rail-title">Log</div>
      {months.map(({ monthKey, label, days }) => {
        const isOpen = !collapsed.has(monthKey);
        const filled = days.filter((d) => hasContent(entries[d.key])).length;
        return (
          <section key={monthKey} className="log-month">
            <button className="log-month-header" onClick={() => toggle(monthKey)}>
              <span className={`log-month-chevron${isOpen ? ' open' : ''}`}>&#x25B8;</span>
              <span className="log-month-label">{label}</span>
              <span className="log-month-count">{filled}/{days.length}</span>
            </button>
            {isOpen && (
              <ul className="log-day-list">
                {days.map(({ key, future }) => {
                  const filledDay = hasContent(entries[key]);
                  const classes = [
                    'log-day-row',
                    filledDay ? 'filled' : '',
                    key === selectedDay ? 'selected' : '',
                    key === tKey ? 'today' : '',
                    future ? 'future' : '',
                  ].filter(Boolean).join(' ');
                  return (
                    <li key={key}>
                      <button className={classes} onClick={() => onSelectDay(key)}>
                        <span className="log-day-dot" />
                        <span className="log-day-label">{dayLabel(key)}</span>
                        {key === tKey && <span className="log-day-today">Today</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </aside>
  );
}

/* ─── Day page: fixed template — Planned + the five tags ─── */

/** Single-line-looking textarea that grows with its content. */
function AutoGrowInput({ id, placeholder, value, onChange }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      id={id}
      className="log-field-input"
      rows={1}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      spellCheck={false}
    />
  );
}

export function LogDayPage({ dateKey, entry, onChange }) {
  const handleField = (field) => (e) => onChange(dateKey, { [field]: e.target.value });
  const isToday = dateKey === todayKey();
  const isFuture = dateKey > todayKey();

  return (
    <div className="log-day-page">
      <h1 className="log-day-title">
        {dayTitle(dateKey)}
        {isToday && <span className="log-title-badge">Today</span>}
        {isFuture && <span className="log-title-badge future">Upcoming</span>}
      </h1>

      {/* Planned is NOT a tag — plain label, no icon, no accent color. */}
      <div className="log-field log-field-planned">
        <label className="log-field-label" htmlFor={`log-planned-${dateKey}`}>
          Planned:
        </label>
        <AutoGrowInput
          id={`log-planned-${dateKey}`}
          placeholder="None"
          value={(entry && entry.planned) || ''}
          onChange={handleField('planned')}
        />
      </div>

      <div className="log-field-divider" />

      {LOG_TAGS.map(({ key, label }) => {
        const style = TAG_STYLE[key] || {};
        return (
          <div className="log-field" key={key}>
            <label
              className="log-field-label log-field-tag"
              htmlFor={`log-${key}-${dateKey}`}
              style={tagChipStyle(style.color)}
            >
              <span className={`log-field-icon${style.code ? ' code' : ''}`}>{style.icon}</span>
              {label}
            </label>
            <AutoGrowInput
              id={`log-${key}-${dateKey}`}
              placeholder="&mdash;"
              value={(entry && entry[key]) || ''}
              onChange={handleField(key)}
            />
          </div>
        );
      })}
    </div>
  );
}
