export type AuthorizationWorkspaceScope = "user" | "project" | "task";
export type MembershipRole = "admin" | "member";

export interface AuthorizationMembership {
  id: string;
  userId: string;
  projectId: string;
  role: MembershipRole;
  active: boolean;
}

export interface WorkspaceAuthorizationContext {
  scopeType: AuthorizationWorkspaceScope;
  scopeOwnerUserId?: string;
  projectId?: string;
  projectOwnerMembershipId?: string;
  effectiveTaskOwnerMembershipId?: string;
}

export interface AuthorizationActor {
  userId: string;
  active: boolean;
  membership?: AuthorizationMembership;
}

export type AuthorizationReason =
  | "allowed"
  | "account_inactive"
  | "not_scope_owner"
  | "membership_required"
  | "membership_inactive"
  | "membership_project_mismatch"
  | "project_write_requires_owner_or_admin"
  | "task_write_requires_effective_owner";

export interface AuthorizationDecision {
  allowed: boolean;
  reason: AuthorizationReason;
}

function deny(reason: Exclude<AuthorizationReason, "allowed">): AuthorizationDecision {
  return { allowed: false, reason };
}

function activeProjectMembership(
  context: WorkspaceAuthorizationContext,
  actor: AuthorizationActor,
): AuthorizationDecision | AuthorizationMembership {
  if (!actor.membership) {
    return deny("membership_required");
  }
  if (!actor.membership.active) {
    return deny("membership_inactive");
  }
  if (!context.projectId || actor.membership.projectId !== context.projectId) {
    return deny("membership_project_mismatch");
  }
  return actor.membership;
}

export function resolveWorkspaceReadAccess(
  context: WorkspaceAuthorizationContext,
  actor: AuthorizationActor,
): AuthorizationDecision {
  if (!actor.active) {
    return deny("account_inactive");
  }
  if (context.scopeType === "user") {
    return context.scopeOwnerUserId === actor.userId
      ? { allowed: true, reason: "allowed" }
      : deny("not_scope_owner");
  }

  const membership = activeProjectMembership(context, actor);
  return "allowed" in membership ? membership : { allowed: true, reason: "allowed" };
}

export function resolveWorkspaceWriteEligibility(
  context: WorkspaceAuthorizationContext,
  actor: AuthorizationActor,
): AuthorizationDecision {
  const read = resolveWorkspaceReadAccess(context, actor);
  if (!read.allowed || context.scopeType === "user") {
    return read;
  }

  const membership = actor.membership;
  if (!membership) {
    return deny("membership_required");
  }

  if (context.scopeType === "project") {
    return membership.role === "admin" || context.projectOwnerMembershipId === membership.id
      ? { allowed: true, reason: "allowed" }
      : deny("project_write_requires_owner_or_admin");
  }

  return context.effectiveTaskOwnerMembershipId === membership.id
    ? { allowed: true, reason: "allowed" }
    : deny("task_write_requires_effective_owner");
}
