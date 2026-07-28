import type {
  ChangeMembershipPermissionRequest,
  ChangeProjectLifecycleRequest,
  CreateMembershipJoinRequest,
  CreateOwnershipTransferRequest,
  CreateProjectRequest,
  RemoveMembershipRequest,
  ResolveMembershipJoinRequest,
  ResolveOwnershipTransferRequest,
  UpdateMembershipProfileRequest,
} from "@ngapd/contracts";
import {
  ProjectMembershipRepository,
  type AdminModeRecord,
  type Database,
  type JoinRequestRecord,
  type MembershipRecord,
  type OwnershipTransferRecord,
  type ProjectRecord,
} from "@ngapd/database";
import { resolveProjectGovernanceAuthorization } from "@ngapd/domain";

import {
  AuthorizationAuditService,
  adminModeActions,
  membershipActions,
  projectActions,
  type AuthenticatedM1Actor,
  type AuthorizedProjectContext,
  type M1ApplicationContext,
} from "../authorization-audit/index.js";

export class ProjectsMembershipService {
  private readonly projects: ProjectMembershipRepository;
  private readonly authorization: AuthorizationAuditService;

  constructor(database: Database) {
    this.projects = new ProjectMembershipRepository(database);
    this.authorization = new AuthorizationAuditService(database);
  }

  async listProjects(actor: AuthenticatedM1Actor, context: M1ApplicationContext) {
    const projects = await this.projects.listProjectsForUser(actor.userId);
    return {
      projects: await Promise.all(
        projects.map(async (project) => {
          const membership = await this.projects.findMembershipByUser(project.id, actor.userId);
          if (!membership || membership.status !== "active") {
            throw new Error("PROJECT_LIST_MEMBERSHIP_MISSING");
          }
          const adminMode = await this.authorization.currentAdminMode(project.id, actor, context);
          return mapProject(project, membership, adminMode);
        }),
      ),
    };
  }

  async getProject(projectKey: string, actor: AuthenticatedM1Actor, context: M1ApplicationContext) {
    const authorized = await this.authorization.requireMemberByProjectKey(
      projectKey,
      actor,
      context,
      {
        action: "project.read",
        targetType: "project",
        targetId: projectKey,
      },
    );
    const adminMode = await this.authorization.currentAdminMode(
      authorized.project.id,
      actor,
      context,
    );
    return {
      project: mapProject(authorized.project, authorized.membership, adminMode),
      currentMembership: mapMembership(
        authorized.project,
        authorized.membership,
        authorized.membership,
        adminMode,
      ),
      adminMode: adminMode ? mapAdminMode(adminMode) : null,
    };
  }

  async getJoinTarget(
    projectKey: string,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const target = await this.projects.findJoinTarget(projectKey);
    if (!target) {
      return this.authorization.reject(
        {
          actor,
          context,
          action: "project.join_target.read",
          projectId: null,
          targetType: "project",
          targetId: projectKey,
        },
        "project_not_found",
      );
    }
    return target;
  }

  async createProject(
    input: CreateProjectRequest,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const result = await this.authorization.executeMutation(
      {
        actor,
        context,
        action: "project.create",
        projectId: null,
        targetType: "project",
        targetId: input.key,
      },
      () =>
        this.projects.createProject({
          actorUserId: actor.userId,
          key: input.key,
          name: input.name,
          description: input.description ?? "",
          completedSuccessorReopenPolicy: input.completedSuccessorReopenPolicy ?? "deny",
          requestId: context.requestId,
          idempotencyKey: input.idempotencyKey,
          requestSha256: context.requestSha256,
          now: context.now,
        }),
      (error) => (isUniqueViolation(error) ? "project_key_taken" : undefined),
    );
    const membership = await this.projects.findMembershipByUser(result.project.id, actor.userId);
    if (!membership) {
      throw new Error("PROJECT_CREATE_MEMBERSHIP_MISSING");
    }
    return {
      project: mapProject(result.project, membership, null),
      idempotentReplay: result.idempotentReplay,
    };
  }

