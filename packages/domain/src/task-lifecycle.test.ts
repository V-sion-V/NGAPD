import { describe, expect, it } from "vitest";

import {
  deriveTaskEffectiveStatus,
  evaluateTaskCompletion,
  evaluateTaskMutation,
  evaluateTaskReopen,
  type TaskLifecycleNode,
} from "./task-lifecycle.js";

function task(
  id: string,
  owner: string,
  overrides: Partial<TaskLifecycleNode> = {},
): TaskLifecycleNode {
  return {
    id,
    projectId: "project-1",
    parentTaskId: null,
    explicitOwnerMembershipId: owner,
    effectiveOwnerMembershipId: owner,
    baseStatus: "in_progress",
    archived: false,
    version: 1,
    ...overrides,
  };
}

describe("formal task status and completion", () => {
  it("derives blocked only from manual blockers or unfinished enabled predecessors", () => {
    expect(
      deriveTaskEffectiveStatus({
        baseStatus: "not_started",
        unresolvedManualBlockers: 1,
        predecessorStatuses: [],
      }),
    ).toBe("blocked");
    expect(
      deriveTaskEffectiveStatus({
        baseStatus: "in_progress",
        unresolvedManualBlockers: 0,
        predecessorStatuses: ["done", "not_started"],
      }),
    ).toBe("blocked");
    expect(
      deriveTaskEffectiveStatus({
        baseStatus: "done",
        unresolvedManualBlockers: 3,
        predecessorStatuses: ["not_started"],
      }),
    ).toBe("done");
  });

  it("produces one atomic completion plan with inherited owner materialization", () => {
    expect(
      evaluateTaskCompletion({
        task: task("child", "owner-a", {
          parentTaskId: "parent",
          explicitOwnerMembershipId: null,
        }),
        ownerResolution: {
          ok: true,
          membershipId: "owner-a",
          sourceTaskId: "parent",
        },
        directChildStatuses: [{ status: "done", archived: false }],
        predecessorStatuses: [{ status: "done", archived: false }],
        unresolvedManualBlockers: 0,
        authorized: true,
        expectedTaskVersion: 1,
        expectedGraphVersion: 4,
        currentGraphVersion: 4,
        workspace: {
          workspaceId: "workspace-child",
          lifecycle: "active",
          syncVersion: 8,
          expectedSyncVersion: 8,
          finalServerVersionReceived: true,
          activeLeaseId: "lease-1",
        },
      }),
    ).toEqual({
      ok: true,
      plan: {
        taskId: "child",
        baseStatus: "done",
        materializeOwnerMembershipId: "owner-a",
        freeze: true,
        workspace: {
          workspaceId: "workspace-child",
          snapshotSyncVersion: 8,
          lifecycle: "frozen",
          revokeLeaseId: "lease-1",
        },
        auditRequired: true,
      },
    });
  });

  it("rejects incomplete children, stale versions and unfinished workspace facts", () => {
    const base = {
      task: task("task", "owner-a"),
      ownerResolution: {
        ok: true as const,
        membershipId: "owner-a",
        sourceTaskId: "task",
      },
      directChildStatuses: [{ status: "not_started" as const, archived: false }],
      predecessorStatuses: [],
      unresolvedManualBlockers: 0,
      authorized: true,
      expectedTaskVersion: 1,
      expectedGraphVersion: 1,
      currentGraphVersion: 1,
      workspace: {
        workspaceId: "workspace-task",
        lifecycle: "active" as const,
        syncVersion: 1,
        expectedSyncVersion: 1,
        finalServerVersionReceived: true,
        activeLeaseId: null,
      },
    };
    expect(evaluateTaskCompletion(base)).toEqual({ ok: false, reason: "child_incomplete" });
    expect(
      evaluateTaskCompletion({
        ...base,
        directChildStatuses: [],
        expectedTaskVersion: 0,
      }),
    ).toEqual({ ok: false, reason: "task_version_conflict" });
    expect(
      evaluateTaskCompletion({
        ...base,
        directChildStatuses: [],
        workspace: { ...base.workspace, finalServerVersionReceived: false },
      }),
    ).toEqual({ ok: false, reason: "workspace_not_finalized" });
  });

  it("freezes every mutable completed field except explicit exceptions", () => {
    const completed = task("done", "owner-a", { baseStatus: "done" });
    for (const mutation of [
      "content",
      "owner",
      "structure",
      "dependency",
      "blocker",
      "workspace",
    ] as const) {
      expect(evaluateTaskMutation(completed, mutation)).toEqual({
        ok: false,
        reason: "completed_task_frozen",
      });
    }
    expect(evaluateTaskMutation(completed, "comment")).toEqual({ ok: true });
    expect(evaluateTaskMutation(completed, "reopen")).toEqual({ ok: true });
    expect(evaluateTaskMutation(completed, "archive")).toEqual({ ok: true });
    expect(evaluateTaskMutation({ ...completed, parentTaskId: "parent" }, "archive")).toEqual({
      ok: false,
      reason: "completed_task_frozen",
    });
  });
});

