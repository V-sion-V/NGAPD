import { describe, expect, it } from "vitest";

import { computeTaskImpactSet, type TaskImpactNode } from "./task-impact.js";

function task(
  id: string,
  parentTaskId: string | null,
  overrides: Partial<TaskImpactNode> = {},
): TaskImpactNode {
  return {
    id,
    projectId: "project-1",
    parentTaskId,
    baseStatus: "in_progress",
    effectiveOwnerMembershipId: "owner-a",
    workspace: {
      activeLeaseId: null,
      syncVersion: 1,
      lastAcknowledgedSyncVersion: 1,
    },
    ...overrides,
  };
}

describe("deterministic task impact sets", () => {
  it("covers descendants, external dependencies, status, ancestors, leases and versions", () => {
    const tasks = [
      task("ancestor", null, { baseStatus: "done" }),
      task("target", "ancestor"),
      task("child", "target", {
        workspace: {
          activeLeaseId: "lease-child",
          syncVersion: 4,
          lastAcknowledgedSyncVersion: 3,
        },
      }),
      task("external", "ancestor"),
    ];
    const result = computeTaskImpactSet({
      operation: "move",
      targetTaskId: "target",
      targetParentTaskId: null,
      tasks,
      dependencies: [
        {
          id: "dep-external",
          predecessorTaskId: "child",
          successorTaskId: "external",
        },
      ],
    });
    expect(result).toEqual({
      ok: true,
      impact: {
        operation: "move",
        targetTaskId: "target",
        affectedTaskIds: ["child", "target"],
        descendantTaskIds: ["child"],
        dependencyIds: ["dep-external"],
        effectiveStatusTaskIds: ["external"],
        completedAncestorTaskIds: ["ancestor"],
        workspaceLeaseIds: ["lease-child"],
        unsyncedWorkspaceTaskIds: ["child"],
        graphScopeIds: ["project-1:$project-root", "project-1:ancestor", "project-1:target"],
      },
      confirmationToken: expect.any(String),
    });
  });

  it("is stable for a depth-20 tree and reversed input", () => {
    const tasks = Array.from({ length: 21 }, (_, index) =>
      task(
        `task-${String(index).padStart(2, "0")}`,
        index === 0 ? null : `task-${String(index - 1).padStart(2, "0")}`,
      ),
    );
    const forward = computeTaskImpactSet({
      operation: "owner_change",
      targetTaskId: "task-00",
      tasks,
      dependencies: [],
    });
    const reversed = computeTaskImpactSet({
      operation: "owner_change",
      targetTaskId: "task-00",
      tasks: [...tasks].reverse(),
      dependencies: [],
    });
    expect(forward).toEqual(reversed);
    expect(forward.ok && forward.impact.descendantTaskIds).toHaveLength(20);
  });

  it("limits follow changes to explicitly related one-hop tasks", () => {
    const tasks = [task("source", null), task("target", null), task("unrelated", null)];
    const result = computeTaskImpactSet({
      operation: "follow_change",
      targetTaskId: "source",
      relatedTaskIds: ["target"],
      tasks,
      dependencies: [],
    });
    expect(result.ok && result.impact.affectedTaskIds).toEqual(["source", "target"]);
    expect(result.ok && result.impact.descendantTaskIds).toEqual([]);
  });
});
