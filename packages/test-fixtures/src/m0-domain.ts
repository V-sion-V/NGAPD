import type { TaskGraphNode, TaskImpactNode, TaskTreeNode } from "@ngapd/domain";

export const M0_DOMAIN_FIXTURE_SPEC = {
  schemaVersion: 1,
  seed: 20260727,
  treeDepth: 20,
  siblingCount: 200,
  activeTaskCount: 5_000,
} as const;

export function createM0DepthTreeFixture(depth = M0_DOMAIN_FIXTURE_SPEC.treeDepth): TaskTreeNode[] {
  return Array.from({ length: depth + 1 }, (_, index) => ({
    id: `tree-${String(index).padStart(4, "0")}`,
    projectId: "project-m0",
    parentTaskId: index === 0 ? null : `tree-${String(index - 1).padStart(4, "0")}`,
  }));
}

export function createM0SiblingDagFixture(count = M0_DOMAIN_FIXTURE_SPEC.siblingCount): {
  tasks: TaskGraphNode[];
  dependencies: Array<{ predecessorTaskId: string; successorTaskId: string }>;
} {
  const tasks = Array.from({ length: count }, (_, index) => ({
    id: `sibling-${String(index).padStart(4, "0")}`,
    projectId: "project-m0",
    parentTaskId: "parent-m0",
    effectiveOwnerMembershipId: `membership-${String(index % 4).padStart(2, "0")}`,
    baseStatus: "not_started" as const,
    archived: false,
  }));
  return {
    tasks,
    dependencies: tasks.slice(1).map((task, index) => ({
      predecessorTaskId: tasks[index]?.id ?? "",
      successorTaskId: task.id,
    })),
  };
}

export function createM0ProjectScaleFixture(
  count = M0_DOMAIN_FIXTURE_SPEC.activeTaskCount,
): TaskImpactNode[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `project-task-${String(index).padStart(5, "0")}`,
    projectId: "project-m0",
    parentTaskId: null,
    baseStatus: index % 3 === 0 ? "not_started" : "in_progress",
    effectiveOwnerMembershipId: `membership-${String(index % 8).padStart(2, "0")}`,
    workspace: {
      activeLeaseId: null,
      syncVersion: 0,
      lastAcknowledgedSyncVersion: 0,
    },
  }));
}
