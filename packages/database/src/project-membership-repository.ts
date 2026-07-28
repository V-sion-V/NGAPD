import { randomUUID } from "node:crypto";

import {
  evaluateAdminMode,
  openAdminMode,
  previewMembershipRemoval,
  requestMembershipJoin,
  resolveMembershipJoin,
  resolveOwnershipTransfer,
  resolveProjectGovernanceAuthorization,
  resolveProjectLifecycleTransition,
  createOwnershipTransfer as resolveOwnershipTransferCreation,
  type AdminModeState,
  type GovernanceMembership,
  type MembershipRemovalTask,
  type MembershipState,
  type OwnershipMembership,
  type OwnershipTransferState,
} from "@ngapd/domain";
import { sql, type Kysely, type Transaction } from "kysely";

import {
  lockM1IdempotencyKey,
  lockMemberships,
  readM1Replay,
  revokeAdminModes,
  revokeWorkspaceLeases,
  stringField,
  writeM1Replay,
  writeM1Success,
} from "./m1-repository-support.js";
import type { DatabaseSchema } from "./types.js";

const EMPTY_MANIFEST_HASH = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";

export interface ProjectRecord {
  id: string;
  key: string;
  name: string;
  description: string;
  ownerMembershipId: string;
  workspaceId: string;
  completedSuccessorReopenPolicy: "deny" | "cascade";
  lifecycle: "active" | "archived";
  version: number;
}

export interface MembershipRecord {
  id: string;
  projectId: string;
  userId: string;
  displayName: string;
  permissionLevel: "admin" | "member";
  status: "pending" | "active" | "removed";
  introduction: string;
  roleIds: string[];
  version: number;
  hasBeenActive: boolean;
}

