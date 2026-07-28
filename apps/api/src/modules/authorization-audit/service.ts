import type { ApiErrorCode, CloseAdminModeRequest, OpenAdminModeRequest } from "@ngapd/contracts";
import {
  FoundationRepository,
  ProjectMembershipRepository,
  type AdminModeRecord,
  type Database,
  type MembershipRecord,
  type ProjectRecord,
} from "@ngapd/database";
import {
  resolveLogicalRoleOperation,
  resolveProjectGovernanceAuthorization,
  type ProjectGovernanceAction,
} from "@ngapd/domain";

import { ApplicationError, m1ApplicationError, m1ReasonCode } from "../../application-errors.js";

export interface AuthenticatedM1Actor {
  userId: string;
  webSessionId: string;
  actorType: "human";
}

export interface M1ApplicationContext {
  requestId: string;
  requestSha256: string;
  now: Date;
}

export interface AuthorizedProjectContext {
  project: ProjectRecord;
  membership: MembershipRecord;
}

interface Attempt {
  actor: AuthenticatedM1Actor;
  context: M1ApplicationContext;
  action: string;
  projectId: string | null;
  targetType: string;
  targetId: string;
  beforeVersion?: number;
}

export class AuthorizationAuditService {
  private readonly projects: ProjectMembershipRepository;
  private readonly audit: FoundationRepository;

  constructor(database: Database) {
    this.projects = new ProjectMembershipRepository(database);
    this.audit = new FoundationRepository(database);
  }

  async requireMemberByProjectKey(
    projectKey: string,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
    operation: Omit<Attempt, "actor" | "context" | "projectId">,
  ): Promise<AuthorizedProjectContext> {
    const project = await this.projects.findProjectByKey(projectKey);
    if (!project) {
      return this.reject({ ...operation, actor, context, projectId: null }, "project_not_found");
    }
    const membership = await this.projects.findMembershipByUser(project.id, actor.userId);
    if (!membership) {
      return this.reject(
        { ...operation, actor, context, projectId: project.id },
        "membership_required",
      );
    }
    if (membership.status !== "active") {
      return this.reject(
        {
          ...operation,
          actor,
          context,
          projectId: project.id,
          beforeVersion: membership.version,
        },
        "membership_inactive",
      );
    }
    return { project, membership };
  }

  async requireMemberByProjectId(
    projectId: string,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
    operation: Omit<Attempt, "actor" | "context" | "projectId">,
  ): Promise<AuthorizedProjectContext> {
    const project = await this.projects.findProjectById(projectId);
    if (!project) {
      return this.reject({ ...operation, actor, context, projectId: null }, "project_not_found");
    }
    const membership = await this.projects.findMembershipByUser(project.id, actor.userId);
    if (!membership) {
      return this.reject(
        { ...operation, actor, context, projectId: project.id },
        "membership_required",
      );
    }
    if (membership.status !== "active") {
      return this.reject(
        {
          ...operation,
          actor,
          context,
          projectId: project.id,
          beforeVersion: membership.version,
        },
        "membership_inactive",
      );
    }
    return { project, membership };
  }

  async currentAdminMode(
    projectId: string,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ): Promise<AdminModeRecord | null> {
    const latest = await this.projects.findLatestAdminModeForSession(projectId, actor.webSessionId);
    if (!latest) {
      return null;
    }
    const result = await this.projects.readAdminMode({
      adminModeId: latest.id,
      actorUserId: actor.userId,
      webSessionId: actor.webSessionId,
      now: context.now,
      requestId: context.requestId,
    });
    return result.ok ? result.adminMode : null;
  }

  async requireAdminMode(
    authorized: AuthorizedProjectContext,
    adminModeId: string | undefined,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
    operation: Omit<Attempt, "actor" | "context" | "projectId">,
  ): Promise<AdminModeRecord> {
    if (!adminModeId) {
      return this.reject(
        {
          ...operation,
          actor,
          context,
          projectId: authorized.project.id,
          beforeVersion: authorized.membership.version,
        },
        "admin_mode_required",
      );
    }
    const result = await this.projects.readAdminMode({
      adminModeId,
      actorUserId: actor.userId,
      webSessionId: actor.webSessionId,
      now: context.now,
      requestId: context.requestId,
    });
    if (!result.ok) {
      return this.reject(
        {
          ...operation,
          actor,
          context,
          projectId: authorized.project.id,
          beforeVersion: authorized.membership.version,
        },
        result.reason,
        result.currentVersion,
      );
    }
    if (
      result.adminMode.projectId !== authorized.project.id ||
      result.adminMode.membershipId !== authorized.membership.id
    ) {
      return this.reject(
        {
          ...operation,
          actor,
          context,
          projectId: authorized.project.id,
          beforeVersion: result.adminMode.version,
        },
        "admin_mode_scope_mismatch",
      );
    }
    if (result.adminMode.status !== "active") {
      return this.reject(
        {
          ...operation,
          actor,
          context,
          projectId: authorized.project.id,
          beforeVersion: result.adminMode.version,
        },
        result.adminMode.status === "expired" ? "admin_mode_expired" : "admin_mode_not_active",
      );
    }
    return result.adminMode;
  }

