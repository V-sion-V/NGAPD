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

export type TaskOperationAuthorizationReason =
  | AuthorizationReason
  | "tenant_scope_mismatch"
  | "task_owner_required"
  | "admin_mode_required"
  | "agent_admin_mode_requires_explicit_request"
  | "impact_confirmation_required";

export interface TaskOperationAuthorizationContext {
  serverProjectId: string;
  targetProjectIds: readonly string[];
  affectedOwnerMembershipIds: readonly string[];
  projectOwnerMembershipId: string;
  projectRootOperation: boolean;
  adminSessionActive: boolean;
  actorType: "human" | "agent";
  adminSessionEnteredFromExplicitUserRequest: boolean;
  impactConfirmationRequired: boolean;
  impactConfirmed: boolean;
}

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
    return { allowed: true, reason: "allowed" };
  }

  const membership = activeProjectMembership(context, actor);
  return "allowed" in membership ? membership : { allowed: true, reason: "allowed" };
}

export function resolveWorkspaceWriteEligibility(
  context: WorkspaceAuthorizationContext,
  actor: AuthorizationActor,
): AuthorizationDecision {
  const read = resolveWorkspaceReadAccess(context, actor);
  if (!read.allowed) {
    return read;
  }
  if (context.scopeType === "user") {
    return context.scopeOwnerUserId === actor.userId
      ? { allowed: true, reason: "allowed" }
      : deny("not_scope_owner");
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

export function resolveAgentWorkspaceReadIntent(input: {
  actorUserId: string;
  scopeOwnerUserId: string;
  explicitUserInstructionForScope: boolean;
}): AuthorizationDecision {
  return input.scopeOwnerUserId === input.actorUserId || input.explicitUserInstructionForScope
    ? { allowed: true, reason: "allowed" }
    : deny("not_scope_owner");
}

export function resolveTaskOperationAuthorization(
  context: TaskOperationAuthorizationContext,
  actor: AuthorizationActor,
):
  | { allowed: true; reason: "allowed" }
  | {
      allowed: false;
      reason: Exclude<TaskOperationAuthorizationReason, "allowed">;
    } {
  if (!actor.active) {
    return { allowed: false, reason: "account_inactive" };
  }
  const membership = actor.membership;
  if (!membership) {
    return { allowed: false, reason: "membership_required" };
  }
  if (!membership.active) {
    return { allowed: false, reason: "membership_inactive" };
  }
  if (
    membership.projectId !== context.serverProjectId ||
    context.targetProjectIds.some((projectId) => projectId !== context.serverProjectId)
  ) {
    return { allowed: false, reason: "tenant_scope_mismatch" };
  }

  const ownsEveryAffectedTask = context.affectedOwnerMembershipIds.every(
    (ownerMembershipId) => ownerMembershipId === membership.id,
  );
  const controlsProjectRoot =
    context.projectRootOperation && context.projectOwnerMembershipId === membership.id;
  const requiresAdmin = !ownsEveryAffectedTask && !controlsProjectRoot;
  if (requiresAdmin && !context.adminSessionActive) {
    return { allowed: false, reason: "admin_mode_required" };
  }
  if (
    requiresAdmin &&
    context.actorType === "agent" &&
    !context.adminSessionEnteredFromExplicitUserRequest
  ) {
    return {
      allowed: false,
      reason: "agent_admin_mode_requires_explicit_request",
    };
  }
  if (context.impactConfirmationRequired && !context.impactConfirmed) {
    return { allowed: false, reason: "impact_confirmation_required" };
  }
  return { allowed: true, reason: "allowed" };
}