export interface JoinRequestRecord {
  id: string;
  projectId: string;
  membershipId: string;
  requestedByUserId: string;
  status: "pending" | "approved" | "rejected" | "stale";
  version: number;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface OwnershipTransferRecord {
  id: string;
  projectId: string;
  fromOwnerMembershipId: string;
  targetMembershipId: string;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "stale";
  version: number;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface AdminModeRecord {
  id: string;
  webSessionId: string;
  projectId: string;
  membershipId: string;
  status: "active" | "closed" | "expired" | "revoked";
  issuedAt: Date;
  lastProtectedActivityAt: Date;
  expiresAt: Date;
  version: number;
}

export interface MembershipRemovalPreviewRecord {
  membershipId: string;
  blockingTasks: Array<{ id: string; key: string }>;
  canRemove: boolean;
  projectVersion: number;
  membershipVersion: number;
}

export type MutationFailureReason =
  | "account_inactive"
  | "project_not_found"
  | "project_archived"
  | "membership_required"
  | "membership_not_found"
  | "membership_inactive"
  | "membership_project_mismatch"
  | "membership_already_active"
  | "join_request_already_pending"
  | "join_request_not_found"
  | "join_request_not_pending"
  | "ownership_transfer_not_found"
  | "ownership_transfer_not_pending"
  | "ownership_transfer_stale"
  | "project_owner_required"
  | "owner_or_admin_required"
  | "admin_mode_required"
  | "admin_mode_not_found"
  | "admin_mode_not_active"
  | "admin_mode_expired"
  | "admin_mode_scope_mismatch"
  | "web_session_inactive"
  | "self_membership_required"
  | "target_is_current_owner"
  | "target_membership_inactive"
  | "ownership_transfer_already_pending"
  | "target_membership_required"
  | "owner_removal_forbidden"
  | "active_task_ownership_blocked"
  | "project_lifecycle_unchanged"
  | "project_version_conflict"
  | "membership_version_conflict"
  | "request_version_conflict"
  | "transfer_version_conflict"
  | "admin_mode_version_conflict"
  | "role_not_found"
  | "project_role_archived"
  | "idempotency_conflict"
  | "forbidden";

export type ProjectMutationResult =
  | { ok: true; project: ProjectRecord; idempotentReplay: boolean }
  | { ok: false; reason: MutationFailureReason; currentVersion?: number };

export type JoinRequestMutationResult =
  | {
      ok: true;
      request: JoinRequestRecord;
      membership: MembershipRecord;
      idempotentReplay: boolean;
    }
  | { ok: false; reason: MutationFailureReason; currentVersion?: number };

export type MembershipMutationResult =
  | { ok: true; membership: MembershipRecord; idempotentReplay: boolean }
  | {
      ok: false;
      reason: MutationFailureReason;
      currentVersion?: number;
      blockingTasks?: Array<{ id: string; key: string }>;
    };

export type OwnershipTransferMutationResult =
  | { ok: true; transfer: OwnershipTransferRecord; idempotentReplay: boolean }
  | { ok: false; reason: MutationFailureReason; currentVersion?: number };

export type AdminModeMutationResult =
  | { ok: true; adminMode: AdminModeRecord; idempotentReplay: boolean }
  | { ok: false; reason: MutationFailureReason; currentVersion?: number };

export class ProjectMembershipRepository {
  constructor(private readonly database: Kysely<DatabaseSchema>) {}

  async listProjectsForUser(userId: string): Promise<ProjectRecord[]> {
    const rows = await this.database
      .selectFrom("projects as project")
      .innerJoin("memberships as membership", (join) =>
        join
          .onRef("membership.project_id", "=", "project.id")
          .on("membership.user_id", "=", userId)
          .on("membership.status", "=", "active"),
      )
      .innerJoin("workspaces as workspace", (join) =>
        join
          .on("workspace.scope_type", "=", "project")
          .onRef("workspace.scope_id", "=", "project.id"),
      )
      .select([
        "project.id",
        "project.project_key",
        "project.name",
        "project.description",
        "project.owner_membership_id",
        "project.completed_successor_reopen_policy",
        "project.lifecycle",
        "project.version",
        "workspace.id as workspace_id",
      ])
      .orderBy("project.project_key")
      .orderBy("project.id")
      .execute();
    return rows.map(mapProject);
  }

  async findProjectForMember(
    projectKey: string,
    userId: string,
  ): Promise<{ project: ProjectRecord; membership: MembershipRecord } | undefined> {
    const project = await this.findProjectByKey(projectKey);
    if (!project) {
      return undefined;
    }
    const membership = await this.findMembershipByUser(project.id, userId);
    return membership?.status === "active" ? { project, membership } : undefined;
  }

  async findJoinTarget(projectKey: string) {
    const project = await this.database
      .selectFrom("projects")
      .select(["project_key", "name", "lifecycle"])
      .where("project_key", "=", projectKey)
      .executeTakeFirst();
    return project
      ? {
          key: project.project_key,
          name: project.name,
          acceptsJoinRequests: project.lifecycle === "active",
        }
      : undefined;
  }

  async findProjectByKey(projectKey: string): Promise<ProjectRecord | undefined> {
    const row = await this.database
      .selectFrom("projects as project")
      .innerJoin("workspaces as workspace", (join) =>
        join
          .on("workspace.scope_type", "=", "project")
          .onRef("workspace.scope_id", "=", "project.id"),
      )
      .select([
        "project.id",
        "project.project_key",
        "project.name",
        "project.description",
        "project.owner_membership_id",
        "project.completed_successor_reopen_policy",
        "project.lifecycle",
        "project.version",
        "workspace.id as workspace_id",
      ])
      .where("project.project_key", "=", projectKey)
      .executeTakeFirst();
    return row ? mapProject(row) : undefined;
  }

  async findProjectById(projectId: string): Promise<ProjectRecord | undefined> {
    const row = await this.database
      .selectFrom("projects as project")
      .innerJoin("workspaces as workspace", (join) =>
        join
          .on("workspace.scope_type", "=", "project")
          .onRef("workspace.scope_id", "=", "project.id"),
      )
      .select([
        "project.id",
        "project.project_key",
        "project.name",
        "project.description",
        "project.owner_membership_id",
        "project.completed_successor_reopen_policy",
        "project.lifecycle",
        "project.version",
        "workspace.id as workspace_id",
      ])
      .where("project.id", "=", projectId)
      .executeTakeFirst();
    return row ? mapProject(row) : undefined;
  }

  async listMembers(projectId: string): Promise<MembershipRecord[]> {
    const rows = await this.database
      .selectFrom("memberships as membership")
      .innerJoin("users as user", "user.id", "membership.user_id")
      .select([
        "membership.id",
        "membership.project_id",
        "membership.user_id",
        "membership.permission_level",
        "membership.status",
        "membership.introduction",
        "membership.version",
        "membership.has_been_active",
        "user.display_name",
      ])
      .where("membership.project_id", "=", projectId)
      .orderBy("user.display_name")
      .orderBy("membership.id")
      .execute();
    const roleIds = await readMembershipRoleIds(
      this.database,
      rows.map((row) => row.id),
    );
    return rows.map((row) => mapMembership(row, roleIds.get(row.id) ?? []));
  }

  async findMembership(
    projectId: string,
    membershipId: string,
  ): Promise<MembershipRecord | undefined> {
    return findMembershipWithExecutor(this.database, projectId, membershipId);
  }

  async findMembershipByUser(
    projectId: string,
    userId: string,
  ): Promise<MembershipRecord | undefined> {
    const row = await this.database
      .selectFrom("memberships")
      .select("id")
      .where("project_id", "=", projectId)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return row ? this.findMembership(projectId, row.id) : undefined;
  }

  async listJoinRequests(projectId: string): Promise<JoinRequestRecord[]> {
    const rows = await this.database
      .selectFrom("membership_join_requests")
      .selectAll()
      .where("project_id", "=", projectId)
      .orderBy("created_at")
      .orderBy("id")
      .execute();
    return rows.map(mapJoinRequest);
  }

  async listOwnershipTransfers(projectId: string): Promise<OwnershipTransferRecord[]> {
    const rows = await this.database
      .selectFrom("project_ownership_transfer_requests")
      .selectAll()
      .where("project_id", "=", projectId)
      .orderBy("created_at")
      .orderBy("id")
      .execute();
    return rows.map(mapOwnershipTransfer);
  }

  async findLatestAdminModeForSession(
    projectId: string,
    webSessionId: string,
  ): Promise<AdminModeRecord | undefined> {
    const row = await this.database
      .selectFrom("admin_mode_sessions")
      .selectAll()
      .where("project_id", "=", projectId)
      .where("web_session_id", "=", webSessionId)
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .executeTakeFirst();
    return row ? mapAdminMode(row) : undefined;
  }

  async createProject(input: {
    projectId?: string;
    ownerMembershipId?: string;
    workspaceId?: string;
    rootGraphScopeId?: string;
    actorUserId: string;
    key: string;
    name: string;
    description: string;
    completedSuccessorReopenPolicy: "deny" | "cascade";
    requestId: string;
    idempotencyKey: string;
    requestSha256: string;
    now: Date;
  }): Promise<ProjectMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      await lockM1IdempotencyKey(transaction, {
        actorUserId: input.actorUserId,
        operation: "project_create",
        idempotencyKey: input.idempotencyKey,
      });
      const replay = await readM1Replay(transaction, {
        actorUserId: input.actorUserId,
        operation: "project_create",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
      });
      if (replay.status === "conflict") {
        return { ok: false, reason: "idempotency_conflict" };
      }
      if (replay.status === "replay") {
        const project = await findProjectByIdWithExecutor(
          transaction,
          stringField(replay.response.projectId, "projectId"),
        );
        if (!project) {
          throw new Error("M1_IDEMPOTENCY_PROJECT_MISSING");
        }
        return { ok: true, project, idempotentReplay: true };
      }

      const user = await transaction
        .selectFrom("users")
        .select(["id", "active"])
        .where("id", "=", input.actorUserId)
        .forUpdate()
        .executeTakeFirst();
      if (!user || !user.active) {
        return { ok: false, reason: "account_inactive" };
      }

      const projectId = input.projectId ?? randomUUID();
      const ownerMembershipId = input.ownerMembershipId ?? randomUUID();
      const workspaceId = input.workspaceId ?? randomUUID();
      await sql`set constraints all deferred`.execute(transaction);
      await transaction
        .insertInto("projects")
        .values({
          id: projectId,
          project_key: input.key,
          name: input.name,
          description: input.description,
          owner_membership_id: ownerMembershipId,
          completed_successor_reopen_policy: input.completedSuccessorReopenPolicy,
        })
        .execute();
      await transaction
        .insertInto("memberships")
        .values({
          id: ownerMembershipId,
          project_id: projectId,
          user_id: input.actorUserId,
          permission_level: "admin",
          status: "active",
          has_been_active: true,
        })
        .execute();
      await transaction
        .insertInto("project_logical_roles")
        .columns(["id", "project_id", "source_template_id", "name", "capability"])
        .expression((expression) =>
          expression
            .selectFrom("system_logical_role_templates")
            .select([
              sql<string>`md5(${projectId}::text || ':' || id)::uuid`.as("id"),
              sql<string>`${projectId}::uuid`.as("project_id"),
              "id as source_template_id",
              "title as name",
              "description as capability",
            ]),
        )
        .execute();
      await transaction
        .insertInto("sibling_task_graph_scopes")
        .values({
          id: input.rootGraphScopeId ?? randomUUID(),
          project_id: projectId,
          parent_task_id: null,
        })
        .execute();
      await insertWorkspace(transaction, workspaceId, "project", projectId);
      await writeM1Success(transaction, {
        actorUserId: input.actorUserId,
        projectId,
        requestId: input.requestId,
        action: "project.create",
        reasonCode: "PROJECT_CREATED",
        targetType: "project",
        targetId: projectId,
        beforeVersion: null,
        afterVersion: 1,
        audienceType: "project",
        audienceId: projectId,
        eventType: "project.created",
        payload: { projectId, projectKey: input.key, version: 1 },
      });
      await writeM1Replay(transaction, {
        actorUserId: input.actorUserId,
        projectId,
        operation: "project_create",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
        response: { projectId, ownerMembershipId, workspaceId },
      });
      const project = await findProjectByIdWithExecutor(transaction, projectId);
      if (!project) {
        throw new Error("PROJECT_CREATE_RESPONSE_MISSING");
      }
      return { ok: true, project, idempotentReplay: false };
    });
  }

  async createJoinRequest(input: {
    requestIdValue?: string;
    actorUserId: string;
    projectKey: string;
    requestId: string;
    idempotencyKey: string;
    requestSha256: string;
    now: Date;
  }): Promise<JoinRequestMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      await lockM1IdempotencyKey(transaction, {
        actorUserId: input.actorUserId,
        operation: "membership_join_request_create",
        idempotencyKey: input.idempotencyKey,
      });
      const replay = await readM1Replay(transaction, {
        actorUserId: input.actorUserId,
        operation: "membership_join_request_create",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
      });
      if (replay.status === "conflict") {
        return { ok: false, reason: "idempotency_conflict" };
      }
      if (replay.status === "replay") {
        return replayJoinRequest(transaction, replay.response);
      }

      const project = await transaction
        .selectFrom("projects")
        .select(["id", "lifecycle"])
        .where("project_key", "=", input.projectKey)
        .forUpdate()
        .executeTakeFirst();
      if (!project) {
        return { ok: false, reason: "project_not_found" };
      }
      if (project.lifecycle !== "active") {
        return { ok: false, reason: "project_archived" };
      }
      const user = await transaction
        .selectFrom("users")
        .select(["id", "active"])
        .where("id", "=", input.actorUserId)
        .executeTakeFirst();
      if (!user?.active) {
        return { ok: false, reason: "account_inactive" };
      }

      let membership = await transaction
        .selectFrom("memberships")
        .selectAll()
        .where("project_id", "=", project.id)
        .where("user_id", "=", input.actorUserId)
        .forUpdate()
        .executeTakeFirst();
      const transition = requestMembershipJoin(membership ? mapMembershipState(membership) : null);
      if (!transition.ok) {
        return { ok: false, reason: transition.reason };
      }
      if (!membership) {
        membership = await transaction
          .insertInto("memberships")
          .values({
            id: randomUUID(),
            project_id: project.id,
            user_id: input.actorUserId,
            permission_level: "member",
            status: "pending",
            has_been_active: false,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
      } else {
        membership = await transaction
          .updateTable("memberships")
          .set({
            permission_level: "member",
            status: "pending",
            version: (expression) => expression("version", "+", "1"),
            updated_at: input.now,
          })
          .where("id", "=", membership.id)
          .returningAll()
          .executeTakeFirstOrThrow();
      }
      const requestRow = await transaction
        .insertInto("membership_join_requests")
        .values({
          id: input.requestIdValue ?? randomUUID(),
          project_id: project.id,
          membership_id: membership.id,
          requested_by_user_id: input.actorUserId,
          idempotency_key: input.idempotencyKey,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeM1Success(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        requestId: input.requestId,
        action: "membership.join_request.create",
        reasonCode: "MEMBERSHIP_JOIN_REQUEST_CREATED",
        targetType: "membership_join_request",
        targetId: requestRow.id,
        beforeVersion: null,
        afterVersion: 1,
        audienceType: "project",
        audienceId: project.id,
        eventType: "membership.join_request.created",
        payload: { requestId: requestRow.id, membershipId: membership.id },
      });
      await writeM1Replay(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        operation: "membership_join_request_create",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
        response: { requestId: requestRow.id, membershipId: membership.id, projectId: project.id },
      });
      const mappedMembership = await findMembershipWithExecutor(
        transaction,
        project.id,
        membership.id,
      );
      if (!mappedMembership) {
        throw new Error("JOIN_REQUEST_MEMBERSHIP_MISSING");
      }
      return {
        ok: true,
        request: mapJoinRequest(requestRow),
        membership: mappedMembership,
        idempotentReplay: false,
      };
    });
  }

  async resolveJoinRequest(input: {
    projectId: string;
    joinRequestId: string;
    actorUserId: string;
    actorMembershipId: string;
    decision: "approve" | "reject";
    expectedProjectVersion: number;
    expectedMembershipVersion: number;
    expectedRequestVersion: number;
    requestId: string;
    idempotencyKey: string;
    requestSha256: string;
    now: Date;
  }): Promise<JoinRequestMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const project = await lockProject(transaction, input.projectId);
      if (!project) {
        return { ok: false, reason: "project_not_found" };
      }
      const request = await transaction
        .selectFrom("membership_join_requests")
        .selectAll()
        .where("id", "=", input.joinRequestId)
        .where("project_id", "=", input.projectId)
        .executeTakeFirst();
      if (!request) {
        return { ok: false, reason: "join_request_not_found" };
      }
      const memberships = await lockMemberships(transaction, input.projectId, [
        input.actorMembershipId,
        request.membership_id,
      ]);
      const actor = memberships.find((membership) => membership.id === input.actorMembershipId);
      const target = memberships.find((membership) => membership.id === request.membership_id);
      if (!actor || !target) {
        return { ok: false, reason: "membership_not_found" };
      }
      if (actor.user_id !== input.actorUserId) {
        return { ok: false, reason: "forbidden" };
      }
      const lockedRequest = await transaction
        .selectFrom("membership_join_requests")
        .selectAll()
        .where("id", "=", request.id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      await lockM1IdempotencyKey(transaction, {
        actorUserId: input.actorUserId,
        operation: "membership_join_request_resolve",
        idempotencyKey: input.idempotencyKey,
      });
      const replay = await readM1Replay(transaction, {
        actorUserId: input.actorUserId,
        operation: "membership_join_request_resolve",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
      });
      if (replay.status === "conflict") {
        return { ok: false, reason: "idempotency_conflict" };
      }
      if (replay.status === "replay") {
        return replayJoinRequest(transaction, replay.response);
      }
      if (Number(project.version) !== input.expectedProjectVersion) {
        return {
          ok: false,
          reason: "project_version_conflict",
          currentVersion: Number(project.version),
        };
      }
      if (Number(target.version) !== input.expectedMembershipVersion) {
        return {
          ok: false,
          reason: "membership_version_conflict",
          currentVersion: Number(target.version),
        };
      }
      if (Number(lockedRequest.version) !== input.expectedRequestVersion) {
        return {
          ok: false,
          reason: "request_version_conflict",
          currentVersion: Number(lockedRequest.version),
        };
      }
      const authorization = resolveProjectGovernanceAuthorization({
        action: "review_join_request",
        projectId: project.id,
        projectLifecycle: project.lifecycle,
        projectOwnerMembershipId: project.owner_membership_id,
        actorMembership: mapGovernanceMembership(actor),
        adminModeActive: false,
      });
      if (!authorization.allowed) {
        return { ok: false, reason: authorization.reason };
      }
      if (lockedRequest.status !== "pending") {
        return { ok: false, reason: "join_request_not_pending" };
      }
      const transition = resolveMembershipJoin(mapMembershipState(target), input.decision);
      if (!transition.ok) {
        return { ok: false, reason: transition.reason };
      }

      const nextMembershipVersion = Number(target.version) + 1;
      const userDefaults = transition.initializeProjectProfileFromUserDefaults
        ? await transaction
            .selectFrom("users")
            .select("default_introduction")
            .where("id", "=", target.user_id)
            .executeTakeFirstOrThrow()
        : undefined;
      await transaction
        .updateTable("memberships")
        .set({
          status: transition.nextStatus,
          permission_level: transition.nextPermissionLevel,
          has_been_active: target.has_been_active || input.decision === "approve",
          ...(userDefaults ? { introduction: userDefaults.default_introduction } : {}),
          version: String(nextMembershipVersion),
          updated_at: input.now,
        })
        .where("id", "=", target.id)
        .executeTakeFirstOrThrow();
      if (userDefaults) {
        const defaultRoles = await transaction
          .selectFrom("user_default_role_templates as default_role")
          .innerJoin("project_logical_roles as role", (join) =>
            join
              .onRef("role.source_template_id", "=", "default_role.template_id")
              .on("role.project_id", "=", project.id)
              .on("role.status", "=", "active"),
          )
          .select("role.id")
          .where("default_role.user_id", "=", target.user_id)
          .orderBy("role.id")
          .execute();
        if (defaultRoles.length > 0) {
          await transaction
            .insertInto("membership_logical_roles")
            .values(
              defaultRoles.map((role) => ({
                membership_id: target.id,
                project_id: project.id,
                role_id: role.id,
              })),
            )
            .onConflict((conflict) => conflict.columns(["membership_id", "role_id"]).doNothing())
            .execute();
        }
      }
      const nextRequestVersion = Number(lockedRequest.version) + 1;
      const resolvedRequest = await transaction
        .updateTable("membership_join_requests")
        .set({
          status: input.decision === "approve" ? "approved" : "rejected",
          resolved_by_membership_id: actor.id,
          resolved_at: input.now,
          version: String(nextRequestVersion),
          updated_at: input.now,
        })
        .where("id", "=", lockedRequest.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      if (input.decision === "reject") {
        await revokeAdminModes(transaction, {
          projectId: project.id,
          membershipId: target.id,
          now: input.now,
          reason: "membership_rejected",
        });
        await revokeWorkspaceLeases(transaction, {
          projectId: project.id,
          userId: target.user_id,
          now: input.now,
          reason: "membership_rejected",
        });
      }
      await writeM1Success(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        requestId: input.requestId,
        action: `membership.join_request.${input.decision}`,
        reasonCode:
          input.decision === "approve"
            ? "MEMBERSHIP_JOIN_REQUEST_APPROVED"
            : "MEMBERSHIP_JOIN_REQUEST_REJECTED",
        targetType: "membership_join_request",
        targetId: lockedRequest.id,
        beforeVersion: Number(lockedRequest.version),
        afterVersion: nextRequestVersion,
        audienceType: "project",
        audienceId: project.id,
        eventType:
          input.decision === "approve"
            ? "membership.join_request.approved"
            : "membership.join_request.rejected",
        payload: {
          requestId: lockedRequest.id,
          membershipId: target.id,
          membershipVersion: nextMembershipVersion,
        },
      });
      await writeM1Replay(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        operation: "membership_join_request_resolve",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
        response: {
          requestId: lockedRequest.id,
          membershipId: target.id,
          projectId: project.id,
        },
      });
      const mappedMembership = await findMembershipWithExecutor(transaction, project.id, target.id);
      if (!mappedMembership) {
        throw new Error("JOIN_RESOLUTION_MEMBERSHIP_MISSING");
      }
      return {
        ok: true,
        request: mapJoinRequest(resolvedRequest),
        membership: mappedMembership,
        idempotentReplay: false,
      };
    });
  }

  async updateMembershipProfile(input: {
    projectId: string;
    targetMembershipId: string;
    actorUserId: string;
    actorMembershipId: string;
    webSessionId: string;
    adminModeId?: string;
    introduction: string;
    roleIds: readonly string[];
    expectedMembershipVersion: number;
    requestId: string;
    now: Date;
  }): Promise<MembershipMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const project = await lockProject(transaction, input.projectId);
      if (!project) {
        return { ok: false, reason: "project_not_found" };
      }
      const memberships = await lockMemberships(transaction, input.projectId, [
        input.actorMembershipId,
        input.targetMembershipId,
      ]);
      const actor = memberships.find((membership) => membership.id === input.actorMembershipId);
      const target = memberships.find((membership) => membership.id === input.targetMembershipId);
      if (!actor || !target) {
        return { ok: false, reason: "membership_not_found" };
      }
      if (actor.user_id !== input.actorUserId) {
        return { ok: false, reason: "forbidden" };
      }
      if (Number(target.version) !== input.expectedMembershipVersion) {
        return {
          ok: false,
          reason: "membership_version_conflict",
          currentVersion: Number(target.version),
        };
      }
      const editingSelf = actor.id === target.id;
      let adminMode: AdminModeState | undefined;
      let adminModeDecision: ReturnType<typeof evaluateAdminMode> | undefined;
      if (!editingSelf && input.adminModeId) {
        const evaluated = await lockAndEvaluateAdminMode(transaction, {
          adminModeId: input.adminModeId,
          actorUserId: input.actorUserId,
          webSessionId: input.webSessionId,
          project,
          actor,
          now: input.now,
          requestId: input.requestId,
        });
        if (!evaluated.ok) {
          return { ok: false, reason: evaluated.reason };
        }
        adminMode = evaluated.state;
        adminModeDecision = evaluated.decision;
      }
      const authorization = resolveProjectGovernanceAuthorization({
        action: editingSelf ? "edit_own_membership_profile" : "edit_other_membership_profile",
        projectId: project.id,
        projectLifecycle: project.lifecycle,
        projectOwnerMembershipId: project.owner_membership_id,
        actorMembership: mapGovernanceMembership(actor),
        targetMembershipId: target.id,
        adminModeActive: adminModeDecision?.allowed ?? false,
      });
      if (!authorization.allowed) {
        return { ok: false, reason: authorization.reason };
      }
      if (target.status !== "active") {
        return { ok: false, reason: "membership_inactive" };
      }

      const roleIds = [...new Set(input.roleIds)].sort((left, right) =>
        left.localeCompare(right, "en"),
      );
      if (roleIds.length > 0) {
        const roles = await transaction
          .selectFrom("project_logical_roles")
          .select(["id", "status"])
          .where("project_id", "=", project.id)
          .where("id", "in", roleIds)
          .orderBy("id")
          .forUpdate()
          .execute();
        if (roles.length !== roleIds.length) {
          return { ok: false, reason: "role_not_found" };
        }
        if (roles.some((role) => role.status !== "active")) {
          return { ok: false, reason: "project_role_archived" };
        }
      }
      const nextVersion = Number(target.version) + 1;
      await transaction
        .updateTable("memberships")
        .set({
          introduction: input.introduction,
          version: String(nextVersion),
          updated_at: input.now,
        })
        .where("id", "=", target.id)
        .executeTakeFirstOrThrow();
      await transaction
        .deleteFrom("membership_logical_roles")
        .where("membership_id", "=", target.id)
        .execute();
      if (roleIds.length > 0) {
        await transaction
          .insertInto("membership_logical_roles")
          .values(
            roleIds.map((roleId) => ({
              membership_id: target.id,
              project_id: project.id,
              role_id: roleId,
            })),
          )
          .execute();
      }
      if (adminMode) {
        await renewAdminMode(transaction, adminMode, input.now);
      }
      await writeM1Success(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        requestId: input.requestId,
        action: "membership.profile.update",
        reasonCode: "MEMBERSHIP_PROFILE_UPDATED",
        targetType: "membership",
        targetId: target.id,
        beforeVersion: Number(target.version),
        afterVersion: nextVersion,
        audienceType: "project",
        audienceId: project.id,
        eventType: "membership.profile.updated",
        payload: { membershipId: target.id, version: nextVersion },
      });
      const membership = await findMembershipWithExecutor(transaction, project.id, target.id);
      if (!membership) {
        throw new Error("MEMBERSHIP_PROFILE_RESPONSE_MISSING");
      }
      return { ok: true, membership, idempotentReplay: false };
    });
  }

  async changeMembershipPermission(input: {
    projectId: string;
    targetMembershipId: string;
    actorUserId: string;
    actorMembershipId: string;
    permissionLevel: "admin" | "member";
    expectedProjectVersion: number;
    expectedMembershipVersion: number;
    requestId: string;
    idempotencyKey: string;
    requestSha256: string;
    now: Date;
  }): Promise<MembershipMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const project = await lockProject(transaction, input.projectId);
      if (!project) {
        return { ok: false, reason: "project_not_found" };
      }
      const memberships = await lockMemberships(transaction, input.projectId, [
        input.actorMembershipId,
        input.targetMembershipId,
      ]);
      const actor = memberships.find((membership) => membership.id === input.actorMembershipId);
      const target = memberships.find((membership) => membership.id === input.targetMembershipId);
      if (!actor || !target) {
        return { ok: false, reason: "membership_not_found" };
      }
      if (actor.user_id !== input.actorUserId) {
        return { ok: false, reason: "forbidden" };
      }
      await lockM1IdempotencyKey(transaction, {
        actorUserId: input.actorUserId,
        operation: "membership_permission_change",
        idempotencyKey: input.idempotencyKey,
      });
      const replay = await readM1Replay(transaction, {
        actorUserId: input.actorUserId,
        operation: "membership_permission_change",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
      });
      if (replay.status === "conflict") {
        return { ok: false, reason: "idempotency_conflict" };
      }
      if (replay.status === "replay") {
        const membership = await findMembershipWithExecutor(
          transaction,
          project.id,
          stringField(replay.response.membershipId, "membershipId"),
        );
        if (!membership) {
          throw new Error("MEMBERSHIP_PERMISSION_REPLAY_MISSING");
        }
        return { ok: true, membership, idempotentReplay: true };
      }
      if (Number(project.version) !== input.expectedProjectVersion) {
        return {
          ok: false,
          reason: "project_version_conflict",
          currentVersion: Number(project.version),
        };
      }
      if (Number(target.version) !== input.expectedMembershipVersion) {
        return {
          ok: false,
          reason: "membership_version_conflict",
          currentVersion: Number(target.version),
        };
      }
      const authorization = resolveProjectGovernanceAuthorization({
        action: "change_admin_permission",
        projectId: project.id,
        projectLifecycle: project.lifecycle,
        projectOwnerMembershipId: project.owner_membership_id,
        actorMembership: mapGovernanceMembership(actor),
        adminModeActive: false,
      });
      if (!authorization.allowed) {
        return { ok: false, reason: authorization.reason };
      }
      if (target.status !== "active") {
        return { ok: false, reason: "membership_inactive" };
      }
      const nextVersion = Number(target.version) + 1;
      await transaction
        .updateTable("memberships")
        .set({
          permission_level: input.permissionLevel,
          version: String(nextVersion),
          updated_at: input.now,
        })
        .where("id", "=", target.id)
        .executeTakeFirstOrThrow();
      if (input.permissionLevel === "member") {
        await revokeAdminModes(transaction, {
          projectId: project.id,
          membershipId: target.id,
          now: input.now,
          reason: "admin_permission_revoked",
        });
        await revokeWorkspaceLeases(transaction, {
          projectId: project.id,
          userId: target.user_id,
          now: input.now,
          reason: "admin_permission_revoked",
          includeTaskWorkspaces: false,
        });
      }
      await writeM1Success(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        requestId: input.requestId,
        action: "membership.permission.change",
        reasonCode: "MEMBERSHIP_PERMISSION_CHANGED",
        targetType: "membership",
        targetId: target.id,
        beforeVersion: Number(target.version),
        afterVersion: nextVersion,
        audienceType: "project",
        audienceId: project.id,
        eventType: "membership.permission.changed",
        payload: { membershipId: target.id, permissionLevel: input.permissionLevel },
      });
      await writeM1Replay(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        operation: "membership_permission_change",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
        response: { membershipId: target.id, version: nextVersion },
      });
      const membership = await findMembershipWithExecutor(transaction, project.id, target.id);
      if (!membership) {
        throw new Error("MEMBERSHIP_PERMISSION_RESPONSE_MISSING");
      }
      return { ok: true, membership, idempotentReplay: false };
    });
  }

  async previewMembershipRemoval(
    projectId: string,
    targetMembershipId: string,
  ): Promise<MembershipRemovalPreviewRecord | undefined> {
    return this.database.transaction().execute(async (transaction) => {
      const project = await transaction
        .selectFrom("projects")
        .select(["id", "owner_membership_id", "version"])
        .where("id", "=", projectId)
        .executeTakeFirst();
      const target = await transaction
        .selectFrom("memberships")
        .selectAll()
        .where("id", "=", targetMembershipId)
        .where("project_id", "=", projectId)
        .executeTakeFirst();
      if (!project || !target) {
        return undefined;
      }
      const facts = await loadRemovalFacts(transaction, projectId);
      const decision = previewMembershipRemoval({
        projectId,
        ownerMembershipId: project.owner_membership_id,
        targetMembership: mapMembershipState(target),
        tasks: facts.tasks,
        memberships: facts.memberships,
      });
      return {
        membershipId: target.id,
        blockingTasks: [...decision.blockers],
        canRemove: decision.ok,
        projectVersion: Number(project.version),
        membershipVersion: Number(target.version),
      };
    });
  }

  async removeMembership(input: {
    projectId: string;
    targetMembershipId: string;
    actorUserId: string;
    actorMembershipId: string;
    expectedProjectVersion: number;
    expectedMembershipVersion: number;
    confirmedBlockingTaskIds: readonly string[];
    requestId: string;
    idempotencyKey: string;
    requestSha256: string;
    now: Date;
  }): Promise<MembershipMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const project = await lockProject(transaction, input.projectId);
      if (!project) {
        return { ok: false, reason: "project_not_found" };
      }
      const memberships = await lockMemberships(transaction, input.projectId, [
        input.actorMembershipId,
        input.targetMembershipId,
      ]);
      const actor = memberships.find((membership) => membership.id === input.actorMembershipId);
      const target = memberships.find((membership) => membership.id === input.targetMembershipId);
      if (!actor || !target) {
        return { ok: false, reason: "membership_not_found" };
      }
      if (actor.user_id !== input.actorUserId) {
        return { ok: false, reason: "forbidden" };
      }
      await lockM1IdempotencyKey(transaction, {
        actorUserId: input.actorUserId,
        operation: "membership_remove",
        idempotencyKey: input.idempotencyKey,
      });
      const replay = await readM1Replay(transaction, {
        actorUserId: input.actorUserId,
        operation: "membership_remove",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
      });
      if (replay.status === "conflict") {
        return { ok: false, reason: "idempotency_conflict" };
      }
      if (replay.status === "replay") {
        const membership = await findMembershipWithExecutor(
          transaction,
          project.id,
          stringField(replay.response.membershipId, "membershipId"),
        );
        if (!membership) {
          throw new Error("MEMBERSHIP_REMOVE_REPLAY_MISSING");
        }
        return { ok: true, membership, idempotentReplay: true };
      }
      if (Number(project.version) !== input.expectedProjectVersion) {
        return {
          ok: false,
          reason: "project_version_conflict",
          currentVersion: Number(project.version),
        };
      }
      if (Number(target.version) !== input.expectedMembershipVersion) {
        return {
          ok: false,
          reason: "membership_version_conflict",
          currentVersion: Number(target.version),
        };
      }
      const authorization = resolveProjectGovernanceAuthorization({
        action: "remove_membership",
        projectId: project.id,
        projectLifecycle: project.lifecycle,
        projectOwnerMembershipId: project.owner_membership_id,
        actorMembership: mapGovernanceMembership(actor),
        adminModeActive: false,
      });
      if (!authorization.allowed) {
        return { ok: false, reason: authorization.reason };
      }

      const tasks = await transaction
        .selectFrom("tasks")
        .select([
          "id",
          "task_key",
          "project_id",
          "parent_task_id",
          "explicit_owner_membership_id",
          "base_status",
          "archived",
          "frozen",
        ])
        .where("project_id", "=", project.id)
        .orderBy("id")
        .forUpdate()
        .execute();
      const allMemberships = await transaction
        .selectFrom("memberships")
        .select(["id", "project_id", "status"])
        .where("project_id", "=", project.id)
        .orderBy("id")
        .execute();
      const decision = previewMembershipRemoval({
        projectId: project.id,
        ownerMembershipId: project.owner_membership_id,
        targetMembership: mapMembershipState(target),
        tasks: tasks.map(mapRemovalTask),
        memberships: allMemberships.map(mapOwnershipMembership),
      });
      if (!decision.ok) {
        return {
          ok: false,
          reason:
            decision.reason === "membership_not_active" ? "membership_inactive" : decision.reason,
          blockingTasks: [...decision.blockers],
        };
      }
      if (input.confirmedBlockingTaskIds.length !== 0) {
        return { ok: false, reason: "forbidden" };
      }

      const nextVersion = Number(target.version) + 1;
      await transaction
        .updateTable("memberships")
        .set({
          status: "removed",
          permission_level: "member",
          version: String(nextVersion),
          updated_at: input.now,
        })
        .where("id", "=", target.id)
        .executeTakeFirstOrThrow();
      await revokeAdminModes(transaction, {
        projectId: project.id,
        membershipId: target.id,
        now: input.now,
        reason: "membership_removed",
      });
      await revokeWorkspaceLeases(transaction, {
        projectId: project.id,
        userId: target.user_id,
        now: input.now,
        reason: "membership_removed",
      });
      await writeM1Success(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        requestId: input.requestId,
        action: "membership.remove",
        reasonCode: "MEMBERSHIP_REMOVED",
        targetType: "membership",
        targetId: target.id,
        beforeVersion: Number(target.version),
        afterVersion: nextVersion,
        audienceType: "project",
        audienceId: project.id,
        eventType: "membership.removed",
        payload: { membershipId: target.id, version: nextVersion },
      });
      await writeM1Replay(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        operation: "membership_remove",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
        response: { membershipId: target.id, version: nextVersion },
      });
      const membership = await findMembershipWithExecutor(transaction, project.id, target.id);
      if (!membership) {
        throw new Error("MEMBERSHIP_REMOVE_RESPONSE_MISSING");
      }
      return { ok: true, membership, idempotentReplay: false };
    });
  }

  async changeProjectLifecycle(input: {
    projectId: string;
    actorUserId: string;
    actorMembershipId: string;
    lifecycle: "active" | "archived";
    expectedProjectVersion: number;
    requestId: string;
    idempotencyKey: string;
    requestSha256: string;
    now: Date;
  }): Promise<ProjectMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const project = await lockProject(transaction, input.projectId);
      if (!project) {
        return { ok: false, reason: "project_not_found" };
      }
      const [actor] = await lockMemberships(transaction, input.projectId, [
        input.actorMembershipId,
      ]);
      if (!actor) {
        return { ok: false, reason: "membership_not_found" };
      }
      if (actor.user_id !== input.actorUserId) {
        return { ok: false, reason: "forbidden" };
      }
      await lockM1IdempotencyKey(transaction, {
        actorUserId: input.actorUserId,
        operation: "project_lifecycle_change",
        idempotencyKey: input.idempotencyKey,
      });
      const replay = await readM1Replay(transaction, {
        actorUserId: input.actorUserId,
        operation: "project_lifecycle_change",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
      });
      if (replay.status === "conflict") {
        return { ok: false, reason: "idempotency_conflict" };
      }
      if (replay.status === "replay") {
        const replayed = await findProjectByIdWithExecutor(transaction, project.id);
        if (!replayed) {
          throw new Error("PROJECT_LIFECYCLE_REPLAY_MISSING");
        }
        return { ok: true, project: replayed, idempotentReplay: true };
      }
      if (Number(project.version) !== input.expectedProjectVersion) {
        return {
          ok: false,
          reason: "project_version_conflict",
          currentVersion: Number(project.version),
        };
      }
      const authorization = resolveProjectGovernanceAuthorization({
        action: input.lifecycle === "archived" ? "archive_project" : "unarchive_project",
        projectId: project.id,
        projectLifecycle: project.lifecycle,
        projectOwnerMembershipId: project.owner_membership_id,
        actorMembership: mapGovernanceMembership(actor),
        adminModeActive: false,
      });
      if (!authorization.allowed) {
        return { ok: false, reason: authorization.reason };
      }
      const transition = resolveProjectLifecycleTransition({
        current: project.lifecycle,
        requested: input.lifecycle,
      });
      if (!transition.ok) {
        return { ok: false, reason: transition.reason };
      }
      const nextVersion = Number(project.version) + 1;
      await transaction
        .updateTable("projects")
        .set({
          lifecycle: transition.next,
          version: String(nextVersion),
          updated_at: input.now,
        })
        .where("id", "=", project.id)
        .executeTakeFirstOrThrow();
      if (transition.revokeProjectCapabilities) {
        await revokeAdminModes(transaction, {
          projectId: project.id,
          now: input.now,
          reason: "project_archived",
        });
        await revokeWorkspaceLeases(transaction, {
          projectId: project.id,
          now: input.now,
          reason: "project_archived",
        });
      }
      await writeM1Success(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        requestId: input.requestId,
        action: `project.${transition.next}`,
        reasonCode: transition.next === "archived" ? "PROJECT_ARCHIVED" : "PROJECT_UNARCHIVED",
        targetType: "project",
        targetId: project.id,
        beforeVersion: Number(project.version),
        afterVersion: nextVersion,
        audienceType: "project",
        audienceId: project.id,
        eventType: `project.${transition.next}`,
        payload: { projectId: project.id, lifecycle: transition.next, version: nextVersion },
      });
      await writeM1Replay(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        operation: "project_lifecycle_change",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
        response: { projectId: project.id, version: nextVersion },
      });
      const mapped = await findProjectByIdWithExecutor(transaction, project.id);
      if (!mapped) {
        throw new Error("PROJECT_LIFECYCLE_RESPONSE_MISSING");
      }
      return { ok: true, project: mapped, idempotentReplay: false };
    });
  }

  async createOwnershipTransfer(input: {
    transferId?: string;
    projectId: string;
    actorUserId: string;
    actorMembershipId: string;
    targetMembershipId: string;
    expectedProjectVersion: number;
    expectedTargetMembershipVersion: number;
    requestId: string;
    idempotencyKey: string;
    requestSha256: string;
    now: Date;
  }): Promise<OwnershipTransferMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const project = await lockProject(transaction, input.projectId);
      if (!project) {
        return { ok: false, reason: "project_not_found" };
      }
      const memberships = await lockMemberships(transaction, input.projectId, [
        input.actorMembershipId,
        input.targetMembershipId,
      ]);
      const actor = memberships.find((membership) => membership.id === input.actorMembershipId);
      const target = memberships.find((membership) => membership.id === input.targetMembershipId);
      if (!actor || !target) {
        return { ok: false, reason: "membership_not_found" };
      }
      if (actor.user_id !== input.actorUserId) {
        return { ok: false, reason: "forbidden" };
      }
      await lockM1IdempotencyKey(transaction, {
        actorUserId: input.actorUserId,
        operation: "ownership_transfer_create",
        idempotencyKey: input.idempotencyKey,
      });
      const replay = await readM1Replay(transaction, {
        actorUserId: input.actorUserId,
        operation: "ownership_transfer_create",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
      });
      if (replay.status === "conflict") {
        return { ok: false, reason: "idempotency_conflict" };
      }
      if (replay.status === "replay") {
        const transfer = await findTransferWithExecutor(
          transaction,
          project.id,
          stringField(replay.response.transferId, "transferId"),
        );
        if (!transfer) {
          throw new Error("OWNERSHIP_TRANSFER_REPLAY_MISSING");
        }
        return { ok: true, transfer, idempotentReplay: true };
      }
      if (Number(project.version) !== input.expectedProjectVersion) {
        return {
          ok: false,
          reason: "project_version_conflict",
          currentVersion: Number(project.version),
        };
      }
      if (Number(target.version) !== input.expectedTargetMembershipVersion) {
        return {
          ok: false,
          reason: "membership_version_conflict",
          currentVersion: Number(target.version),
        };
      }
      const pending = await transaction
        .selectFrom("project_ownership_transfer_requests")
        .select("id")
        .where("project_id", "=", project.id)
        .where("status", "=", "pending")
        .executeTakeFirst();
      const decision = resolveOwnershipTransferCreation({
        projectId: project.id,
        currentOwnerMembershipId: project.owner_membership_id,
        actorMembershipId: actor.id,
        targetMembership: mapGovernanceMembership(target),
        existingPending: Boolean(pending),
      });
      if (!decision.ok) {
        return { ok: false, reason: decision.reason };
      }
      const transfer = await transaction
        .insertInto("project_ownership_transfer_requests")
        .values({
          id: input.transferId ?? randomUUID(),
          project_id: project.id,
          from_owner_membership_id: decision.fromOwnerMembershipId,
          target_membership_id: decision.targetMembershipId,
          idempotency_key: input.idempotencyKey,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeM1Success(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        requestId: input.requestId,
        action: "ownership_transfer.create",
        reasonCode: "OWNERSHIP_TRANSFER_CREATED",
        targetType: "ownership_transfer",
        targetId: transfer.id,
        beforeVersion: null,
        afterVersion: 1,
        audienceType: "project",
        audienceId: project.id,
        eventType: "ownership_transfer.created",
        payload: { transferId: transfer.id, targetMembershipId: target.id },
      });
      await writeM1Replay(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        operation: "ownership_transfer_create",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
        response: { transferId: transfer.id },
      });
      return {
        ok: true,
        transfer: mapOwnershipTransfer(transfer),
        idempotentReplay: false,
      };
    });
  }

  async resolveOwnershipTransfer(input: {
    projectId: string;
    transferId: string;
    actorUserId: string;
    actorMembershipId: string;
    action: "accept" | "reject" | "cancel";
    expectedProjectVersion: number;
    expectedTransferVersion: number;
    requestId: string;
    idempotencyKey: string;
    requestSha256: string;
    now: Date;
  }): Promise<OwnershipTransferMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const project = await lockProject(transaction, input.projectId);
      if (!project) {
        return { ok: false, reason: "project_not_found" };
      }
      const transferRead = await transaction
        .selectFrom("project_ownership_transfer_requests")
        .selectAll()
        .where("id", "=", input.transferId)
        .where("project_id", "=", project.id)
        .executeTakeFirst();
      if (!transferRead) {
        return { ok: false, reason: "ownership_transfer_not_found" };
      }
      const memberships = await lockMemberships(transaction, project.id, [
        input.actorMembershipId,
        transferRead.from_owner_membership_id,
        transferRead.target_membership_id,
      ]);
      const actor = memberships.find((membership) => membership.id === input.actorMembershipId);
      const target = memberships.find(
        (membership) => membership.id === transferRead.target_membership_id,
      );
      if (!actor || !target) {
        return { ok: false, reason: "membership_not_found" };
      }
      if (actor.user_id !== input.actorUserId) {
        return { ok: false, reason: "forbidden" };
      }
      const transfer = await transaction
        .selectFrom("project_ownership_transfer_requests")
        .selectAll()
        .where("id", "=", input.transferId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      await lockM1IdempotencyKey(transaction, {
        actorUserId: input.actorUserId,
        operation: "ownership_transfer_resolve",
        idempotencyKey: input.idempotencyKey,
      });
      const replay = await readM1Replay(transaction, {
        actorUserId: input.actorUserId,
        operation: "ownership_transfer_resolve",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
      });
      if (replay.status === "conflict") {
        return { ok: false, reason: "idempotency_conflict" };
      }
      if (replay.status === "replay") {
        const replayed = await findTransferWithExecutor(
          transaction,
          project.id,
          stringField(replay.response.transferId, "transferId"),
        );
        if (!replayed) {
          throw new Error("OWNERSHIP_TRANSFER_RESOLVE_REPLAY_MISSING");
        }
        return { ok: true, transfer: replayed, idempotentReplay: true };
      }
      if (Number(project.version) !== input.expectedProjectVersion) {
        return {
          ok: false,
          reason: "project_version_conflict",
          currentVersion: Number(project.version),
        };
      }
      if (Number(transfer.version) !== input.expectedTransferVersion) {
        return {
          ok: false,
          reason: "transfer_version_conflict",
          currentVersion: Number(transfer.version),
        };
      }
      const decision = resolveOwnershipTransfer({
        transfer: mapOwnershipTransferState(transfer),
        action: input.action,
        actorMembershipId: actor.id,
        projectLifecycle: project.lifecycle,
        currentOwnerMembershipId: project.owner_membership_id,
        targetMembership: mapGovernanceMembership(target),
      });
      if (!decision.ok) {
        if (decision.reason === "ownership_transfer_stale" && transfer.status === "pending") {
          await transaction
            .updateTable("project_ownership_transfer_requests")
            .set({
              status: "stale",
              version: (expression) => expression("version", "+", "1"),
              resolved_at: input.now,
              updated_at: input.now,
            })
            .where("id", "=", transfer.id)
            .execute();
        }
        return { ok: false, reason: decision.reason };
      }
      const nextTransferVersion = Number(transfer.version) + 1;
      const nextProjectVersion =
        input.action === "accept" ? Number(project.version) + 1 : Number(project.version);
      if (input.action === "accept") {
        await transaction
          .updateTable("projects")
          .set({
            owner_membership_id: decision.nextOwnerMembershipId,
            version: String(nextProjectVersion),
            updated_at: input.now,
          })
          .where("id", "=", project.id)
          .executeTakeFirstOrThrow();
        await revokeAdminModes(transaction, {
          projectId: project.id,
          now: input.now,
          reason: "ownership_transferred",
        });
        await revokeWorkspaceLeases(transaction, {
          projectId: project.id,
          now: input.now,
          reason: "ownership_transferred",
          includeTaskWorkspaces: false,
        });
      }
      const resolved = await transaction
        .updateTable("project_ownership_transfer_requests")
        .set({
          status:
            input.action === "accept"
              ? "accepted"
              : input.action === "reject"
                ? "rejected"
                : "cancelled",
          version: String(nextTransferVersion),
          resolved_at: input.now,
          updated_at: input.now,
        })
        .where("id", "=", transfer.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeM1Success(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        requestId: input.requestId,
        action: `ownership_transfer.${input.action}`,
        reasonCode:
          input.action === "accept"
            ? "OWNERSHIP_TRANSFER_ACCEPTED"
            : input.action === "reject"
              ? "OWNERSHIP_TRANSFER_REJECTED"
              : "OWNERSHIP_TRANSFER_CANCELLED",
        targetType: "ownership_transfer",
        targetId: transfer.id,
        beforeVersion: Number(transfer.version),
        afterVersion: nextTransferVersion,
        audienceType: "project",
        audienceId: project.id,
        eventType:
          input.action === "accept"
            ? "ownership_transfer.accepted"
            : input.action === "reject"
              ? "ownership_transfer.rejected"
              : "ownership_transfer.cancelled",
        payload: {
          transferId: transfer.id,
          ownerMembershipId: decision.nextOwnerMembershipId,
          projectVersion: nextProjectVersion,
        },
      });
      await writeM1Replay(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        operation: "ownership_transfer_resolve",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
        response: { transferId: transfer.id },
      });
      return {
        ok: true,
        transfer: mapOwnershipTransfer(resolved),
        idempotentReplay: false,
      };
    });
  }

  async openAdminMode(input: {
    adminModeId?: string;
    projectId: string;
    actorUserId: string;
    actorMembershipId: string;
    webSessionId: string;
    expectedMembershipVersion: number;
    requestId: string;
    idempotencyKey: string;
    requestSha256: string;
    now: Date;
  }): Promise<AdminModeMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const project = await lockProject(transaction, input.projectId);
      if (!project) {
        return { ok: false, reason: "project_not_found" };
      }
      const [membership] = await lockMemberships(transaction, input.projectId, [
        input.actorMembershipId,
      ]);
      if (!membership) {
        return { ok: false, reason: "membership_not_found" };
      }
      if (membership.user_id !== input.actorUserId) {
        return { ok: false, reason: "forbidden" };
      }
      await lockM1IdempotencyKey(transaction, {
        actorUserId: input.actorUserId,
        operation: "admin_mode_open",
        idempotencyKey: input.idempotencyKey,
      });
      const replay = await readM1Replay(transaction, {
        actorUserId: input.actorUserId,
        operation: "admin_mode_open",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
      });
      if (replay.status === "conflict") {
        return { ok: false, reason: "idempotency_conflict" };
      }
      if (replay.status === "replay") {
        const adminMode = await findAdminModeWithExecutor(
          transaction,
          stringField(replay.response.adminModeId, "adminModeId"),
        );
        if (!adminMode) {
          throw new Error("ADMIN_MODE_REPLAY_MISSING");
        }
        return { ok: true, adminMode, idempotentReplay: true };
      }
      if (Number(membership.version) !== input.expectedMembershipVersion) {
        return {
          ok: false,
          reason: "membership_version_conflict",
          currentVersion: Number(membership.version),
        };
      }
      const webSession = await transaction
        .selectFrom("web_sessions")
        .select(["id", "user_id", "expires_at", "revoked_at"])
        .where("id", "=", input.webSessionId)
        .forUpdate()
        .executeTakeFirst();
      if (
        !webSession ||
        webSession.user_id !== input.actorUserId ||
        webSession.revoked_at ||
        webSession.expires_at.getTime() <= input.now.getTime()
      ) {
        return { ok: false, reason: "web_session_inactive" };
      }
      const decision = openAdminMode({
        id: input.adminModeId ?? randomUUID(),
        webSessionId: webSession.id,
        projectId: project.id,
        membership: mapGovernanceMembership(membership),
        ownerMembershipId: project.owner_membership_id,
        projectLifecycle: project.lifecycle,
        now: input.now,
      });
      if (!decision.ok) {
        return { ok: false, reason: decision.reason };
      }
      await revokeAdminModes(transaction, {
        projectId: project.id,
        webSessionId: webSession.id,
        now: input.now,
        reason: "replaced",
      });
      const inserted = await transaction
        .insertInto("admin_mode_sessions")
        .values({
          id: decision.state.id,
          web_session_id: decision.state.webSessionId,
          project_id: decision.state.projectId,
          membership_id: decision.state.membershipId,
          status: decision.state.status,
          issued_at: decision.state.issuedAt,
          last_protected_activity_at: decision.state.lastProtectedActivityAt,
          expires_at: decision.state.expiresAt,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeM1Success(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        requestId: input.requestId,
        action: "admin_mode.open",
        reasonCode: "ADMIN_MODE_OPENED",
        targetType: "admin_mode",
        targetId: inserted.id,
        beforeVersion: null,
        afterVersion: 1,
        audienceType: "user",
        audienceId: input.actorUserId,
        eventType: "admin_mode.opened",
        payload: { adminModeId: inserted.id, projectId: project.id },
      });
      await writeM1Replay(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        operation: "admin_mode_open",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
        response: { adminModeId: inserted.id },
      });
      return {
        ok: true,
        adminMode: mapAdminMode(inserted),
        idempotentReplay: false,
      };
    });
  }

  async readAdminMode(input: {
    adminModeId: string;
    actorUserId: string;
    webSessionId: string;
    now: Date;
    requestId: string;
  }): Promise<AdminModeMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const read = await transaction
        .selectFrom("admin_mode_sessions")
        .select(["project_id", "membership_id"])
        .where("id", "=", input.adminModeId)
        .executeTakeFirst();
      if (!read) {
        return { ok: false, reason: "admin_mode_not_found" };
      }
      const project = await lockProject(transaction, read.project_id);
      if (!project) {
        return { ok: false, reason: "project_not_found" };
      }
      const [membership] = await lockMemberships(transaction, project.id, [read.membership_id]);
      if (!membership) {
        return { ok: false, reason: "membership_not_found" };
      }
      const evaluated = await lockAndEvaluateAdminMode(transaction, {
        adminModeId: input.adminModeId,
        actorUserId: input.actorUserId,
        webSessionId: input.webSessionId,
        project,
        actor: membership,
        now: input.now,
        requestId: input.requestId,
      });
      if (!evaluated.ok && !evaluated.adminMode) {
        return { ok: false, reason: evaluated.reason };
      }
      return {
        ok: true,
        adminMode: evaluated.adminMode ?? mapAdminModeState(evaluated.state),
        idempotentReplay: false,
      };
    });
  }

  async closeAdminMode(input: {
    adminModeId: string;
    actorUserId: string;
    webSessionId: string;
    expectedVersion: number;
    requestId: string;
    now: Date;
  }): Promise<AdminModeMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const read = await transaction
        .selectFrom("admin_mode_sessions")
        .select(["project_id", "membership_id"])
        .where("id", "=", input.adminModeId)
        .executeTakeFirst();
      if (!read) {
        return { ok: false, reason: "admin_mode_not_found" };
      }
      const project = await lockProject(transaction, read.project_id);
      if (!project) {
        return { ok: false, reason: "project_not_found" };
      }
      const [membership] = await lockMemberships(transaction, project.id, [read.membership_id]);
      if (!membership) {
        return { ok: false, reason: "membership_not_found" };
      }
      const adminMode = await transaction
        .selectFrom("admin_mode_sessions")
        .selectAll()
        .where("id", "=", input.adminModeId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (
        adminMode.web_session_id !== input.webSessionId ||
        membership.user_id !== input.actorUserId
      ) {
        return { ok: false, reason: "admin_mode_scope_mismatch" };
      }
      if (Number(adminMode.version) !== input.expectedVersion) {
        return {
          ok: false,
          reason: "admin_mode_version_conflict",
          currentVersion: Number(adminMode.version),
        };
      }
      if (adminMode.status !== "active") {
        return { ok: false, reason: "admin_mode_not_active" };
      }
      const nextVersion = Number(adminMode.version) + 1;
      const closed = await transaction
        .updateTable("admin_mode_sessions")
        .set({
          status: "closed",
          revoked_reason: "closed_by_user",
          version: String(nextVersion),
          updated_at: input.now,
        })
        .where("id", "=", adminMode.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeM1Success(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        requestId: input.requestId,
        action: "admin_mode.close",
        reasonCode: "ADMIN_MODE_CLOSED",
        targetType: "admin_mode",
        targetId: adminMode.id,
        beforeVersion: Number(adminMode.version),
        afterVersion: nextVersion,
        audienceType: "user",
        audienceId: input.actorUserId,
        eventType: "admin_mode.closed",
        payload: { adminModeId: adminMode.id },
      });
      return {
        ok: true,
        adminMode: mapAdminMode(closed),
        idempotentReplay: false,
      };
    });
  }
}