  async changeProjectLifecycle(
    projectKey: string,
    input: ChangeProjectLifecycleRequest,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireMember(projectKey, actor, context, "project.lifecycle");
    const result = await this.authorization.executeMutation(
      attempt(
        authorized,
        actor,
        context,
        "project.lifecycle.change",
        "project",
        authorized.project.id,
        authorized.project.version,
      ),
      () =>
        this.projects.changeProjectLifecycle({
          projectId: authorized.project.id,
          actorUserId: actor.userId,
          actorMembershipId: authorized.membership.id,
          lifecycle: input.lifecycle,
          expectedProjectVersion: input.expectedVersion,
          requestId: context.requestId,
          idempotencyKey: input.idempotencyKey,
          requestSha256: context.requestSha256,
          now: context.now,
        }),
    );
    const membership = await this.projects.findMembershipByUser(result.project.id, actor.userId);
    if (!membership) {
      throw new Error("PROJECT_LIFECYCLE_MEMBERSHIP_MISSING");
    }
    return {
      project: mapProject(result.project, membership, null),
      idempotentReplay: result.idempotentReplay,
    };
  }

  async createJoinRequest(
    input: CreateMembershipJoinRequest,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const project = await this.projects.findProjectByKey(input.projectKey);
    if (!project) {
      return this.authorization.reject(
        {
          actor,
          context,
          action: "membership.join_request.create",
          projectId: null,
          targetType: "project",
          targetId: input.projectKey,
        },
        "project_not_found",
      );
    }
    const result = await this.authorization.executeMutation(
      {
        actor,
        context,
        action: "membership.join_request.create",
        projectId: project.id,
        targetType: "membership_join_request",
        targetId: actor.userId,
      },
      () =>
        this.projects.createJoinRequest({
          actorUserId: actor.userId,
          projectKey: input.projectKey,
          requestId: context.requestId,
          idempotencyKey: input.idempotencyKey,
          requestSha256: context.requestSha256,
          now: context.now,
        }),
    );
    return {
      request: mapJoinRequest(result.request, false),
      membership: mapMembership(project, result.membership, result.membership, null),
      idempotentReplay: result.idempotentReplay,
    };
  }

  async listJoinRequests(
    projectKey: string,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireOwner(
      projectKey,
      actor,
      context,
      "membership.join_request.list",
    );
    const requests = await this.projects.listJoinRequests(authorized.project.id);
    return {
      requests: await Promise.all(
        requests.map(async (request) => {
          const membership = await this.projects.findMembership(
            authorized.project.id,
            request.membershipId,
          );
          if (!membership) {
            throw new Error("JOIN_REQUEST_MEMBERSHIP_MISSING");
          }
          return {
            request: mapJoinRequest(request, true),
            membership: mapMembership(authorized.project, authorized.membership, membership, null),
          };
        }),
      ),
    };
  }

  async resolveJoinRequest(
    projectKey: string,
    joinRequestId: string,
    input: ResolveMembershipJoinRequest,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireMember(
      projectKey,
      actor,
      context,
      "membership.join_request.resolve",
    );
    const result = await this.authorization.executeMutation(
      attempt(
        authorized,
        actor,
        context,
        "membership.join_request.resolve",
        "membership_join_request",
        joinRequestId,
        input.expectedRequestVersion,
      ),
      () =>
        this.projects.resolveJoinRequest({
          projectId: authorized.project.id,
          joinRequestId,
          actorUserId: actor.userId,
          actorMembershipId: authorized.membership.id,
          decision: input.decision,
          expectedProjectVersion: input.expectedProjectVersion,
          expectedMembershipVersion: input.expectedMembershipVersion,
          expectedRequestVersion: input.expectedRequestVersion,
          requestId: context.requestId,
          idempotencyKey: input.idempotencyKey,
          requestSha256: context.requestSha256,
          now: context.now,
        }),
    );
    return {
      request: mapJoinRequest(result.request, false),
      membership: mapMembership(authorized.project, authorized.membership, result.membership, null),
      idempotentReplay: result.idempotentReplay,
    };
  }

