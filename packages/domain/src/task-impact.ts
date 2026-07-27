import {
  collectTaskAncestorIds,
  collectTaskDescendantIds,
  type TaskTreeNode,
} from "./task-tree.js";
import type { TaskBaseStatus } from "./task-lifecycle.js";

export type TaskImpactOperation =
  "move" | "archive" | "delete" | "owner_change" | "cascade_reopen" | "follow_change";

export interface TaskImpactNode extends TaskTreeNode {
  baseStatus: TaskBaseStatus;
  effectiveOwnerMembershipId: string;
  workspace: {
    activeLeaseId: string | null;
    syncVersion: number;
    lastAcknowledgedSyncVersion: number;
  };
}

export interface TaskImpactDependency {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
}

export interface TaskImpactSet {
  operation: TaskImpactOperation;
  targetTaskId: string;
  affectedTaskIds: string[];
  descendantTaskIds: string[];
  dependencyIds: string[];
  effectiveStatusTaskIds: string[];
  completedAncestorTaskIds: string[];
  workspaceLeaseIds: string[];
  unsyncedWorkspaceTaskIds: string[];
  graphScopeIds: string[];
}

export type TaskImpactDecision =
  | { ok: true; impact: TaskImpactSet; confirmationToken: string }
  | {
      ok: false;
      reason: "task_not_found" | "invalid_task_tree";
      taskId: string;
    };

function stableUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function graphScopeId(projectId: string, parentTaskId: string | null): string {
  return `${projectId}:${parentTaskId ?? "$project-root"}`;
}

export function computeTaskImpactSet(input: {
  operation: TaskImpactOperation;
  targetTaskId: string;
  tasks: readonly TaskImpactNode[];
  dependencies: readonly TaskImpactDependency[];
  relatedTaskIds?: readonly string[];
  targetParentTaskId?: string | null;
}): TaskImpactDecision {
  const tasksById = new Map(input.tasks.map((task) => [task.id, task]));
  const target = tasksById.get(input.targetTaskId);
  if (!target) {
    return { ok: false, reason: "task_not_found", taskId: input.targetTaskId };
  }

  const includeDescendants = input.operation !== "follow_change";
  const descendants = includeDescendants
    ? collectTaskDescendantIds(input.targetTaskId, input.tasks)
    : { ok: true as const, taskIds: [] };
  if (!descendants.ok) {
    return { ok: false, reason: "invalid_task_tree", taskId: descendants.taskId };
  }

  const affectedTaskIds = stableUnique([
    target.id,
    ...descendants.taskIds,
    ...(input.relatedTaskIds ?? []),
  ]);
  const affectedSet = new Set(affectedTaskIds);
  const incidentDependencies = input.dependencies.filter(
    (dependency) =>
      affectedSet.has(dependency.predecessorTaskId) || affectedSet.has(dependency.successorTaskId),
  );
  const effectiveStatusTaskIds = stableUnique(
    incidentDependencies
      .filter((dependency) => affectedSet.has(dependency.predecessorTaskId))
      .map((dependency) => dependency.successorTaskId),
  );

  const ancestors = collectTaskAncestorIds(target.id, input.tasks);
  if (!ancestors.ok) {
    return { ok: false, reason: "invalid_task_tree", taskId: ancestors.taskId };
  }
  const completedAncestorTaskIds = ancestors.taskIds.filter(
    (taskId) => tasksById.get(taskId)?.baseStatus === "done",
  );

  const affectedTasks = affectedTaskIds
    .map((taskId) => tasksById.get(taskId))
    .filter((task): task is TaskImpactNode => task !== undefined);
  const graphScopeIds = [
    ...affectedTasks.map((task) => graphScopeId(task.projectId, task.parentTaskId)),
  ];
  if (input.targetParentTaskId !== undefined) {
    graphScopeIds.push(graphScopeId(target.projectId, input.targetParentTaskId));
  }
  for (const dependency of incidentDependencies) {
    const predecessor = tasksById.get(dependency.predecessorTaskId);
    if (predecessor) {
      graphScopeIds.push(graphScopeId(predecessor.projectId, predecessor.parentTaskId));
    }
  }

  const impact: TaskImpactSet = {
    operation: input.operation,
    targetTaskId: target.id,
    affectedTaskIds,
    descendantTaskIds: stableUnique(descendants.taskIds),
    dependencyIds: stableUnique(incidentDependencies.map((dependency) => dependency.id)),
    effectiveStatusTaskIds,
    completedAncestorTaskIds: stableUnique(completedAncestorTaskIds),
    workspaceLeaseIds: stableUnique(
      affectedTasks.flatMap((task) =>
        task.workspace.activeLeaseId === null ? [] : [task.workspace.activeLeaseId],
      ),
    ),
    unsyncedWorkspaceTaskIds: stableUnique(
      affectedTasks
        .filter((task) => task.workspace.syncVersion !== task.workspace.lastAcknowledgedSyncVersion)
        .map((task) => task.id),
    ),
    graphScopeIds: stableUnique(graphScopeIds),
  };

  return {
    ok: true,
    impact,
    confirmationToken: JSON.stringify(impact),
  };
}