async function replayJoinRequest(
  transaction: Transaction<DatabaseSchema>,
  response: Record<string, unknown>,
): Promise<JoinRequestMutationResult> {
  const projectId = stringField(response.projectId, "projectId");
  const requestId = stringField(response.requestId, "requestId");
  const membershipId = stringField(response.membershipId, "membershipId");
  const request = await transaction
    .selectFrom("membership_join_requests")
    .selectAll()
    .where("id", "=", requestId)
    .executeTakeFirst();
  const membership = await findMembershipWithExecutor(transaction, projectId, membershipId);
  if (!request || !membership) {
    throw new Error("JOIN_REQUEST_REPLAY_MISSING");
  }
  return {
    ok: true,
    request: mapJoinRequest(request),
    membership,
    idempotentReplay: true,
  };
}

async function findProjectByIdWithExecutor(
  executor: Kysely<DatabaseSchema> | Transaction<DatabaseSchema>,
  projectId: string,
): Promise<ProjectRecord | undefined> {
  const row = await executor
    .selectFrom("projects as project")
    .innerJoin("workspaces as workspace", (join) =>
      join
        .on("workspace.scope_type", "=", "project")
        .onRef("workspace.scope_id", "=", "project.id"),
    )
    .select([
      "project.id",
      "project.project_key",
      "project.name",
      "project.description",
      "project.owner_membership_id",
      "project.completed_successor_reopen_policy",
      "project.lifecycle",
      "project.version",
      "workspace.id as workspace_id",
    ])
    .where("project.id", "=", projectId)
    .executeTakeFirst();
  return row ? mapProject(row) : undefined;
}

