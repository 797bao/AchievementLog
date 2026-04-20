import { useState, useCallback, useMemo } from 'react';
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
  snapToGrid,
} from '../plannerHelpers';

export default function usePlannerState() {
  const [milestones, setMilestones] = useState(() => createSampleMilestones());
  const [activeMilestoneIdx, setActiveMilestoneIdx] = useState(0);
  const [boardMonth, setBoardMonth] = useState({ year: 2026, month: 3 });
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const [currentBoardPath, setCurrentBoardPath] = useState(null);
  const [isSprintOverview, setIsSprintOverview] = useState(false);
  const [msCollapsed, setMsCollapsed] = useState(false);
  const [taskOrder, setTaskOrder] = useState({});

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
    allLeaves.filter((l) => l.sprint === mk).forEach((l) => { timeEst += parseTime(l.time); });
    return { assigned, completed, inProgress, timeEst: formatTime(timeEst) };
  }, [allLeaves, mk]);

  const totalStats = useMemo(() => {
    const done = allLeaves.filter((l) => l.status === 'done').length;
    const total = allLeaves.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    let totalTime = 0;
    let doneTime = 0;
    allLeaves.forEach((l) => {
      totalTime += parseTime(l.time);
      if (l.status === 'done') doneTime += parseTime(l.time);
    });
    return { done, total, pct, totalTime: formatTime(totalTime), doneTime: formatTime(doneTime) };
  }, [allLeaves]);

  const showBreadcrumb = !isSprintOverview && !currentBoardId;
  const showBoard = isSprintOverview || !!currentBoardId;

  /* ─── Helpers to clone & update milestones ─── */
  const updateMilestones = useCallback((updater) => {
    setMilestones((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      updater(clone);
      return clone;
    });
  }, []);

  /* ─── Actions ─── */
  const switchMilestone = useCallback((idx) => {
    setActiveMilestoneIdx(idx);
    setCurrentBoardId(null);
    setCurrentBoardPath(null);
    setIsSprintOverview(false);
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
    setIsSprintOverview(false);
    setCurrentBoardId(nodeId);
    setCurrentBoardPath(displayName);
  }, []);

  const openSprintOverview = useCallback(() => {
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
        time: null,
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
      if (updates.time !== undefined) task.time = updates.time || null;
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
      parent.children.push({
        id: 'task-' + Date.now(),
        name: taskData.name || 'New Task',
        type: taskData.type || 'script',
        status: taskData.status || 'planned',
        time: taskData.time || null,
        sprint: null,
        completedAt: null,
      });
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

  const updateTaskOrder = useCallback((orderKey, newOrder) => {
    setTaskOrder((prev) => ({ ...prev, [orderKey]: newOrder }));
  }, []);

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
    msCollapsed,
    taskOrder,
    allLeaves,
    mk,
    sprintStats,
    totalStats,
    showBreadcrumb,
    showBoard,
    // Actions
    switchMilestone,
    changeSidebarMonth,
    toggleMilestones,
    openBoard,
    openSprintOverview,
    closeBoard,
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
  };
}
