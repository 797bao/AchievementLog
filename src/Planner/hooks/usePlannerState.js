import { useState, useCallback, useMemo, useRef } from 'react';
import { createSampleMilestones } from '../plannerData';
import {
  getAllLeaves,
  getLeaves,
  findTask,
  findInNode,
  removeTaskFromTree,
  removeSystemFromAny,
  autoLayoutMilestone,
  deepCloneWithNewIds,
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

  // Cross-milestone leaves for sprint views (sprint is a global concept across milestones)
  const allLeavesAllMilestones = useMemo(() => {
    let all = [];
    milestones.forEach((m) => { all = all.concat(getAllLeaves(m)); });
    return all;
  }, [milestones]);

  const mk = monthKey(boardMonth.year, boardMonth.month);

  const sprintStats = useMemo(() => {
    const assigned = allLeavesAllMilestones.filter((l) => l.sprint === mk).length;
    const completed = allLeavesAllMilestones.filter((l) => l.completedAt === mk).length;
    const inProgress = allLeavesAllMilestones.filter((l) => l.sprint === mk && l.status === 'progress').length;
    let timeEst = 0;
    let timeLogged = 0;
    allLeavesAllMilestones.filter((l) => l.sprint === mk).forEach((l) => {
      timeEst += getTaskExpectedTime(l);
      timeLogged += getTaskLoggedTime(l);
    });
    return { assigned, completed, inProgress, timeEst: formatTime(timeEst), timeLogged: formatTime(timeLogged) };
  }, [allLeavesAllMilestones, mk]);

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
    return { done, total, pct, totalTime: formatTime(expectedTime), loggedTime: formatTime(loggedTime), rawExpected: expectedTime, rawLogged: loggedTime };
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
          // Clear layout props from previous context (loose/frame positioning)
          delete sysCopy.x;
          delete sysCopy.y;
          delete sysCopy.w;
          delete sysCopy.h;
          if (!targetSys.children) targetSys.children = [];
          targetSys.children.push(sysCopy);
          // Clear parent's explicit height so it auto-sizes to fit new content
          delete targetSys.h;
        }
      } else {
        sysCopy.x = canvasPos.x;
        sysCopy.y = canvasPos.y;
        // Preserve existing width; only set default if none exists
        if (!sysCopy.w) {
          const groupCount = (sysCopy.children || []).filter((c) => c.isGroup).length;
          sysCopy.w = groupCount >= 2 ? 500 : 280;
        }
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
      } else if (target && target.type === 'frame') {
        const frame = milestone.frames.find((f) => f.id === target.id);
        if (frame) {
          if (!frame.tasks) frame.tasks = [];
          frame.tasks.push(taskCopy);
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

  // Find a task across all milestones (active first), so cross-milestone sprint view edits work
  const findTaskAnywhere = (taskId, ms) => {
    let t = findTask(taskId, ms[activeMilestoneIdx]);
    if (t) return t;
    for (let i = 0; i < ms.length; i++) {
      if (i === activeMilestoneIdx) continue;
      t = findTask(taskId, ms[i]);
      if (t) return t;
    }
    return null;
  };

  const updateTaskStatus = useCallback((taskId, newStatus) => {
    updateMilestones((ms) => {
      const task = findTaskAnywhere(taskId, ms);
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
      const task = findTaskAnywhere(taskId, ms);
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
      // Try active milestone first, then fall back to all (sprint view spans all milestones)
      let removed = removeTaskFromTree(taskId, ms[activeMilestoneIdx]);
      if (!removed) {
        for (let i = 0; i < ms.length; i++) {
          if (i === activeMilestoneIdx) continue;
          if (removeTaskFromTree(taskId, ms[i])) { removed = true; break; }
        }
      }
      // Clean up arrows in every milestone (cheap, prevents orphaned arrows)
      ms.forEach((m) => {
        if (m.arrows) {
          m.arrows = m.arrows.filter((a) => a.fromId !== taskId && a.toId !== taskId);
        }
      });
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

  /* ─── Create task inside a system or frame (from board view) ─── */
  const createTaskInSystem = useCallback((parentId, taskData) => {
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      const newTask = {
        id: 'task-' + Date.now(),
        name: taskData.name || 'New Task',
        type: taskData.type || 'script',
        status: taskData.status || 'planned',
        time: taskData.time || null,
        timeLogs: [],
        description: taskData.description || '',
        sprint: null,
        completedAt: null,
      };

      // Try as system/node first
      const parent = findTask(parentId, milestone);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(newTask);
        return;
      }

      // Try as frame
      const frame = milestone.frames.find((f) => f.id === parentId);
      if (frame) {
        if (!frame.tasks) frame.tasks = [];
        frame.tasks.push(newTask);
      }
    });
  }, [activeMilestoneIdx, updateMilestones]);

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

  /** Assign a sprint to every non-done leaf task inside a system/subsystem/frame */
  const bulkSetSprint = useCallback((targetId, targetType, sprintKey) => {
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      let tasks = [];

      if (targetType === 'system') {
        const sys = findTask(targetId, milestone);
        if (sys) tasks = getLeaves(sys);
      } else if (targetType === 'frame') {
        const frame = milestone.frames.find((f) => f.id === targetId);
        if (frame) {
          frame.systems.forEach((sys) => { tasks = tasks.concat(getLeaves(sys)); });
          (frame.tasks || []).forEach((t) => tasks.push(t));
        }
      }

      tasks.forEach((t) => {
        if (t.status !== 'done') {
          t.sprint = sprintKey || null;
        }
      });
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

  /* ─── Paste elements (from clipboard) ─── */
  const pasteElements = useCallback((elements, canvasPos) => {
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      const px = canvasPos.x;
      const py = canvasPos.y;

      // Collect all original positions to find the group's bounding-box origin
      const positions = [];
      (elements.tasks || []).forEach((t) => { if (t.x != null) positions.push({ x: t.x, y: t.y || 0 }); });
      (elements.systems || []).forEach((s) => { if (s.x != null) positions.push({ x: s.x, y: s.y || 0 }); });
      (elements.frames || []).forEach((f) => { if (f.x != null) positions.push({ x: f.x, y: f.y || 0 }); });
      (elements.images || []).forEach((img) => { if (img.x != null) positions.push({ x: img.x, y: img.y || 0 }); });

      // Origin = top-left of the group; offsets are relative to this
      const originX = positions.length ? Math.min(...positions.map((p) => p.x)) : 0;
      const originY = positions.length ? Math.min(...positions.map((p) => p.y)) : 0;

      let stagger = 0; // small offset for elements that had no position (came from inside a system)

      (elements.tasks || []).forEach((t) => {
        const { clone } = deepCloneWithNewIds(t);
        if (t.x != null) {
          clone.x = snapToGrid(px + (t.x - originX));
          clone.y = snapToGrid(py + ((t.y || 0) - originY));
        } else {
          clone.x = snapToGrid(px + stagger);
          clone.y = snapToGrid(py + stagger);
          stagger += 30;
        }
        if (!milestone.looseTasks) milestone.looseTasks = [];
        milestone.looseTasks.push(clone);
      });

      (elements.systems || []).forEach((s) => {
        const { clone } = deepCloneWithNewIds(s);
        if (s.x != null) {
          clone.x = snapToGrid(px + (s.x - originX));
          clone.y = snapToGrid(py + ((s.y || 0) - originY));
        } else {
          clone.x = snapToGrid(px + stagger);
          clone.y = snapToGrid(py + stagger);
          stagger += 30;
        }
        clone.w = s.w || 250;
        if (!milestone.looseSystems) milestone.looseSystems = [];
        milestone.looseSystems.push(clone);
      });

      (elements.frames || []).forEach((f) => {
        const { clone } = deepCloneWithNewIds(f);
        if (f.x != null) {
          clone.x = snapToGrid(px + (f.x - originX));
          clone.y = snapToGrid(py + ((f.y || 0) - originY));
        } else {
          clone.x = snapToGrid(px + stagger);
          clone.y = snapToGrid(py + stagger);
          stagger += 30;
        }
        milestone.frames.push(clone);
      });

      (elements.images || []).forEach((img) => {
        const { clone } = deepCloneWithNewIds(img);
        if (img.x != null) {
          clone.x = snapToGrid(px + (img.x - originX));
          clone.y = snapToGrid(py + ((img.y || 0) - originY));
        } else {
          clone.x = snapToGrid(px + stagger);
          clone.y = snapToGrid(py + stagger);
          stagger += 30;
        }
        if (!milestone.looseImages) milestone.looseImages = [];
        milestone.looseImages.push(clone);
      });
    });
  }, [activeMilestoneIdx, updateMilestones]);

  /* ─── Drop multiple selected elements into a container ─── */
  const dropSelected = useCallback((items, target) => {
    if (!items || items.length === 0 || !target) return;
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];

      items.forEach(({ id, type }) => {
        // Don't drop an item into itself
        if (id === target.id) return;

        if (type === 'task') {
          const taskNode = findTask(id, milestone);
          if (!taskNode || taskNode.children) return;
          const taskCopy = JSON.parse(JSON.stringify(taskNode));
          removeTaskFromTree(id, milestone);

          if (target.type === 'system' || target.type === 'subgroup') {
            const targetNode = findTask(target.id, milestone);
            if (targetNode) {
              if (!targetNode.children) targetNode.children = [];
              targetNode.children.push(taskCopy);
            }
          } else if (target.type === 'frame') {
            const frame = milestone.frames.find((f) => f.id === target.id);
            if (frame) {
              if (!frame.tasks) frame.tasks = [];
              frame.tasks.push(taskCopy);
            }
          }
        } else if (type === 'system') {
          const sysNode = findTask(id, milestone);
          if (!sysNode) return;
          // Prevent dropping into own descendant
          if (findInNode(target.id, sysNode)) return;

          const sysCopy = JSON.parse(JSON.stringify(sysNode));
          removeSystemFromAny(id, milestone);

          if (target.type === 'frame') {
            const targetFrame = milestone.frames.find((f) => f.id === target.id);
            if (targetFrame) targetFrame.systems.push(sysCopy);
          } else if (target.type === 'system' || target.type === 'subgroup') {
            const targetSys = findTask(target.id, milestone);
            if (targetSys) {
              sysCopy.isGroup = true;
              delete sysCopy.x;
              delete sysCopy.y;
              delete sysCopy.w;
              delete sysCopy.h;
              if (!targetSys.children) targetSys.children = [];
              targetSys.children.push(sysCopy);
              delete targetSys.h;
            }
          }
        }
        // Skip frames and images — they can't be dropped into containers
      });

      // Clean up empty standalone frames
      milestone.frames = milestone.frames.filter(
        (f) => !f.standalone || f.systems.length > 0
      );
    });
  }, [activeMilestoneIdx, updateMilestones]);

  /* ─── Move multiple selected elements by a delta ─── */
  const moveSelected = useCallback((items, dx, dy) => {
    if (!items || items.length === 0) return;
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      items.forEach(({ id, type }) => {
        if (type === 'frame') {
          const frame = milestone.frames.find((f) => f.id === id);
          if (frame) { frame.x = (frame.x || 0) + dx; frame.y = (frame.y || 0) + dy; }
        } else if (type === 'task') {
          const task = (milestone.looseTasks || []).find((t) => t.id === id);
          if (task) { task.x = (task.x || 0) + dx; task.y = (task.y || 0) + dy; }
        } else if (type === 'system') {
          const sys = (milestone.looseSystems || []).find((s) => s.id === id);
          if (sys) { sys.x = (sys.x || 0) + dx; sys.y = (sys.y || 0) + dy; }
        } else if (type === 'image') {
          const img = (milestone.looseImages || []).find((i) => i.id === id);
          if (img) { img.x = (img.x || 0) + dx; img.y = (img.y || 0) + dy; }
        }
      });
    });
  }, [activeMilestoneIdx, updateMilestones]);

  /* ─── Delete multiple selected elements ─── */
  const deleteSelected = useCallback((items) => {
    if (!items || items.length === 0) return;
    updateMilestones((ms) => {
      const milestone = ms[activeMilestoneIdx];
      items.forEach(({ id, type }) => {
        if (type === 'task') removeTaskFromTree(id, milestone);
        else if (type === 'system') removeSystemFromAny(id, milestone);
        else if (type === 'frame') {
          milestone.frames = milestone.frames.filter((f) => f.id !== id);
        }
        else if (type === 'image') {
          if (milestone.looseImages) {
            milestone.looseImages = milestone.looseImages.filter((i) => i.id !== id);
          }
          // Also try removing from systems
          const allSystems = [];
          milestone.frames.forEach((f) => f.systems.forEach((s) => allSystems.push(s)));
          (milestone.looseSystems || []).forEach((s) => allSystems.push(s));
          allSystems.forEach((sys) => {
            if (sys.images) sys.images = sys.images.filter((i) => i.id !== id);
          });
        }
        // Clean up arrows referencing deleted element
        if (milestone.arrows) {
          milestone.arrows = milestone.arrows.filter(
            (a) => a.fromId !== id && a.toId !== id
          );
        }
      });
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
    allLeavesAllMilestones,
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
    bulkSetSprint,
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
    pasteElements,
    moveSelected,
    dropSelected,
    deleteSelected,
  };
}