async function findMembershipWithExecutor(
  executor: Kysely<DatabaseSchema> | Transaction<DatabaseSchema>,
  projectId: string,
  membershipId: string,
): Promise<MembershipRecord | undefined> {
  const row = await executor
    .selectFrom("memberships as membership")
    .innerJoin("users as user", "user.id", "membership.user_id")
    .select([
      "membership.id",
      "membership.project_id",
      "membership.user_id",
      "membership.permission_level",
      "membership.status",
      "membership.introduction",
      "membership.version",
      "membership.has_been_active",
      "user.display_name",
    ])
    .where("membership.project_id", "=", projectId)
    .where("membership.id", "=", membershipId)
    .executeTakeFirst();
  if (!row) {
    return undefined;
  }
  const roleIds = await readMembershipRoleIds(executor, [row.id]);
  return mapMembership(row, roleIds.get(row.id) ?? []);
}

async function readMembershipRoleIds(
  executor: Kysely<DatabaseSchema> | Transaction<DatabaseSchema>,
  membershipIds: readonly string[],
) {
  if (membershipIds.length === 0) {
    return new Map<string, string[]>();
  }
  const rows = await executor
    .selectFrom("membership_logical_roles")
    .select(["membership_id", "role_id"])
    .where("membership_id", "in", [...membershipIds])
    .orderBy("membership_id")
    .orderBy("role_id")
    .execute();
  const byMembership = new Map<string, string[]>();
  for (const row of rows) {
    const values = byMembership.get(row.membership_id) ?? [];
    values.push(row.role_id);
    byMembership.set(row.membership_id, values);
  }
  return byMembership;
}

