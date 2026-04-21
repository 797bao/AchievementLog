/* ═══════════════════════════════════════
   PLANNER PURE HELPER FUNCTIONS
   ═══════════════════════════════════════ */

import { MONTH_NAMES, TYPE_ICON_FILES, GRID_SIZE } from './plannerData';

/* ─── Date / Sprint helpers ─── */
export function monthKey(y, m) {
  return y + '-' + m;
}

export function monthLabel(y, m) {
  return MONTH_NAMES[m] + ' ' + y;
}

export function sprintShort(key) {
  if (!key) return '';
  const p = key.split('-');
  return MONTH_NAMES[parseInt(p[1])];
}

/**
 * True when the given time-log entry was created today (local time).
 * Prefers an explicit `loggedAt` ISO string; falls back to parsing the
 * timestamp embedded in the entry's `id` (format: `tl-<ms>-…`).
 */
export function wasLoggedToday(log) {
  if (!log) return false;
  let ts = null;
  if (log.loggedAt) {
    const parsed = Date.parse(log.loggedAt);
    if (!isNaN(parsed)) ts = parsed;
  }
  if (ts == null && typeof log.id === 'string' && log.id.startsWith('tl-')) {
    const parts = log.id.split('-');
    const n = parseInt(parts[1], 10);
    if (!isNaN(n) && n > 0) ts = n;
  }
  if (ts == null) return false;
  const d = new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
}

/* ─── Tree traversal ─── */
export function getLeaves(node) {
  if (!node.children) return [node]; // leaf task
  if (node.children.length === 0) return []; // empty container
  let result = [];
  node.children.forEach((c) => {
    result = result.concat(getLeaves(c));
  });
  return result;
}

export function getProgress(node) {
  const leaves = getLeaves(node);
  if (!leaves.length) return { done: 0, total: 0, pct: 0 };
  const done = leaves.filter((x) => x.status === 'done').length;
  return { done, total: leaves.length, pct: Math.round((done / leaves.length) * 100) };
}

/* ─── Time helpers ─── */
export function parseTime(t) {
  if (!t) return 0;
  let mins = 0;
  const hMatch = t.toString().match(/(\d+(?:\.\d+)?)\s*h/i);
  const mMatch = t.toString().match(/(\d+(?:\.\d+)?)\s*m/i);
  if (hMatch) mins += parseFloat(hMatch[1]) * 60;
  if (mMatch) mins += parseFloat(mMatch[1]);
  if (mins === 0 && /^\d+(\.\d+)?$/.test(String(t).trim())) mins = parseFloat(t);
  return mins;
}

/** Expected time for a task (the estimate in task.time) */
export function getTaskExpectedTime(task) {
  return parseTime(task.time);
}

/** Logged time for a task (sum of timeLogs entries) */
export function getTaskLoggedTime(task) {
  if (!task.timeLogs || task.timeLogs.length === 0) return 0;
  let total = 0;
  task.timeLogs.forEach((log) => { total += parseTime(log.duration); });
  return total;
}

/** Backward compat alias — returns expected time */
export function getTaskTime(task) {
  return parseTime(task.time);
}

export function formatTime(minutes) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? h + 'h ' + m + 'm' : h + 'h';
  }
  return minutes + 'm';
}

/** Sum of expected times for all leaves under a node */
export function getTotalTime(node) {
  const leaves = getLeaves(node);
  let total = 0;
  leaves.forEach((x) => { total += getTaskExpectedTime(x); });
  return total;
}

/** Sum of logged times for all leaves under a node */
export function getLoggedTime(node) {
  const leaves = getLeaves(node);
  let total = 0;
  leaves.forEach((x) => { total += getTaskLoggedTime(x); });
  return total;
}

/** Milestone-level: sum of expected times */
export function getMilestoneTotalTime(ms) {
  const leaves = getAllLeaves(ms);
  let total = 0;
  leaves.forEach((x) => { total += getTaskExpectedTime(x); });
  return total;
}

/** Milestone-level: sum of logged times */
export function getMilestoneLoggedTime(ms) {
  const leaves = getAllLeaves(ms);
  let total = 0;
  leaves.forEach((x) => { total += getTaskLoggedTime(x); });
  return total;
}

