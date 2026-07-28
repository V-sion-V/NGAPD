import { resolveEffectiveTaskOwner, type OwnershipMembership } from "./task-owner.js";

export type MembershipPermissionLevel = "admin" | "member";
export type MembershipStatus = "pending" | "active" | "removed";

export interface MembershipState {
  id: string;
  projectId: string;
  userId: string;
  permissionLevel: MembershipPermissionLevel;
  status: MembershipStatus;
  hasBeenActive: boolean;
}

export type MembershipJoinTransition =
  | {
      ok: true;
      nextStatus: MembershipStatus;
      nextPermissionLevel: MembershipPermissionLevel;
      initializeProjectProfileFromUserDefaults: boolean;
    }
  | {
      ok: false;
      reason:
        "membership_already_active" | "join_request_already_pending" | "join_request_not_pending";
    };

export function requestMembershipJoin(
  membership: MembershipState | null,
): MembershipJoinTransition {
  if (!membership) {
    return {
      ok: true,
      nextStatus: "pending",
      nextPermissionLevel: "member",
      initializeProjectProfileFromUserDefaults: false,
    };
  }
  if (membership.status === "active") {
    return { ok: false, reason: "membership_already_active" };
  }
  if (membership.status === "pending") {
    return { ok: false, reason: "join_request_already_pending" };
  }
  return {
    ok: true,
    nextStatus: "pending",
    nextPermissionLevel: "member",
    initializeProjectProfileFromUserDefaults: false,
  };
}

export function resolveMembershipJoin(
  membership: MembershipState,
  decision: "approve" | "reject",
): MembershipJoinTransition {
  if (membership.status !== "pending") {
    return { ok: false, reason: "join_request_not_pending" };
  }
  if (decision === "reject") {
    return {
      ok: true,
      nextStatus: "removed",
      nextPermissionLevel: "member",
      initializeProjectProfileFromUserDefaults: false,
    };
  }
  return {
    ok: true,
    nextStatus: "active",
    nextPermissionLevel: "member",
    initializeProjectProfileFromUserDefaults: !membership.hasBeenActive,
  };
}

export type MembershipLifecycleLockPurpose =
  "remove_membership" | "create_task" | "assign_task_owner" | "reopen_task";

export interface MembershipLifecycleLockScope {
  projectId: string;
  membershipIds: readonly string[];
  purpose: MembershipLifecycleLockPurpose;
}

export function resolveMembershipLifecycleLockScope(input: {
  projectId: string;
  membershipIds: readonly string[];
  purpose: MembershipLifecycleLockPurpose;
}): MembershipLifecycleLockScope {
  return {
    projectId: input.projectId,
    membershipIds: [...new Set(input.membershipIds)].sort((left, right) =>
      left.localeCompare(right),
    ),
    purpose: input.purpose,
  };
}

export interface MembershipRemovalTask {
  id: string;
  key: string;
  projectId: string;
  parentTaskId: string | null;
  explicitOwnerMembershipId: string | null;
  status: "not_started" | "in_progress" | "blocked" | "done";
  lifecycle: "active" | "frozen" | "archived" | "deleted";
}

export interface MembershipRemovalBlocker {
  id: string;
  key: string;
}

export type MembershipRemovalDecision =
  | { ok: true; blockers: readonly [] }
  | {
      ok: false;
      reason: "membership_not_active" | "owner_removal_forbidden" | "active_task_ownership_blocked";
      blockers: readonly MembershipRemovalBlocker[];
    };

function taskIsEnabled(
  task: MembershipRemovalTask,
  taskById: ReadonlyMap<string, MembershipRemovalTask>,
): boolean {
  const visited = new Set<string>();
  let current: MembershipRemovalTask | undefined = task;
  while (current) {
    if (visited.has(current.id)) {
      return false;
    }
    visited.add(current.id);
    if (current.lifecycle === "archived" || current.lifecycle === "deleted") {
      return false;
    }
    current = current.parentTaskId ? taskById.get(current.parentTaskId) : undefined;
  }
  return true;
}

export function previewMembershipRemoval(input: {
  projectId: string;
  ownerMembershipId: string;
  targetMembership: MembershipState;
  tasks: readonly MembershipRemovalTask[];
  memberships: readonly OwnershipMembership[];
}): MembershipRemovalDecision {
  if (
    input.targetMembership.projectId !== input.projectId ||
    input.targetMembership.status !== "active"
  ) {
    return { ok: false, reason: "membership_not_active", blockers: [] };
  }
  if (input.targetMembership.id === input.ownerMembershipId) {
    return { ok: false, reason: "owner_removal_forbidden", blockers: [] };
  }

  const projectTasks = input.tasks.filter((task) => task.projectId === input.projectId);
  const taskById = new Map(projectTasks.map((task) => [task.id, task]));
  const ownershipTasks = projectTasks.map((task) => ({
    id: task.id,
    projectId: task.projectId,
    parentTaskId: task.parentTaskId,
    explicitOwnerMembershipId: task.explicitOwnerMembershipId,
  }));
  const blockers = projectTasks
    .filter(
      (task) =>
        task.status !== "done" &&
        task.lifecycle !== "frozen" &&
        taskIsEnabled(task, taskById) &&
        resolveEffectiveTaskOwner(task.id, ownershipTasks, input.memberships).ok,
    )
    .filter((task) => {
      const owner = resolveEffectiveTaskOwner(task.id, ownershipTasks, input.memberships);
      return owner.ok && owner.membershipId === input.targetMembership.id;
    })
    .map(({ id, key }) => ({ id, key }))
    .sort((left, right) => left.key.localeCompare(right.key) || left.id.localeCompare(right.id));

  return blockers.length === 0
    ? { ok: true, blockers: [] }
    : { ok: false, reason: "active_task_ownership_blocked", blockers };
}