async function findTransferWithExecutor(
  executor: Kysely<DatabaseSchema> | Transaction<DatabaseSchema>,
  projectId: string,
  transferId: string,
) {
  const row = await executor
    .selectFrom("project_ownership_transfer_requests")
    .selectAll()
    .where("project_id", "=", projectId)
    .where("id", "=", transferId)
    .executeTakeFirst();
  return row ? mapOwnershipTransfer(row) : undefined;
}

async function findAdminModeWithExecutor(
  executor: Kysely<DatabaseSchema> | Transaction<DatabaseSchema>,
  adminModeId: string,
) {
  const row = await executor
    .selectFrom("admin_mode_sessions")
    .selectAll()
    .where("id", "=", adminModeId)
    .executeTakeFirst();
  return row ? mapAdminMode(row) : undefined;
}

export async function lockProject(transaction: Transaction<DatabaseSchema>, projectId: string) {
  return transaction
    .selectFrom("projects")
    .selectAll()
    .where("id", "=", projectId)
    .forUpdate()
    .executeTakeFirst();
}

async function loadRemovalFacts(
  executor: Kysely<DatabaseSchema> | Transaction<DatabaseSchema>,
  projectId: string,
) {
  const tasks = await executor
    .selectFrom("tasks")
    .select([
      "id",
      "task_key",
      "project_id",
      "parent_task_id",
      "explicit_owner_membership_id",
      "base_status",
      "archived",
      "frozen",
    ])
    .where("project_id", "=", projectId)
    .orderBy("task_key")
    .execute();
  const memberships = await executor
    .selectFrom("memberships")
    .select(["id", "project_id", "status"])
    .where("project_id", "=", projectId)
    .orderBy("id")
    .execute();
  return {
    tasks: tasks.map(mapRemovalTask),
    memberships: memberships.map(mapOwnershipMembership),
  };
}

