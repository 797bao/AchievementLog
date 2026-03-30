import React, { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from './firebase';
import PinButton from './PinButton';
import ShapeIcon from './ShapeIcon';
import './CardioAchievements.css';

const EXERCISE_NAMES = {
  barbellflatbench: 'Barbell Flat Bench',
  barbellinclinebench: 'Barbell Incline Bench',
  squats: 'Squats',
  deadlifts: 'Deadlifts',
  hipthrusts: 'Hip Thrusts',
  barbellrows: 'Barbell Rows',
  pullups: 'Pull Ups',
  pushups: 'Push Ups',
  dips: 'Ring Dips',
  hangs: 'Hangs',
};

const EXERCISE_ICONS = {
  barbellflatbench: { pointStyle: 'rectRot', bg: '#f44336', border: '#f44336' },
  barbellinclinebench: { pointStyle: 'rectRot', bg: '#000000', border: '#f44336' },
  squats: { pointStyle: 'circle', bg: '#6d9eeb', border: '#6d9eeb' },
  deadlifts: { pointStyle: 'circle', bg: '#ea9999', border: '#ea9999' },
  hipthrusts: { pointStyle: 'rect', bg: '#ff9800', border: '#ff9800' },
  barbellrows: { pointStyle: 'rectRot', bg: '#26a69a', border: '#26a69a' },
  pullups: { pointStyle: 'rectRot', bg: '#b5a4da', border: '#b5a4da' },
  pushups: { pointStyle: 'circle', bg: '#000000', border: '#b5a4da' },
  dips: { pointStyle: 'circle', bg: '#b5a4da', border: '#b5a4da' },
  hangs: { pointStyle: 'rect', bg: '#b5a4da', border: '#b5a4da' },
};

const CARDIO_ICON = { pointStyle: 'circle', bg: '#7ACF52', border: '#7ACF52' };
const MISSIONPEAK_ICON = { pointStyle: 'rectRot', bg: '#EF4538', border: '#EF4538' };

const CARDIO_MILESTONE_ORDER = [
  'missionpeak', 1.5, 3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5,
];

const DEV_SOURCES = [
  { source: 'GameDevHours', name: 'Game Dev' },
];

function getCategoryIcon(category, ach) {
  if (category === 'strength') {
    const icon = EXERCISE_ICONS[ach.exerciseId];
    if (icon) return <ShapeIcon pointStyle={icon.pointStyle} bg={icon.bg} border={icon.border} size={15} />;
    return <ShapeIcon pointStyle="circle" bg="#9aa0a6" border="#9aa0a6" size={15} />;
  }
  if (category === 'cardio') {
    const icon = ach.activityFilter === 'missionpeak' ? MISSIONPEAK_ICON : CARDIO_ICON;
    return <ShapeIcon pointStyle={icon.pointStyle} bg={icon.bg} border={icon.border} size={15} />;
  }
  if (category === 'dev') {
    return <img src={`${process.env.PUBLIC_URL}/redhat.png`} alt="" style={{ width: 24, height: 24, flexShrink: 0 }} />;
  }
  return null;
}

function Inbox({ pins, isPinned, togglePin, isOwner }) {
  const [cardioAchievements, setCardioAchievements] = useState([]);
  const [strengthAchievements, setStrengthAchievements] = useState([]);
  const [devAchievements, setDevAchievements] = useState([]);
  const [cardioData, setCardioData] = useState({});
  const [workoutData, setWorkoutData] = useState({});
  const [hourData, setHourData] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let loaded = 0;
    const total = 6; // cardioAch, strengthAch, devAch, cardio, workouts, GameDevHours
    const checkDone = () => { if (++loaded >= total) setLoading(false); };

    const unsubs = [
      onValue(ref(database, 'achievements/cardio'), (snap) => {
        const data = snap.val();
        if (data) setCardioAchievements(Object.entries(data).map(([id, val]) => ({ id, ...val })));
        checkDone();
      }),
      onValue(ref(database, 'achievements/strength'), (snap) => {
        const data = snap.val();
        if (data) setStrengthAchievements(Object.entries(data).map(([id, val]) => ({ id, ...val })));
        checkDone();
      }),
      onValue(ref(database, 'achievements/dev'), (snap) => {
        const data = snap.val();
        if (data) setDevAchievements(Object.entries(data).map(([id, val]) => ({ id, ...val })));
        checkDone();
      }),
      onValue(ref(database, 'cardio'), (snap) => {
        if (snap.val()) setCardioData(snap.val());
        checkDone();
      }),
      onValue(ref(database, 'workouts'), (snap) => {
        if (snap.val()) setWorkoutData(snap.val());
        checkDone();
      }),
      onValue(ref(database, 'GameDevHours'), (snap) => {
        if (snap.val()) setHourData((prev) => ({ ...prev, GameDevHours: snap.val() }));
        checkDone();
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, []);

  // ── Flattened data ──

  const cardioSessions = useMemo(() => {
    const result = [];
    for (const year of Object.keys(cardioData)) {
      for (const month of Object.keys(cardioData[year])) {
        for (const dayKey of Object.keys(cardioData[year][month])) {
          const dayEntry = cardioData[year][month][dayKey];
          for (const activity of Object.keys(dayEntry)) {
            if (dayEntry[activity].sessions) {
              for (const s of dayEntry[activity].sessions) {
                const totalSeconds =
                  (s.time?.hours || 0) * 3600 +
                  (s.time?.minutes || 0) * 60 +
                  (s.time?.seconds || 0);
                result.push({ date: dayKey, dateFormatted: fmtDate(dayKey), distance: s.distance, totalSeconds, activity });
              }
            }
          }
        }
      }
    }
    return result;
  }, [cardioData]);

  const allSets = useMemo(() => {
    const sets = [];
    for (const year of Object.keys(workoutData)) {
      for (const month of Object.keys(workoutData[year])) {
        for (const dayKey of Object.keys(workoutData[year][month])) {
          const dayEntry = workoutData[year][month][dayKey];
          for (const exId of Object.keys(dayEntry)) {
            if (dayEntry[exId].sets) {
              for (const s of dayEntry[exId].sets) {
                sets.push({ date: dayKey, dateFormatted: fmtDate(dayKey), exerciseId: exId, weight: s.weight || 0, reps: s.reps || 0, time: s.time || 0 });
              }
            }
          }
        }
      }
    }
    return sets;
  }, [workoutData]);

  const monthlyTotals = useMemo(() => {
    const result = {};
    for (const [source, dateMap] of Object.entries(hourData)) {
      const months = {};
      for (const [dateStr, hours] of Object.entries(dateMap)) {
        const monthKey = dateStr.slice(0, 7);
        months[monthKey] = (months[monthKey] || 0) + hours;
      }
      result[source] = months;
    }
    return result;
  }, [hourData]);

  // ── Completion helpers ──

  function getCardioCompletions(ach) {
    if (ach.activityFilter) {
      return cardioSessions
        .filter((s) => s.activity === ach.activityFilter && s.totalSeconds <= ach.targetSeconds && s.totalSeconds > 0)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
    }
    return cardioSessions
      .filter((s) => s.distance >= ach.distance && s.totalSeconds <= ach.targetSeconds && s.totalSeconds > 0)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  function getStrengthCompletions(ach) {
    let completions;
    if (ach.type === 'timed') {
      completions = allSets.filter((s) => s.exerciseId === ach.exerciseId && s.time >= ach.targetSeconds);
    } else if (ach.type === 'bodyweight') {
      completions = allSets.filter((s) => s.exerciseId === ach.exerciseId && s.reps >= ach.reps);
    } else {
      completions = allSets.filter((s) => s.exerciseId === ach.exerciseId && s.weight >= ach.weight && s.reps >= ach.reps);
    }
    const byDate = {};
    for (const c of completions) { if (!byDate[c.date]) byDate[c.date] = c; }
    return Object.values(byDate).sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  function getDevCompletions(ach) {
    const months = monthlyTotals[ach.source] || {};
    return findStreaks(months, ach.hoursTarget, ach.monthsTarget);
  }

  function strengthDetail(ach, c) {
    if (ach.type === 'timed') return `${fmtTime(c.time)} hold`;
    if (ach.type === 'bodyweight') return `${c.reps} reps`;
    return `${c.weight} lbs x ${c.reps}`;
  }

  // ── Pinned items ──

  const pinnedItems = useMemo(() => {
    const items = [];

    for (const pinKey of Object.keys(pins)) {
      const [category, ...rest] = pinKey.split('__');
      const achId = rest.join('__');

      if (category === 'cardio') {
        const ach = cardioAchievements.find((a) => a.id === achId);
        if (!ach) continue;
        const completions = getCardioCompletions(ach);
        items.push({
          pinKey, category, ach, completions,
          completed: completions.length > 0,
          detailFn: (c) => `${fmtTime(c.totalSeconds)} (${c.activity})`,
        });
      } else if (category === 'strength') {
        const ach = strengthAchievements.find((a) => a.id === achId);
        if (!ach) continue;
        const completions = getStrengthCompletions(ach);
        items.push({
          pinKey, category, ach, completions,
          completed: completions.length > 0,
          detailFn: (c) => strengthDetail(ach, c),
        });
      } else if (category === 'dev') {
        const ach = devAchievements.find((a) => a.id === achId);
        if (!ach) continue;
        const completions = getDevCompletions(ach);
        items.push({
          pinKey, category, ach, completions,
          completed: completions.length > 0,
          isDev: true,
        });
      }
    }

    items.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return 0;
    });

    return items;
  // eslint-disable-next-line
  }, [pins, cardioAchievements, strengthAchievements, devAchievements, cardioSessions, allSets, monthlyTotals]);

  // ── Next Milestones ──

  const nextMilestones = useMemo(() => {
    const milestones = [];

    // Cardio milestones in sidebar order
    for (const key of CARDIO_MILESTONE_ORDER) {
      let group, groupLabel;
      if (key === 'missionpeak') {
        group = cardioAchievements.filter((a) => a.activityFilter === 'missionpeak').sort((a, b) => a.order - b.order);
        groupLabel = 'Mission Peak';
      } else {
        group = cardioAchievements.filter((a) => a.distance === key && !a.activityFilter).sort((a, b) => a.order - b.order);
        groupLabel = `${key} mi`;
      }
      for (const ach of group) {
        if (getCardioCompletions(ach).length === 0) {
          milestones.push({ key: `next_cardio_${key}`, category: 'cardio', groupLabel, ach, completions: [], completed: false });
          break;
        }
      }
    }

    // Strength milestones
    const exerciseIds = [...new Set(strengthAchievements.map((a) => a.exerciseId))];
    for (const exId of exerciseIds) {
      const exAchs = strengthAchievements.filter((a) => a.exerciseId === exId).sort((a, b) => a.order - b.order);
      if (exAchs[0]?.type === 'weighted') {
        for (const reps of [5, 10]) {
          const repAchs = exAchs.filter((a) => a.reps === reps);
          for (const ach of repAchs) {
            if (getStrengthCompletions(ach).length === 0) {
              milestones.push({ key: `next_strength_${exId}_${reps}rm`, category: 'strength', groupLabel: `${EXERCISE_NAMES[exId] || exId} — ${reps}RM`, ach, completions: [], completed: false });
              break;
            }
          }
        }
      } else {
        for (const ach of exAchs) {
          if (getStrengthCompletions(ach).length === 0) {
            milestones.push({ key: `next_strength_${exId}`, category: 'strength', groupLabel: EXERCISE_NAMES[exId] || exId, ach, completions: [], completed: false });
            break;
          }
        }
      }
    }

    // Dev milestones — one per source + hours tier
    for (const { source, name } of DEV_SOURCES) {
      for (const hours of [30, 45, 60]) {
        const group = devAchievements
          .filter((a) => a.source === source && a.hoursTarget === hours)
          .sort((a, b) => a.order - b.order);
        for (const ach of group) {
          if (getDevCompletions(ach).length === 0) {
            milestones.push({ key: `next_dev_${source}_${hours}`, category: 'dev', groupLabel: `${name} — ${hours} hrs/mo`, ach, completions: [], completed: false });
            break;
          }
        }
      }
    }

    return milestones;
  // eslint-disable-next-line
  }, [cardioAchievements, strengthAchievements, devAchievements, cardioSessions, allSets, monthlyTotals]);

  if (loading) return <div className="loading">Loading...</div>;

  const catLabel = (cat) => {
    if (cat === 'cardio') return 'Cardio';
    if (cat === 'strength') return 'Strength';
    return 'Dev';
  };

  const renderPinnedRow = ({ pinKey, category, ach, completions, completed, detailFn, isDev }) => {
    const isExpanded = expandedId === pinKey;
    return (
      <li key={pinKey} className={`achievement-item ${completed ? 'completed' : ''}`}>
        <div
          className="achievement-row"
          onClick={() => completed && setExpandedId(isExpanded ? null : pinKey)}
        >
          <span className="inbox-icon">{getCategoryIcon(category, ach)}</span>
          <span className={`check ${completed ? 'checked' : ''}`}>
            {completed ? '\u2713' : ''}
          </span>
          <span className="achievement-label">
            <span className="inbox-category">{catLabel(category)}</span>
            {category === 'strength' && ach.exerciseName && (
              <span className="inbox-exercise">{ach.exerciseName}</span>
            )}
            {category === 'cardio' && (
              <span className="inbox-exercise">{ach.group || `${ach.distance} mi`}</span>
            )}
            {category === 'dev' && (
              <span className="inbox-exercise">{ach.sourceName}</span>
            )}
            {ach.label}
          </span>
          {completed && (
            <span className="completion-count">{completions.length}x</span>
          )}
          {isOwner && <PinButton pinned={true} onClick={() => togglePin(category, ach.id)} />}
        </div>
        {isExpanded && completed && !isDev && (
          <ul className="completion-dates">
            {completions.map((c, i) => (
              <li key={i} className="completion-date">
                {c.dateFormatted} — {detailFn(c)}
              </li>
            ))}
          </ul>
        )}
        {isExpanded && completed && isDev && (
          <ul className="completion-dates">
            {completions.map((streak, si) => (
              <li key={si} className="completion-date">
                <span className="streak-header">Streak {si + 1}:</span>
                {streak.months.map((m) => (
                  <span key={m.key} className="streak-month">{m.label} — {m.hours.toFixed(1)} hrs</span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="cardio-achievements">
      <div className="section-header">
        <h1 className="section-title">Inbox</h1>
      </div>

      <div className="achievement-group">
        <h2 className="group-label">Pinned</h2>
        {pinnedItems.length === 0 ? (
          <p className="empty-state">No pinned achievements yet. Pin items from any section.</p>
        ) : (
          <ul className="achievement-list">
            {pinnedItems.map((item) => renderPinnedRow(item))}
          </ul>
        )}
      </div>

      <div className="achievement-group">
        <h2 className="group-label">Next Milestones</h2>
        {nextMilestones.length === 0 ? (
          <p className="empty-state">All achievements completed!</p>
        ) : (
          <ul className="achievement-list">
            {nextMilestones.map((item) => (
              <li key={item.key} className="achievement-item">
                <div className="achievement-row">
                  <span className="inbox-icon">{getCategoryIcon(item.category, item.ach)}</span>
                  <span className="check">{''}</span>
                  <span className="achievement-label">
                    <span className="inbox-category">{catLabel(item.category)}</span>
                    <span className="inbox-exercise">{item.groupLabel}</span>
                    {item.ach.label}
                  </span>
                  {isOwner && <PinButton
                    pinned={isPinned(item.category, item.ach.id)}
                    onClick={() => togglePin(item.category, item.ach.id)}
                  />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Streak finder ──

function findStreaks(monthlyMap, hoursTarget, monthsTarget) {
  const allMonths = Object.keys(monthlyMap).sort();
  if (allMonths.length === 0) return [];

  const qualifying = new Set();
  for (const m of allMonths) {
    if (monthlyMap[m] >= hoursTarget) qualifying.add(m);
  }

  const monthRange = generateMonthRange(allMonths[0], allMonths[allMonths.length - 1]);
  const streaks = [];
  let currentStreak = [];

  for (const m of monthRange) {
    if (qualifying.has(m)) {
      currentStreak.push(m);
    } else {
      if (currentStreak.length >= monthsTarget) streaks.push([...currentStreak]);
      currentStreak = [];
    }
  }
  if (currentStreak.length >= monthsTarget) streaks.push([...currentStreak]);

  return streaks.map((streak) => ({
    months: streak.map((m) => ({ key: m, label: fmtMonth(m), hours: monthlyMap[m] || 0 })),
  }));
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

function fmtMonth(key) {
  const [y, m] = key.split('-');
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function fmtDate(key) {
  const y = key.slice(0, 4);
  const m = parseInt(key.slice(4, 6), 10) - 1;
  const d = parseInt(key.slice(6, 8), 10);
  return new Date(y, m, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default Inbox;
