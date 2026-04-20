import React, { useState, useEffect, useRef } from 'react';
import { TYPE_ICON_FILES, STATUSES, STATUS_LABELS, STATUS_COLORS } from '../plannerData';

/**
 * Generic dark-themed modal for the Planner.
 * `fields` array defines the form:
 *   { key, label, type: 'text'|'icon-select'|'status-select', value, placeholder }
 */
export default function PlannerModal({ title, fields, onSubmit, onClose }) {
  const [values, setValues] = useState(() => {
    const init = {};
    fields.forEach((f) => { init[f.key] = f.value || ''; });
    return init;
  });
  const firstRef = useRef(null);

  useEffect(() => {
    if (firstRef.current) firstRef.current.focus();
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleChange = (key, val) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(values);
  };

  let refIdx = 0;

  return (
    <div className="planner-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="planner-modal" onSubmit={handleSubmit}>
        <div className="pm-title">{title}</div>

        {fields.map((f) => (
          <div className="pm-field" key={f.key}>
            <label className="pm-label">{f.label}</label>

            {f.type === 'text' && (
              <input
                ref={refIdx++ === 0 ? firstRef : null}
                className="pm-input"
                type="text"
                value={values[f.key]}
                onChange={(e) => handleChange(f.key, e.target.value)}
                placeholder={f.placeholder || ''}
                spellCheck={false}
              />
            )}

            {f.type === 'icon-select' && (
              <div className="pm-icon-grid">
                {Object.entries(TYPE_ICON_FILES).map(([type, src]) => (
                  <div
                    key={type}
                    className={`pm-icon-item${values[f.key] === type ? ' active' : ''}`}
                    onClick={() => handleChange(f.key, type)}
                  >
                    <img src={src} alt={type} className="pm-icon-img" />
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