async function insertWorkspace(
  transaction: Transaction<DatabaseSchema>,
  id: string,
  scopeType: "user" | "project" | "task",
  scopeId: string,
) {
  await transaction
    .insertInto("workspaces")
    .values({ id, scope_type: scopeType, scope_id: scopeId })
    .execute();
  await transaction
    .insertInto("workspace_versions")
    .values({
      workspace_id: id,
      sync_version: "0",
      manifest_sha256: EMPTY_MANIFEST_HASH,
      created_by_user_id: null,
      device_id: null,
      lease_id: null,
    })
    .execute();
}

export async function lockAndEvaluateAdminMode(
  transaction: Transaction<DatabaseSchema>,
  input: {
    adminModeId: string;
    actorUserId: string;
    webSessionId: string;
    project: {
      id: string;
      lifecycle: "active" | "archived";
      owner_membership_id: string;
    };
    actor: {
      id: string;
      project_id: string;
      user_id: string;
      permission_level: "admin" | "member";
      status: "pending" | "active" | "removed";
    };
    now: Date;
    requestId: string;
  },
): Promise<
  | {
      ok: true;
      state: AdminModeState;
      decision: Extract<ReturnType<typeof evaluateAdminMode>, { allowed: true }>;
      adminMode: AdminModeRecord;
    }
  | {
      ok: false;
      reason: MutationFailureReason;
      state: AdminModeState;
      adminMode?: AdminModeRecord;
    }
