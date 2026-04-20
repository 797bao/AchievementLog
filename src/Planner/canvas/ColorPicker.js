import React, { useState, useEffect, useCallback } from 'react';
import { DEFAULT_COLOR_PALETTE } from '../plannerData';

const STORAGE_KEY = 'planner-fav-colors';

function loadFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveFavorites(favs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}

export default function ColorPicker({ label, value, onChange, onClose }) {
  const [hex, setHex] = useState(value || '#4285f4');
  const [favorites, setFavorites] = useState(loadFavorites);

  useEffect(() => {
    if (value) setHex(value);
  }, [value]);

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
      setHex(value || '#4285f4');
    }
  }, [hex, value]);

  const addFavorite = useCallback(() => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const updated = [...favorites.filter((f) => f !== hex), hex];
    setFavorites(updated);
    saveFavorites(updated);
  }, [hex, favorites]);

  const removeFavorite = useCallback((color) => {
    const updated = favorites.filter((f) => f !== color);
    setFavorites(updated);
    saveFavorites(updated);
  }, [favorites]);

  return (
    <div className="color-picker-popover" onClick={(e) => e.stopPropagation()}>
      {label && <div className="cp-label">{label}</div>}

      {/* Current color + hex input */}
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
      </div>

      {/* Preset palette */}
      <div className="cp-section-label">Palette</div>
      <div className="cp-swatch-grid">
        {DEFAULT_COLOR_PALETTE.map((c) => (
          <div
            key={c}
            className={`cp-swatch${c === hex ? ' active' : ''}`}
            style={{ background: c }}
            onClick={() => handleSelect(c)}
            title={c}
          />
        ))}
      </div>

      {/* Favorites */}
      {favorites.length > 0 && (
        <>
          <div className="cp-section-label">Favorites</div>
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
        </>
      )}
    </div>
  );
}
