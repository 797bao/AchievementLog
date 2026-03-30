import React, { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from './firebase';
import PinButton from './PinButton';
import './CardioAchievements.css';

// Map source key to Firebase path
const SOURCE_PATHS = {
  GameDevHours: 'GameDevHours',
};

function DevAchievements({ filterSource, isPinned, togglePin, hideCompleted, setHideCompleted, isOwner }) {
  const [achievements, setAchievements] = useState([]);
  const [hourData, setHourData] = useState({}); // { GameDevHours: { '2024-09-01': 0, ... } }
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [hoursFilter, setHoursFilter] = useState('all'); // 'all', '30', '45', '60'

  useEffect(() => {
    let loaded = 0;
    const totalSources = Object.keys(SOURCE_PATHS).length;
    const total = 1 + totalSources; // achievements + each hour source
    const checkDone = () => { if (++loaded >= total) setLoading(false); };

    const unsubAch = onValue(ref(database, 'achievements/dev'), (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        list.sort((a, b) => a.order - b.order);
        setAchievements(list);
      }
      checkDone();
    });

    // Load all hour sources
    const sourceUnsubs = Object.entries(SOURCE_PATHS).map(([key, path]) =>
      onValue(ref(database, path), (snap) => {
        const data = snap.val();
        if (data) {
          setHourData((prev) => ({ ...prev, [key]: data }));
        }
        checkDone();
      })
    );

    return () => {
      unsubAch();
      sourceUnsubs.forEach((u) => u());
    };
  }, []);

  useEffect(() => {
    setExpandedId(null);
    setHoursFilter('all');
  }, [filterSource]);

  // Build monthly totals for each source: { 'GameDevHours': { '2024-09': 12.5, '2024-10': 30, ... } }
  const monthlyTotals = useMemo(() => {
    const result = {};
    for (const [source, dateMap] of Object.entries(hourData)) {
      const months = {};
      for (const [dateStr, hours] of Object.entries(dateMap)) {
        const monthKey = dateStr.slice(0, 7); // 'YYYY-MM'
        months[monthKey] = (months[monthKey] || 0) + hours;
      }
      result[source] = months;
    }
    return result;
  }, [hourData]);

  // Filter achievements
  const filtered = useMemo(() => {
    let list = achievements;
    if (filterSource) {
      list = list.filter((a) => a.source === filterSource);
    }
    if (hoursFilter !== 'all') {
      list = list.filter((a) => a.hoursTarget === parseInt(hoursFilter));
    }
    return list;
  }, [achievements, filterSource, hoursFilter]);

  // Compute completions for streak achievements
  const computed = useMemo(() => {
    return filtered.map((ach) => {
      const months = monthlyTotals[ach.source] || {};
      const completions = findStreaks(months, ach.hoursTarget, ach.monthsTarget);
      return { ...ach, completions };
    });
  }, [filtered, monthlyTotals]);

  const displayList = useMemo(() => {
    if (hideCompleted) return computed.filter((a) => a.completions.length === 0);
    return computed;
  }, [computed, hideCompleted]);

  if (loading) return <div className="loading">Loading...</div>;

  if (!filterSource) {
    return (
      <div className="cardio-achievements">
        <h1 className="section-title">Dev Achievements</h1>
        <p className="empty-state">Select a category from the sidebar.</p>
      </div>
    );
  }

  const sourceName = filtered[0]?.sourceName || filterSource;
  const completedCount = computed.filter((a) => a.completions.length > 0).length;

  // Group by hours threshold
  const groups = {};
  for (const ach of displayList) {
    const key = ach.group || `${ach.hoursTarget} hrs/mo`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(ach);
  }

  return (
    <div className="cardio-achievements">
      <div className="section-header">
        <h1 className="section-title">{sourceName}</h1>
        <span className="progress-badge">{completedCount} / {computed.length}</span>
        <select
          className="rm-dropdown"
          value={hoursFilter}
          onChange={(e) => setHoursFilter(e.target.value)}
        >
          <option value="all">All Tiers</option>
          <option value="30">30 hrs/mo</option>
          <option value="45">45 hrs/mo</option>
          <option value="60">60 hrs/mo</option>
        </select>
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
        if (items.length === 0) return null;
        return (
          <div key={groupLabel} className="achievement-group">
            {hoursFilter === 'all' && <h2 className="group-label">{groupLabel}</h2>}
            <ul className="achievement-list">
              {items.map((ach) => {
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
                        pinned={isPinned('dev', ach.id)}
                        onClick={() => togglePin('dev', ach.id)}
                      />}
                    </div>
                    {isExpanded && ach.completions.length > 0 && (
                      <ul className="completion-dates">
                        {ach.completions.map((streak, si) => (
                          <li key={si} className="completion-date">
                            <span className="streak-header">Streak {si + 1}:</span>
                            {streak.months.map((m) => (
                              <span key={m.key} className="streak-month">
                                {m.label} — {m.hours.toFixed(1)} hrs
                              </span>
                            ))}
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
        <p className="empty-state">No achievements defined for this category yet.</p>
      )}
    </div>
  );
}

/**
 * Find all consecutive month streaks where each month >= hoursTarget
 * for at least monthsTarget consecutive months.
 * Returns array of streak objects: [{ months: [{ key: '2024-09', label: 'Sep 2024', hours: 35 }, ...] }]
 */
function findStreaks(monthlyMap, hoursTarget, monthsTarget) {
  // Get all months sorted chronologically
  const allMonths = Object.keys(monthlyMap).sort();
  if (allMonths.length === 0) return [];

  // Find qualifying months (>= hoursTarget)
  const qualifying = new Set();
  for (const m of allMonths) {
    if (monthlyMap[m] >= hoursTarget) qualifying.add(m);
  }

  // Build consecutive sequences
  const streaks = [];
  let currentStreak = [];

  // Generate a full month range from first to last
  const monthRange = generateMonthRange(allMonths[0], allMonths[allMonths.length - 1]);

  for (const m of monthRange) {
    if (qualifying.has(m)) {
      currentStreak.push(m);
    } else {
      if (currentStreak.length >= monthsTarget) {
        streaks.push([...currentStreak]);
      }
      currentStreak = [];
    }
  }
  // Don't forget the last streak
  if (currentStreak.length >= monthsTarget) {
    streaks.push([...currentStreak]);
  }

  // Convert to result format — each streak that is >= monthsTarget months counts
  const results = [];
  for (const streak of streaks) {
    // For a streak of length N and target T, there are (N - T + 1) windows
    // But we just report the full consecutive streak as one completion
    results.push({
      months: streak.map((m) => ({
        key: m,
        label: formatMonthKey(m),
        hours: monthlyMap[m] || 0,
      })),
    });
  }

  return results;
}

function generateMonthRange(start, end) {
  const months = [];
  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

function formatMonthKey(key) {
  const [y, m] = key.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default DevAchievements;
