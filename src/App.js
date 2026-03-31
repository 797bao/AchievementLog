import React, { useState, useEffect, useMemo } from 'react';
import { ref, onValue, set as fbSet, remove } from 'firebase/database';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { database, auth, googleProvider } from './firebase';
import CardioAchievements from './CardioAchievements';
import StrengthAchievements from './StrengthAchievements';
import DevAchievements from './DevAchievements';
import ArtAchievements from './ArtAchievements';
import Quests from './Quests';
import Inbox from './Inbox';
import ShapeIcon from './ShapeIcon';
import './App.css';

const STRENGTH_EXERCISES = [
  { id: 'barbellflatbench', label: 'Barbell Flat Bench', pointStyle: 'rectRot', bg: '#f44336', border: '#f44336' },
  { id: 'barbellinclinebench', label: 'Barbell Incline Bench', pointStyle: 'rectRot', bg: '#000000', border: '#f44336' },
  { id: 'squats', label: 'Squats', pointStyle: 'circle', bg: '#6d9eeb', border: '#6d9eeb' },
  { id: 'deadlifts', label: 'Deadlifts', pointStyle: 'circle', bg: '#ea9999', border: '#ea9999' },
  { id: 'hipthrusts', label: 'Hip Thrusts', pointStyle: 'rect', bg: '#ff9800', border: '#ff9800' },
  { id: 'barbellrows', label: 'Barbell Rows', pointStyle: 'rectRot', bg: '#26a69a', border: '#26a69a' },
  { id: 'pullups', label: 'Pull Ups', pointStyle: 'rectRot', bg: '#b5a4da', border: '#b5a4da' },
  { id: 'pushups', label: 'Push Ups', pointStyle: 'circle', bg: '#000000', border: '#b5a4da' },
  { id: 'dips', label: 'Ring Dips', pointStyle: 'circle', bg: '#b5a4da', border: '#b5a4da' },
  { id: 'hangs', label: 'Hangs', pointStyle: 'rect', bg: '#b5a4da', border: '#b5a4da' },
];

const CARDIO_ITEMS = [
  { id: 'missionpeak', label: 'Mission Peak', pointStyle: 'rectRot', bg: '#EF4538', border: '#EF4538' },
  { id: 1.5, label: '1.5 mi (1 lap)', pointStyle: 'circle', bg: '#7ACF52', border: '#7ACF52' },
  { id: 3, label: '3 mi (2 laps)', pointStyle: 'circle', bg: '#7ACF52', border: '#7ACF52' },
  { id: 4.5, label: '4.5 mi (3 laps)', pointStyle: 'circle', bg: '#7ACF52', border: '#7ACF52' },
  { id: 6, label: '6 mi (4 laps)', pointStyle: 'circle', bg: '#7ACF52', border: '#7ACF52' },
  { id: 7.5, label: '7.5 mi (5 laps)', pointStyle: 'circle', bg: '#7ACF52', border: '#7ACF52' },
  { id: 9, label: '9 mi (6 laps)', pointStyle: 'circle', bg: '#7ACF52', border: '#7ACF52' },
  { id: 10.5, label: '10.5 mi (7 laps)', pointStyle: 'circle', bg: '#7ACF52', border: '#7ACF52' },
  { id: 12, label: '12 mi (8 laps)', pointStyle: 'circle', bg: '#7ACF52', border: '#7ACF52' },
  { id: 13.5, label: '13.5 mi (9 laps)', pointStyle: 'circle', bg: '#7ACF52', border: '#7ACF52' },
];