  async listMembers(
    projectKey: string,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireMember(projectKey, actor, context, "membership.list");
    const adminMode = await this.authorization.currentAdminMode(
      authorized.project.id,
      actor,
      context,
    );
    const members = await this.projects.listMembers(authorized.project.id);
    return {
      members: members.map((membership) =>
        mapMembership(authorized.project, authorized.membership, membership, adminMode),
      ),
    };
  }

  async updateMembershipProfile(
    projectKey: string,
    membershipId: string,
    input: UpdateMembershipProfileRequest,
    adminModeId: string | undefined,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireMember(
      projectKey,
      actor,
      context,
      "membership.profile.update",
    );
    const result = await this.authorization.executeMutation(
      attempt(
        authorized,
        actor,
        context,
        "membership.profile.update",
        "membership",
        membershipId,
        input.expectedVersion,
      ),
      () =>
        this.projects.updateMembershipProfile({
          projectId: authorized.project.id,
          targetMembershipId: membershipId,
          actorUserId: actor.userId,
          actorMembershipId: authorized.membership.id,
          webSessionId: actor.webSessionId,
          ...(adminModeId ? { adminModeId } : {}),
          introduction: input.introduction,
          roleIds: input.roleIds,
          expectedMembershipVersion: input.expectedVersion,
          requestId: context.requestId,
          now: context.now,
        }),
    );
    const adminMode = adminModeId
      ? await this.authorization.currentAdminMode(authorized.project.id, actor, context)
      : null;
    return {
      membership: mapMembership(
        authorized.project,
        authorized.membership,
        result.membership,
        adminMode,
      ),
      idempotentReplay: result.idempotentReplay,
    };
  }

  async changeMembershipPermission(
    projectKey: string,
    membershipId: string,
    input: ChangeMembershipPermissionRequest,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireMember(
      projectKey,
      actor,
      context,
      "membership.permission.change",
    );
    const result = await this.authorization.executeMutation(
      attempt(
        authorized,
        actor,
        context,
        "membership.permission.change",
        "membership",
        membershipId,
        input.expectedMembershipVersion,
      ),
      () =>
        this.projects.changeMembershipPermission({
          projectId: authorized.project.id,
          targetMembershipId: membershipId,
          actorUserId: actor.userId,
          actorMembershipId: authorized.membership.id,
          permissionLevel: input.permissionLevel,
          expectedProjectVersion: input.expectedProjectVersion,
          expectedMembershipVersion: input.expectedMembershipVersion,
          requestId: context.requestId,
          idempotencyKey: input.idempotencyKey,
          requestSha256: context.requestSha256,
          now: context.now,
        }),
    );
    return {
      membership: mapMembership(authorized.project, authorized.membership, result.membership, null),
      idempotentReplay: result.idempotentReplay,
    };
  }

  async previewMembershipRemoval(
    projectKey: string,
    membershipId: string,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireOwner(
      projectKey,
      actor,
      context,
      "membership.remove.preview",
    );
    const preview = await this.projects.previewMembershipRemoval(
      authorized.project.id,
      membershipId,
    );
    if (!preview) {
      return this.authorization.reject(
        attempt(
          authorized,
          actor,
          context,
          "membership.remove.preview",
          "membership",
          membershipId,
        ),
        "membership_not_found",
      );
    }
    return preview;
  }

