import React, { useEffect, useCallback } from 'react';
import './Planner.css';
import PlannerSidebar from './PlannerSidebar';
import FloatingUI from './FloatingUI';
import CanvasViewport from './canvas/CanvasViewport';
import BoardView from './board/BoardView';
import usePlannerState from './hooks/usePlannerState';
import { findTask } from './plannerHelpers';

export default function Planner() {
  const state = usePlannerState();

  // Escape key to close board
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && state.showBoard) {
        state.closeBoard();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [state.showBoard, state.closeBoard]);

  const handleOpenBoard = useCallback((nodeId, displayName) => {
    state.openBoard(nodeId, displayName || (findTask(nodeId, state.activeMilestone) || {}).name);
  }, [state.openBoard, state.activeMilestone]);

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
          // Task editing
          onRenameTask={state.renameTask}
          onChangeTaskIcon={state.changeTaskIcon}
          onSetTaskTime={state.setTaskTime}
          onUpdateTaskStatus={state.updateTaskStatus}
          // System editing
          onCreateSubSystem={state.createSubSystem}
          onRenameSystem={state.renameSystem}
          onUpdateSystemColors={state.updateSystemColors}
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
        />
      </div>
    </div>
  );
}
