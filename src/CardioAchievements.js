import React, { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from './firebase';
import PinButton from './PinButton';
import './CardioAchievements.css';

function CardioAchievements({ cardioFilter, isPinned, togglePin, hideCompleted, setHideCompleted, isOwner }) {
  const [achievements, setAchievements] = useState([]);
  const [cardioData, setCardioData] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const achievementsRef = ref(database, 'achievements/cardio');
    const unsubAchievements = onValue(achievementsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        list.sort((a, b) => a.order - b.order);
        setAchievements(list);
      }
    });

    const cardioRef = ref(database, 'cardio');
    const unsubCardio = onValue(cardioRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setCardioData(data);
      setLoading(false);
    });

    return () => { unsubAchievements(); unsubCardio(); };
  }, []);

  useEffect(() => {
    setExpandedId(null);
  }, [cardioFilter]);

  // Flatten all cardio sessions
  const sessions = useMemo(() => {
    const result = [];
    for (const year of Object.keys(cardioData)) {
      for (const month of Object.keys(cardioData[year])) {
        for (const dayKey of Object.keys(cardioData[year][month])) {
          const dayEntry = cardioData[year][month][dayKey];
          for (const activity of Object.keys(dayEntry)) {
            const actData = dayEntry[activity];
            if (actData.sessions) {
              for (const s of actData.sessions) {
                const totalSeconds =
                  (s.time?.hours || 0) * 3600 +
                  (s.time?.minutes || 0) * 60 +
                  (s.time?.seconds || 0);
                result.push({
                  date: dayKey,
                  dateFormatted: formatDateKey(dayKey),
                  distance: s.distance,
                  totalSeconds,
                  activity,
                });
              }
            }
          }
        }
      }
    }
    return result;
  }, [cardioData]);

  // Filter achievements based on sidebar selection
  const filtered = useMemo(() => {
    if (cardioFilter === 'missionpeak') {
      return achievements.filter((a) => a.activityFilter === 'missionpeak');
    }
    if (typeof cardioFilter === 'number') {
      return achievements.filter((a) => a.distance === cardioFilter && !a.activityFilter);
    }
    // No filter — show all
    return achievements;
  }, [achievements, cardioFilter]);

  // Compute completions
  const computed = useMemo(() => {
    return filtered.map((ach) => {
      let completions;
      if (ach.activityFilter) {
        // Mission Peak: match activity name + time
        completions = sessions.filter(
          (s) => s.activity === ach.activityFilter && s.totalSeconds <= ach.targetSeconds && s.totalSeconds > 0
        );
      } else {
        // Distance-based: match distance + time
        completions = sessions.filter(
          (s) => s.distance >= ach.distance && s.totalSeconds <= ach.targetSeconds && s.totalSeconds > 0
        );
      }
      completions.sort((a, b) => (a.date < b.date ? 1 : -1));
      return { ...ach, completions };
    });
  }, [filtered, sessions]);

  if (loading) return <div className="loading">Loading...</div>;

  // Group by the `group` field from seed
  const groups = {};
  for (const ach of computed) {
    const key = ach.group || `${ach.distance} mi`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(ach);
  }

  const totalCompleted = computed.filter((a) => a.completions.length > 0).length;

  // Title based on filter
  let title = 'Cardio Achievements';
  if (cardioFilter === 'missionpeak') {
    title = 'Mission Peak Achievements';
  } else if (typeof cardioFilter === 'number') {
    title = `${cardioFilter} Mile Achievements`;
  }

  return (
    <div className="cardio-achievements">
      <div className="section-header">
        <h1 className="section-title">{title}</h1>
        <span className="progress-badge">{totalCompleted} / {computed.length}</span>
        <label className="hide-completed-toggle">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => setHideCompleted(e.target.checked)}
          />
          Hide completed
        </label>
      </div>

      {Object.entries(groups).map(([groupLabel, items]) => {
        const displayItems = hideCompleted
          ? items.filter((a) => a.completions.length === 0)
          : items;
        if (displayItems.length === 0) return null;
        return (
          <div key={groupLabel} className="achievement-group">
            {!cardioFilter && <h2 className="group-label">{groupLabel}</h2>}
            <ul className="achievement-list">
              {displayItems.map((ach) => {
                const completed = ach.completions.length > 0;
                const isExpanded = expandedId === ach.id;
                return (
                  <li key={ach.id} className={`achievement-item ${completed ? 'completed' : ''}`}>
                    <div
                      className="achievement-row"
                      onClick={() => completed && setExpandedId(isExpanded ? null : ach.id)}
                    >
                      <span className={`check ${completed ? 'checked' : ''}`}>
                        {completed ? '\u2713' : ''}
                      </span>
                      <span className="achievement-label">{ach.label}</span>
                      {completed && (
                        <span className="completion-count">{ach.completions.length}x</span>
                      )}
                      {isOwner && <PinButton
                        pinned={isPinned('cardio', ach.id)}
                        onClick={() => togglePin('cardio', ach.id)}
                      />}
                    </div>
                    {isExpanded && ach.completions.length > 0 && (
                      <ul className="completion-dates">
                        {ach.completions.map((c, i) => (
                          <li key={i} className="completion-date">
                            {c.dateFormatted} — {formatTime(c.totalSeconds)} ({c.activity})
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <p className="empty-state">No achievements defined yet. Run the seed script first.</p>
      )}
    </div>
  );
}

function formatDateKey(key) {
  const y = key.slice(0, 4);
  const m = parseInt(key.slice(4, 6), 10) - 1;
  const d = parseInt(key.slice(6, 8), 10);
  const date = new Date(y, m, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default CardioAchievements;