/* ─── Visual helpers ─── */
export function getProgressColor(pct) {
  if (pct === 100) return '#34a853';
  if (pct >= 50) return '#E8985A';
  if (pct > 0) return '#fbbc04';
  return '#5f6368';
}

export function getProgressClass(pct) {
  if (pct === 100) return 'prog-done';
  if (pct >= 50) return 'prog-high';
  if (pct > 0) return 'prog-mid';
  return 'prog-low';
}

export function iconFor(type) {
  return TYPE_ICON_FILES[type] || TYPE_ICON_FILES.script;
}

export function snapToGrid(val, gridSize = GRID_SIZE) {
  return Math.round(val / gridSize) * gridSize;
}

export function getFrameTotalTime(frame) {
  let total = 0;
  (frame.systems || []).forEach((sys) => { total += getTotalTime(sys); });
  (frame.tasks || []).forEach((t) => { total += getTaskExpectedTime(t); });
  return total;
}

export function getFrameLoggedTime(frame) {
  let total = 0;
  (frame.systems || []).forEach((sys) => { total += getLoggedTime(sys); });
  (frame.tasks || []).forEach((t) => { total += getTaskLoggedTime(t); });
  return total;
}

/* ─── Milestone-level queries ─── */
export function getAllLeaves(ms) {
  let all = [];
  ms.frames.forEach((f) => {
    f.systems.forEach((s) => {
      all = all.concat(getLeaves(s));
    });
    (f.tasks || []).forEach((t) => {
      all.push(t);
    });
  });
  (ms.looseSystems || []).forEach((s) => {
    all = all.concat(getLeaves(s));
  });
  (ms.looseTasks || []).forEach((t) => {
    all.push(t);
  });
  return all;
}

export function findInNode(id, node) {
  if (node.id === id) return node;
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      const found = findInNode(id, node.children[i]);
      if (found) return found;
    }
  }
  return null;
}

export function findTask(id, ms) {
  for (let i = 0; i < ms.frames.length; i++) {
    for (let j = 0; j < ms.frames[i].systems.length; j++) {
      const found = findInNode(id, ms.frames[i].systems[j]);
      if (found) return found;
    }
    const ft = ms.frames[i].tasks || [];
    for (let j = 0; j < ft.length; j++) {
      if (ft[j].id === id) return ft[j];
    }
  }
  const ls = ms.looseSystems || [];
  for (let i = 0; i < ls.length; i++) {
    const found = findInNode(id, ls[i]);
    if (found) return found;
  }
  const lt = ms.looseTasks || [];
  for (let i = 0; i < lt.length; i++) {
    if (lt[i].id === id) return lt[i];
  }
  return null;
}

export function findSystemForTask(tid, ms) {
  for (let i = 0; i < ms.frames.length; i++) {
    for (let j = 0; j < ms.frames[i].systems.length; j++) {
      const sys = ms.frames[i].systems[j];
      if (findInNode(tid, sys)) return sys;
    }
    // frame-level tasks have no parent system
  }
  const ls = ms.looseSystems || [];
  for (let i = 0; i < ls.length; i++) {
    if (findInNode(tid, ls[i])) return ls[i];
  }
  return null;
}

export function findParentName(tid, node) {
  if (!node.children) return null;
  for (let i = 0; i < node.children.length; i++) {
    const c = node.children[i];
    if (c.id === tid) return null;
    if (c.isGroup && c.children) {
      for (let j = 0; j < c.children.length; j++) {
        if (c.children[j].id === tid) return c.name;
      }
    }
  }
  return null;
}

/* ─── Data mutation helpers (return new milestone via deep clone) ─── */

function removeFromNode(taskId, node) {
  if (!node.children) return false;
  for (let i = 0; i < node.children.length; i++) {
    if (node.children[i].id === taskId) {
      node.children.splice(i, 1);
      return true;
    }
    if (removeFromNode(taskId, node.children[i])) return true;
  }
  return false;
}