const DEV_ITEMS = [
  { id: 'GameDevHours', label: 'Game Dev', icon: 'redhat' },
];

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeSection, setActiveSection] = useState('inbox');
  const [activeExercise, setActiveExercise] = useState(null);
  const [cardioFilter, setCardioFilter] = useState(null);
  const [devFilter, setDevFilter] = useState(null);
  const [strengthOpen, setStrengthOpen] = useState(false);
  const [cardioOpen, setCardioOpen] = useState(true);
  const [devOpen, setDevOpen] = useState(false);
  const [artOpen, setArtOpen] = useState(false);
  const [pins, setPins] = useState({});
  const [hideCompleted, setHideCompleted] = useState(false);

  // ── Auth ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  const handleSignIn = () => signInWithPopup(auth, googleProvider).catch(console.error);
  const handleSignOut = () => signOut(auth).catch(console.error);

  const OWNER_UID = 'G6LOOmF0nfQl8IeMeLGIDzEptYj1';
  const isOwner = !!user && user.uid === OWNER_UID;

  // ── Data for sidebar counts ──
  const [strengthAchievements, setStrengthAchievements] = useState([]);
  const [cardioAchievements, setCardioAchievements] = useState([]);
  const [devAchievements, setDevAchievements] = useState([]);
  const [workoutData, setWorkoutData] = useState({});
  const [cardioData, setCardioData] = useState({});
  const [hourData, setHourData] = useState({});
  const [illustrationData, setIllustrationData] = useState({});
  const [questData, setQuestData] = useState({});

  useEffect(() => {
    const unsubs = [
      onValue(ref(database, 'pins'), (snap) => setPins(snap.val() || {})),
      onValue(ref(database, 'achievements/strength'), (snap) => {
        const data = snap.val();
        if (data) setStrengthAchievements(Object.entries(data).map(([id, val]) => ({ id, ...val })));
      }),
      onValue(ref(database, 'achievements/cardio'), (snap) => {
        const data = snap.val();
        if (data) setCardioAchievements(Object.entries(data).map(([id, val]) => ({ id, ...val })));
      }),
      onValue(ref(database, 'achievements/dev'), (snap) => {
        const data = snap.val();
        if (data) setDevAchievements(Object.entries(data).map(([id, val]) => ({ id, ...val })));
      }),
      onValue(ref(database, 'workouts'), (snap) => {
        if (snap.val()) setWorkoutData(snap.val());
      }),
      onValue(ref(database, 'cardio'), (snap) => {
        if (snap.val()) setCardioData(snap.val());
      }),
      onValue(ref(database, 'GameDevHours'), (snap) => {
        if (snap.val()) setHourData((prev) => ({ ...prev, GameDevHours: snap.val() }));
      }),
      onValue(ref(database, 'illustrations'), (snap) => {
        setIllustrationData(snap.val() || {});
      }),
      onValue(ref(database, 'quests'), (snap) => {
        setQuestData(snap.val() || {});
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  // ── Flatten workout sets for strength counting ──
  const allSets = useMemo(() => {
    const sets = [];
    for (const year of Object.keys(workoutData)) {
      for (const month of Object.keys(workoutData[year])) {
        for (const dayKey of Object.keys(workoutData[year][month])) {
          const dayEntry = workoutData[year][month][dayKey];
          for (const exerciseId of Object.keys(dayEntry)) {
            if (dayEntry[exerciseId].sets) {
              for (const s of dayEntry[exerciseId].sets) {
                sets.push({
                  date: dayKey,
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

  // ── Flatten cardio sessions ──
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
                result.push({ date: dayKey, distance: s.distance, totalSeconds, activity });
              }
            }
          }
        }
      }
    }
    return result;
  }, [cardioData]);

  // ── Monthly totals for dev ──
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

  // ── Strength counts per exercise ──
  const strengthCounts = useMemo(() => {
    const counts = {};
    for (const ex of STRENGTH_EXERCISES) {
      const exAchs = strengthAchievements.filter((a) => a.exerciseId === ex.id);
      let completed = 0;
      for (const ach of exAchs) {
        let hasCompletion = false;
        if (ach.type === 'timed') {
          hasCompletion = allSets.some((s) => s.exerciseId === ach.exerciseId && s.time >= ach.targetSeconds);
        } else if (ach.type === 'bodyweight') {
          hasCompletion = allSets.some((s) => s.exerciseId === ach.exerciseId && s.reps >= ach.reps);
        } else {
          hasCompletion = allSets.some((s) => s.exerciseId === ach.exerciseId && s.weight >= ach.weight && s.reps >= ach.reps);
        }
        if (hasCompletion) completed++;
      }
      counts[ex.id] = { completed, total: exAchs.length };
    }
    return counts;
  }, [strengthAchievements, allSets]);

  // ── Cardio counts per filter ──
  const cardioCounts = useMemo(() => {
    const counts = {};
    for (const item of CARDIO_ITEMS) {
      let itemAchs;
      if (item.id === 'missionpeak') {
        itemAchs = cardioAchievements.filter((a) => a.activityFilter === 'missionpeak');
      } else {
        itemAchs = cardioAchievements.filter((a) => a.distance === item.id && !a.activityFilter);
      }
      let completed = 0;
      for (const ach of itemAchs) {
        let hasCompletion;
        if (ach.activityFilter) {
          hasCompletion = cardioSessions.some(
            (s) => s.activity === ach.activityFilter && s.totalSeconds <= ach.targetSeconds && s.totalSeconds > 0
          );
        } else {
          hasCompletion = cardioSessions.some(
            (s) => s.distance >= ach.distance && s.totalSeconds <= ach.targetSeconds && s.totalSeconds > 0
          );
        }
        if (hasCompletion) completed++;
      }
      counts[item.id] = { completed, total: itemAchs.length };
    }
    return counts;
  }, [cardioAchievements, cardioSessions]);

  // ── Dev counts per source ──
  const devCounts = useMemo(() => {
    const counts = {};
    for (const item of DEV_ITEMS) {
      const sourceAchs = devAchievements.filter((a) => a.source === item.id);
      let completed = 0;
      for (const ach of sourceAchs) {
        const months = monthlyTotals[ach.source] || {};
        const streaks = findStreaks(months, ach.hoursTarget, ach.monthsTarget);
        if (streaks.length > 0) completed++;
      }
      counts[item.id] = { completed, total: sourceAchs.length };
    }
    return counts;
  }, [devAchievements, monthlyTotals]);

  // ── Art counts ──
  const artCount = useMemo(() => {
    return Object.keys(illustrationData).length;
  }, [illustrationData]);

  // ── Quest counts (effective status: quest with subquests needs all subs completed) ──
  const questCounts = useMemo(() => {
    const all = Object.values(questData);
    let completed = 0;
    for (const q of all) {
      const subs = q.subquests ? Object.values(q.subquests) : [];
      if (subs.length === 0) {
        if (q.status === 'completed') completed++;
      } else {
        if (subs.every((s) => s.status === 'completed')) completed++;
      }
    }
    return { completed, total: all.length };
  }, [questData]);

  // ── Section totals ──
  const strengthTotal = useMemo(() => {
    let completed = 0, total = 0;
    for (const c of Object.values(strengthCounts)) { completed += c.completed; total += c.total; }
    return { completed, total };
  }, [strengthCounts]);

  const cardioTotal = useMemo(() => {
    let completed = 0, total = 0;
    for (const c of Object.values(cardioCounts)) { completed += c.completed; total += c.total; }
    return { completed, total };
  }, [cardioCounts]);

  const devTotal = useMemo(() => {
    let completed = 0, total = 0;
    for (const c of Object.values(devCounts)) { completed += c.completed; total += c.total; }
    return { completed, total };
  }, [devCounts]);

  const grandTotal = useMemo(() => ({
    completed: strengthTotal.completed + cardioTotal.completed + devTotal.completed + questCounts.completed,
    total: strengthTotal.total + cardioTotal.total + devTotal.total + questCounts.total,
  }), [strengthTotal, cardioTotal, devTotal, questCounts]);

  const pinCount = Object.keys(pins).length;

  const togglePin = (category, achievementId) => {
    if (!isOwner) return; // read-only for public visitors
    const pinKey = `${category}__${achievementId}`;
    const pinRef = ref(database, `pins/${pinKey}`);
    if (pins[pinKey]) {
      remove(pinRef);
    } else {
      fbSet(pinRef, true);
    }
  };

  const isPinned = (category, achievementId) => {
    return !!pins[`${category}__${achievementId}`];
  };

  const clearFilters = () => {
    setActiveExercise(null);
    setCardioFilter(null);
    setDevFilter(null);
  };

  const handleStrengthToggle = () => setStrengthOpen(!strengthOpen);
  const handleCardioToggle = () => setCardioOpen(!cardioOpen);
  const handleDevToggle = () => setDevOpen(!devOpen);
  const handleArtToggle = () => setArtOpen(!artOpen);

  const handleExerciseClick = (exId) => {
    setActiveSection('strength');
    clearFilters();
    setActiveExercise(exId);
  };

  const handleCardioItemClick = (filterId) => {
    setActiveSection('cardio');
    clearFilters();
    setCardioFilter(filterId);
  };

  const handleDevItemClick = (sourceId) => {
    setActiveSection('dev');
    clearFilters();
    setDevFilter(sourceId);
  };

  const handleArtItemClick = () => {
    setActiveSection('art');
    clearFilters();
  };

  const handleQuestClick = () => {
    setActiveSection('quests');
    clearFilters();
  };

  const handleInboxClick = () => {
    setActiveSection('inbox');
    clearFilters();
  };

  // Keep all components mounted to preserve Firebase subscriptions & state.
  // Only the active section is visible; others are hidden with CSS.

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-header">
          <span>Achievement Log</span>
          {grandTotal.total > 0 && (
            <span className="sidebar-grand-total">{grandTotal.completed} / {grandTotal.total}</span>
          )}
        </div>
        <ul className="nav-list">
          {/* Inbox */}
          <li
            className={`nav-item ${activeSection === 'inbox' ? 'active' : ''}`}
            onClick={handleInboxClick}
          >
            <span className="nav-icon">&#x1F4E5;</span>
            <span className="nav-label">Inbox</span>
            {pinCount > 0 && <span className="nav-badge">{pinCount}</span>}
          </li>

          {/* Strength — expandable */}
          <li
            className={`nav-item expandable ${activeSection === 'strength' ? 'active' : ''}`}
            onClick={handleStrengthToggle}
          >
            <span className="nav-icon"><img src={`${process.env.PUBLIC_URL}/strength.png`} alt="" className="nav-icon-img" /></span>
            <span className="nav-label">Strength</span>
            {strengthTotal.total > 0 && (
              <span className="nav-count">{strengthTotal.completed}/{strengthTotal.total}</span>
            )}
            <span className={`chevron ${strengthOpen ? 'open' : ''}`}>&#x25B8;</span>
          </li>
          {strengthOpen && (
            <ul className="sub-list">
              {STRENGTH_EXERCISES.map((ex) => (
                <li
                  key={ex.id}
                  className={`sub-item ${activeSection === 'strength' && activeExercise === ex.id ? 'active' : ''}`}
                  onClick={() => handleExerciseClick(ex.id)}
                >
                  <ShapeIcon pointStyle={ex.pointStyle} bg={ex.bg} border={ex.border} size={10} />
                  <span className="sub-item-label">{ex.label}</span>
                  {strengthCounts[ex.id] && strengthCounts[ex.id].total > 0 && (
                    <span className="sub-count">{strengthCounts[ex.id].completed}/{strengthCounts[ex.id].total}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Cardio — expandable */}
          <li
            className={`nav-item expandable ${activeSection === 'cardio' ? 'active' : ''}`}
            onClick={handleCardioToggle}
          >
            <span className="nav-icon"><img src={`${process.env.PUBLIC_URL}/agility.png`} alt="" className="nav-icon-img" style={{ width: 23, height: 23 }} /></span>
            <span className="nav-label">Cardio</span>
            {cardioTotal.total > 0 && (
              <span className="nav-count">{cardioTotal.completed}/{cardioTotal.total}</span>
            )}
            <span className={`chevron ${cardioOpen ? 'open' : ''}`}>&#x25B8;</span>
          </li>
          {cardioOpen && (
            <ul className="sub-list">
              {CARDIO_ITEMS.map((item) => (
                <li
                  key={item.id}
                  className={`sub-item ${activeSection === 'cardio' && cardioFilter === item.id ? 'active' : ''}`}
                  onClick={() => handleCardioItemClick(item.id)}
                >
                  <ShapeIcon pointStyle={item.pointStyle} bg={item.bg} border={item.border} size={10} />
                  <span className="sub-item-label">{item.label}</span>
                  {cardioCounts[item.id] && cardioCounts[item.id].total > 0 && (
                    <span className="sub-count">{cardioCounts[item.id].completed}/{cardioCounts[item.id].total}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Dev — expandable */}
          <li
            className={`nav-item expandable ${activeSection === 'dev' ? 'active' : ''}`}
            onClick={handleDevToggle}
          >
            <span className="nav-icon"><img src={`${process.env.PUBLIC_URL}/mage.png`} alt="" className="nav-icon-img" style={{ width: 23, height: 23 }} /></span>
            <span className="nav-label">Dev</span>
            {devTotal.total > 0 && (
              <span className="nav-count">{devTotal.completed}/{devTotal.total}</span>
            )}
            <span className={`chevron ${devOpen ? 'open' : ''}`}>&#x25B8;</span>
          </li>
          {devOpen && (
            <ul className="sub-list">
              {DEV_ITEMS.map((item) => (
                <li
                  key={item.id}
                  className={`sub-item ${activeSection === 'dev' && devFilter === item.id ? 'active' : ''}`}
                  onClick={() => handleDevItemClick(item.id)}
                >
                  <img src={`${process.env.PUBLIC_URL}/redhat.png`} alt="" className="sub-icon-img" style={{ width: 18, height: 18 }} />
                  <span className="sub-item-label">{item.label}</span>
                  {devCounts[item.id] && devCounts[item.id].total > 0 && (
                    <span className="sub-count">{devCounts[item.id].completed}/{devCounts[item.id].total}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {/* Art — expandable */}
          <li
            className={`nav-item expandable ${activeSection === 'art' ? 'active' : ''}`}
            onClick={handleArtToggle}
          >
            <span className="nav-icon"><img src={`${process.env.PUBLIC_URL}/greenhat.png`} alt="" className="nav-icon-img" /></span>
            <span className="nav-label">Art</span>
            {artCount > 0 && (
              <span className="nav-count">{artCount}</span>
            )}
            <span className={`chevron ${artOpen ? 'open' : ''}`}>&#x25B8;</span>
          </li>
          {artOpen && (
            <ul className="sub-list">
              <li
                className={`sub-item ${activeSection === 'art' ? 'active' : ''}`}
                onClick={handleArtItemClick}
              >
                <img src={`${process.env.PUBLIC_URL}/greenhat.png`} alt="" className="sub-icon-img" style={{ width: 18, height: 18 }} />
                <span className="sub-item-label">Illustrations</span>
                {artCount > 0 && <span className="sub-count">{artCount}</span>}
              </li>
            </ul>
          )}

          {/* Quests — no subsections */}
          <li
            className={`nav-item ${activeSection === 'quests' ? 'active' : ''}`}
            onClick={handleQuestClick}
          >
            <span className="nav-icon"><img src={`${process.env.PUBLIC_URL}/Quest.png`} alt="" className="nav-icon-img" /></span>
            <span className="nav-label">Quests</span>
            {questCounts.total > 0 && (
              <span className="nav-count">{questCounts.completed}/{questCounts.total}</span>
            )}
          </li>
        </ul>
        <div className="sidebar-footer">
          {authReady && !user && (
            <button className="auth-btn" onClick={handleSignIn}>
              Sign in
            </button>
          )}
          {user && !isOwner && (
            <button className="auth-btn" onClick={handleSignOut}>
              Sign out
            </button>
          )}
          {isOwner && (
            <button className="auth-btn auth-btn-signed-in" onClick={handleSignOut} title={user.email}>
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="auth-avatar" referrerPolicy="no-referrer" />
              ) : null}
              <span className="auth-name">{user.displayName || user.email}</span>
            </button>
          )}
        </div>
      </nav>
      <main className="content">
        <div style={{ display: activeSection === 'cardio' ? 'block' : 'none' }}>
          <CardioAchievements
            cardioFilter={cardioFilter}
            isPinned={isPinned}
            togglePin={togglePin}
            hideCompleted={hideCompleted}
            setHideCompleted={setHideCompleted}
            isOwner={isOwner}
          />
        </div>
        <div style={{ display: activeSection === 'strength' ? 'block' : 'none' }}>
          <StrengthAchievements
            filterExercise={activeExercise}
            isPinned={isPinned}
            togglePin={togglePin}
            hideCompleted={hideCompleted}
            setHideCompleted={setHideCompleted}
            isOwner={isOwner}
          />
        </div>
        <div style={{ display: activeSection === 'dev' ? 'block' : 'none' }}>
          <DevAchievements
            filterSource={devFilter}
            isPinned={isPinned}
            togglePin={togglePin}
            hideCompleted={hideCompleted}
            setHideCompleted={setHideCompleted}
            isOwner={isOwner}
          />
        </div>
        <div style={{ display: activeSection === 'art' ? 'block' : 'none' }}>
          <ArtAchievements isOwner={isOwner} />
        </div>
        <div style={{ display: activeSection === 'quests' ? 'block' : 'none' }}>
          <Quests isOwner={isOwner} />
        </div>
        <div style={{ display: activeSection === 'inbox' ? 'block' : 'none' }}>
          <Inbox
            pins={pins}
            isPinned={isPinned}
            togglePin={togglePin}
            isOwner={isOwner}
          />
        </div>
      </main>
    </div>
  );
}

// ── Streak finder (for sidebar dev counts) ──
function findStreaks(monthlyMap, hoursTarget, monthsTarget) {
  const allMonths = Object.keys(monthlyMap).sort();
  if (allMonths.length === 0) return [];
  const qualifying = new Set();
  for (const m of allMonths) {
    if (monthlyMap[m] >= hoursTarget) qualifying.add(m);
  }
  const monthRange = [];
  let [y, mo] = allMonths[0].split('-').map(Number);
  const [ey, em] = allMonths[allMonths.length - 1].split('-').map(Number);
  while (y < ey || (y === ey && mo <= em)) {
    monthRange.push(`${y}-${String(mo).padStart(2, '0')}`);
    mo++;
    if (mo > 12) { mo = 1; y++; }
  }
  const streaks = [];
  let current = [];
  for (const m of monthRange) {
    if (qualifying.has(m)) {
      current.push(m);
    } else {
      if (current.length >= monthsTarget) streaks.push(current);
      current = [];
    }
  }
  if (current.length >= monthsTarget) streaks.push(current);
  return streaks;
}

export default App;
