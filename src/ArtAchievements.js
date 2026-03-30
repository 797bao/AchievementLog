import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ref, onValue, set as fbSet, push } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { database, storage } from './firebase';
import './ArtAchievements.css';

function ArtAchievements({ isOwner }) {
  const [illustrations, setIllustrations] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewMode, setViewMode] = useState('grid');
  const [lightbox, setLightbox] = useState(null);
  const [lbScale, setLbScale] = useState(100);
  const [lbBaseScale, setLbBaseScale] = useState(100); // the "fit" scale
  const lightboxImgRef = useRef(null);
  const lbWrapRef = useRef(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newPreviewFile, setNewPreviewFile] = useState(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const unsub = onValue(ref(database, 'illustrations'), (snap) => {
      setIllustrations(snap.val() || {});
      setLoading(false);
    });
    return unsub;
  }, []);

  const sortedEntries = useMemo(() => {
    const entries = Object.entries(illustrations).map(([id, data]) => ({ id, ...data }));
    entries.sort((a, b) => {
      const dateA = a.completedDate || '';
      const dateB = b.completedDate || '';
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return sortOrder === 'asc'
        ? dateA.localeCompare(dateB)
        : dateB.localeCompare(dateA);
    });
    return entries;
  }, [illustrations, sortOrder]);

  const handleAddIllustration = async () => {
    if (!isOwner || !newName || !newDate || !newPreviewFile) return;
    setAdding(true);
    try {
      const newRef = push(ref(database, 'illustrations'));
      const id = newRef.key;
      const fileRef = storageRef(storage, `illustrations/${id}/preview_${newPreviewFile.name}`);
      await uploadBytes(fileRef, newPreviewFile);
      const url = await getDownloadURL(fileRef);
      await fbSet(newRef, {
        name: newName,
        completedDate: newDate,
        previewUrl: url,
      });
      setNewName('');
      setNewDate('');
      setNewPreviewFile(null);
      setShowAddForm(false);
    } catch (err) {
      console.error('Add illustration failed:', err);
    }
    setAdding(false);
  };

  const handlePreviewUpload = async (id, file) => {
    if (!isOwner || !file) return;
    setUploading((prev) => ({ ...prev, [id]: true }));
    try {
      const fileRef = storageRef(storage, `illustrations/${id}/preview_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      const current = illustrations[id] || {};
      await fbSet(ref(database, `illustrations/${id}`), { ...current, previewUrl: url });
    } catch (err) {
      console.error('Preview upload failed:', err);
    }
    setUploading((prev) => ({ ...prev, [id]: false }));
  };

  const handleClipUpload = async (id, file) => {
    if (!isOwner || !file) return;
    setUploading((prev) => ({ ...prev, [id]: true }));
    try {
      const fileRef = storageRef(storage, `illustrations/${id}/${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      const current = illustrations[id] || {};
      await fbSet(ref(database, `illustrations/${id}`), {
        ...current,
        clipUrl: url,
        clipFileName: file.name,
      });
    } catch (err) {
      console.error('Clip upload failed:', err);
    }
    setUploading((prev) => ({ ...prev, [id]: false }));
  };

  const startEdit = (id, field) => {
    setEditingField({ id, field });
    setEditValue(illustrations[id]?.[field] || '');
  };

  const saveEdit = async () => {
    if (!isOwner || !editingField) return;
    const { id, field } = editingField;
    const current = illustrations[id] || {};
    await fbSet(ref(database, `illustrations/${id}`), { ...current, [field]: editValue });
    setEditingField(null);
    setEditValue('');
  };

  const [lbNatW, setLbNatW] = useState(0);
  const [lbNatH, setLbNatH] = useState(0);

  const openLightbox = (id) => {
    setLightbox(id);
    setLbScale(100);
    setLbBaseScale(1);
    setLbNatW(0);
    setLbNatH(0);
    const img = new Image();
    img.src = illustrations[id].previewUrl;
    img.onload = () => {
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      setLbNatW(natW);
      setLbNatH(natH);
      const availW = window.innerWidth * 0.93;
      const availH = window.innerHeight * 0.82;
      const scaleW = availW / natW;
      const scaleH = availH / natH;
      const fitScale = Math.min(scaleW, scaleH, 1);
      setLbBaseScale(fitScale);
      setLbScale(100);
    };
  };

  if (loading) {
    return <div className="art-loading">Loading illustrations...</div>;
  }

  const count = sortedEntries.length;

  const renderCard = (entry, index) => {
    const { id, ...data } = entry;
    const hasPreview = !!data.previewUrl;
    const isUploading = uploading[id];
    const displayNum = index + 1;

    return (
      <div key={id} className={`art-card ${hasPreview ? 'filled' : 'empty'} ${viewMode === 'list' ? 'art-card-list' : ''}`}>
        <div className="art-card-number">{displayNum}</div>

        {/* Preview area */}
        <div className="art-preview-area">
          {hasPreview ? (
            <img
              src={data.previewUrl}
              alt={data.name || `Illustration ${displayNum}`}
              className="art-preview-img"
              onClick={() => openLightbox(id)}
            />
          ) : (
            <div className="art-preview-placeholder">No preview</div>
          )}
          {isOwner && (
            <label className="art-upload-overlay-btn" title="Replace image">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handlePreviewUpload(id, e.target.files[0])}
                style={{ display: 'none' }}
              />
              &#x1F4F7;
            </label>
          )}
        </div>

        {/* Meta row */}
        <div className="art-card-meta">
          {/* Name & Date on same line */}
          <div className="art-meta-row">
            <div className="art-name-section">
              {editingField?.id === id && editingField?.field === 'name' ? (
                <div className="art-inline-edit">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="art-name-input"
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                  />
                  <button className="art-save-btn" onClick={saveEdit}>Save</button>
                  <button className="art-cancel-btn" onClick={() => setEditingField(null)}>Cancel</button>
                </div>
              ) : (
                <span
                  className={`art-name-display ${isOwner ? 'editable' : ''}`}
                  onClick={() => isOwner && startEdit(id, 'name')}
                >
                  {data.name || `Illustration ${displayNum}`}
                </span>
              )}
            </div>

            <div className="art-date-section">
              {editingField?.id === id && editingField?.field === 'completedDate' ? (
                <div className="art-inline-edit">
                  <input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="art-date-input"
                  />
                  <button className="art-save-btn" onClick={saveEdit}>Save</button>
                  <button className="art-cancel-btn" onClick={() => setEditingField(null)}>Cancel</button>
                </div>
              ) : data.completedDate ? (
                <span
                  className={`art-date-display ${isOwner ? 'editable' : ''}`}
                  onClick={() => isOwner && startEdit(id, 'completedDate')}
                >
                  {data.completedDate}
                </span>
              ) : isOwner ? (
                <span className="art-date-display editable" onClick={() => startEdit(id, 'completedDate')}>
                  Set date
                </span>
              ) : null}
            </div>
          </div>

          {/* Clip file */}
          <div className="art-clip-section">
            {data.clipUrl ? (
              <a href={data.clipUrl} download={data.clipFileName} className="art-clip-link" target="_blank" rel="noopener noreferrer">
                {data.clipFileName || 'Download .clip'}
              </a>
            ) : isOwner ? (
              <label className="art-clip-upload-btn">
                <input
                  type="file"
                  accept=".clip"
                  onChange={(e) => handleClipUpload(id, e.target.files[0])}
                  style={{ display: 'none' }}
                />
                Upload .clip
              </label>
            ) : null}
          </div>
        </div>

        {isUploading && <div className="art-uploading-overlay">Uploading...</div>}
      </div>
    );
  };

  return (
    <div className="art-achievements">
      <div className="art-header">
        <img src={`${process.env.PUBLIC_URL}/greenhat.png`} alt="" className="art-header-icon" />
        <h2>Illustrations</h2>
        <span className="art-count">{count}</span>
        <div className="art-controls">
          {isOwner && (
            <button className="art-add-btn" onClick={() => setShowAddForm(!showAddForm)}>
              + Add
            </button>
          )}
          <div className="art-view-toggle">
            <button
              className={`art-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              &#x25A6;
            </button>
            <button
              className={`art-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              &#x2630;
            </button>
          </div>
          <select
            className="art-sort-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </div>
      </div>

      {showAddForm && isOwner && (
        <div className="art-add-form">
          <input
            type="text"
            placeholder="Name *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="art-add-input"
          />
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="art-add-input"
          />
          <label className="art-add-file-label">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewPreviewFile(e.target.files[0])}
              style={{ display: 'none' }}
            />
            {newPreviewFile ? newPreviewFile.name : 'Choose preview image *'}
          </label>
          <button
            className="art-add-submit"
            onClick={handleAddIllustration}
            disabled={!newName || !newDate || !newPreviewFile || adding}
          >
            {adding ? 'Uploading...' : 'Add Illustration'}
          </button>
        </div>
      )}

      <div className={viewMode === 'grid' ? 'art-grid' : 'art-list'}>
        {sortedEntries.map((entry, i) => renderCard(entry, i))}
      </div>

      {/* Lightbox */}
      {lightbox && illustrations[lightbox]?.previewUrl && (
        <div className="art-lightbox" onClick={() => setLightbox(null)}>
          <button className="art-lightbox-close" onClick={(e) => { e.stopPropagation(); setLightbox(null); }}>&times;</button>
          <div className="art-lightbox-title">
            {illustrations[lightbox].name || 'Illustration'}
          </div>
          <div className="art-lightbox-img-wrap" ref={lbWrapRef}>
            {lbNatW > 0 && (
              <img
                ref={lightboxImgRef}
                src={illustrations[lightbox].previewUrl}
                alt={illustrations[lightbox].name || 'Illustration'}
                className="art-lightbox-img"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: Math.round(lbNatW * lbBaseScale * (lbScale / 100)),
                  height: Math.round(lbNatH * lbBaseScale * (lbScale / 100)),
                }}
              />
            )}
          </div>
          <div className="art-lightbox-footer" onClick={(e) => e.stopPropagation()}>
            {illustrations[lightbox].completedDate && (
              <span className="art-lightbox-date">{illustrations[lightbox].completedDate}</span>
            )}
            <div className="art-lightbox-scale">
              <input
                type="range"
                min="20"
                max="300"
                value={lbScale}
                onChange={(e) => setLbScale(Number(e.target.value))}
                className="art-scale-slider"
              />
              <span className="art-scale-label">{lbScale}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ArtAchievements;
