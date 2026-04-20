import React, { useState, useEffect, useCallback } from 'react';
import { ref, get, set } from 'firebase/database';
import { database } from '../../firebase';

const FAV_PATH = 'planner/favoriteColors';

export default function ColorPicker({ label, value, onChange, defaultValue }) {
  const [hex, setHex] = useState(value || '#E8985A');
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    if (value) setHex(value);
  }, [value]);

  // Load favorites from Firebase on mount
  useEffect(() => {
    get(ref(database, FAV_PATH))
      .then((snap) => {
        if (snap.exists()) {
          const val = snap.val();
          setFavorites(Array.isArray(val) ? val : Object.values(val));
        }
      })
      .catch(() => {});
  }, []);

  const handleSelect = useCallback((color) => {
    setHex(color);
    onChange(color);
  }, [onChange]);

  const handleHexChange = useCallback((e) => {
    const v = e.target.value;
    setHex(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      onChange(v);
    }
  }, [onChange]);

  const handleHexBlur = useCallback(() => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      setHex(value || '#E8985A');
    }
  }, [hex, value]);

  const addFavorite = useCallback(() => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const updated = [...favorites.filter((f) => f !== hex), hex];
    setFavorites(updated);
    set(ref(database, FAV_PATH), updated).catch(() => {});
  }, [hex, favorites]);

  const removeFavorite = useCallback((color) => {
    const updated = favorites.filter((f) => f !== color);
    setFavorites(updated);
    set(ref(database, FAV_PATH), updated.length > 0 ? updated : null).catch(() => {});
  }, [favorites]);

  const handleReset = useCallback(() => {
    const def = defaultValue || '';
    setHex(def || '#E8985A');
    onChange(def);
  }, [defaultValue, onChange]);

  const stopMouse = useCallback((e) => {
    e.stopPropagation();
  }, []);

  return (
    <div className="color-picker-popover cp-compact" onMouseDown={stopMouse} onClick={(e) => e.stopPropagation()}>
      {label && <div className="cp-label">{label}</div>}

      <div className="cp-input-row">
        <div className="cp-preview" style={{ background: hex }} />
        <input
          className="cp-hex-input"
          type="text"
          value={hex}
          onChange={handleHexChange}
          onBlur={handleHexBlur}
          maxLength={7}
          spellCheck={false}
        />
        <button className="cp-fav-btn" onClick={addFavorite} title="Add to favorites">
          &#9733;
        </button>
        <button className="cp-reset-btn-sm" onClick={handleReset} title="Reset to default">
          &#10006;
        </button>
      </div>

      {/* Favorites (blank by default, user builds this palette) */}
      {favorites.length > 0 && (
        <div className="cp-swatch-grid">
          {favorites.map((c) => (
            <div
              key={c}
              className={`cp-swatch fav${c === hex ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => handleSelect(c)}
              onContextMenu={(e) => { e.preventDefault(); removeFavorite(c); }}
              title={`${c} (right-click to remove)`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