  async executeMutation<
    T extends {
      ok: boolean;
      reason?: string;
      currentVersion?: number;
      blockingTasks?: Array<{ id: string; key: string }>;
    },
  >(
    attempt: Attempt,
    operation: () => Promise<T>,
    translateError?: (error: unknown) => string | undefined,
  ): Promise<Extract<T, { ok: true }>> {
    try {
      const result = await operation();
      if (result.ok) {
        return result as Extract<T, { ok: true }>;
      }
      await this.recordFailure(attempt, m1ReasonCode(result.reason ?? "conflict"));
      throw m1ApplicationError(
        result.reason ?? "conflict",
        result.currentVersion,
        result.blockingTasks,
      );
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      const translatedReason = translateError?.(error);
      if (translatedReason) {
        await this.recordFailure(attempt, m1ReasonCode(translatedReason));
        throw m1ApplicationError(translatedReason);
      }
      try {
        await this.recordFailure(attempt, "INTERNAL_ERROR");
      } catch {
        throw error;
      }
      throw error;
    }
  }

  async reject<T = never>(attempt: Attempt, reason: string, currentVersion?: number): Promise<T> {
    await this.recordFailure(attempt, m1ReasonCode(reason));
    throw m1ApplicationError(reason, currentVersion);
  }

  private async recordFailure(attempt: Attempt, reasonCode: ApiErrorCode): Promise<void> {
    await this.audit.writeAudit({
      actorUserId: attempt.actor.userId,
      actorType: attempt.actor.actorType,
      projectId: attempt.projectId,
      targetType: attempt.targetType,
      targetId: attempt.targetId,
      requestId: attempt.context.requestId,
      action: attempt.action,
      result: "failure",
      reasonCode,
      beforeVersion: attempt.beforeVersion ?? null,
      afterVersion: null,
      metadata: {},
    });
  }
}

export class AdminModeService {
  private readonly projects: ProjectMembershipRepository;
  private readonly authorization: AuthorizationAuditService;

  constructor(database: Database) {
    this.projects = new ProjectMembershipRepository(database);
    this.authorization = new AuthorizationAuditService(database);
  }

  async open(
    input: OpenAdminModeRequest,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.authorization.requireMemberByProjectId(
      input.projectId,
      actor,
      context,
      {
        action: "admin_mode.open",
        targetType: "project",
        targetId: input.projectId,
      },
    );
    const result = await this.authorization.executeMutation(
      {
        actor,
        context,
        action: "admin_mode.open",
        projectId: authorized.project.id,
        targetType: "admin_mode",
        targetId: authorized.project.id,
        beforeVersion: input.expectedMembershipVersion,
      },
      () =>
        this.projects.openAdminMode({
          projectId: authorized.project.id,
          actorUserId: actor.userId,
          actorMembershipId: authorized.membership.id,
          webSessionId: actor.webSessionId,
          expectedMembershipVersion: input.expectedMembershipVersion,
          requestId: context.requestId,
          idempotencyKey: input.idempotencyKey,
          requestSha256: context.requestSha256,
          now: context.now,
        }),
    );
    return {
      adminMode: mapAdminModeResource(result.adminMode),
      idempotentReplay: result.idempotentReplay,
    };
  }

  async read(adminModeId: string, actor: AuthenticatedM1Actor, context: M1ApplicationContext) {
    const result = await this.projects.readAdminMode({
      adminModeId,
      actorUserId: actor.userId,
      webSessionId: actor.webSessionId,
      now: context.now,
      requestId: context.requestId,
    });
    if (!result.ok) {
      return this.authorization.reject(
        {
          actor,
          context,
          action: "admin_mode.read",
          projectId: null,
          targetType: "admin_mode",
          targetId: adminModeId,
        },
        result.reason,
        result.currentVersion,
      );
    }
    return {
      adminMode: mapAdminModeResource(result.adminMode),
      idempotentReplay: result.idempotentReplay,
    };
  }

  async close(
    adminModeId: string,
    input: CloseAdminModeRequest,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const result = await this.authorization.executeMutation(
      {
        actor,
        context,
        action: "admin_mode.close",
        projectId: null,
        targetType: "admin_mode",
        targetId: adminModeId,
        beforeVersion: input.expectedVersion,
      },
      () =>
        this.projects.closeAdminMode({
          adminModeId,
          actorUserId: actor.userId,
          webSessionId: actor.webSessionId,
          expectedVersion: input.expectedVersion,
          requestId: context.requestId,
          now: context.now,
        }),
    );
    return {
      adminMode: mapAdminModeResource(result.adminMode),
      idempotentReplay: result.idempotentReplay,
    };
  }
}

