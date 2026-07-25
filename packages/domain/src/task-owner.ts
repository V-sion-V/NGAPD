export interface TaskOwnershipNode {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  explicitOwnerMembershipId: string | null;
}

export interface OwnershipMembership {
  id: string;
  projectId: string;
  active: boolean;
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
      if (!membership.active) {
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