export function removeTaskFromTree(taskId, ms) {
  for (let i = 0; i < ms.frames.length; i++) {
    for (let j = 0; j < ms.frames[i].systems.length; j++) {
      if (removeFromNode(taskId, ms.frames[i].systems[j])) return true;
    }
    const ft = ms.frames[i].tasks || [];
    for (let j = 0; j < ft.length; j++) {
      if (ft[j].id === taskId) { ft.splice(j, 1); return true; }
    }
  }
  const ls = ms.looseSystems || [];
  for (let i = 0; i < ls.length; i++) {
    if (removeFromNode(taskId, ls[i])) return true;
  }
  const lt = ms.looseTasks || [];
  for (let i = 0; i < lt.length; i++) {
    if (lt[i].id === taskId) { lt.splice(i, 1); return true; }
  }
  return false;
}

export function removeSystemFromAny(sysId, ms) {
  // Remove from frame.systems
  for (let i = 0; i < ms.frames.length; i++) {
    const f = ms.frames[i];
    for (let j = 0; j < f.systems.length; j++) {
      if (f.systems[j].id === sysId) { f.systems.splice(j, 1); return true; }
    }
  }
  // Remove as sub-group inside systems
  for (let i = 0; i < ms.frames.length; i++) {
    for (let j = 0; j < ms.frames[i].systems.length; j++) {
      if (removeFromNode(sysId, ms.frames[i].systems[j])) return true;
    }
  }
  const ls = ms.looseSystems || [];
  for (let i = 0; i < ls.length; i++) {
    if (ls[i].id === sysId) { ls.splice(i, 1); return true; }
    if (removeFromNode(sysId, ls[i])) return true;
  }
  return false;
}

/* ─── Deep clone with new IDs (for copy/paste) ─── */
export function deepCloneWithNewIds(element) {
  const idMap = {};
  let counter = 0;
  const ts = Date.now();

  // Random suffix guarantees uniqueness across multiple deepClone calls in the
  // same millisecond (e.g. when pasteElements clones each item separately).
  const rand = Math.random().toString(36).slice(2, 8);
  function newId(prefix) {
    return prefix + '-' + ts + '-' + rand + '-' + (counter++);
  }

  function cloneNode(node) {
    const clone = JSON.parse(JSON.stringify(node));
    const oldId = clone.id;
    const prefix = oldId ? oldId.split('-')[0] : 'elem';
    clone.id = newId(prefix);
    idMap[oldId] = clone.id;
    if (clone.children) {
      clone.children = clone.children.map((c) => cloneNode(c));
    }
    if (clone.images) {
      clone.images = clone.images.map((img) => {
        const oldImgId = img.id;
        img.id = newId('img');
        idMap[oldImgId] = img.id;
        return img;
      });
    }
    if (clone.systems) {
      clone.systems = clone.systems.map((s) => cloneNode(s));
    }
    if (clone.tasks) {
      clone.tasks = clone.tasks.map((t) => cloneNode(t));
    }
    if (clone.timeLogs) {
      clone.timeLogs = clone.timeLogs.map((tl) => ({
        ...tl,
        id: newId('tl'),
      }));
    }
    return clone;
  }

  const clone = cloneNode(element);
  return { clone, idMap };
}

/* ─── Auto-layout ─── */
export function estimateSysHeight(sys) {
  let h = 80;
  (sys.children || []).forEach((c) => {
    if (c.isGroup) {
      h += 38 + (c.children ? c.children.length * 26 : 0);
    } else {
      h += 26;
    }
  });
  return h;
}

export function estimateFrameHeight(frame) {
  if (frame.standalone) return 90;
  let maxH = 0;
  frame.systems.forEach((sys) => {
    const h = estimateSysHeight(sys);
    if (h > maxH) maxH = h;
  });
  return maxH + 65;
}

export function autoLayoutMilestone(ms) {
  if (ms._laid_out) return;
  ms._laid_out = true;
  if (!ms.looseSystems) ms.looseSystems = [];
  if (!ms.looseTasks) ms.looseTasks = [];
  let curY = 30;
  ms.frames.forEach((frame) => {
    if (frame.x !== undefined) return;
    if (frame.standalone) {
      frame.x = 280;
      frame.y = curY;
      frame.w = 300;
      curY += 130;
    } else {
      frame.x = 40;
      frame.y = curY;
      frame.w = Math.min(1200, Math.max(500, frame.systems.length * 260 + 60));
      curY += estimateFrameHeight(frame) + 35;
    }
  });
}