describe("formal task reopen policy", () => {
  const tasks = [
    task("target", "owner-a", { baseStatus: "done", version: 2 }),
    task("successor-a", "owner-a", { baseStatus: "done", version: 3 }),
    task("successor-b", "owner-b", { baseStatus: "done", version: 4 }),
  ];
  const dependencies = [
    { predecessorTaskId: "target", successorTaskId: "successor-a" },
    { predecessorTaskId: "successor-a", successorTaskId: "successor-b" },
  ];
  const expectedTaskVersions = { target: 2, "successor-a": 3, "successor-b": 4 };
  const expectedOwnerMembershipIds = {
    target: "owner-a",
    "successor-a": "owner-a",
    "successor-b": "owner-b",
  };
  const workspaceWorkCycles = { target: 1, "successor-a": 2, "successor-b": 3 };

  it("denies reopen when a completed successor exists", () => {
    expect(
      evaluateTaskReopen({
        taskId: "target",
        policy: "deny",
        tasks,
        dependencies,
        expectedTaskVersions,
        expectedOwnerMembershipIds,
        workspaceWorkCycles,
        adminModeActive: false,
        confirmedTaskIds: [],
      }),
    ).toEqual({
      ok: false,
      reason: "completed_successor_exists",
      taskIds: ["successor-a", "successor-b"],
    });
  });

  it("requires admin capability and an exact cross-owner cascade confirmation", () => {
    const base = {
      taskId: "target",
      policy: "cascade" as const,
      tasks,
      dependencies,
      expectedTaskVersions,
      expectedOwnerMembershipIds,
      workspaceWorkCycles,
      adminModeActive: false,
      confirmedTaskIds: ["successor-a", "successor-b", "target"],
    };
    expect(evaluateTaskReopen(base)).toEqual({
      ok: false,
      reason: "admin_mode_required",
      taskIds: ["successor-a", "successor-b", "target"],
    });
    expect(
      evaluateTaskReopen({
        ...base,
        adminModeActive: true,
        confirmedTaskIds: ["target"],
      }),
    ).toEqual({
      ok: false,
      reason: "impact_confirmation_stale",
      taskIds: ["successor-a", "successor-b", "target"],
    });
    expect(evaluateTaskReopen({ ...base, adminModeActive: true })).toEqual({
      ok: true,
      plan: {
        taskIds: ["successor-a", "successor-b", "target"],
        baseStatus: "in_progress",
        workspaceTransitions: [
          {
            taskId: "successor-a",
            previousWorkCycle: 2,
            nextWorkCycle: 3,
            preservePreviousSnapshot: true,
          },
          {
            taskId: "successor-b",
            previousWorkCycle: 3,
            nextWorkCycle: 4,
            preservePreviousSnapshot: true,
          },
          {
            taskId: "target",
            previousWorkCycle: 1,
            nextWorkCycle: 2,
            preservePreviousSnapshot: true,
          },
        ],
      },
    });
  });
});
