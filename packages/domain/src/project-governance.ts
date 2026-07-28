import type { MembershipPermissionLevel, MembershipStatus } from "./membership.js";

export interface GovernanceMembership {
  id: string;
  projectId: string;
  permissionLevel: MembershipPermissionLevel;
  status: MembershipStatus;
}

export type ProjectGovernanceAction =
  | "archive_project"
  | "unarchive_project"
  | "review_join_request"
  | "change_admin_permission"
  | "remove_membership"
  | "create_ownership_transfer"
  | "cancel_ownership_transfer"
  | "open_admin_mode"
  | "edit_own_membership_profile"
  | "edit_other_membership_profile"
  | "manage_project_roles";

export type ProjectGovernanceDecision =
  | { allowed: true; reason: "allowed" }
  | {
      allowed: false;
      reason:
        | "membership_required"
        | "membership_inactive"
        | "membership_project_mismatch"
        | "project_archived"
        | "project_owner_required"
        | "owner_or_admin_required"
        | "admin_mode_required"
        | "self_membership_required";
    };

const ownerDirectActions = new Set<ProjectGovernanceAction>([
  "archive_project",
  "unarchive_project",
  "review_join_request",
  "change_admin_permission",
  "remove_membership",
  "create_ownership_transfer",
  "cancel_ownership_transfer",
]);

const adminModeActions = new Set<ProjectGovernanceAction>([
  "edit_other_membership_profile",
  "manage_project_roles",
]);

export function resolveProjectGovernanceAuthorization(input: {
  action: ProjectGovernanceAction;
  projectId: string;
  projectLifecycle: "active" | "archived";
  projectOwnerMembershipId: string;
  actorMembership?: GovernanceMembership;
  targetMembershipId?: string;
  adminModeActive: boolean;
}): ProjectGovernanceDecision {
  const actor = input.actorMembership;
  if (!actor) {
    return { allowed: false, reason: "membership_required" };
  }
  if (actor.status !== "active") {
    return { allowed: false, reason: "membership_inactive" };
  }
  if (actor.projectId !== input.projectId) {
    return { allowed: false, reason: "membership_project_mismatch" };
  }
  if (
    input.projectLifecycle === "archived" &&
    input.action !== "unarchive_project" &&
    input.action !== "archive_project"
  ) {
    return { allowed: false, reason: "project_archived" };
  }

  const isOwner = actor.id === input.projectOwnerMembershipId;
  if (ownerDirectActions.has(input.action)) {
    return isOwner
      ? { allowed: true, reason: "allowed" }
      : { allowed: false, reason: "project_owner_required" };
  }

  if (input.action === "open_admin_mode") {
    return isOwner || actor.permissionLevel === "admin"
      ? { allowed: true, reason: "allowed" }
      : { allowed: false, reason: "owner_or_admin_required" };
  }

  if (input.action === "edit_own_membership_profile") {
    return input.targetMembershipId === actor.id
      ? { allowed: true, reason: "allowed" }
      : { allowed: false, reason: "self_membership_required" };
  }

  if (adminModeActions.has(input.action)) {
    if (!isOwner && actor.permissionLevel !== "admin") {
      return { allowed: false, reason: "owner_or_admin_required" };
    }
    return input.adminModeActive
      ? { allowed: true, reason: "allowed" }
      : { allowed: false, reason: "admin_mode_required" };
  }

  return { allowed: false, reason: "project_owner_required" };
}

export type ProjectOwnershipValidation =
  | { ok: true }
  | {
      ok: false;
      reason: "owner_membership_missing" | "owner_project_mismatch" | "owner_membership_inactive";
    };

export function validateProjectOwnership(input: {
  projectId: string;
  ownerMembershipId: string;
  memberships: readonly GovernanceMembership[];
}): ProjectOwnershipValidation {
  const owner = input.memberships.find((membership) => membership.id === input.ownerMembershipId);
  if (!owner) {
    return { ok: false, reason: "owner_membership_missing" };
  }
  if (owner.projectId !== input.projectId) {
    return { ok: false, reason: "owner_project_mismatch" };
  }
  if (owner.status !== "active") {
    return { ok: false, reason: "owner_membership_inactive" };
  }
  return { ok: true };
}

export function resolveProjectLifecycleTransition(input: {
  current: "active" | "archived";
  requested: "active" | "archived";
}):
  | { ok: true; next: "active" | "archived"; revokeProjectCapabilities: boolean }
  | { ok: false; reason: "project_lifecycle_unchanged" } {
  if (input.current === input.requested) {
    return { ok: false, reason: "project_lifecycle_unchanged" };
  }
  return {
    ok: true,
    next: input.requested,
    revokeProjectCapabilities: input.requested === "archived",
  };
}
