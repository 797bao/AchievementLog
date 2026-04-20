import { useState, useCallback, useMemo, useRef } from 'react';
import { createSampleMilestones } from '../plannerData';
import {
  getAllLeaves,
  findTask,
  findInNode,
  removeTaskFromTree,
  removeSystemFromAny,
  autoLayoutMilestone,
  monthKey,
  parseTime,
  formatTime,
  getTaskExpectedTime,
  getTaskLoggedTime,
  snapToGrid,
} from '../plannerHelpers';

export default function usePlannerState(initialData) {
  const [milestones, setMilestones] = useState(
    () => (initialData && initialData.milestones) || createSampleMilestones()
  );
  const [activeMilestoneIdx, setActiveMilestoneIdx] = useState(
    () => (initialData && initialData.activeMilestoneIdx) || 0
  );
  const [boardMonth, setBoardMonth] = useState({ year: 2026, month: 3 });
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const [currentBoardPath, setCurrentBoardPath] = useState(null);
  const [isSprintOverview, setIsSprintOverview] = useState(false);
  const [msCollapsed, setMsCollapsed] = useState(false);
  const [isMetricsView, setIsMetricsView] = useState(false);
  const [taskOrder, setTaskOrder] = useState(
    () => (initialData && initialData.taskOrder) || {}
  );

  /* ─── Undo / Redo history ─── */
  const MAX_HISTORY = 50;
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  /* ─── Derived ─── */
  const activeMilestone = milestones[activeMilestoneIdx];

  const allLeaves = useMemo(
    () => getAllLeaves(activeMilestone),
    [activeMilestone]
  );

  const mk = monthKey(boardMonth.year, boardMonth.month);

  const sprintStats = useMemo(() => {
    const assigned = allLeaves.filter((l) => l.sprint === mk).length;
    const completed = allLeaves.filter((l) => l.completedAt === mk).length;
    const inProgress = allLeaves.filter((l) => l.sprint === mk && l.status === 'progress').length;
    let timeEst = 0;
    let timeLogged = 0;
    allLeaves.filter((l) => l.sprint === mk).forEach((l) => {
      timeEst += getTaskExpectedTime(l);
      timeLogged += getTaskLoggedTime(l);
    });
    return { assigned, completed, inProgress, timeEst: formatTime(timeEst), timeLogged: formatTime(timeLogged) };
  }, [allLeaves, mk]);

  const totalStats = useMemo(() => {
    const done = allLeaves.filter((l) => l.status === 'done').length;
    const total = allLeaves.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    let expectedTime = 0;
    let loggedTime = 0;
    allLeaves.forEach((l) => {
      expectedTime += getTaskExpectedTime(l);
      loggedTime += getTaskLoggedTime(l);
    });
    return { done, total, pct, totalTime: formatTime(expectedTime), loggedTime: formatTime(loggedTime) };
  }, [allLeaves]);

  const showBreadcrumb = !isSprintOverview && !currentBoardId;
  const showBoard = isSprintOverview || !!currentBoardId;

  /* ─── Helpers to clone & update milestones (with undo history) ─── */
  const updateMilestones = useCallback((updater) => {
    setMilestones((prev) => {
      // Push current state onto undo stack
      undoStack.current.push(JSON.stringify(prev));
      if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
      // Clear redo stack on new action
      redoStack.current = [];
      const clone = JSON.parse(JSON.stringify(prev));
      updater(clone);
      return clone;
    });
  }, []);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    setMilestones((prev) => {
      redoStack.current.push(JSON.stringify(prev));
      const restored = JSON.parse(undoStack.current.pop());
      return restored;
    });
  }, []);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    setMilestones((prev) => {
      undoStack.current.push(JSON.stringify(prev));
      const restored = JSON.parse(redoStack.current.pop());
      return restored;
    });
  }, []);

  /* ─── Actions ─── */
  const switchMilestone = useCallback((idx) => {
    setActiveMilestoneIdx(idx);
    setCurrentBoardId(null);
    setCurrentBoardPath(null);
    setIsSprintOverview(false);
    setIsMetricsView(false);
  }, []);

  const changeSidebarMonth = useCallback((dir) => {
    setBoardMonth((prev) => {
      let m = prev.month + dir;
      let y = prev.year;
      if (m > 11) { m = 0; y++; }
      if (m < 0) { m = 11; y--; }
      return { year: y, month: m };
    });
  }, []);

  const toggleMilestones = useCallback(() => {
    setMsCollapsed((p) => !p);
  }, []);

  const openBoard = useCallback((nodeId, displayName) => {
    setIsMetricsView(false);
    setIsSprintOverview(false);
    setCurrentBoardId(nodeId);
    setCurrentBoardPath(displayName);
  }, []);

  const openSprintOverview = useCallback(() => {
    setIsMetricsView(false);
    setIsSprintOverview((prev) => {
      if (prev) {
        setCurrentBoardId(null);
        setCurrentBoardPath(null);
        return false;
      }
      setCurrentBoardId(null);
      return true;
    });
  }, []);

  const closeBoard = useCallback(() => {
    setCurrentBoardId(null);
    setCurrentBoardPath(null);
    setIsSprintOverview(false);
  }, []);

  const openMetrics = useCallback(() => {
    setIsMetricsView((prev) => {
      if (prev) return false;
      setCurrentBoardId(null);
      setCurrentBoardPath(null);
      setIsSprintOverview(false);
      return true;
    });
  }, []);

  const closeMetrics = useCallback(() => {
    setIsMetricsView(false);
  }, []);

  /* ─── Milestone CRUD ─── */
  const createMilestone = useCallback((name) => {
    setMilestones((prev) => {
      undoStack.current.push(JSON.stringify(prev));
      if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
      redoStack.current = [];
      const clone = JSON.parse(JSON.stringify(prev));
      clone.push({
        id: 'ms-' + Date.now(),
        name: name || 'New Milestone',
        looseSystems: [],
        looseTasks: [],
        arrows: [],
        frames: [],
      });
      return clone;
    });
    setActiveMilestoneIdx((prev) => prev); // stay on current
  }, []);

  const renameMilestone = useCallback((msId, newName) => {
    updateMilestones((ms) => {
      const m = ms.find((x) => x.id === msId);
      if (m) m.name = newName;
    });
  }, [updateMilestones]);

  const moveMilestone = useCallback((msId, direction) => {
    setMilestones((prev) => {
      const idx = prev.findIndex((x) => x.id === msId);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      undoStack.current.push(JSON.stringify(prev));
      if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
      redoStack.current = [];
      const clone = JSON.parse(JSON.stringify(prev));
      const temp = clone[idx];
      clone[idx] = clone[newIdx];
      clone[newIdx] = temp;
      return clone;
    });
    // Adjust active index to follow the milestone the user is viewing
    setActiveMilestoneIdx((prev) => {
      const idx = milestones.findIndex((x) => x.id === msId);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= milestones.length) return prev;
      if (prev === idx) return newIdx;
      if (prev === newIdx) return idx;
      return prev;
    });
  }, [milestones]);

  const deleteMilestone = useCallback((msId) => {
    setMilestones((prev) => {
      if (prev.length <= 1) return prev; // can't delete last
      const idx = prev.findIndex((x) => x.id === msId);
      if (idx < 0) return prev;
      undoStack.current.push(JSON.stringify(prev));
      if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
      redoStack.current = [];
      const clone = JSON.parse(JSON.stringify(prev));
      clone.splice(idx, 1);
      return clone;
    });
    setActiveMilestoneIdx((prev) => {
      const newLen = milestones.length - 1;
      return prev >= newLen ? Math.max(0, newLen - 1) : prev;
    });
    setCurrentBoardId(null);
    setCurrentBoardPath(null);
    setIsSprintOverview(false);
  }, [milestones]);

  /* ─── Canvas mutations ─── */
  const moveFrame = useCallback((frameId, dx, dy) => {
    updateMilestones((ms) => {
      const frame = ms[activeMilestoneIdx].frames.find((f) => f.id === frameId);
      if (frame) {
        frame.x = (frame.x || 0) + dx;
        frame.y = (frame.y || 0) + dy;
      }
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const dropSystem = useCallback((sysId, target, canvasPos) => {
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      const sysNode = findTask(sysId, milestone);
      if (!sysNode) return;

      if (target && target.type === 'system') {
        if (findInNode(target.id, sysNode)) return;
      }

      const sysCopy = JSON.parse(JSON.stringify(sysNode));
      removeSystemFromAny(sysId, milestone);

      // Clean up empty standalone frames left behind
      milestone.frames = milestone.frames.filter(
        (f) => !f.standalone || f.systems.length > 0
      );

      if (target && target.type === 'frame') {
        const targetFrame = milestone.frames.find((f) => f.id === target.id);
        if (targetFrame) targetFrame.systems.push(sysCopy);
      } else if (target && target.type === 'system') {
        const targetSys = findTask(target.id, milestone);
        if (targetSys) {
          sysCopy.isGroup = true;
          if (!targetSys.children) targetSys.children = [];
          targetSys.children.push(sysCopy);
        }
      } else {
        sysCopy.x = canvasPos.x;
        sysCopy.y = canvasPos.y;
        sysCopy.w = 280;
        if (!milestone.looseSystems) milestone.looseSystems = [];
        milestone.looseSystems.push(sysCopy);
      }
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const dropTask = useCallback((taskId, target, canvasPos) => {
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      const taskNode = findTask(taskId, milestone);
      if (!taskNode || taskNode.children) return;
      const taskCopy = JSON.parse(JSON.stringify(taskNode));
      removeTaskFromTree(taskId, milestone);

      if (target && (target.type === 'system' || target.type === 'subgroup')) {
        const targetNode = findTask(target.id, milestone);
        if (targetNode) {
          if (!targetNode.children) targetNode.children = [];
          targetNode.children.push(taskCopy);
        }
      } else {
        taskCopy.x = canvasPos.x;
        taskCopy.y = canvasPos.y;
        if (!milestone.looseTasks) milestone.looseTasks = [];
        milestone.looseTasks.push(taskCopy);
      }
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const resizeFrame = useCallback((frameId, newWidth) => {
    updateMilestones((ms) => {
      const frame = ms[activeMilestoneIdx].frames.find((f) => f.id === frameId);
      if (frame) frame.w = newWidth;
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const resizeLooseSystem = useCallback((sysId, newWidth) => {
    updateMilestones((ms) => {
      const sys = (ms[activeMilestoneIdx].looseSystems || []).find((s) => s.id === sysId);
      if (sys) sys.w = newWidth;
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const createNewTask = useCallback((x, y) => {
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      if (!milestone.looseTasks) milestone.looseTasks = [];
      milestone.looseTasks.push({
        id: 'task-' + Date.now(),
        name: 'New Task',
        type: 'script',
        status: 'planned',
        timeLogs: [],
        description: '',
        sprint: null,
        completedAt: null,
        x: snapToGrid(x),
        y: snapToGrid(y),
      });
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const createNewSystem = useCallback((x, y) => {
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      if (!milestone.looseSystems) milestone.looseSystems = [];
      milestone.looseSystems.push({
        id: 'sys-' + Date.now(),
        name: 'New System',
        children: [],
        x: snapToGrid(x),
        y: snapToGrid(y),
        w: 250,
      });
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const createNewFrame = useCallback((x, y) => {
    updateMilestones((ms) => {
      ms[activeMilestoneIdx].frames.push({
        id: 'frame-' + Date.now(),
        label: 'New Frame',
        systems: [],
        x: snapToGrid(x),
        y: snapToGrid(y),
        w: 500,
      });
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const renameFrame = useCallback((frameId, newLabel) => {
    updateMilestones((ms) => {
      const frame = ms[activeMilestoneIdx].frames.find((f) => f.id === frameId);
      if (frame) frame.label = newLabel;
    });
  }, [activeMilestoneIdx, updateMilestones]);

  /* ─── Task editing actions ─── */
  const renameTask = useCallback((taskId, newName) => {
    updateMilestones((ms) => {
      const task = findTask(taskId, ms[activeMilestoneIdx]);
      if (task) task.name = newName;
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const changeTaskIcon = useCallback((taskId, newType) => {
    updateMilestones((ms) => {
      const task = findTask(taskId, ms[activeMilestoneIdx]);
      if (task) task.type = newType;
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const setTaskTime = useCallback((taskId, time) => {
    updateMilestones((ms) => {
      const task = findTask(taskId, ms[activeMilestoneIdx]);
      if (task) task.time = time;
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const updateTaskStatus = useCallback((taskId, newStatus) => {
    updateMilestones((ms) => {
      const task = findTask(taskId, ms[activeMilestoneIdx]);
      if (!task || task.children) return;
      task.status = newStatus;
      if (newStatus === 'done') {
        task.completedAt = monthKey(boardMonth.year, boardMonth.month);
      } else {
        task.completedAt = null;
      }
    });
  }, [activeMilestoneIdx, boardMonth, updateMilestones]);

  /** Update multiple task fields at once (used by modal) */
  const updateTask = useCallback((taskId, updates) => {
    updateMilestones((ms) => {
      const task = findTask(taskId, ms[activeMilestoneIdx]);
      if (!task) return;
      if (updates.name !== undefined) task.name = updates.name;
      if (updates.type !== undefined) task.type = updates.type;
      if (updates.description !== undefined) task.description = updates.description;
      if (updates.timeLogs !== undefined) task.timeLogs = updates.timeLogs;
      if (updates.time !== undefined) task.time = updates.time || null;
      if (updates.sprint !== undefined) task.sprint = updates.sprint || null;
      if (updates.status !== undefined) {
        task.status = updates.status;
        if (updates.status === 'done') {
          task.completedAt = monthKey(boardMonth.year, boardMonth.month);
        } else {
          task.completedAt = null;
        }
      }
    });
  }, [activeMilestoneIdx, boardMonth, updateMilestones]);

  /* ─── Delete actions ─── */
  const deleteTask = useCallback((taskId) => {
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      removeTaskFromTree(taskId, milestone);
      // Also remove any arrows referencing this task
      if (milestone.arrows) {
        milestone.arrows = milestone.arrows.filter(
          (a) => a.fromId !== taskId && a.toId !== taskId
        );
      }
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const deleteSystem = useCallback((sysId) => {
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      removeSystemFromAny(sysId, milestone);
      if (milestone.arrows) {
        milestone.arrows = milestone.arrows.filter(
          (a) => a.fromId !== sysId && a.toId !== sysId
        );
      }
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const deleteFrame = useCallback((frameId) => {
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      milestone.frames = milestone.frames.filter((f) => f.id !== frameId);
      if (milestone.arrows) {
        milestone.arrows = milestone.arrows.filter(
          (a) => a.fromId !== frameId && a.toId !== frameId
        );
      }
    });
  }, [activeMilestoneIdx, updateMilestones]);

  /* ─── System editing actions ─── */
  const createSubSystem = useCallback((parentSysId) => {
    updateMilestones((ms) => {
      const parent = findTask(parentSysId, ms[activeMilestoneIdx]);
      if (!parent) return;
      if (!parent.children) parent.children = [];
      parent.children.push({
        id: 'sys-' + Date.now(),
        name: 'New Sub-System',
        type: 'system',
        isGroup: true,
        children: [],
      });
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const renameSystem = useCallback((sysId, newName) => {
    updateMilestones((ms) => {
      const sys = findTask(sysId, ms[activeMilestoneIdx]);
      if (sys) sys.name = newName;
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const updateSystemColors = useCallback((sysId, colors) => {
    updateMilestones((ms) => {
      const sys = findTask(sysId, ms[activeMilestoneIdx]);
      if (sys) {
        if (colors.headerBg !== undefined) sys.headerBg = colors.headerBg;
        if (colors.headerText !== undefined) sys.headerText = colors.headerText;
      }
    });
  }, [activeMilestoneIdx, updateMilestones]);

  /* ─── Create task inside a system (from board view) ─── */
  const createTaskInSystem = useCallback((parentSysId, taskData) => {
    updateMilestones((ms) => {
      const parent = findTask(parentSysId, ms[activeMilestoneIdx]);
      if (!parent) return;
      if (!parent.children) parent.children = [];
      const curMk = monthKey(boardMonth.year, boardMonth.month);
      parent.children.push({
        id: 'task-' + Date.now(),
        name: taskData.name || 'New Task',
        type: taskData.type || 'script',
        status: taskData.status || 'planned',
        timeLogs: taskData.time
          ? [{ id: 'tl-' + Date.now(), duration: taskData.time, month: curMk }]
          : [],
        description: taskData.description || '',
        sprint: null,
        completedAt: null,
      });
    });
  }, [activeMilestoneIdx, boardMonth, updateMilestones]);

  /* ─── Arrow actions ─── */
  const addArrow = useCallback((fromId, toId) => {
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      if (!milestone.arrows) milestone.arrows = [];
      // Prevent duplicate arrows
      const exists = milestone.arrows.some(
        (a) => a.fromId === fromId && a.toId === toId
      );
      if (!exists) {
        milestone.arrows.push({
          id: 'arrow-' + Date.now(),
          fromId,
          toId,
        });
      }
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const deleteArrow = useCallback((arrowId) => {
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      if (milestone.arrows) {
        milestone.arrows = milestone.arrows.filter((a) => a.id !== arrowId);
      }
    });
  }, [activeMilestoneIdx, updateMilestones]);

  /* ─── Kanban actions ─── */
  const assignSprint = useCallback((taskId) => {
    updateMilestones((ms) => {
      const task = findTask(taskId, ms[activeMilestoneIdx]);
      if (task) task.sprint = monthKey(boardMonth.year, boardMonth.month);
    });
  }, [activeMilestoneIdx, boardMonth, updateMilestones]);

  const unassignSprint = useCallback((taskId) => {
    updateMilestones((ms) => {
      const task = findTask(taskId, ms[activeMilestoneIdx]);
      if (task) task.sprint = null;
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const updateTaskOrder = useCallback((orderKey, newOrder) => {
    setTaskOrder((prev) => ({ ...prev, [orderKey]: newOrder }));
  }, []);

  /* ─── Sub-node resize ─── */
  const resizeSubNode = useCallback((sysId, newWidth, newHeight) => {
    updateMilestones((ms) => {
      const node = findTask(sysId, ms[activeMilestoneIdx]);
      if (node) {
        if (newWidth && !isNaN(newWidth)) node.w = newWidth;
        if (newHeight && !isNaN(newHeight)) node.h = newHeight;
      }
    });
  }, [activeMilestoneIdx, updateMilestones]);

  /* ─── Image actions ─── */
  const addImageToSystem = useCallback((sysId, imageData) => {
    updateMilestones((ms) => {
      const sys = findTask(sysId, ms[activeMilestoneIdx]);
      if (!sys) return;
      if (!sys.images) sys.images = [];
      sys.images.push({
        id: 'img-' + Date.now(),
        url: imageData.url,
        x: imageData.x || 10,
        y: imageData.y || 40,
        w: imageData.w || 150,
        h: imageData.h || 150,
        zIndex: 0,
        flipH: false,
        flipV: false,
      });
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const addLooseImage = useCallback((imageData) => {
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      if (!milestone.looseImages) milestone.looseImages = [];
      milestone.looseImages.push({
        id: 'img-' + Date.now(),
        url: imageData.url,
        x: imageData.x || 100,
        y: imageData.y || 100,
        w: imageData.w || 150,
        h: imageData.h || 150,
        zIndex: 0,
        flipH: false,
        flipV: false,
      });
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const updateLooseImage = useCallback((imgId, updates) => {
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      if (!milestone.looseImages) return;
      const img = milestone.looseImages.find((i) => i.id === imgId);
      if (!img) return;
      Object.keys(updates).forEach((k) => { img[k] = updates[k]; });
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const deleteLooseImage = useCallback((imgId) => {
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      if (!milestone.looseImages) return;
      milestone.looseImages = milestone.looseImages.filter((i) => i.id !== imgId);
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const detachImageFromSystem = useCallback((sysId, imgId, canvasX, canvasY) => {
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      const sys = findTask(sysId, milestone);
      if (!sys || !sys.images) return;
      const img = sys.images.find((i) => i.id === imgId);
      if (!img) return;
      // Remove from system
      sys.images = sys.images.filter((i) => i.id !== imgId);
      // Add as loose image at canvas position
      if (!milestone.looseImages) milestone.looseImages = [];
      milestone.looseImages.push({
        ...img,
        x: canvasX,
        y: canvasY,
      });
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const updateImage = useCallback((sysId, imgId, updates) => {
    updateMilestones((ms) => {
      const sys = findTask(sysId, ms[activeMilestoneIdx]);
      if (!sys || !sys.images) return;
      const img = sys.images.find((i) => i.id === imgId);
      if (!img) return;
      Object.keys(updates).forEach((k) => { img[k] = updates[k]; });
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const deleteImage = useCallback((sysId, imgId) => {
    updateMilestones((ms) => {
      const sys = findTask(sysId, ms[activeMilestoneIdx]);
      if (!sys || !sys.images) return;
      sys.images = sys.images.filter((i) => i.id !== imgId);
    });
  }, [activeMilestoneIdx, updateMilestones]);

  const moveImageLayer = useCallback((sysId, imgId, direction) => {
    updateMilestones((ms) => {
      const sys = findTask(sysId, ms[activeMilestoneIdx]);
      if (!sys || !sys.images || sys.images.length < 2) return;
      // Sort by zIndex, find position, swap
      const sorted = [...sys.images].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((i) => i.id === imgId);
      if (idx < 0) return;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= sorted.length) return;
      // Swap zIndex values
      const tmpZ = sorted[idx].zIndex;
      const realA = sys.images.find((i) => i.id === sorted[idx].id);
      const realB = sys.images.find((i) => i.id === sorted[newIdx].id);
      realA.zIndex = sorted[newIdx].zIndex;
      realB.zIndex = tmpZ;
    });
  }, [activeMilestoneIdx, updateMilestones]);

  /* ─── Ensure layout ─── */
  autoLayoutMilestone(activeMilestone);

  return {
    milestones,
    activeMilestoneIdx,
    activeMilestone,
    boardMonth,
    currentBoardId,
    currentBoardPath,
    isSprintOverview,
    isMetricsView,
    msCollapsed,
    taskOrder,
    allLeaves,
    mk,
    sprintStats,
    totalStats,
    showBreadcrumb,
    showBoard,
    // Undo / Redo
    undo,
    redo,
    // Milestone CRUD
    createMilestone,
    renameMilestone,
    deleteMilestone,
    moveMilestone,
    // Actions
    switchMilestone,
    changeSidebarMonth,
    toggleMilestones,
    openBoard,
    openSprintOverview,
    closeBoard,
    openMetrics,
    closeMetrics,
    moveFrame,
    dropSystem,
    dropTask,
    resizeFrame,
    resizeLooseSystem,
    createNewTask,
    createNewSystem,
    createNewFrame,
    renameFrame,
    renameTask,
    changeTaskIcon,
    setTaskTime,
    updateTaskStatus,
    updateTask,
    deleteTask,
    deleteSystem,
    deleteFrame,
    createSubSystem,
    renameSystem,
    updateSystemColors,
    createTaskInSystem,
    addArrow,
    deleteArrow,
    assignSprint,
    unassignSprint,
    updateTaskOrder,
    resizeSubNode,
    addImageToSystem,
    addLooseImage,
    updateImage,
    updateLooseImage,
    deleteImage,
    deleteLooseImage,
    moveImageLayer,
    detachImageFromSystem,
  };
}
