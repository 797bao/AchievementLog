import React, { useState, useEffect, useMemo } from 'react';
import { ref, onValue, set as fbSet, push, remove } from 'firebase/database';
import { database } from './firebase';
import './Quests.css';

function Quests({ isOwner }) {
  const [quests, setQuests] = useState({});
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  // Add subquest
  const [addingSubquest, setAddingSubquest] = useState(null); // quest id
  const [newSubTitle, setNewSubTitle] = useState('');

  // Editing
  const [editingField, setEditingField] = useState(null); // { id, field, subId? }
  const [editValue, setEditValue] = useState('');

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState(null); // "questId" or "questId/subId"

  // Expanded quests (to show/hide subquests)
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    const unsub = onValue(ref(database, 'quests'), (snap) => {
      setQuests(snap.val() || {});
      setLoading(false);
    });
    return unsub;
  }, []);

  // Derive effective status: quest with subquests is completed only if ALL subquests are completed
  const getEffectiveStatus = (data) => {
    const subs = data.subquests ? Object.values(data.subquests) : [];
    if (subs.length === 0) return data.status || 'inactive';
    const allCompleted = subs.every((s) => s.status === 'completed');
    const anyPending = subs.some((s) => s.status === 'pending' || s.status === 'completed');
    if (allCompleted) return 'completed';
    if (anyPending) return 'pending';
    return 'inactive';
  };

  const sortedEntries = useMemo(() => {
    let entries = Object.entries(quests).map(([id, data]) => ({
      id,
      ...data,
      effectiveStatus: getEffectiveStatus(data),
    }));

    if (filterStatus !== 'all') {
      entries = entries.filter((e) => e.effectiveStatus === filterStatus);
    }

    entries.sort((a, b) => {
      const dateA = a.completedDate || a.createdDate || '';
      const dateB = b.completedDate || b.createdDate || '';
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return sortOrder === 'asc'
        ? dateA.localeCompare(dateB)
        : dateB.localeCompare(dateA);
    });
    return entries;
  }, [quests, sortOrder, filterStatus]);

  const counts = useMemo(() => {
    const entries = Object.entries(quests).map(([, data]) => getEffectiveStatus(data));
    const completed = entries.filter((s) => s === 'completed').length;
    const total = entries.length;
    return { completed, total };
  }, [quests]);

  const handleAddQuest = async () => {
    if (!isOwner || !newTitle.trim()) return;
    setAdding(true);
    try {
      const newRef = push(ref(database, 'quests'));
      await fbSet(newRef, {
        title: newTitle.trim(),
        status: 'inactive',
        createdDate: new Date().toISOString().slice(0, 10),
      });
      setNewTitle('');
      setShowAddForm(false);
    } catch (err) {
      console.error('Add quest failed:', err);
    }
    setAdding(false);
  };

  const handleAddSubquest = async (questId) => {
    if (!isOwner || !newSubTitle.trim()) return;
    try {
      const newRef = push(ref(database, `quests/${questId}/subquests`));
      await fbSet(newRef, {
        title: newSubTitle.trim(),
        status: 'inactive',
        createdDate: new Date().toISOString().slice(0, 10),
      });
      setNewSubTitle('');
      setAddingSubquest(null);
    } catch (err) {
      console.error('Add subquest failed:', err);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    if (!isOwner) return;
    const current = quests[id] || {};
    const subs = current.subquests ? Object.values(current.subquests) : [];

    // If quest has subquests, don't allow manually setting to completed unless all subs are done
    if (newStatus === 'completed' && subs.length > 0) {
      const allDone = subs.every((s) => s.status === 'completed');
      if (!allDone) return; // block — must complete subquests first
    }

    if (newStatus === 'completed' && !current.completedDate) {
      await fbSet(ref(database, `quests/${id}`), {
        ...current,
        status: newStatus,
        completedDate: new Date().toISOString().slice(0, 10),
      });
    } else if (newStatus !== 'completed') {
      const { completedDate, ...rest } = current;
      await fbSet(ref(database, `quests/${id}`), {
        ...rest,
        status: newStatus,
      });
    } else {
      await fbSet(ref(database, `quests/${id}`), {
        ...current,
        status: newStatus,
      });
    }
  };

  const handleSubStatusChange = async (questId, subId, newStatus) => {
    if (!isOwner) return;
    const quest = quests[questId] || {};
    const sub = quest.subquests?.[subId] || {};

    if (newStatus === 'completed' && !sub.completedDate) {
      await fbSet(ref(database, `quests/${questId}/subquests/${subId}`), {
        ...sub,
        status: newStatus,
        completedDate: new Date().toISOString().slice(0, 10),
      });
    } else if (newStatus !== 'completed') {
      const { completedDate, ...rest } = sub;
      await fbSet(ref(database, `quests/${questId}/subquests/${subId}`), {
        ...rest,
        status: newStatus,
      });
    } else {
      await fbSet(ref(database, `quests/${questId}/subquests/${subId}`), {
        ...sub,
        status: newStatus,
      });
    }

    // After updating subquest, check if all subquests are now completed → auto-complete parent
    // We need to read the latest state, so re-fetch after write
    setTimeout(async () => {
      // Read fresh data
      const freshQuest = quests[questId] || {};
      const subs = { ...freshQuest.subquests, [subId]: { ...sub, status: newStatus } };
      const allDone = Object.values(subs).every((s) => s.status === 'completed');
      if (allDone && freshQuest.status !== 'completed') {
        await fbSet(ref(database, `quests/${questId}`), {
          ...freshQuest,
          subquests: subs,
          status: 'completed',
          completedDate: freshQuest.completedDate || new Date().toISOString().slice(0, 10),
        });
      }
      // If moving a subquest away from completed, un-complete parent
      if (newStatus !== 'completed' && freshQuest.status === 'completed') {
        const { completedDate, ...rest } = freshQuest;
        await fbSet(ref(database, `quests/${questId}`), {
          ...rest,
          subquests: subs,
          status: 'pending',
        });
      }
    }, 100);
  };

  const handleDelete = async (id) => {
    if (!isOwner) return;
    try {
      await remove(ref(database, `quests/${id}`));
      setConfirmDelete(null);
    } catch (err) {
      console.error('Delete quest failed:', err);
    }
  };

  const handleDeleteSub = async (questId, subId) => {
    if (!isOwner) return;
    try {
      await remove(ref(database, `quests/${questId}/subquests/${subId}`));
      setConfirmDelete(null);
    } catch (err) {
      console.error('Delete subquest failed:', err);
    }
  };

  const startEdit = (id, field, subId) => {
    if (!isOwner) return;
    setEditingField({ id, field, subId });
    if (subId) {
      setEditValue(quests[id]?.subquests?.[subId]?.[field] || '');
    } else {
      setEditValue(quests[id]?.[field] || '');
    }
  };

  const saveEdit = async () => {
    if (!isOwner || !editingField) return;
    const { id, field, subId } = editingField;
    if (subId) {
      const current = quests[id]?.subquests?.[subId] || {};
      await fbSet(ref(database, `quests/${id}/subquests/${subId}`), { ...current, [field]: editValue });
    } else {
      const current = quests[id] || {};
      await fbSet(ref(database, `quests/${id}`), { ...current, [field]: editValue });
    }
    setEditingField(null);
    setEditValue('');
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return <div className="quest-loading">Loading quests...</div>;
  }

  const statusColor = (status) => {
    switch (status) {
      case 'completed': return '#4a9c6d';
      case 'pending': return '#e8a735';
      case 'inactive':
      default: return '#5f6368';
    }
  };

  const statusLabel = (status) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'pending': return 'Pending';
      case 'inactive':
      default: return 'Inactive';
    }
  };

  const renderSubquest = (questId, subId, subData) => {
    const status = subData.status || 'inactive';
    const deleteKey = `${questId}/${subId}`;

    return (
      <div key={subId} className={`subquest-card subquest-status-${status}`}>
        <div
          className="subquest-status-dot"
          style={{ background: statusColor(status) }}
          title={statusLabel(status)}
        />
        <div className="subquest-body">
          <div className="subquest-title-row">
            <div className="subquest-title-section">
              {editingField?.id === questId && editingField?.subId === subId && editingField?.field === 'title' ? (
                <div className="quest-inline-edit">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="quest-edit-input"
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    autoFocus
                  />
                  <button className="quest-save-btn" onClick={saveEdit}>Save</button>
                  <button className="quest-cancel-btn" onClick={() => setEditingField(null)}>Cancel</button>
                </div>
              ) : (
                <span
                  className={`subquest-title ${isOwner ? 'editable' : ''}`}
                  onClick={() => isOwner && startEdit(questId, 'title', subId)}
                >
                  {subData.title || 'Untitled Subquest'}
                </span>
              )}
            </div>

            <div className="subquest-meta-right">
              {status === 'completed' && (
                <div className="quest-date-section">
                  {editingField?.id === questId && editingField?.subId === subId && editingField?.field === 'completedDate' ? (
                    <div className="quest-inline-edit">
                      <input
                        type="date"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="quest-date-input"
                      />
                      <button className="quest-save-btn" onClick={saveEdit}>Save</button>
                      <button className="quest-cancel-btn" onClick={() => setEditingField(null)}>Cancel</button>
                    </div>
                  ) : (
                    <span
                      className={`quest-date ${isOwner ? 'editable' : ''}`}
                      onClick={() => isOwner && startEdit(questId, 'completedDate', subId)}
                    >
                      {subData.completedDate || 'Set date'}
                    </span>
                  )}
                </div>
              )}

              {isOwner && (
                <select
                  className="quest-status-select"
                  value={status}
                  onChange={(e) => handleSubStatusChange(questId, subId, e.target.value)}
                  style={{ borderColor: statusColor(status), color: statusColor(status) }}
                >
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
              )}

              {!isOwner && (
                <span className="quest-status-badge" style={{ background: statusColor(status) }}>
                  {statusLabel(status)}
                </span>
              )}

              {isOwner && (
                confirmDelete === deleteKey ? (
                  <div className="quest-confirm-delete">
                    <button className="quest-delete-yes" onClick={() => handleDeleteSub(questId, subId)}>Delete</button>
                    <button className="quest-delete-no" onClick={() => setConfirmDelete(null)}>Cancel</button>
                  </div>
                ) : (
                  <button
                    className="quest-delete-btn"
                    onClick={() => setConfirmDelete(deleteKey)}
                    title="Remove subquest"
                  >
                    &times;
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="quests">
      <div className="quest-header">
        <img src={`${process.env.PUBLIC_URL}/Quest.png`} alt="" className="quest-header-icon" />
        <h2>Quests</h2>
        <span className="quest-count">{counts.completed}/{counts.total}</span>
        <div className="quest-controls">
          {isOwner && (
            <button className="quest-add-btn" onClick={() => setShowAddForm(!showAddForm)}>
              + Add
            </button>
          )}
          <select
            className="quest-filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
          <select
            className="quest-sort-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </div>
      </div>

      {showAddForm && isOwner && (
        <div className="quest-add-form">
          <input
            type="text"
            placeholder="Quest title *"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="quest-add-input"
            onKeyDown={(e) => e.key === 'Enter' && handleAddQuest()}
          />
          <button
            className="quest-add-submit"
            onClick={handleAddQuest}
            disabled={!newTitle.trim() || adding}
          >
            {adding ? 'Adding...' : 'Add Quest'}
          </button>
        </div>
      )}

      <div className="quest-list">
        {sortedEntries.length === 0 && (
          <div className="quest-empty">No quests found.</div>
        )}
        {sortedEntries.map((entry) => {
          const { id, effectiveStatus, ...data } = entry;
          const subs = data.subquests ? Object.entries(data.subquests) : [];
          const subCount = subs.length;
          const subCompleted = subs.filter(([, s]) => s.status === 'completed').length;
          const isExpanded = expanded[id];
          const hasSubquests = subCount > 0;

          return (
            <div key={id} className={`quest-card-wrapper quest-status-${effectiveStatus}`}>
              <div className={`quest-card ${hasSubquests ? 'has-subs' : ''}`}>
                {/* Status indicator */}
                <div
                  className="quest-status-dot"
                  style={{ background: statusColor(effectiveStatus) }}
                  title={statusLabel(effectiveStatus)}
                />

                {/* Main content */}
                <div className="quest-card-body">
                  <div className="quest-title-row">
                    <div className="quest-title-section">
                      {editingField?.id === id && !editingField?.subId && editingField?.field === 'title' ? (
                        <div className="quest-inline-edit">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="quest-edit-input"
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                            autoFocus
                          />
                          <button className="quest-save-btn" onClick={saveEdit}>Save</button>
                          <button className="quest-cancel-btn" onClick={() => setEditingField(null)}>Cancel</button>
                        </div>
                      ) : (
                        <span
                          className={`quest-title ${isOwner ? 'editable' : ''}`}
                          onClick={() => isOwner && startEdit(id, 'title')}
                        >
                          {data.title || 'Untitled Quest'}
                        </span>
                      )}
                    </div>

                    <div className="quest-meta-right">
                      {/* Subquest count badge */}
                      {hasSubquests && (
                        <span
                          className="quest-sub-count"
                          onClick={() => toggleExpand(id)}
                          title="Toggle subquests"
                        >
                          {subCompleted}/{subCount}
                        </span>
                      )}

                      {/* Completion date (only for completed) */}
                      {effectiveStatus === 'completed' && (
                        <div className="quest-date-section">
                          {editingField?.id === id && !editingField?.subId && editingField?.field === 'completedDate' ? (
                            <div className="quest-inline-edit">
                              <input
                                type="date"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="quest-date-input"
                              />
                              <button className="quest-save-btn" onClick={saveEdit}>Save</button>
                              <button className="quest-cancel-btn" onClick={() => setEditingField(null)}>Cancel</button>
                            </div>
                          ) : (
                            <span
                              className={`quest-date ${isOwner ? 'editable' : ''}`}
                              onClick={() => isOwner && startEdit(id, 'completedDate')}
                            >
                              {data.completedDate || 'Set date'}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Status selector (owner only) — for quests without subquests */}
                      {isOwner && !hasSubquests && (
                        <select
                          className="quest-status-select"
                          value={effectiveStatus}
                          onChange={(e) => handleStatusChange(id, e.target.value)}
                          style={{ borderColor: statusColor(effectiveStatus), color: statusColor(effectiveStatus) }}
                        >
                          <option value="inactive">Inactive</option>
                          <option value="pending">Pending</option>
                          <option value="completed">Completed</option>
                        </select>
                      )}

                      {/* Status badge — for quests with subquests (owner) or non-owner */}
                      {((!isOwner) || (isOwner && hasSubquests)) && (
                        <span
                          className="quest-status-badge"
                          style={{ background: statusColor(effectiveStatus) }}
                        >
                          {statusLabel(effectiveStatus)}
                        </span>
                      )}

                      {/* Expand toggle for subquests */}
                      {hasSubquests && (
                        <button
                          className={`quest-expand-btn ${isExpanded ? 'open' : ''}`}
                          onClick={() => toggleExpand(id)}
                          title="Toggle subquests"
                        >
                          &#x25B8;
                        </button>
                      )}

                      {/* Add subquest button */}
                      {isOwner && (
                        <button
                          className="quest-add-sub-btn"
                          onClick={() => {
                            setAddingSubquest(addingSubquest === id ? null : id);
                            setNewSubTitle('');
                            if (!expanded[id]) setExpanded((prev) => ({ ...prev, [id]: true }));
                          }}
                          title="Add subquest"
                        >
                          +
                        </button>
                      )}

                      {/* Delete button (owner only) */}
                      {isOwner && (
                        confirmDelete === id ? (
                          <div className="quest-confirm-delete">
                            <button className="quest-delete-yes" onClick={() => handleDelete(id)}>Delete</button>
                            <button className="quest-delete-no" onClick={() => setConfirmDelete(null)}>Cancel</button>
                          </div>
                        ) : (
                          <button
                            className="quest-delete-btn"
                            onClick={() => setConfirmDelete(id)}
                            title="Remove quest"
                          >
                            &times;
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Subquests area */}
              {isExpanded && hasSubquests && (
                <div className="subquest-list">
                  {subs.map(([subId, subData]) => renderSubquest(id, subId, subData))}
                </div>
              )}

              {/* Add subquest form */}
              {addingSubquest === id && isOwner && (
                <div className="subquest-add-form">
                  <input
                    type="text"
                    placeholder="Subquest title *"
                    value={newSubTitle}
                    onChange={(e) => setNewSubTitle(e.target.value)}
                    className="quest-add-input subquest-add-input"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubquest(id)}
                    autoFocus
                  />
                  <button
                    className="quest-add-submit"
                    onClick={() => handleAddSubquest(id)}
                    disabled={!newSubTitle.trim()}
                  >
                    Add
                  </button>
                  <button
                    className="quest-cancel-btn"
                    onClick={() => { setAddingSubquest(null); setNewSubTitle(''); }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Quests;
