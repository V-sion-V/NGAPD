export interface TaskOwnershipNode {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  explicitOwnerMembershipId: string | null;
}

export interface OwnershipMembership {
  id: string;
  projectId: string;
  status: "pending" | "active" | "removed";
}

export type TaskOwnerResolution =
  | { ok: true; membershipId: string; sourceTaskId: string }
  | {
      ok: false;
      reason:
        | "task_not_found"
        | "parent_not_found"
        | "project_mismatch"
        | "ownership_cycle"
        | "owner_missing"
        | "owner_inactive"
        | "owner_project_mismatch";
    };

export type TaskOwnershipValidation =
  | { ok: true }
  | {
      ok: false;
      taskId: string;
      reason:
        | "duplicate_task"
        | "duplicate_membership"
        | "top_level_owner_required"
        | Exclude<TaskOwnerResolution, { ok: true }>["reason"];
    };

export type CompletionOwnerMaterialization =
  | {
      ok: true;
      membershipId: string;
      sourceTaskId: string;
      shouldMaterialize: boolean;
    }
  | Exclude<TaskOwnerResolution, { ok: true }>;

export function resolveEffectiveTaskOwner(
  taskId: string,
  tasks: readonly TaskOwnershipNode[],
  memberships: readonly OwnershipMembership[],
): TaskOwnerResolution {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const membershipById = new Map(memberships.map((membership) => [membership.id, membership]));
  const first = taskById.get(taskId);
  if (!first) {
    return { ok: false, reason: "task_not_found" };
  }

  const visited = new Set<string>();
  let current: TaskOwnershipNode | undefined = first;
  while (current) {
    if (visited.has(current.id)) {
      return { ok: false, reason: "ownership_cycle" };
    }
    visited.add(current.id);

    if (current.projectId !== first.projectId) {
      return { ok: false, reason: "project_mismatch" };
    }

    if (current.explicitOwnerMembershipId) {
      const membership = membershipById.get(current.explicitOwnerMembershipId);
      if (!membership) {
        return { ok: false, reason: "owner_missing" };
      }
      if (membership.status !== "active") {
        return { ok: false, reason: "owner_inactive" };
      }
      if (membership.projectId !== first.projectId) {
        return { ok: false, reason: "owner_project_mismatch" };
      }
      return {
        ok: true,
        membershipId: membership.id,
        sourceTaskId: current.id,
      };
    }

    if (!current.parentTaskId) {
      return { ok: false, reason: "owner_missing" };
    }
    current = taskById.get(current.parentTaskId);
    if (!current) {
      return { ok: false, reason: "parent_not_found" };
    }
  }

  return { ok: false, reason: "owner_missing" };
}

export function validateTaskOwnership(
  tasks: readonly TaskOwnershipNode[],
  memberships: readonly OwnershipMembership[],
): TaskOwnershipValidation {
  const taskIds = new Set<string>();
  for (const task of tasks) {
    if (taskIds.has(task.id)) {
      return { ok: false, taskId: task.id, reason: "duplicate_task" };
    }
    taskIds.add(task.id);
  }

  const membershipIds = new Set<string>();
  for (const membership of memberships) {
    if (membershipIds.has(membership.id)) {
      const relatedTask = [...tasks]
        .sort((left, right) => left.id.localeCompare(right.id))
        .find((task) => task.explicitOwnerMembershipId === membership.id);
      return {
        ok: false,
        taskId: relatedTask?.id ?? "",
        reason: "duplicate_membership",
      };
    }
    membershipIds.add(membership.id);
  }

  for (const task of [...tasks].sort((left, right) => left.id.localeCompare(right.id))) {
    if (task.parentTaskId === null && task.explicitOwnerMembershipId === null) {
      return { ok: false, taskId: task.id, reason: "top_level_owner_required" };
    }
    const resolution = resolveEffectiveTaskOwner(task.id, tasks, memberships);
    if (!resolution.ok) {
      return { ok: false, taskId: task.id, reason: resolution.reason };
    }
  }
  return { ok: true };
}

export function resolveCompletionOwnerMaterialization(
  taskId: string,
  tasks: readonly TaskOwnershipNode[],
  memberships: readonly OwnershipMembership[],
): CompletionOwnerMaterialization {
  const task = tasks.find((candidate) => candidate.id === taskId);
  const resolution = resolveEffectiveTaskOwner(taskId, tasks, memberships);
  if (!resolution.ok) {
    return resolution;
  }
  return {
    ok: true,
    membershipId: resolution.membershipId,
    sourceTaskId: resolution.sourceTaskId,
    shouldMaterialize: task?.explicitOwnerMembershipId === null,
  };
}