export function projectActions(
  project: ProjectRecord,
  membership: MembershipRecord,
  adminMode: AdminModeRecord | null,
) {
  const actions = ["read"] as Array<
    | "read"
    | "archive"
    | "unarchive"
    | "review_join_request"
    | "manage_admins"
    | "remove_member"
    | "transfer_ownership"
    | "manage_roles"
  >;
  const allowed = (action: ProjectGovernanceAction, adminModeActive = false) =>
    resolveProjectGovernanceAuthorization({
      action,
      projectId: project.id,
      projectLifecycle: project.lifecycle,
      projectOwnerMembershipId: project.ownerMembershipId,
      actorMembership: governanceMembership(membership),
      adminModeActive,
    }).allowed;
  if (allowed(project.lifecycle === "active" ? "archive_project" : "unarchive_project")) {
    actions.push(project.lifecycle === "active" ? "archive" : "unarchive");
  }
  if (allowed("review_join_request")) {
    actions.push("review_join_request", "manage_admins", "remove_member", "transfer_ownership");
  }
  if (allowed("manage_project_roles", adminMode?.status === "active")) {
    actions.push("manage_roles");
  }
  return actions;
}

export function membershipActions(
  project: ProjectRecord,
  actorMembership: MembershipRecord,
  target: MembershipRecord,
  adminMode: AdminModeRecord | null,
) {
  const actions = ["read"] as Array<
    | "read"
    | "edit_self"
    | "edit_other"
    | "grant_admin"
    | "revoke_admin"
    | "remove"
    | "request_ownership_transfer"
  >;
  const decision = (action: ProjectGovernanceAction, adminModeActive = false) =>
    resolveProjectGovernanceAuthorization({
      action,
      projectId: project.id,
      projectLifecycle: project.lifecycle,
      projectOwnerMembershipId: project.ownerMembershipId,
      actorMembership: governanceMembership(actorMembership),
      targetMembershipId: target.id,
      adminModeActive,
    }).allowed;
  if (target.status === "active" && decision("edit_own_membership_profile")) {
    actions.push("edit_self");
  }
  if (
    target.status === "active" &&
    target.id !== actorMembership.id &&
    decision("edit_other_membership_profile", adminMode?.status === "active")
  ) {
    actions.push("edit_other");
  }
  if (
    target.status === "active" &&
    target.id !== project.ownerMembershipId &&
    decision("change_admin_permission")
  ) {
    actions.push(target.permissionLevel === "admin" ? "revoke_admin" : "grant_admin");
  }
  if (
    target.status === "active" &&
    target.id !== project.ownerMembershipId &&
    decision("remove_membership")
  ) {
    actions.push("remove", "request_ownership_transfer");
  }
  return actions;
}

export function roleActions(
  project: ProjectRecord,
  membership: MembershipRecord,
  adminMode: AdminModeRecord | null,
  role: {
    id: string;
    projectId: string;
    sourceTemplateId: string | null;
    name: string;
    capability: string;
    status: "active" | "archived";
    version: number;
  },
) {
  const governance = resolveProjectGovernanceAuthorization({
    action: "manage_project_roles",
    projectId: project.id,
    projectLifecycle: project.lifecycle,
    projectOwnerMembershipId: project.ownerMembershipId,
    actorMembership: governanceMembership(membership),
    adminModeActive: adminMode?.status === "active",
  });
  if (!governance.allowed) {
    return [];
  }
  return (["edit", "copy", "archive", "bind"] as const).filter(
    (action) => resolveLogicalRoleOperation({ role, operation: action }).allowed,
  );
}

export function adminModeActions(adminMode: AdminModeRecord) {
  return adminMode.status === "active"
    ? (["close", "perform_protected_action"] as const)
    : ([] as const);
}

function mapAdminModeResource(adminMode: AdminModeRecord) {
  return {
    id: adminMode.id,
    webSessionId: adminMode.webSessionId,
    projectId: adminMode.projectId,
    membershipId: adminMode.membershipId,
    status: adminMode.status,
    issuedAt: adminMode.issuedAt.toISOString(),
    lastProtectedActivityAt: adminMode.lastProtectedActivityAt.toISOString(),
    expiresAt: adminMode.expiresAt.toISOString(),
    version: adminMode.version,
    actions: adminModeActions(adminMode),
  };
}

function governanceMembership(membership: MembershipRecord) {
  return {
    id: membership.id,
    projectId: membership.projectId,
    permissionLevel: membership.permissionLevel,
    status: membership.status,
  };
}
