import type { TaskDependencyEdge } from "./task-graph.js";
import type { TaskOwnerResolution } from "./task-owner.js";

export type TaskBaseStatus = "not_started" | "in_progress" | "done";
export type TaskEffectiveStatus = TaskBaseStatus | "blocked";
export type TaskMutationKind =
  | "content"
  | "owner"
  | "structure"
  | "dependency"
  | "blocker"
  | "workspace"
  | "comment"
  | "reopen"
  | "archive";

export interface TaskLifecycleNode {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  explicitOwnerMembershipId: string | null;
  effectiveOwnerMembershipId: string;
  baseStatus: TaskBaseStatus;
  archived: boolean;
  version: number;
}

export function deriveTaskEffectiveStatus(input: {
  baseStatus: TaskBaseStatus;
  unresolvedManualBlockers: number;
  predecessorStatuses: readonly TaskBaseStatus[];
}): TaskEffectiveStatus {
  if (input.baseStatus === "done") {
    return "done";
  }
  return input.unresolvedManualBlockers > 0 ||
    input.predecessorStatuses.some((status) => status !== "done")
    ? "blocked"
    : input.baseStatus;
}

export function isTaskCompletionEligible(
  directChildStatuses: readonly { status: TaskBaseStatus; archived: boolean }[],
): boolean {
  return directChildStatuses
    .filter((child) => !child.archived)
    .every((child) => child.status === "done");
}

export function evaluateTaskMutation(
  task: Pick<TaskLifecycleNode, "baseStatus" | "archived" | "parentTaskId">,
  mutation: TaskMutationKind,
): { ok: true } | { ok: false; reason: "task_archived" | "completed_task_frozen" } {
  if (task.archived) {
    return { ok: false, reason: "task_archived" };
  }
  if (task.baseStatus !== "done") {
    return { ok: true };
  }
  if (
    mutation === "comment" ||
    mutation === "reopen" ||
    (mutation === "archive" && task.parentTaskId === null)
  ) {
    return { ok: true };
  }
  return { ok: false, reason: "completed_task_frozen" };
}

export interface TaskCompletionPlan {
  taskId: string;
  baseStatus: "done";
  materializeOwnerMembershipId: string | null;
  freeze: true;
  workspace: {
    workspaceId: string;
    snapshotSyncVersion: number;
    lifecycle: "frozen";
    revokeLeaseId: string | null;
  };
  auditRequired: true;
}

export type TaskCompletionDecision =
  | { ok: true; plan: TaskCompletionPlan }
  | {
      ok: false;
      reason:
        | "task_archived"
        | "task_already_done"
        | "owner_unresolved"
        | "child_incomplete"
        | "predecessor_incomplete"
        | "manual_blocker_active"
        | "forbidden"
        | "task_version_conflict"
        | "graph_version_conflict"
        | "workspace_version_conflict"
        | "workspace_not_finalized";
    };

export function evaluateTaskCompletion(input: {
  task: TaskLifecycleNode;
  ownerResolution: TaskOwnerResolution;
  directChildStatuses: readonly { status: TaskBaseStatus; archived: boolean }[];
  predecessorStatuses: readonly { status: TaskBaseStatus; archived: boolean }[];
  unresolvedManualBlockers: number;
  authorized: boolean;
  expectedTaskVersion: number;
  expectedGraphVersion: number;
  currentGraphVersion: number;
  workspace: {
    workspaceId: string;
    lifecycle: "active" | "frozen";
    syncVersion: number;
    expectedSyncVersion: number;
    finalServerVersionReceived: boolean;
    activeLeaseId: string | null;
  };
}): TaskCompletionDecision {
  if (input.task.archived) {
    return { ok: false, reason: "task_archived" };
  }
  if (input.task.baseStatus === "done") {
    return { ok: false, reason: "task_already_done" };
  }
  if (!input.ownerResolution.ok) {
    return { ok: false, reason: "owner_unresolved" };
  }
  if (!isTaskCompletionEligible(input.directChildStatuses)) {
    return { ok: false, reason: "child_incomplete" };
  }
  if (
    input.predecessorStatuses.some(
      (predecessor) => !predecessor.archived && predecessor.status !== "done",
    )
  ) {
    return { ok: false, reason: "predecessor_incomplete" };
  }
  if (input.unresolvedManualBlockers > 0) {
    return { ok: false, reason: "manual_blocker_active" };
  }
  if (!input.authorized) {
    return { ok: false, reason: "forbidden" };
  }
  if (input.expectedTaskVersion !== input.task.version) {
    return { ok: false, reason: "task_version_conflict" };
  }
  if (input.expectedGraphVersion !== input.currentGraphVersion) {
    return { ok: false, reason: "graph_version_conflict" };
  }
  if (
    input.workspace.syncVersion !== input.workspace.expectedSyncVersion ||
    input.workspace.lifecycle !== "active"
  ) {
    return { ok: false, reason: "workspace_version_conflict" };
  }
  if (!input.workspace.finalServerVersionReceived) {
    return { ok: false, reason: "workspace_not_finalized" };
  }

  return {
    ok: true,
    plan: {
      taskId: input.task.id,
      baseStatus: "done",
      materializeOwnerMembershipId:
        input.task.explicitOwnerMembershipId === null ? input.ownerResolution.membershipId : null,
      freeze: true,
      workspace: {
        workspaceId: input.workspace.workspaceId,
        snapshotSyncVersion: input.workspace.syncVersion,
        lifecycle: "frozen",
        revokeLeaseId: input.workspace.activeLeaseId,
      },
      auditRequired: true,
    },
  };
}

