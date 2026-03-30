// Run with: node src/seedAchievements.js
// Pushes all achievement definitions to Firebase

require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set } = require('firebase/database');

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// ─── Helpers ───

function toSeconds(timeStr) {
  const parts = timeStr.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function formatSeconds(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Format pace: given total seconds and distance, return "M:SS/mi"
function formatPace(totalSec, distance) {
  const pacePerMile = totalSec / distance;
  const m = Math.floor(pacePerMile / 60);
  const s = Math.round(pacePerMile % 60);
  return `${m}:${String(s).padStart(2, '0')}/mi`;
}

// ═══════════════════════════════════════════
//  CARDIO ACHIEVEMENTS
// ═══════════════════════════════════════════

const cardioAchievements = {};
let cOrder = 1;

// ── Mission Peak: 60:00 → 40:00 in 30s decrements ──
// activityFilter = 'missionpeak' so we only match that activity
for (let sec = 3600; sec >= 2400; sec -= 30) {
  const id = `missionpeak_${sec}s`;
  cardioAchievements[id] = {
    activityFilter: 'missionpeak',
    distance: 0,
    targetSeconds: sec,
    label: `${formatSeconds(sec)} — Mission Peak`,
    group: 'Mission Peak',
    order: cOrder++,
  };
}

// ── 1.5 miles: custom specific times (kept as-is) ──
const onePointFive = [
  '12:00', '11:30', '11:15', '11:00', '10:45', '10:30',
  '10:15', '10:00', '9:45', '9:30', '9:15',
  '9:00', '8:45', '8:30', '8:15', '8:00',
];
for (const time of onePointFive) {
  const id = `1_5mi_${time.replace(':', '')}`;
  cardioAchievements[id] = {
    distance: 1.5,
    targetSeconds: toSeconds(time),
    label: `${time} — 1.5 miles`,
    group: '1.5 mi',
    order: cOrder++,
  };
}

// ── 3 mi and up: 10:00/mi → 6:00/mi, total time decreases by 30s each step ──
// For each distance: start = distance * 600s (10:00/mi), end = distance * 360s (6:00/mi)
// Step: -30s on total time each increment

const paceDistances = [3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5];

for (const dist of paceDistances) {
  const startSec = Math.round(dist * 600); // 10:00/mi
  const endSec = Math.round(dist * 360);   // 6:00/mi

  for (let totalSec = startSec; totalSec >= endSec; totalSec -= 30) {
    const timeLabel = formatSeconds(totalSec);
    const paceLabel = formatPace(totalSec, dist);
    const idDist = String(dist).replace('.', '_');
    const id = `${idDist}mi_${totalSec}s`;
    cardioAchievements[id] = {
      distance: dist,
      targetSeconds: totalSec,
      label: `${timeLabel} — ${dist} miles (${paceLabel})`,
      group: `${dist} mi`,
      order: cOrder++,
    };
  }
}

// ═══════════════════════════════════════════
//  STRENGTH ACHIEVEMENTS
// ═══════════════════════════════════════════

const strengthAchievements = {};
let sOrder = 1;

// --- Weighted exercises: 5RM and 10RM ---

const weightedExercises = [
  { id: 'barbellflatbench', name: 'Barbell Flat Bench', min: 225, max: 315, step: 2.5 },
  { id: 'barbellinclinebench', name: 'Barbell Incline Bench', min: 225, max: 315, step: 2.5 },
  { id: 'squats', name: 'Squats', min: 225, max: 315, step: 5 },
  { id: 'deadlifts', name: 'Deadlifts', min: 225, max: 315, step: 5 },
  { id: 'hipthrusts', name: 'Hip Thrusts', min: 225, max: 315, step: 5 },
  { id: 'barbellrows', name: 'Barbell Rows', min: 135, max: 225, step: 2.5 },
];

// Order by weight, then reps within each weight (225x5, 225x10, 227.5x5, 227.5x10, ...)
for (const ex of weightedExercises) {
  for (let w = ex.min; w <= ex.max; w += ex.step) {
    for (const reps of [5, 10]) {
      const wLabel = w % 1 === 0 ? `${w}` : `${w}`;
      const achId = `${ex.id}_${reps}rm_${String(w).replace('.', '_')}`;
      strengthAchievements[achId] = {
        exerciseId: ex.id,
        exerciseName: ex.name,
        type: 'weighted',
        reps: reps,
        weight: w,
        label: `${wLabel} lbs x ${reps}`,
        order: sOrder++,
      };
    }
  }
}

// --- Bodyweight exercises ---

const bodyweightExercises = [
  { id: 'pullups', name: 'Pull Ups', min: 5, max: 30, step: 1 },
  { id: 'pushups', name: 'Push Ups', min: 50, max: 100, step: 1 },
  { id: 'dips', name: 'Ring Dips', min: 20, max: 50, step: 1 },
];

for (const ex of bodyweightExercises) {
  for (let r = ex.min; r <= ex.max; r += ex.step) {
    const achId = `${ex.id}_${r}reps`;
    strengthAchievements[achId] = {
      exerciseId: ex.id,
      exerciseName: ex.name,
      type: 'bodyweight',
      reps: r,
      weight: 0,
      label: `${r} reps`,
      order: sOrder++,
    };
  }
}

// --- Hangs: 60s to 300s in 5s increments ---

for (let sec = 60; sec <= 300; sec += 5) {
  const achId = `hangs_${sec}s`;
  const label = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  strengthAchievements[achId] = {
    exerciseId: 'hangs',
    exerciseName: 'Hangs',
    type: 'timed',
    targetSeconds: sec,
    reps: 0,
    weight: 0,
    label: `${label} hang`,
    order: sOrder++,
  };
}

// ═══════════════════════════════════════════
//  DEV ACHIEVEMENTS
// ═══════════════════════════════════════════

const devAchievements = {};
let dOrder = 1;

// Game Dev: streak achievements — hit X hrs/month for N consecutive months
// Thresholds: 30, 45, 60 hrs/month | Streaks: 1–24 months
// Source: GameDevHours in Firebase

const devCategories = [
  { source: 'GameDevHours', name: 'Game Dev' },
];

const hourThresholds = [30, 45, 60];

for (const cat of devCategories) {
  for (const hours of hourThresholds) {
    for (let months = 1; months <= 24; months++) {
      const monthLabel = months === 1 ? '1 Month' : `${months} Months`;
      const achId = `${cat.source}_${hours}h_${months}m`;
      devAchievements[achId] = {
        source: cat.source,
        sourceName: cat.name,
        hoursTarget: hours,
        monthsTarget: months,
        label: `${monthLabel} — ${hours} hrs/mo`,
        group: `${cat.name} — ${hours} hrs/mo`,
        order: dOrder++,
      };
    }
  }
}

// ─── SEED ───

async function seed() {
  const cc = Object.keys(cardioAchievements).length;
  const sc = Object.keys(strengthAchievements).length;
  const dc = Object.keys(devAchievements).length;
  console.log(`Seeding ${cc} cardio achievements...`);
  console.log(`Seeding ${sc} strength achievements...`);
  console.log(`Seeding ${dc} dev achievements...`);

  await Promise.all([
    set(ref(database, 'achievements/cardio'), cardioAchievements),
    set(ref(database, 'achievements/strength'), strengthAchievements),
    set(ref(database, 'achievements/dev'), devAchievements),
  ]);

  console.log(`Done! ${cc + sc + dc} total achievements written.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
