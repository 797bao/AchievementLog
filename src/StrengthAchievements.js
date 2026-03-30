import React, { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from './firebase';
import PinButton from './PinButton';
import './CardioAchievements.css';

function StrengthAchievements({ filterExercise, isPinned, togglePin, hideCompleted, setHideCompleted, isOwner }) {
  const [achievements, setAchievements] = useState([]);
  const [workoutData, setWorkoutData] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [rmFilter, setRmFilter] = useState('all');

  useEffect(() => {
    const achievementsRef = ref(database, 'achievements/strength');
    const unsubAch = onValue(achievementsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        list.sort((a, b) => a.order - b.order);
        setAchievements(list);
      }
    });

    const workoutsRef = ref(database, 'workouts');
    const unsubWorkouts = onValue(workoutsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setWorkoutData(data);
      setLoading(false);
    });

    return () => { unsubAch(); unsubWorkouts(); };
  }, []);

  useEffect(() => {
    setRmFilter('all');
    setExpandedId(null);
  }, [filterExercise]);

  const allSets = useMemo(() => {
    const sets = [];
    for (const year of Object.keys(workoutData)) {
      for (const month of Object.keys(workoutData[year])) {
        for (const dayKey of Object.keys(workoutData[year][month])) {
          const dayEntry = workoutData[year][month][dayKey];
          for (const exerciseId of Object.keys(dayEntry)) {
            const exData = dayEntry[exerciseId];
            if (exData.sets) {
              for (const s of exData.sets) {
                sets.push({
                  date: dayKey,
                  dateFormatted: formatDateKey(dayKey),
                  exerciseId,
                  weight: s.weight || 0,
                  reps: s.reps || 0,
                  time: s.time || 0,
                });
              }
            }
          }
        }
      }
    }
    return sets;
  }, [workoutData]);

  const filtered = useMemo(() => {
    let list = achievements;

    if (filterExercise) {
      list = list.filter((a) => a.exerciseId === filterExercise);
    }

    const types = new Set(list.map((a) => a.type));
    const isWeighted = types.has('weighted');

    if (isWeighted && rmFilter !== 'all') {
      list = list.filter((a) => a.reps === parseInt(rmFilter));
    }

    // When "all" for weighted, sort by weight then reps (225x5, 225x10, 227.5x5, ...)
    if (isWeighted && rmFilter === 'all') {
      list = [...list].sort((a, b) => {
        if (a.weight !== b.weight) return a.weight - b.weight;
        return a.reps - b.reps;
      });
    }

    return list;
  }, [achievements, filterExercise, rmFilter]);

  const exerciseType = useMemo(() => {
    if (!filterExercise) return null;
    const match = achievements.find((a) => a.exerciseId === filterExercise);
    return match?.type || null;
  }, [achievements, filterExercise]);

  const computed = useMemo(() => {
    return filtered.map((ach) => {
      let completions;

      if (ach.type === 'timed') {
        completions = allSets
          .filter((s) => s.exerciseId === ach.exerciseId && s.time >= ach.targetSeconds)
          .map((s) => ({ ...s, detail: `${formatTime(s.time)} hold` }));
      } else if (ach.type === 'bodyweight') {
        completions = allSets
          .filter((s) => s.exerciseId === ach.exerciseId && s.reps >= ach.reps)
          .map((s) => ({ ...s, detail: `${s.reps} reps` }));
      } else {
        completions = allSets
          .filter((s) => s.exerciseId === ach.exerciseId && s.weight >= ach.weight && s.reps >= ach.reps)
          .map((s) => ({ ...s, detail: `${s.weight} lbs x ${s.reps}` }));
      }

      const byDate = {};
      for (const c of completions) {
        if (!byDate[c.date]) byDate[c.date] = c;
      }
      const unique = Object.values(byDate);
      unique.sort((a, b) => (a.date < b.date ? 1 : -1));

      return { ...ach, completions: unique };
    });
  }, [filtered, allSets]);

  const displayList = useMemo(() => {
    if (hideCompleted) return computed.filter((a) => a.completions.length === 0);
    return computed;
  }, [computed, hideCompleted]);

  if (loading) return <div className="loading">Loading...</div>;

  if (!filterExercise) {
    return (
      <div className="cardio-achievements">
        <h1 className="section-title">Strength Achievements</h1>
        <p className="empty-state">Select an exercise from the sidebar.</p>
      </div>
    );
  }

  const exerciseName = filtered[0]?.exerciseName || filterExercise;
  const completedCount = computed.filter((a) => a.completions.length > 0).length;

  return (
    <div className="cardio-achievements">
      <div className="section-header">
        <h1 className="section-title">{exerciseName}</h1>
        <span className="progress-badge">{completedCount} / {computed.length}</span>
        {exerciseType === 'weighted' && (
          <select
            className="rm-dropdown"
            value={rmFilter}
            onChange={(e) => setRmFilter(e.target.value)}
          >
            <option value="all">All Rep Max</option>
            <option value="5">5 Rep Max</option>
            <option value="10">10 Rep Max</option>
          </select>
        )}
        <label className="hide-completed-toggle">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => setHideCompleted(e.target.checked)}
          />
          Hide completed
        </label>
      </div>

      <ul className="achievement-list">
        {displayList.map((ach) => {
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
                  pinned={isPinned('strength', ach.id)}
                  onClick={() => togglePin('strength', ach.id)}
                />}
              </div>
              {isExpanded && ach.completions.length > 0 && (
                <ul className="completion-dates">
                  {ach.completions.map((c, i) => (
                    <li key={i} className="completion-date">
                      {c.dateFormatted} — {c.detail}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && (
        <p className="empty-state">No achievements defined for this exercise yet.</p>
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

export default StrengthAchievements;
