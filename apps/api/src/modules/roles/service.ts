import type {
  ArchiveProjectLogicalRoleRequest,
  CopyProjectLogicalRoleRequest,
  CreateProjectLogicalRoleRequest,
  UpdateProjectLogicalRoleRequest,
} from "@ngapd/contracts";
import {
  ProjectRoleRepository,
  type Database,
  type ProjectLogicalRoleRecord,
} from "@ngapd/database";

import {
  AuthorizationAuditService,
  roleActions,
  type AuthenticatedM1Actor,
  type M1ApplicationContext,
} from "../authorization-audit/index.js";

export class RolesService {
  private readonly roles: ProjectRoleRepository;
  private readonly authorization: AuthorizationAuditService;

  constructor(database: Database) {
    this.roles = new ProjectRoleRepository(database);
    this.authorization = new AuthorizationAuditService(database);
  }

  async listSystemTemplates() {
    return { templates: await this.roles.listSystemTemplates() };
  }

  async listProjectRoles(
    projectKey: string,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireMember(projectKey, actor, context, "project_role.list");
    const adminMode = await this.authorization.currentAdminMode(
      authorized.project.id,
      actor,
      context,
    );
    const roles = await this.roles.listProjectRoles(authorized.project.id);
    return {
      roles: roles.map((role) => ({
        ...role,
        actions: roleActions(authorized.project, authorized.membership, adminMode, role),
      })),
    };
  }

  async getProjectRole(
    projectKey: string,
    roleId: string,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireMember(projectKey, actor, context, "project_role.read");
    const role = await this.roles.findProjectRole(authorized.project.id, roleId);
    if (!role) {
      return this.authorization.reject(
        {
          actor,
          context,
          action: "project_role.read",
          projectId: authorized.project.id,
          targetType: "project_role",
          targetId: roleId,
        },
        "role_not_found",
      );
    }
    const adminMode = await this.authorization.currentAdminMode(
      authorized.project.id,
      actor,
      context,
    );
    return {
      ...role,
      actions: roleActions(authorized.project, authorized.membership, adminMode, role),
    };
  }

  async createProjectRole(
    projectKey: string,
    input: CreateProjectLogicalRoleRequest,
    adminModeId: string | undefined,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireMember(projectKey, actor, context, "project_role.create");
    const adminMode = await this.authorization.requireAdminMode(
      authorized,
      adminModeId,
      actor,
      context,
      {
        action: "project_role.create",
        targetType: "project",
        targetId: authorized.project.id,
      },
    );
    const result = await this.authorization.executeMutation(
      {
        actor,
        context,
        action: "project_role.create",
        projectId: authorized.project.id,
        targetType: "project_role",
        targetId: authorized.project.id,
      },
      () =>
        this.roles.createProjectRole({
          projectId: authorized.project.id,
          actorUserId: actor.userId,
          actorMembershipId: authorized.membership.id,
          webSessionId: actor.webSessionId,
          adminModeId: adminMode.id,
          name: input.name,
          capability: input.capability,
          requestId: context.requestId,
          idempotencyKey: input.idempotencyKey,
          requestSha256: context.requestSha256,
          now: context.now,
        }),
    );
    return mutationResponse(result, authorized, adminMode);
  }

  async updateProjectRole(
    projectKey: string,
    roleId: string,
    input: UpdateProjectLogicalRoleRequest,
    adminModeId: string | undefined,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireMember(projectKey, actor, context, "project_role.update");
    const adminMode = await this.authorization.requireAdminMode(
      authorized,
      adminModeId,
      actor,
      context,
      {
        action: "project_role.update",
        targetType: "project_role",
        targetId: roleId,
        beforeVersion: input.expectedVersion,
      },
    );
    const result = await this.authorization.executeMutation(
      {
        actor,
        context,
        action: "project_role.update",
        projectId: authorized.project.id,
        targetType: "project_role",
        targetId: roleId,
        beforeVersion: input.expectedVersion,
      },
      () =>
        this.roles.updateProjectRole({
          projectId: authorized.project.id,
          roleId,
          actorUserId: actor.userId,
          actorMembershipId: authorized.membership.id,
          webSessionId: actor.webSessionId,
          adminModeId: adminMode.id,
          name: input.name,
          capability: input.capability,
          expectedVersion: input.expectedVersion,
          requestId: context.requestId,
          now: context.now,
        }),
    );
    return mutationResponse(result, authorized, adminMode);
  }

  async copyProjectRole(
    projectKey: string,
    roleId: string,
    input: CopyProjectLogicalRoleRequest,
    adminModeId: string | undefined,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireMember(projectKey, actor, context, "project_role.copy");
    const adminMode = await this.authorization.requireAdminMode(
      authorized,
      adminModeId,
      actor,
      context,
      {
        action: "project_role.copy",
        targetType: "project_role",
        targetId: roleId,
        beforeVersion: input.expectedSourceVersion,
      },
    );
    const result = await this.authorization.executeMutation(
      {
        actor,
        context,
        action: "project_role.copy",
        projectId: authorized.project.id,
        targetType: "project_role",
        targetId: roleId,
        beforeVersion: input.expectedSourceVersion,
      },
      () =>
        this.roles.copyProjectRole({
          projectId: authorized.project.id,
          sourceRoleId: roleId,
          actorUserId: actor.userId,
          actorMembershipId: authorized.membership.id,
          webSessionId: actor.webSessionId,
          adminModeId: adminMode.id,
          name: input.name,
          expectedSourceVersion: input.expectedSourceVersion,
          requestId: context.requestId,
          idempotencyKey: input.idempotencyKey,
          requestSha256: context.requestSha256,
          now: context.now,
        }),
    );
    return mutationResponse(result, authorized, adminMode);
  }

  async archiveProjectRole(
    projectKey: string,
    roleId: string,
    input: ArchiveProjectLogicalRoleRequest,
    adminModeId: string | undefined,
    actor: AuthenticatedM1Actor,
    context: M1ApplicationContext,
  ) {
    const authorized = await this.requireMember(projectKey, actor, context, "project_role.archive");
    const adminMode = await this.authorization.requireAdminMode(
      authorized,
      adminModeId,
      actor,
      context,
      {
        action: "project_role.archive",
        targetType: "project_role",
        targetId: roleId,
        beforeVersion: input.expectedVersion,
      },
    );
    const result = await this.authorization.executeMutation(
      {
        actor,
        context,
        action: "project_role.archive",
        projectId: authorized.project.id,
        targetType: "project_role",
        targetId: roleId,
        beforeVersion: input.expectedVersion,
      },
      () =>
        this.roles.archiveProjectRole({
          projectId: authorized.project.id,
          roleId,
          actorUserId: actor.userId,
          actorMembershipId: authorized.membership.id,
          webSessionId: actor.webSessionId,
          adminModeId: adminMode.id,
          expectedVersion: input.expectedVersion,
          requestId: context.requestId,
          now: context.now,
        }),
    );
    return mutationResponse(result, authorized, adminMode);
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
}

function mutationResponse(
  result: {
    role: ProjectLogicalRoleRecord;
    idempotentReplay: boolean;
  },
  authorized: Awaited<ReturnType<AuthorizationAuditService["requireMemberByProjectKey"]>>,
  adminMode: Awaited<ReturnType<AuthorizationAuditService["requireAdminMode"]>>,
) {
  return {
    role: {
      ...result.role,
      actions: roleActions(authorized.project, authorized.membership, adminMode, result.role),
    },
    idempotentReplay: result.idempotentReplay,
  };
}
