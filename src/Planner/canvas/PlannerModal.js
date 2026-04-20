import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TYPE_ICON_FILES, STATUSES, STATUS_LABELS, STATUS_COLORS, MONTH_NAMES } from '../plannerData';

/**
 * Generic dark-themed modal for the Planner.
 * `fields` array defines the form:
 *   { key, label, type: 'text'|'textarea'|'icon-select'|'status-select'|'sprint-select'|'time-logs', value, placeholder }
 *
 * Confirm mode: if `confirm` is truthy, shows a message + confirm/cancel buttons.
 */
export default function PlannerModal({ title, fields, onSubmit, onClose, confirm, confirmLabel }) {
  const [values, setValues] = useState(() => {
    if (confirm) return {};
    const init = {};
    fields.forEach((f) => {
      init[f.key] = f.type === 'time-logs'
        ? (Array.isArray(f.value) ? JSON.parse(JSON.stringify(f.value)) : [])
        : (f.value || '');
    });
    return init;
  });
  const firstRef = useRef(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  useEffect(() => {
    if (firstRef.current) firstRef.current.focus();
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Enter' && (e.target.tagName || '').toLowerCase() !== 'textarea') {
        e.preventDefault();
        onSubmit(valuesRef.current);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, onSubmit]);

  const handleChange = useCallback((key, val) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(values);
  };

  /* ─── Confirm mode ─── */
  if (confirm) {
    return (
      <div className="planner-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="planner-modal">
          {title && <div className="pm-title">{title}</div>}
          <div className="pm-confirm-msg">{confirm}</div>
          <div className="pm-actions">
            <button type="button" className="pm-btn cancel" onClick={onClose}>Cancel</button>
            <button type="button" className="pm-btn danger" onClick={() => onSubmit({})}>{confirmLabel || 'Delete'}</button>
          </div>
        </div>
      </div>
    );
  }

  let refIdx = 0;

  return (
    <div className="planner-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="planner-modal" onSubmit={handleSubmit}>
        {title && <div className="pm-title">{title}</div>}

        {fields.map((f) => (
          <div className="pm-field" key={f.key}>
            <label className="pm-label">{f.label}</label>

            {f.type === 'text' && (
              <div className="pm-input-wrap">
                <input
                  ref={refIdx++ === 0 ? firstRef : null}
                  className="pm-input"
                  type="text"
                  value={values[f.key]}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  placeholder={f.placeholder || ''}
                  spellCheck={false}
                />
                {f.key === 'time' && values[f.key] && (
                  <button type="button" className="pm-input-clear" onClick={() => handleChange(f.key, '')} title="Clear">&times;</button>
                )}
              </div>
            )}

            {f.type === 'textarea' && (
              <textarea
                ref={refIdx++ === 0 ? firstRef : null}
                className="pm-textarea"
                value={values[f.key]}
                onChange={(e) => handleChange(f.key, e.target.value)}
                placeholder={f.placeholder || 'Optional description...'}
                rows={3}
                spellCheck={false}
              />
            )}

            {f.type === 'icon-select' && (
              <div className="pm-icon-grid">
                {['art', 'anim', 'script', 'fx', 'rig', 'scene', 'misc'].map((type) => (
                  <div
                    key={type}
                    className={`pm-icon-item${values[f.key] === type ? ' active' : ''}`}
                    onClick={() => handleChange(f.key, type)}
                  >
                    <img src={TYPE_ICON_FILES[type]} alt={type} className="pm-icon-img" />
                    <span className="pm-icon-label">{type}</span>
                  </div>
                ))}
              </div>
            )}

            {f.type === 'status-select' && (
              <div className="pm-status-grid">
                {STATUSES.map((s) => (
                  <div
                    key={s}
                    className={`pm-status-item${values[f.key] === s ? ' active' : ''}`}
                    onClick={() => handleChange(f.key, s)}
                  >
                    <div className="pm-status-dot" style={{ background: STATUS_COLORS[s] }} />
                    {STATUS_LABELS[s]}
                  </div>
                ))}
              </div>
            )}

            {f.type === 'sprint-select' && (
              <SprintSelector
                value={values[f.key]}
                onChange={(val) => handleChange(f.key, val)}
              />
            )}

            {f.type === 'time-logs' && (
              <TimeLogsEditor
                logs={values[f.key] || []}
                onChange={(newLogs) => handleChange(f.key, newLogs)}
              />
            )}
          </div>
        ))}

        <div className="pm-actions">
          <button type="button" className="pm-btn cancel" onClick={onClose}>Cancel</button>
          <button type="submit" className="pm-btn submit">Save</button>
        </div>
      </form>
    </div>
  );
}

/* ─── Sprint selector (custom dropdown) ─── */
function SprintSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const currentSprint = curYear + '-' + curMonth;

  // Build options starting from Jan 2026 through end of next year
  const options = [];
  const startYear = 2026;
  const endYear = curYear + 1;
  for (let y = startYear; y <= endYear; y++) {
    for (let m = 0; m < 12; m++) {
      options.push({ label: MONTH_NAMES[m] + ' ' + y, value: y + '-' + m });
    }
  }

  const currentLabel = MONTH_NAMES[curMonth] + ' ' + curYear;
  const displayLabel = !value
    ? 'None'
    : (options.find((o) => o.value === value) || {}).label || value;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div className="sprint-selector" ref={ref}>
      <div
        className={`sprint-selector-trigger${value === currentSprint ? ' is-current' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <span>{displayLabel}</span>
        <span className="sprint-selector-arrow">{open ? '\u25B4' : '\u25BE'}</span>
      </div>
      {open && (
        <div className="sprint-selector-dropdown">
          <div
            className={`sprint-option${!value ? ' active' : ''}`}
            onClick={() => handleSelect('')}
          >None</div>
          <div className="sprint-option-sep" />
          <div
            className={`sprint-option sprint-current${value === currentSprint ? ' active' : ''}`}
            onClick={() => handleSelect(currentSprint)}
          >
            <span>{currentLabel}</span>
            <span className="sprint-current-badge">Current Sprint</span>
          </div>
          <div className="sprint-option-sep" />
          {options.filter((o) => o.value !== currentSprint).map((o) => (
            <div
              key={o.value}
              className={`sprint-option${value === o.value ? ' active' : ''}`}
              onClick={() => handleSelect(o.value)}
            >{o.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Time Logs sub-component ─── */
function TimeLogsEditor({ logs, onChange }) {
  const now = new Date();
  const defaultMonth = now.getFullYear() + '-' + now.getMonth();

  const addLog = () => {
    onChange([...logs, { id: 'tl-' + Date.now(), duration: '', month: defaultMonth }]);
  };

  const updateLog = (idx, field, val) => {
    const updated = logs.map((l, i) => i === idx ? { ...l, [field]: val } : l);
    onChange(updated);
  };

  const removeLog = (idx) => {
    onChange(logs.filter((_, i) => i !== idx));
  };

  const monthDisplay = (mk) => {
    if (!mk) return '?';
    const p = mk.split('-');
    return (MONTH_NAMES[parseInt(p[1])] || '?') + ' ' + p[0];
  };

  const cycleMonth = (idx, dir) => {
    const log = logs[idx];
    const p = (log.month || defaultMonth).split('-');
    let y = parseInt(p[0]);
    let m = parseInt(p[1]) + dir;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    updateLog(idx, 'month', y + '-' + m);
  };

  return (
    <div className="tl-editor">
      {logs.map((log, idx) => (
        <div className="tl-row" key={log.id || idx}>
          <input
            className="tl-duration"
            type="text"
            value={log.duration}
            onChange={(e) => updateLog(idx, 'duration', e.target.value)}
            placeholder="e.g. 2h, 30m"
            spellCheck={false}
          />
          <button type="button" className="tl-month-btn" onClick={() => cycleMonth(idx, -1)}>&#9664;</button>
          <span className="tl-month-label">{monthDisplay(log.month)}</span>
          <button type="button" className="tl-month-btn" onClick={() => cycleMonth(idx, 1)}>&#9654;</button>
          <button type="button" className="tl-remove" onClick={() => removeLog(idx)} title="Remove">&#10005;</button>
        </div>
      ))}
      <button type="button" className="tl-add" onClick={addLog}>+ Add Time Entry</button>
    </div>
  );
}