  async removeMembership(
    projectKey: string,
    membershipId: string,
    input: RemoveMembershipRequest,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireMember(projectKey, actor, context, "membership.remove");
    const result = await this.authorization.executeMutation(
      attempt(
        authorized,
        actor,
        context,
        "membership.remove",
        "membership",
        membershipId,
        input.expectedMembershipVersion,
      ),
      () =>
        this.projects.removeMembership({
          projectId: authorized.project.id,
          targetMembershipId: membershipId,
          actorUserId: actor.userId,
          actorMembershipId: authorized.membership.id,
          expectedProjectVersion: input.expectedProjectVersion,
          expectedMembershipVersion: input.expectedMembershipVersion,
          confirmedBlockingTaskIds: input.confirmedBlockingTaskIds,
          requestId: context.requestId,
          idempotencyKey: input.idempotencyKey,
          requestSha256: context.requestSha256,
          now: context.now,
        }),
    );
    return {
      membership: mapMembership(authorized.project, authorized.membership, result.membership, null),
      idempotentReplay: result.idempotentReplay,
    };
  }

  async listOwnershipTransfers(
    projectKey: string,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireMember(
      projectKey,
      actor,
      context,
      "ownership_transfer.list",
    );
    const transfers = await this.projects.listOwnershipTransfers(authorized.project.id);
    return {
      transfers: transfers.map((transfer) =>
        mapTransfer(transfer, authorized.project, authorized.membership),
      ),
    };
  }

  async createOwnershipTransfer(
    projectKey: string,
    input: CreateOwnershipTransferRequest,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireMember(
      projectKey,
      actor,
      context,
      "ownership_transfer.create",
    );
    const result = await this.authorization.executeMutation(
      attempt(
        authorized,
        actor,
        context,
        "ownership_transfer.create",
        "ownership_transfer",
        input.targetMembershipId,
        input.expectedProjectVersion,
      ),
      () =>
        this.projects.createOwnershipTransfer({
          projectId: authorized.project.id,
          actorUserId: actor.userId,
          actorMembershipId: authorized.membership.id,
          targetMembershipId: input.targetMembershipId,
          expectedProjectVersion: input.expectedProjectVersion,
          expectedTargetMembershipVersion: input.expectedTargetMembershipVersion,
          requestId: context.requestId,
          idempotencyKey: input.idempotencyKey,
          requestSha256: context.requestSha256,
          now: context.now,
        }),
    );
    return {
      transfer: mapTransfer(result.transfer, authorized.project, authorized.membership),
      idempotentReplay: result.idempotentReplay,
    };
  }

  async resolveOwnershipTransfer(
    projectKey: string,
    transferId: string,
    input: ResolveOwnershipTransferRequest,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireMember(
      projectKey,
      actor,
      context,
      "ownership_transfer.resolve",
    );
    const result = await this.authorization.executeMutation(
      attempt(
        authorized,
        actor,
        context,
        "ownership_transfer.resolve",
        "ownership_transfer",
        transferId,
        input.expectedTransferVersion,
      ),
      () =>
        this.projects.resolveOwnershipTransfer({
          projectId: authorized.project.id,
          transferId,
          actorUserId: actor.userId,
          actorMembershipId: authorized.membership.id,
          action: input.action,
          expectedProjectVersion: input.expectedProjectVersion,
          expectedTransferVersion: input.expectedTransferVersion,
          requestId: context.requestId,
          idempotencyKey: input.idempotencyKey,
          requestSha256: context.requestSha256,
          now: context.now,
        }),
    );
    const currentProject =
      (await this.projects.findProjectById(authorized.project.id)) ?? authorized.project;
    return {
      transfer: mapTransfer(result.transfer, currentProject, authorized.membership),
      idempotentReplay: result.idempotentReplay,
    };
  }

  private requireMember(
    projectKey: string,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
    action: string,
  ) {
    return this.authorization.requireMemberByProjectKey(projectKey, actor, context, {
      action,
      targetType: "project",
      targetId: projectKey,
    });
  }

