import { describe, expect, it } from "vitest";

import {
  planTaskWorkspaceCompletion,
  planTaskWorkspaceOwnerChange,
  planTaskWorkspaceReopen,
  type TaskWorkspaceLifecycleState,
} from "./workspace-lifecycle.js";

const active: TaskWorkspaceLifecycleState = {
  workspaceId: "workspace-1",
  taskId: "task-1",
  lifecycle: "active",
  workCycle: 2,
  syncVersion: 8,
  latestSnapshotSyncVersion: 4,
  activeLeaseId: "lease-1",
  hasUncommittedClientVersion: false,
};

describe("task workspace lifecycle coordination ports", () => {
  it("binds completion snapshot, lease revocation and freeze to the task transaction", () => {
    expect(planTaskWorkspaceCompletion(active, 8)).toEqual({
      ok: true,
      plan: {
        workspaceId: "workspace-1",
        taskId: "task-1",
        nextLifecycle: "frozen",
        nextWorkCycle: 2,
        snapshotSyncVersion: 8,
        revokeLeaseId: "lease-1",
        preservePreviousSnapshot: true,
        requiresSameTransactionAsTask: true,
      },
    });
  });

  it("starts a new work cycle while preserving the prior snapshot on reopen", () => {
    expect(
      planTaskWorkspaceReopen({
        ...active,
        lifecycle: "frozen",
        activeLeaseId: null,
        latestSnapshotSyncVersion: 8,
      }),
    ).toEqual({
      ok: true,
      plan: {
        workspaceId: "workspace-1",
        taskId: "task-1",
        nextLifecycle: "active",
        nextWorkCycle: 3,
        snapshotSyncVersion: 8,
        revokeLeaseId: null,
        preservePreviousSnapshot: true,
        requiresSameTransactionAsTask: true,
      },
    });
  });

  it("rejects stale or unsynchronized owner changes", () => {
    expect(planTaskWorkspaceOwnerChange(active, 7)).toEqual({
      ok: false,
      reason: "workspace_version_conflict",
    });
    expect(
      planTaskWorkspaceOwnerChange({ ...active, hasUncommittedClientVersion: true }, 8),
    ).toEqual({
      ok: false,
      reason: "workspace_has_uncommitted_client_version",
    });
  });
});
