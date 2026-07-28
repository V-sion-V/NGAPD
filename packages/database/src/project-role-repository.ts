import { randomUUID } from "node:crypto";

import { resolveLogicalRoleOperation } from "@ngapd/domain";
import type { Kysely, Transaction } from "kysely";

import {
  lockAndEvaluateAdminMode,
  lockProject,
  renewAdminMode,
  type MutationFailureReason,
} from "./project-membership-repository.js";
import {
  lockM1IdempotencyKey,
  lockMemberships,
  readM1Replay,
  stringField,
  writeM1Replay,
  writeM1Success,
} from "./m1-repository-support.js";
import type { DatabaseSchema } from "./types.js";

export interface SystemLogicalRoleTemplateRecord {
  id: string;
  title: string;
  desc: string;
}

export interface ProjectLogicalRoleRecord {
  id: string;
  projectId: string;
  sourceTemplateId: string | null;
  name: string;
  capability: string;
  status: "active" | "archived";
  version: number;
}

export type ProjectRoleMutationResult =
  | { ok: true; role: ProjectLogicalRoleRecord; idempotentReplay: boolean }
  | { ok: false; reason: MutationFailureReason; currentVersion?: number };

export class ProjectRoleRepository {
  constructor(private readonly database: Kysely<DatabaseSchema>) {}

  async listSystemTemplates(): Promise<SystemLogicalRoleTemplateRecord[]> {
    const rows = await this.database
      .selectFrom("system_logical_role_templates")
      .select(["id", "title", "description"])
      .orderBy("id")
      .execute();
    return rows.map((row) => ({ id: row.id, title: row.title, desc: row.description }));
  }

  async listProjectRoles(projectId: string): Promise<ProjectLogicalRoleRecord[]> {
    const rows = await this.database
      .selectFrom("project_logical_roles")
      .selectAll()
      .where("project_id", "=", projectId)
      .orderBy("name")
      .orderBy("id")
      .execute();
    return rows.map(mapRole);
  }

  async findProjectRole(
    projectId: string,
    roleId: string,
  ): Promise<ProjectLogicalRoleRecord | undefined> {
    return findRole(this.database, projectId, roleId);
  }