> {
  if (input.actor.user_id !== input.actorUserId) {
    return {
      ok: false,
      reason: "forbidden",
      state: {
        id: input.adminModeId,
        webSessionId: input.webSessionId,
        projectId: input.project.id,
        membershipId: input.actor.id,
        status: "revoked",
        issuedAt: input.now,
        lastProtectedActivityAt: input.now,
        expiresAt: input.now,
        version: 1,
      },
    };
  }
  const row = await transaction
    .selectFrom("admin_mode_sessions")
    .selectAll()
    .where("id", "=", input.adminModeId)
    .forUpdate()
    .executeTakeFirst();
  if (!row) {
    return {
      ok: false,
      reason: "admin_mode_not_found",
      state: {
        id: input.adminModeId,
        webSessionId: input.webSessionId,
        projectId: input.project.id,
        membershipId: input.actor.id,
        status: "revoked",
        issuedAt: input.now,
        lastProtectedActivityAt: input.now,
        expiresAt: input.now,
        version: 1,
      },
    };
  }
  const state = mapAdminModeState(mapAdminMode(row));
  const webSession = await transaction
    .selectFrom("web_sessions")
    .select(["id", "user_id", "expires_at", "revoked_at"])
    .where("id", "=", input.webSessionId)
    .executeTakeFirst();
  const webSessionActive = Boolean(
    webSession &&
    webSession.user_id === input.actorUserId &&
    !webSession.revoked_at &&
    webSession.expires_at.getTime() > input.now.getTime(),
  );
  const decision = evaluateAdminMode({
    state,
    webSessionId: input.webSessionId,
    webSessionActive,
    projectId: input.project.id,
    projectLifecycle: input.project.lifecycle,
    membership: mapGovernanceMembership(input.actor),
    ownerMembershipId: input.project.owner_membership_id,
    now: input.now,
  });
  if (!decision.allowed) {
    if (row.status === "active") {
      const nextVersion = Number(row.version) + 1;
      const updated = await transaction
        .updateTable("admin_mode_sessions")
        .set({
          status: decision.effectiveStatus,
          revoked_reason: decision.reason,
          version: String(nextVersion),
          updated_at: input.now,
        })
        .where("id", "=", row.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeM1Success(transaction, {
        actorUserId: input.actorUserId,
        projectId: input.project.id,
        requestId: input.requestId,
        action: "admin_mode.invalidate",
        reasonCode: decision.reason.toUpperCase(),
        targetType: "admin_mode",
        targetId: row.id,
        beforeVersion: Number(row.version),
        afterVersion: nextVersion,
        audienceType: "user",
        audienceId: input.actorUserId,
        eventType: `admin_mode.${decision.effectiveStatus}`,
        payload: { adminModeId: row.id, status: decision.effectiveStatus },
      });
      return {
        ok: false,
        reason: decision.reason,
        state: mapAdminModeState(mapAdminMode(updated)),
        adminMode: mapAdminMode(updated),
      };
    }
    return {
      ok: false,
      reason: decision.reason,
      state,
      adminMode: mapAdminMode(row),
    };
  }
  return {
    ok: true,
    state,
    decision,
    adminMode: mapAdminMode(row),
  };
}

export async function renewAdminMode(
  transaction: Transaction<DatabaseSchema>,
  state: AdminModeState,
  now: Date,
) {
  const nextVersion = state.version + 1;
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1_000);
  await transaction
    .updateTable("admin_mode_sessions")
    .set({
      last_protected_activity_at: now,
      expires_at: expiresAt,
      version: String(nextVersion),
      updated_at: now,
    })
    .where("id", "=", state.id)
    .where("status", "=", "active")
    .executeTakeFirstOrThrow();
}