export type ReopenPolicy = "deny" | "cascade";

export type TaskReopenDecision =
  | {
      ok: true;
      plan: {
        taskIds: string[];
        baseStatus: "in_progress";
        workspaceTransitions: Array<{
          taskId: string;
          previousWorkCycle: number;
          nextWorkCycle: number;
          preservePreviousSnapshot: true;
        }>;
      };
    }
  | {
      ok: false;
      reason:
        | "task_not_found"
        | "task_not_done"
        | "completed_ancestor_exists"
        | "completed_successor_exists"
        | "admin_mode_required"
        | "impact_confirmation_stale"
        | "task_version_conflict"
        | "workspace_state_missing";
      taskIds: string[];
    };

function stableUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function completedSuccessorClosure(
  targetTaskId: string,
  tasksById: ReadonlyMap<string, TaskLifecycleNode>,
  dependencies: readonly TaskDependencyEdge[],
): string[] {
  const outgoing = new Map<string, string[]>();
  for (const dependency of dependencies) {
    const successors = outgoing.get(dependency.predecessorTaskId) ?? [];
    successors.push(dependency.successorTaskId);
    outgoing.set(dependency.predecessorTaskId, successors);
  }
  const visited = new Set<string>();
  const pending = [...(outgoing.get(targetTaskId) ?? [])].sort();
  while (pending.length > 0) {
    const successorId = pending.shift();
    if (!successorId || visited.has(successorId)) {
      continue;
    }
    const successor = tasksById.get(successorId);
    if (!successor || successor.baseStatus !== "done" || successor.archived) {
      continue;
    }
    visited.add(successorId);
    pending.push(...(outgoing.get(successorId) ?? []));
    pending.sort();
  }
  return [...visited].sort();
}

export function evaluateTaskReopen(input: {
  taskId: string;
  policy: ReopenPolicy;
  tasks: readonly TaskLifecycleNode[];
  dependencies: readonly TaskDependencyEdge[];
  expectedTaskVersions: Readonly<Record<string, number>>;
  expectedOwnerMembershipIds: Readonly<Record<string, string>>;
  workspaceWorkCycles: Readonly<Record<string, number>>;
  adminModeActive: boolean;
  confirmedTaskIds: readonly string[];
}): TaskReopenDecision {
  const tasksById = new Map(input.tasks.map((task) => [task.id, task]));
  const target = tasksById.get(input.taskId);
  if (!target) {
    return { ok: false, reason: "task_not_found", taskIds: [input.taskId] };
  }
  if (target.baseStatus !== "done" || target.archived) {
    return { ok: false, reason: "task_not_done", taskIds: [target.id] };
  }

  const completedAncestors: string[] = [];
  let current = target;
  while (current.parentTaskId !== null) {
    const parent = tasksById.get(current.parentTaskId);
    if (!parent) {
      break;
    }
    if (parent.baseStatus === "done" && !parent.archived) {
      completedAncestors.push(parent.id);
    }
    current = parent;
  }
  if (completedAncestors.length > 0) {
    return {
      ok: false,
      reason: "completed_ancestor_exists",
      taskIds: stableUnique(completedAncestors),
    };
  }

  const completedSuccessors = completedSuccessorClosure(target.id, tasksById, input.dependencies);
  if (input.policy === "deny" && completedSuccessors.length > 0) {
    return {
      ok: false,
      reason: "completed_successor_exists",
      taskIds: completedSuccessors,
    };
  }

  const affectedTaskIds = stableUnique([target.id, ...completedSuccessors]);
  for (const taskId of affectedTaskIds) {
    const task = tasksById.get(taskId);
    if (!task || input.expectedTaskVersions[taskId] !== task.version) {
      return {
        ok: false,
        reason: "task_version_conflict",
        taskIds: affectedTaskIds,
      };
    }
    if (input.expectedOwnerMembershipIds[taskId] !== task.effectiveOwnerMembershipId) {
      return {
        ok: false,
        reason: "impact_confirmation_stale",
        taskIds: affectedTaskIds,
      };
    }
  }

  const crossesOwner = affectedTaskIds.some(
    (taskId) =>
      tasksById.get(taskId)?.effectiveOwnerMembershipId !== target.effectiveOwnerMembershipId,
  );
  if (crossesOwner && !input.adminModeActive) {
    return { ok: false, reason: "admin_mode_required", taskIds: affectedTaskIds };
  }
  if (
    crossesOwner &&
    JSON.stringify(stableUnique(input.confirmedTaskIds)) !== JSON.stringify(affectedTaskIds)
  ) {
    return {
      ok: false,
      reason: "impact_confirmation_stale",
      taskIds: affectedTaskIds,
    };
  }

  const workspaceTransitions = [];
  for (const taskId of affectedTaskIds) {
    const previousWorkCycle = input.workspaceWorkCycles[taskId];
    if (!Number.isSafeInteger(previousWorkCycle) || (previousWorkCycle ?? 0) < 1) {
      return {
        ok: false,
        reason: "workspace_state_missing",
        taskIds: affectedTaskIds,
      };
    }
    workspaceTransitions.push({
      taskId,
      previousWorkCycle: previousWorkCycle as number,
      nextWorkCycle: (previousWorkCycle as number) + 1,
      preservePreviousSnapshot: true as const,
    });
  }

  return {
    ok: true,
    plan: {
      taskIds: affectedTaskIds,
      baseStatus: "in_progress",
      workspaceTransitions,
    },
  };
}