  private async requireOwner(
    projectKey: string,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
    action: string,
  ) {
    const authorized = await this.requireMember(projectKey, actor, context, action);
    const decision = resolveProjectGovernanceAuthorization({
      action: "review_join_request",
      projectId: authorized.project.id,
      projectLifecycle: authorized.project.lifecycle,
      projectOwnerMembershipId: authorized.project.ownerMembershipId,
      actorMembership: {
        id: authorized.membership.id,
        projectId: authorized.membership.projectId,
        permissionLevel: authorized.membership.permissionLevel,
        status: authorized.membership.status,
      },
      adminModeActive: false,
    });
    if (!decision.allowed) {
      return this.authorization.reject<AuthorizedProjectContext>(
        attempt(
          authorized,
          actor,
          context,
          action,
          "project",
          authorized.project.id,
          authorized.project.version,
        ),
        decision.reason,
      );
    }
    return authorized;
  }
}

function mapProject(
  project: ProjectRecord,
  membership: MembershipRecord,
  adminMode: AdminModeRecord | null,
) {
  return {
    id: project.id,
    key: project.key,
    name: project.name,
    description: project.description,
    ownerMembershipId: project.ownerMembershipId,
    workspaceId: project.workspaceId,
    lifecycle: project.lifecycle,
    completedSuccessorReopenPolicy: project.completedSuccessorReopenPolicy,
    version: project.version,
    actions: projectActions(project, membership, adminMode),
  };
}

function mapMembership(
  project: ProjectRecord,
  actorMembership: MembershipRecord,
  membership: MembershipRecord,
  adminMode: AdminModeRecord | null,
) {
  return {
    id: membership.id,
    projectId: membership.projectId,
    userId: membership.userId,
    displayName: membership.displayName,
    permissionLevel: membership.permissionLevel,
    status: membership.status,
    introduction: membership.introduction,
    roleIds: membership.roleIds,
    version: membership.version,
    actions: membershipActions(project, actorMembership, membership, adminMode),
  };
}

function mapJoinRequest(request: JoinRequestRecord, actorIsOwner: boolean) {
  return {
    id: request.id,
    projectId: request.projectId,
    membershipId: request.membershipId,
    requestedByUserId: request.requestedByUserId,
    status: request.status,
    version: request.version,
    createdAt: request.createdAt.toISOString(),
    resolvedAt: request.resolvedAt?.toISOString() ?? null,
    actions:
      actorIsOwner && request.status === "pending"
        ? (["approve", "reject"] as const)
        : ([] as const),
  };
}

function mapTransfer(
  transfer: OwnershipTransferRecord,
  project: ProjectRecord,
  actorMembership: MembershipRecord,
) {
  const actions: Array<"accept" | "reject" | "cancel"> = [];
  if (transfer.status === "pending") {
    if (actorMembership.id === transfer.targetMembershipId) {
      actions.push("accept", "reject");
    }
    if (
      actorMembership.id === transfer.fromOwnerMembershipId &&
      project.ownerMembershipId === actorMembership.id
    ) {
      actions.push("cancel");
    }
  }
  return {
    id: transfer.id,
    projectId: transfer.projectId,
    fromOwnerMembershipId: transfer.fromOwnerMembershipId,
    targetMembershipId: transfer.targetMembershipId,
    status: transfer.status,
    version: transfer.version,
    createdAt: transfer.createdAt.toISOString(),
    resolvedAt: transfer.resolvedAt?.toISOString() ?? null,
    actions,
  };
}

function mapAdminMode(adminMode: AdminModeRecord) {
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

function attempt(
  authorized: AuthorizedProjectContext,
  actor: AuthenticatedM1Actor,
  context: M1ApplicationContext,
  action: string,
  targetType: string,
  targetId: string,
  beforeVersion?: number,
) {
  return {
    actor,
    context,
    action,
    projectId: authorized.project.id,
    targetType,
    targetId,
    ...(beforeVersion === undefined ? {} : { beforeVersion }),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
