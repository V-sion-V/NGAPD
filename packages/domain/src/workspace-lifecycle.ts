export interface TaskWorkspaceLifecycleState {
  workspaceId: string;
  taskId: string;
  lifecycle: "active" | "frozen";
  workCycle: number;
  syncVersion: number;
  latestSnapshotSyncVersion: number | null;
  activeLeaseId: string | null;
  hasUncommittedClientVersion: boolean;
}

export type TaskWorkspaceLifecycleDecision =
  | {
      ok: true;
      plan: {
        workspaceId: string;
        taskId: string;
        nextLifecycle: "active" | "frozen";
        nextWorkCycle: number;
        snapshotSyncVersion: number;
        revokeLeaseId: string | null;
        preservePreviousSnapshot: true;
        requiresSameTransactionAsTask: true;
      };
    }
  | {
      ok: false;
      reason:
        | "workspace_not_active"
        | "workspace_not_frozen"
        | "workspace_version_conflict"
        | "workspace_has_uncommitted_client_version";
    };

export function planTaskWorkspaceCompletion(
  state: TaskWorkspaceLifecycleState,
  expectedSyncVersion: number,
): TaskWorkspaceLifecycleDecision {
  if (state.lifecycle !== "active") {
    return { ok: false, reason: "workspace_not_active" };
  }
  if (state.syncVersion !== expectedSyncVersion) {
    return { ok: false, reason: "workspace_version_conflict" };
  }
  if (state.hasUncommittedClientVersion) {
    return { ok: false, reason: "workspace_has_uncommitted_client_version" };
  }
  return {
    ok: true,
    plan: {
      workspaceId: state.workspaceId,
      taskId: state.taskId,
      nextLifecycle: "frozen",
      nextWorkCycle: state.workCycle,
      snapshotSyncVersion: state.syncVersion,
      revokeLeaseId: state.activeLeaseId,
      preservePreviousSnapshot: true,
      requiresSameTransactionAsTask: true,
    },
  };
}

export function planTaskWorkspaceReopen(
  state: TaskWorkspaceLifecycleState,
): TaskWorkspaceLifecycleDecision {
  if (state.lifecycle !== "frozen") {
    return { ok: false, reason: "workspace_not_frozen" };
  }
  return {
    ok: true,
    plan: {
      workspaceId: state.workspaceId,
      taskId: state.taskId,
      nextLifecycle: "active",
      nextWorkCycle: state.workCycle + 1,
      snapshotSyncVersion: state.latestSnapshotSyncVersion ?? state.syncVersion,
      revokeLeaseId: state.activeLeaseId,
      preservePreviousSnapshot: true,
      requiresSameTransactionAsTask: true,
    },
  };
}

export function planTaskWorkspaceOwnerChange(
  state: TaskWorkspaceLifecycleState,
  expectedSyncVersion: number,
): TaskWorkspaceLifecycleDecision {
  if (state.lifecycle !== "active") {
    return { ok: false, reason: "workspace_not_active" };
  }
  if (state.syncVersion !== expectedSyncVersion) {
    return { ok: false, reason: "workspace_version_conflict" };
  }
  if (state.hasUncommittedClientVersion) {
    return { ok: false, reason: "workspace_has_uncommitted_client_version" };
  }
  return {
    ok: true,
    plan: {
      workspaceId: state.workspaceId,
      taskId: state.taskId,
      nextLifecycle: "active",
      nextWorkCycle: state.workCycle,
      snapshotSyncVersion: state.syncVersion,
      revokeLeaseId: state.activeLeaseId,
      preservePreviousSnapshot: true,
      requiresSameTransactionAsTask: true,
    },
  };
}