function mapProject(row: {
  id: string;
  project_key: string;
  name: string;
  description: string;
  owner_membership_id: string;
  workspace_id: string;
  completed_successor_reopen_policy: "deny" | "cascade";
  lifecycle: "active" | "archived";
  version: string;
}): ProjectRecord {
  return {
    id: row.id,
    key: row.project_key,
    name: row.name,
    description: row.description,
    ownerMembershipId: row.owner_membership_id,
    workspaceId: row.workspace_id,
    completedSuccessorReopenPolicy: row.completed_successor_reopen_policy,
    lifecycle: row.lifecycle,
    version: Number(row.version),
  };
}

function mapMembership(
  row: {
    id: string;
    project_id: string;
    user_id: string;
    display_name: string;
    permission_level: "admin" | "member";
    status: "pending" | "active" | "removed";
    introduction: string;
    version: string;
    has_been_active: boolean;
  },
  roleIds: string[],
): MembershipRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    displayName: row.display_name,
    permissionLevel: row.permission_level,
    status: row.status,
    introduction: row.introduction,
    roleIds,
    version: Number(row.version),
    hasBeenActive: row.has_been_active,
  };
}

function mapMembershipState(row: {
  id: string;
  project_id: string;
  user_id: string;
  permission_level: "admin" | "member";
  status: "pending" | "active" | "removed";
  has_been_active: boolean;
}): MembershipState {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    permissionLevel: row.permission_level,
    status: row.status,
    hasBeenActive: row.has_been_active,
  };
}

function mapGovernanceMembership(row: {
  id: string;
  project_id: string;
  permission_level: "admin" | "member";
  status: "pending" | "active" | "removed";
}): GovernanceMembership {
  return {
    id: row.id,
    projectId: row.project_id,
    permissionLevel: row.permission_level,
    status: row.status,
  };
}

function mapOwnershipMembership(row: {
  id: string;
  project_id: string;
  status: "pending" | "active" | "removed";
}): OwnershipMembership {
  return { id: row.id, projectId: row.project_id, status: row.status };
}

function mapRemovalTask(row: {
  id: string;
  task_key: string;
  project_id: string;
  parent_task_id: string | null;
  explicit_owner_membership_id: string | null;
  base_status: "not_started" | "in_progress" | "done";
  archived: boolean;
  frozen: boolean;
}): MembershipRemovalTask {
  return {
    id: row.id,
    key: row.task_key,
    projectId: row.project_id,
    parentTaskId: row.parent_task_id,
    explicitOwnerMembershipId: row.explicit_owner_membership_id,
    status: row.base_status,
    lifecycle: row.archived ? "archived" : row.frozen ? "frozen" : "active",
  };
}

function mapJoinRequest(row: {
  id: string;
  project_id: string;
  membership_id: string;
  requested_by_user_id: string;
  status: "pending" | "approved" | "rejected" | "stale";
  version: string;
  created_at: Date;
  resolved_at: Date | null;
}): JoinRequestRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    membershipId: row.membership_id,
    requestedByUserId: row.requested_by_user_id,
    status: row.status,
    version: Number(row.version),
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function mapOwnershipTransfer(row: {
  id: string;
  project_id: string;
  from_owner_membership_id: string;
  target_membership_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "stale";
  version: string;
  created_at: Date;
  resolved_at: Date | null;
}): OwnershipTransferRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    fromOwnerMembershipId: row.from_owner_membership_id,
    targetMembershipId: row.target_membership_id,
    status: row.status,
    version: Number(row.version),
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function mapOwnershipTransferState(row: {
  id: string;
  project_id: string;
  from_owner_membership_id: string;
  target_membership_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "stale";
  version: string;
}): OwnershipTransferState {
  return {
    id: row.id,
    projectId: row.project_id,
    fromOwnerMembershipId: row.from_owner_membership_id,
    targetMembershipId: row.target_membership_id,
    status: row.status,
    version: Number(row.version),
  };
}

function mapAdminMode(row: {
  id: string;
  web_session_id: string;
  project_id: string;
  membership_id: string;
  status: "active" | "closed" | "expired" | "revoked";
  issued_at: Date;
  last_protected_activity_at: Date;
  expires_at: Date;
  version: string;
}): AdminModeRecord {
  return {
    id: row.id,
    webSessionId: row.web_session_id,
    projectId: row.project_id,
    membershipId: row.membership_id,
    status: row.status,
    issuedAt: row.issued_at,
    lastProtectedActivityAt: row.last_protected_activity_at,
    expiresAt: row.expires_at,
    version: Number(row.version),
  };
}

function mapAdminModeState(record: AdminModeRecord): AdminModeState {
  return {
    id: record.id,
    webSessionId: record.webSessionId,
    projectId: record.projectId,
    membershipId: record.membershipId,
    status: record.status,
    issuedAt: record.issuedAt,
    lastProtectedActivityAt: record.lastProtectedActivityAt,
    expiresAt: record.expiresAt,
    version: record.version,
  };
}
