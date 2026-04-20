import React, { useState, useEffect, useCallback } from 'react';
import './Planner.css';
import PlannerSidebar from './PlannerSidebar';
import FloatingUI from './FloatingUI';
import CanvasViewport from './canvas/CanvasViewport';
import BoardView from './board/BoardView';
import PlannerModal from './canvas/PlannerModal';
import usePlannerState from './hooks/usePlannerState';
import { findTask } from './plannerHelpers';

export default function Planner() {
  const state = usePlannerState();
  const [modal, setModal] = useState(null);

  // Escape key to close board (but not if modal is open)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (modal) { setModal(null); return; }
        if (state.showBoard) state.closeBoard();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [state.showBoard, state.closeBoard, modal]);

  const handleOpenBoard = useCallback((nodeId, displayName) => {
    state.openBoard(nodeId, displayName || (findTask(nodeId, state.activeMilestone) || {}).name);
  }, [state.openBoard, state.activeMilestone]);

  const handleOpenModal = useCallback((modalData) => {
    setModal(modalData);
  }, []);

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
    }

    setModal(null);
  }, [modal, state]);

  return (
    <div className="planner">
      <PlannerSidebar
        milestones={state.milestones}
        activeMilestoneIdx={state.activeMilestoneIdx}
        boardMonth={state.boardMonth}
        sprintStats={state.sprintStats}
        isSprintOverview={state.isSprintOverview}
        msCollapsed={state.msCollapsed}
        onSwitchMilestone={state.switchMilestone}
        onChangeSidebarMonth={state.changeSidebarMonth}
        onOpenSprintOverview={state.openSprintOverview}
        onToggleMilestones={state.toggleMilestones}
      />

      <div className="planner-content">
        <FloatingUI
          totalStats={state.totalStats}
          showBreadcrumb={state.showBreadcrumb}
          milestoneName={state.activeMilestone.name}
        />

        <CanvasViewport
          milestone={state.activeMilestone}
          hidden={state.showBoard}
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
          onUpdateTaskStatus={state.updateTaskStatus}
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
        />

        <BoardView
          milestone={state.activeMilestone}
          isSprintOverview={state.isSprintOverview}
          currentBoardId={state.currentBoardId}
          currentBoardPath={state.currentBoardPath}
          boardMonth={state.boardMonth}
          mk={state.mk}
          taskOrder={state.taskOrder}
          onCloseBoard={state.closeBoard}
          onChangeSidebarMonth={state.changeSidebarMonth}
          onStatusChange={state.updateTaskStatus}
          onUpdateTaskOrder={state.updateTaskOrder}
          onAssign={state.assignSprint}
          onUnassign={state.unassignSprint}
          onOpenModal={handleOpenModal}
          onDeleteTask={state.deleteTask}
          onCreateTaskInSystem={state.createTaskInSystem}
        />
      </div>

      {/* Global Modal */}
      {modal && (
        <PlannerModal
          title={modal.title}
          fields={modal.fields}
          onSubmit={handleModalSubmit}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
