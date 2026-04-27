import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Planner.css';
import PlannerSidebar from './PlannerSidebar';
import FloatingUI from './FloatingUI';
import CanvasViewport from './canvas/CanvasViewport';
import BoardView from './board/BoardView';
import MetricsView from './MetricsView';
import PlannerModal from './canvas/PlannerModal';
import usePlannerState from './hooks/usePlannerState';
import usePlannerFirebase from './hooks/usePlannerFirebase';
import { findTask, monthKey } from './plannerHelpers';

/* ─── Outer shell: handles Firebase loading ─── */
export default function Planner({ isOwner, onExit }) {
  const { data, isLoading, save } = usePlannerFirebase(isOwner);

  if (isLoading) {
    return (
      <div className="planner">
        <div className="planner-loading">Loading planner&hellip;</div>
      </div>
    );
  }

  return <PlannerInner initialData={data} onSave={isOwner ? save : null} onExit={onExit} />;
}

/* ─── Inner component: renders once data is ready ─── */
function PlannerInner({ initialData, onSave, onExit }) {
  const state = usePlannerState(initialData);
  const [modal, setModal] = useState(null);
  const hasMountedRef = useRef(false);

  /* ─── Auto-save to Firebase on data changes ─── */
  useEffect(() => {
    if (!onSave) return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    onSave(state.milestones, state.taskOrder, state.activeMilestoneIdx);
  }, [state.milestones, state.taskOrder, state.activeMilestoneIdx, onSave]);

  // Keyboard shortcuts: Escape, Ctrl+Z, Ctrl+Shift+Z
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (modal) { setModal(null); return; }
        if (state.isMetricsView) { state.closeMetrics(); return; }
        if (state.showBoard) state.closeBoard();
        return;
      }
      // Undo/Redo — skip when typing in inputs
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const k = e.key.toLowerCase();
      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && ((k === 'z' && e.shiftKey) || k === 'y')) {
        e.preventDefault();
        state.redo();
        return;
      }
      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) {
        e.preventDefault();
        state.undo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [state.showBoard, state.closeBoard, state.isMetricsView, state.closeMetrics, state.undo, state.redo, modal]);

  const handleOpenBoard = useCallback((nodeId, displayName) => {
    state.openBoard(nodeId, displayName || (findTask(nodeId, state.activeMilestone) || {}).name);
  }, [state.openBoard, state.activeMilestone]);

  const handleOpenModal = useCallback((modalData) => {
    setModal(modalData);
  }, []);

  /** Wrapper around updateTaskStatus that prompts to log a time entry
   *  whenever a task transitions INTO the "done" state. */
  const handleUpdateTaskStatus = useCallback((taskId, newStatus) => {
    // Look up the task across all milestones to see if this is a fresh transition
    let wasAlreadyDone = false;
    for (const m of state.milestones) {
      const t = findTask(taskId, m);
      if (t) { wasAlreadyDone = t.status === 'done'; break; }
    }

    state.updateTaskStatus(taskId, newStatus);

    if (newStatus === 'done' && !wasAlreadyDone) {
      const currentMonth = monthKey(state.boardMonth.year, state.boardMonth.month);
      setModal({
        type: 'log-time-on-done',
        targetId: taskId,
        title: 'Task complete — log time?',
        fields: [
          { key: 'duration', label: 'Time Spent', type: 'text', value: '', placeholder: 'e.g. 2h, 30m (leave blank to skip)' },
          { key: 'month', label: 'Month', type: 'sprint-select', value: currentMonth },
        ],
      });
    }
  }, [state]);

  const handleModalSubmit = useCallback((values) => {
    if (!modal) return;

    if (modal.type === 'edit-task') {
      state.updateTask(modal.targetId, values);
    } else if (modal.type === 'rename-system') {
      if (values.name) state.renameSystem(modal.targetId, values.name);
    } else if (modal.type === 'rename-frame') {
      if (values.label !== undefined) state.renameFrame(modal.targetId, values.label);
    } else if (modal.type === 'new-task-in-system') {
      state.createTaskInSystem(modal.targetId, values);
    } else if (modal.type === 'new-milestone') {
      if (values.name) state.createMilestone(values.name);
    } else if (modal.type === 'rename-milestone') {
      if (values.name) state.renameMilestone(modal.targetId, values.name);
    } else if (modal.type === 'confirm-delete-milestone') {
      state.deleteMilestone(modal.targetId);
    } else if (modal.type === 'log-time-on-done') {
      // Task was already marked done before this modal opened — just append
      // the optional time log. Empty duration is a no-op (effectively "skip").
      if (values.duration && values.duration.trim()) {
        state.addTimeLog(modal.targetId, values.duration, values.month || null);
      }
    }

    setModal(null);
  }, [modal, state]);

  /* ─── Milestone CRUD callbacks for sidebar ─── */
  const handleCreateMilestone = useCallback(() => {
    setModal({
      type: 'new-milestone',
      title: 'New Milestone',
      fields: [
        { key: 'name', label: 'Name', type: 'text', value: '', placeholder: 'Milestone name' },
      ],
    });
  }, []);

  const handleRenameMilestone = useCallback((msId, currentName) => {
    setModal({
      type: 'rename-milestone',
      title: 'Rename Milestone',
      targetId: msId,
      fields: [
        { key: 'name', label: 'Name', type: 'text', value: currentName },
      ],
    });
  }, []);

  const handleDeleteMilestone = useCallback((msId, msName) => {
    if (state.milestones.length <= 1) return; // can't delete last
    setModal({
      type: 'confirm-delete-milestone',
      title: 'Delete Milestone',
      targetId: msId,
      confirm: `Are you sure you want to delete "${msName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
    });
  }, [state.milestones.length]);

  // Mobile sidebar drawer state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  // Auto-close the drawer when the user picks a milestone / opens a board, so
  // the canvas comes back into view on mobile.
  const wrap = (fn) => (...args) => { closeSidebar(); return fn && fn(...args); };

  return (
    <div className="planner">
      <button
        className="planner-hamburger"
        aria-label="Toggle planner menu"
        onClick={() => setSidebarOpen((v) => !v)}
      >
        <span /><span /><span />
      </button>
      <div
        className={`planner-sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={closeSidebar}
      />
      <PlannerSidebar
        sidebarOpen={sidebarOpen}
        onExit={onExit}
        milestones={state.milestones}
        activeMilestoneIdx={state.activeMilestoneIdx}
        boardMonth={state.boardMonth}
        sprintStats={state.sprintStats}
        isSprintOverview={state.isSprintOverview}
        isMetricsView={state.isMetricsView}
        msCollapsed={state.msCollapsed}
        onSwitchMilestone={wrap(state.switchMilestone)}
        onChangeSidebarMonth={state.changeSidebarMonth}
        onOpenSprintOverview={wrap(state.openSprintOverview)}
        onOpenMetrics={wrap(state.openMetrics)}
        onToggleMilestones={state.toggleMilestones}
        onCreateMilestone={handleCreateMilestone}
        onRenameMilestone={handleRenameMilestone}
        onDeleteMilestone={handleDeleteMilestone}
        onMoveMilestone={state.moveMilestone}
      />

      <div className="planner-content">
        {!state.showBoard && !state.isMetricsView && (
          <FloatingUI
            totalStats={state.totalStats}
            showBreadcrumb={state.showBreadcrumb}
            milestoneName={state.activeMilestone.name}
          />
        )}

        <CanvasViewport
          milestone={state.activeMilestone}
          hidden={state.showBoard || state.isMetricsView}
          onOpenBoard={handleOpenBoard}
          onMoveFrame={state.moveFrame}
          onDropSystem={state.dropSystem}
          onDropTask={state.dropTask}
          onResizeFrame={state.resizeFrame}
          onResizeLooseSystem={state.resizeLooseSystem}
          onCreateTask={state.createNewTask}
          onCreateSystem={state.createNewSystem}
          onCreateFrame={state.createNewFrame}
          onRenameTask={state.renameTask}
          onChangeTaskIcon={state.changeTaskIcon}
          onSetTaskTime={state.setTaskTime}
          onUpdateTaskStatus={handleUpdateTaskStatus}
          onUpdateTask={state.updateTask}
          onDeleteTask={state.deleteTask}
          onDeleteSystem={state.deleteSystem}
          onDeleteFrame={state.deleteFrame}
          onCreateSubSystem={state.createSubSystem}
          onRenameSystem={state.renameSystem}
          onUpdateSystemColors={state.updateSystemColors}
          onAddArrow={state.addArrow}
          onDeleteArrow={state.deleteArrow}
          onOpenModal={handleOpenModal}
          onResizeSubNode={state.resizeSubNode}
          onAddImage={state.addImageToSystem}
          onAddLooseImage={state.addLooseImage}
          onUpdateImage={state.updateImage}
          onUpdateLooseImage={state.updateLooseImage}
          onDeleteImage={state.deleteImage}
          onDeleteLooseImage={state.deleteLooseImage}
          onMoveImageLayer={state.moveImageLayer}
          onDetachImage={state.detachImageFromSystem}
          onPasteElements={state.pasteElements}
          onDeleteSelected={state.deleteSelected}
          onMoveSelected={state.moveSelected}
          onDropSelected={state.dropSelected}
          onBulkSetSprint={state.bulkSetSprint}
        />

        {!state.isMetricsView && (
          <BoardView
            milestone={state.activeMilestone}
            milestones={state.milestones}
            isSprintOverview={state.isSprintOverview}
            currentBoardId={state.currentBoardId}
            currentBoardPath={state.currentBoardPath}
            boardMonth={state.boardMonth}
            mk={state.mk}
            taskOrder={state.taskOrder}
            onCloseBoard={state.closeBoard}
            onChangeSidebarMonth={state.changeSidebarMonth}
            onStatusChange={handleUpdateTaskStatus}
            onUpdateTaskOrder={state.updateTaskOrder}
            onOpenModal={handleOpenModal}
            onDeleteTask={state.deleteTask}
            onCreateTaskInSystem={state.createTaskInSystem}
          />
        )}

        {state.isMetricsView && (
          <MetricsView
            milestones={state.milestones}
            onClose={state.closeMetrics}
          />
        )}
      </div>

      {/* Global Modal */}
      {modal && (
        <PlannerModal
          title={modal.title}
          fields={modal.fields || []}
          confirm={modal.confirm}
          confirmLabel={modal.confirmLabel}
          onSubmit={handleModalSubmit}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