  async createProjectRole(input: {
    roleId?: string;
    projectId: string;
    actorUserId: string;
    actorMembershipId: string;
    webSessionId: string;
    adminModeId: string;
    name: string;
    capability: string;
    requestId: string;
    idempotencyKey: string;
    requestSha256: string;
    now: Date;
  }): Promise<ProjectRoleMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const project = await lockProject(transaction, input.projectId);
      if (!project) {
        return { ok: false, reason: "project_not_found" };
      }
      const [actor] = await lockMemberships(transaction, project.id, [input.actorMembershipId]);
      if (!actor) {
        return { ok: false, reason: "membership_not_found" };
      }
      const admin = await lockAndEvaluateAdminMode(transaction, {
        adminModeId: input.adminModeId,
        actorUserId: input.actorUserId,
        webSessionId: input.webSessionId,
        project,
        actor,
        now: input.now,
        requestId: input.requestId,
      });
      if (!admin.ok) {
        return { ok: false, reason: admin.reason };
      }
      await lockM1IdempotencyKey(transaction, {
        actorUserId: input.actorUserId,
        operation: "project_role_create",
        idempotencyKey: input.idempotencyKey,
      });
      const replay = await readM1Replay(transaction, {
        actorUserId: input.actorUserId,
        operation: "project_role_create",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
      });
      if (replay.status === "conflict") {
        return { ok: false, reason: "idempotency_conflict" };
      }
      if (replay.status === "replay") {
        const role = await findRole(
          transaction,
          project.id,
          stringField(replay.response.roleId, "roleId"),
        );
        if (!role) {
          throw new Error("PROJECT_ROLE_CREATE_REPLAY_MISSING");
        }
        return { ok: true, role, idempotentReplay: true };
      }
      const inserted = await transaction
        .insertInto("project_logical_roles")
        .values({
          id: input.roleId ?? randomUUID(),
          project_id: project.id,
          source_template_id: null,
          name: input.name,
          capability: input.capability,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await renewAdminMode(transaction, admin.state, input.now);
      await writeM1Success(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        requestId: input.requestId,
        action: "project_role.create",
        reasonCode: "PROJECT_ROLE_CREATED",
        targetType: "project_role",
        targetId: inserted.id,
        beforeVersion: null,
        afterVersion: 1,
        audienceType: "project",
        audienceId: project.id,
        eventType: "project_role.created",
        payload: { roleId: inserted.id, version: 1 },
      });
      await writeM1Replay(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        operation: "project_role_create",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
        response: { roleId: inserted.id },
      });
      return { ok: true, role: mapRole(inserted), idempotentReplay: false };
    });
  }

  async updateProjectRole(input: {
    projectId: string;
    roleId: string;
    actorUserId: string;
    actorMembershipId: string;
    webSessionId: string;
    adminModeId: string;
    name: string;
    capability: string;
    expectedVersion: number;
    requestId: string;
    now: Date;
  }): Promise<ProjectRoleMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const project = await lockProject(transaction, input.projectId);
      if (!project) {
        return { ok: false, reason: "project_not_found" };
      }
      const [actor] = await lockMemberships(transaction, project.id, [input.actorMembershipId]);
      if (!actor) {
        return { ok: false, reason: "membership_not_found" };
      }
      const admin = await lockAndEvaluateAdminMode(transaction, {
        adminModeId: input.adminModeId,
        actorUserId: input.actorUserId,
        webSessionId: input.webSessionId,
        project,
        actor,
        now: input.now,
        requestId: input.requestId,
      });
      if (!admin.ok) {
        return { ok: false, reason: admin.reason };
      }
      const role = await transaction
        .selectFrom("project_logical_roles")
        .selectAll()
        .where("id", "=", input.roleId)
        .where("project_id", "=", project.id)
        .forUpdate()
        .executeTakeFirst();
      if (!role) {
        return { ok: false, reason: "role_not_found" };
      }
      if (Number(role.version) !== input.expectedVersion) {
        return {
          ok: false,
          reason: "request_version_conflict",
          currentVersion: Number(role.version),
        };
      }
      const decision = resolveLogicalRoleOperation({ role: mapRole(role), operation: "edit" });
      if (!decision.allowed) {
        return { ok: false, reason: decision.reason };
      }
      const nextVersion = Number(role.version) + 1;
      const updated = await transaction
        .updateTable("project_logical_roles")
        .set({
          name: input.name,
          capability: input.capability,
          version: String(nextVersion),
          updated_at: input.now,
        })
        .where("id", "=", role.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await renewAdminMode(transaction, admin.state, input.now);
      await writeM1Success(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        requestId: input.requestId,
        action: "project_role.update",
        reasonCode: "PROJECT_ROLE_UPDATED",
        targetType: "project_role",
        targetId: role.id,
        beforeVersion: Number(role.version),
        afterVersion: nextVersion,
        audienceType: "project",
        audienceId: project.id,
        eventType: "project_role.updated",
        payload: { roleId: role.id, version: nextVersion },
      });
      return { ok: true, role: mapRole(updated), idempotentReplay: false };
    });
  }

  async copyProjectRole(input: {
    roleId?: string;
    projectId: string;
    sourceRoleId: string;
    actorUserId: string;
    actorMembershipId: string;
    webSessionId: string;
    adminModeId: string;
    name: string;
    expectedSourceVersion: number;
    requestId: string;
    idempotencyKey: string;
    requestSha256: string;
    now: Date;
  }): Promise<ProjectRoleMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const project = await lockProject(transaction, input.projectId);
      if (!project) {
        return { ok: false, reason: "project_not_found" };
      }
      const [actor] = await lockMemberships(transaction, project.id, [input.actorMembershipId]);
      if (!actor) {
        return { ok: false, reason: "membership_not_found" };
      }
      const admin = await lockAndEvaluateAdminMode(transaction, {
        adminModeId: input.adminModeId,
        actorUserId: input.actorUserId,
        webSessionId: input.webSessionId,
        project,
        actor,
        now: input.now,
        requestId: input.requestId,
      });
      if (!admin.ok) {
        return { ok: false, reason: admin.reason };
      }
      await lockM1IdempotencyKey(transaction, {
        actorUserId: input.actorUserId,
        operation: "project_role_copy",
        idempotencyKey: input.idempotencyKey,
      });
      const replay = await readM1Replay(transaction, {
        actorUserId: input.actorUserId,
        operation: "project_role_copy",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
      });
      if (replay.status === "conflict") {
        return { ok: false, reason: "idempotency_conflict" };
      }
      if (replay.status === "replay") {
        const role = await findRole(
          transaction,
          project.id,
          stringField(replay.response.roleId, "roleId"),
        );
        if (!role) {
          throw new Error("PROJECT_ROLE_COPY_REPLAY_MISSING");
        }
        return { ok: true, role, idempotentReplay: true };
      }
      const source = await transaction
        .selectFrom("project_logical_roles")
        .selectAll()
        .where("id", "=", input.sourceRoleId)
        .where("project_id", "=", project.id)
        .forUpdate()
        .executeTakeFirst();
      if (!source) {
        return { ok: false, reason: "role_not_found" };
      }
      if (Number(source.version) !== input.expectedSourceVersion) {
        return {
          ok: false,
          reason: "request_version_conflict",
          currentVersion: Number(source.version),
        };
      }
      const decision = resolveLogicalRoleOperation({ role: mapRole(source), operation: "copy" });
      if (!decision.allowed) {
        return { ok: false, reason: decision.reason };
      }
      const copied = await transaction
        .insertInto("project_logical_roles")
        .values({
          id: input.roleId ?? randomUUID(),
          project_id: project.id,
          source_template_id: null,
          name: input.name,
          capability: source.capability,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await renewAdminMode(transaction, admin.state, input.now);
      await writeM1Success(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        requestId: input.requestId,
        action: "project_role.copy",
        reasonCode: "PROJECT_ROLE_COPIED",
        targetType: "project_role",
        targetId: copied.id,
        beforeVersion: null,
        afterVersion: 1,
        audienceType: "project",
        audienceId: project.id,
        eventType: "project_role.copied",
        payload: { roleId: copied.id, sourceRoleId: source.id, version: 1 },
      });
      await writeM1Replay(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        operation: "project_role_copy",
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
        response: { roleId: copied.id },
      });
      return { ok: true, role: mapRole(copied), idempotentReplay: false };
    });
  }

  async archiveProjectRole(input: {
    projectId: string;
    roleId: string;
    actorUserId: string;
    actorMembershipId: string;
    webSessionId: string;
    adminModeId: string;
    expectedVersion: number;
    requestId: string;
    now: Date;
  }): Promise<ProjectRoleMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const project = await lockProject(transaction, input.projectId);
      if (!project) {
        return { ok: false, reason: "project_not_found" };
      }
      const [actor] = await lockMemberships(transaction, project.id, [input.actorMembershipId]);
      if (!actor) {
        return { ok: false, reason: "membership_not_found" };
      }
      const admin = await lockAndEvaluateAdminMode(transaction, {
        adminModeId: input.adminModeId,
        actorUserId: input.actorUserId,
        webSessionId: input.webSessionId,
        project,
        actor,
        now: input.now,
        requestId: input.requestId,
      });
      if (!admin.ok) {
        return { ok: false, reason: admin.reason };
      }
      const role = await transaction
        .selectFrom("project_logical_roles")
        .selectAll()
        .where("id", "=", input.roleId)
        .where("project_id", "=", project.id)
        .forUpdate()
        .executeTakeFirst();
      if (!role) {
        return { ok: false, reason: "role_not_found" };
      }
      if (Number(role.version) !== input.expectedVersion) {
        return {
          ok: false,
          reason: "request_version_conflict",
          currentVersion: Number(role.version),
        };
      }
      const decision = resolveLogicalRoleOperation({ role: mapRole(role), operation: "archive" });
      if (!decision.allowed) {
        return { ok: false, reason: decision.reason };
      }
      const nextVersion = Number(role.version) + 1;
      const archived = await transaction
        .updateTable("project_logical_roles")
        .set({
          status: "archived",
          version: String(nextVersion),
          updated_at: input.now,
        })
        .where("id", "=", role.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await renewAdminMode(transaction, admin.state, input.now);
      await writeM1Success(transaction, {
        actorUserId: input.actorUserId,
        projectId: project.id,
        requestId: input.requestId,
        action: "project_role.archive",
        reasonCode: "PROJECT_ROLE_ARCHIVED",
        targetType: "project_role",
        targetId: role.id,
        beforeVersion: Number(role.version),
        afterVersion: nextVersion,
        audienceType: "project",
        audienceId: project.id,
        eventType: "project_role.archived",
        payload: { roleId: role.id, version: nextVersion },
      });
      return { ok: true, role: mapRole(archived), idempotentReplay: false };
    });
  }
}

async function findRole(
  executor: Kysely<DatabaseSchema> | Transaction<DatabaseSchema>,
  projectId: string,
  roleId: string,
) {
  const role = await executor
    .selectFrom("project_logical_roles")
    .selectAll()
    .where("project_id", "=", projectId)
    .where("id", "=", roleId)
    .executeTakeFirst();
  return role ? mapRole(role) : undefined;
}

function mapRole(row: {
  id: string;
  project_id: string;
  source_template_id: string | null;
  name: string;
  capability: string;
  status: "active" | "archived";
  version: string;
}): ProjectLogicalRoleRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceTemplateId: row.source_template_id,
    name: row.name,
    capability: row.capability,
    status: row.status,
    version: Number(row.version),
  };
}
