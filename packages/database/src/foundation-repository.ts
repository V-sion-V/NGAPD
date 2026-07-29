import { randomUUID } from "node:crypto";

import { sql, type Kysely, type Transaction } from "kysely";

import type { DatabaseSchema } from "./types.js";

const EMPTY_MANIFEST_HASH = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";

type DatabaseExecutor = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>;

export interface CreateUserInput {
  id?: string;
  workspaceId?: string;
  loginName: string;
  normalizedLoginName: string;
  passwordHash: string;
  displayName?: string;
  defaultIntroduction?: string;
}

export interface CreateProjectInput {
  id?: string;
  ownerMembershipId?: string;
  workspaceId?: string;
  key: string;
  name: string;
  description?: string;
  ownerUserId: string;
}

export interface CreateTaskInput {
  id?: string;
  workspaceId?: string;
  projectId: string;
  /**
   * @deprecated Task keys are allocated from the immutable Project Key and project sequence.
   */
  key: string;
  title: string;
  parentTaskId: string | null;
  explicitOwnerMembershipId: string | null;
  createdByMembershipId?: string;
}

export interface AuditEventInput {
  id?: string;
  actorUserId: string | null;
  deviceId?: string | null;
  workspaceId?: string | null;
  requestId: string;
  action: string;
  result: string;
  reasonCode: string;
  beforeVersion?: number | null;
  afterVersion?: number | null;
  actorType?: "human" | "agent" | "system";
  projectId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  taskVersionBefore?: number | null;
  taskVersionAfter?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export class FoundationRepository {
  constructor(private readonly database: Kysely<DatabaseSchema>) {}

  async createUserWithWorkspace(input: CreateUserInput) {
    return this.database.transaction().execute(async (transaction) => {
      const userId = input.id ?? randomUUID();
      const workspaceId = input.workspaceId ?? randomUUID();
      const user = await transaction
        .insertInto("users")
        .values({
          id: userId,
          login_name: input.loginName,
          normalized_login_name: input.normalizedLoginName,
          password_hash: input.passwordHash,
          display_name: input.displayName ?? input.loginName,
          default_introduction: input.defaultIntroduction ?? "",
        })
        .returning(["id", "login_name", "normalized_login_name", "active", "created_at"])
        .executeTakeFirstOrThrow();
      const workspace = await insertWorkspace(transaction, workspaceId, "user", userId);
      return { user, workspace };
    });
  }

  async createProjectWithWorkspace(input: CreateProjectInput) {
    return this.database.transaction().execute(async (transaction) => {
      const projectId = input.id ?? randomUUID();
      const ownerMembershipId = input.ownerMembershipId ?? randomUUID();
      const workspaceId = input.workspaceId ?? randomUUID();
      const rootGraphScopeId = randomUUID();
      await sql`set constraints all deferred`.execute(transaction);
      const project = await transaction
        .insertInto("projects")
        .values({
          id: projectId,
          project_key: input.key,
          name: input.name,
          description: input.description ?? "",
          owner_membership_id: ownerMembershipId,
        })
        .returning(["id", "project_key", "name", "owner_membership_id"])
        .executeTakeFirstOrThrow();
      const ownerMembership = await transaction
        .insertInto("memberships")
        .values({
          id: ownerMembershipId,
          project_id: projectId,
          user_id: input.ownerUserId,
          permission_level: "admin",
          status: "active",
          has_been_active: true,
        })
        .returning(["id", "project_id", "user_id", "permission_level", "status"])
        .executeTakeFirstOrThrow();
      await sql`
        insert into project_logical_roles (
          id,
          project_id,
          source_template_id,
          name,
          capability
        )
        select
          md5(${projectId}::text || ':' || templates.id)::uuid,
          ${projectId}::uuid,
          templates.id,
          templates.title,
          templates.description
        from system_logical_role_templates templates
        on conflict (project_id, source_template_id)
          where source_template_id is not null
          do nothing
      `.execute(transaction);
      await transaction
        .insertInto("sibling_task_graph_scopes")
        .values({
          id: rootGraphScopeId,
          project_id: projectId,
          parent_task_id: null,
        })
        .execute();
      const workspace = await insertWorkspace(transaction, workspaceId, "project", projectId);
      return { project, ownerMembership, workspace };
    });
  }

  async createMembership(input: {
    id?: string;
    projectId: string;
    userId: string;
    permissionLevel: "admin" | "member";
    status?: "pending" | "active" | "removed";
  }) {
    return this.database
      .insertInto("memberships")
      .values({
        id: input.id ?? randomUUID(),
        project_id: input.projectId,
        user_id: input.userId,
        permission_level: input.permissionLevel,
        status: input.status ?? "active",
        has_been_active: (input.status ?? "active") === "active",
      })
      .returning(["id", "project_id", "user_id", "permission_level", "status"])
      .executeTakeFirstOrThrow();
  }

  async createTaskWithWorkspace(input: CreateTaskInput) {
    return this.database.transaction().execute(async (transaction) => {
      const lockedProject = await transaction
        .selectFrom("projects")
        .select(["id", "owner_membership_id"])
        .where("id", "=", input.projectId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      await validateTaskReferences(transaction, input);
      const taskId = input.id ?? randomUUID();
      const workspaceId = input.workspaceId ?? randomUUID();
      const childGraphScopeId = randomUUID();
      const project = await transaction
        .updateTable("projects")
        .set({
          task_sequence: sql`task_sequence + 1`,
          updated_at: sql`now()`,
        })
        .where("id", "=", input.projectId)
        .returning(["project_key", "task_sequence"])
        .executeTakeFirstOrThrow();
      let parentGraphScopeQuery = transaction
        .selectFrom("sibling_task_graph_scopes")
        .select("id")
        .where("project_id", "=", input.projectId);
      parentGraphScopeQuery =
        input.parentTaskId === null
          ? parentGraphScopeQuery.where("parent_task_id", "is", null)
          : parentGraphScopeQuery.where("parent_task_id", "=", input.parentTaskId);
      const parentGraphScope = await parentGraphScopeQuery.executeTakeFirstOrThrow();
      const taskKey = `${project.project_key}-${project.task_sequence}`;
      const task = await transaction
        .insertInto("tasks")
        .values({
          id: taskId,
          project_id: input.projectId,
          task_sequence: project.task_sequence,
          task_key: taskKey,
          title: input.title,
          base_status: "not_started",
          parent_task_id: input.parentTaskId,
          parent_graph_scope_id: parentGraphScope.id,
          explicit_owner_membership_id: input.explicitOwnerMembershipId,
          created_by_membership_id:
            input.createdByMembershipId ??
            input.explicitOwnerMembershipId ??
            lockedProject.owner_membership_id,
        })
        .returning([
          "id",
          "project_id",
          "task_sequence",
          "task_key",
          "title",
          "base_status",
          "parent_task_id",
          "explicit_owner_membership_id",
        ])
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto("sibling_task_graph_scopes")
        .values({
          id: childGraphScopeId,
          project_id: input.projectId,
          parent_task_id: taskId,
        })
        .execute();
      const workspace = await insertWorkspace(transaction, workspaceId, "task", taskId);
      return { task, workspace };
    });
  }

  async findWorkspaceByScope(scopeType: "user" | "project" | "task", scopeId: string) {
    return this.database
      .selectFrom("workspaces")
      .selectAll()
      .where("scope_type", "=", scopeType)
      .where("scope_id", "=", scopeId)
      .executeTakeFirst();
  }

  async writeAudit(input: AuditEventInput): Promise<void> {
    await writeAudit(this.database, input);
  }
}

async function validateTaskReferences(
  executor: DatabaseExecutor,
  input: CreateTaskInput,
): Promise<void> {
  if (input.parentTaskId) {
    const parent = await executor
      .selectFrom("tasks")
      .select(["project_id"])
      .where("id", "=", input.parentTaskId)
      .executeTakeFirst();
    if (!parent || parent.project_id !== input.projectId) {
      throw new Error("TASK_PARENT_PROJECT_MISMATCH");
    }
  } else if (!input.explicitOwnerMembershipId) {
    throw new Error("TOP_LEVEL_TASK_OWNER_REQUIRED");
  }

  if (input.explicitOwnerMembershipId) {
    const membership = await executor
      .selectFrom("memberships")
      .select(["project_id", "status"])
      .where("id", "=", input.explicitOwnerMembershipId)
      .forUpdate()
      .executeTakeFirst();
    if (
      !membership ||
      membership.status !== "active" ||
      membership.project_id !== input.projectId
    ) {
      throw new Error("TASK_OWNER_MEMBERSHIP_INVALID");
    }
  }
}

async function insertWorkspace(
  executor: DatabaseExecutor,
  id: string,
  scopeType: "user" | "project" | "task",
  scopeId: string,
) {
  const workspace = await executor
    .insertInto("workspaces")
    .values({
      id,
      scope_type: scopeType,
      scope_id: scopeId,
    })
    .returning(["id", "scope_type", "scope_id", "lifecycle", "work_cycle", "sync_version"])
    .executeTakeFirstOrThrow();
  await executor
    .insertInto("workspace_versions")
    .values({
      workspace_id: workspace.id,
      sync_version: "0",
      manifest_sha256: EMPTY_MANIFEST_HASH,
      created_by_user_id: null,
      device_id: null,
      lease_id: null,
    })
    .execute();
  return workspace;
}

export async function writeAudit(
  executor: DatabaseExecutor,
  input: AuditEventInput,
): Promise<void> {
  await executor
    .insertInto("audit_events")
    .values({
      id: input.id ?? randomUUID(),
      actor_user_id: input.actorUserId,
      device_id: input.deviceId ?? null,
      workspace_id: input.workspaceId ?? null,
      request_id: input.requestId,
      action: input.action,
      result: input.result,
      reason_code: input.reasonCode,
      actor_type: input.actorType ?? "human",
      project_id: input.projectId ?? null,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      task_version_before:
        input.taskVersionBefore === undefined || input.taskVersionBefore === null
          ? null
          : String(input.taskVersionBefore),
      task_version_after:
        input.taskVersionAfter === undefined || input.taskVersionAfter === null
          ? null
          : String(input.taskVersionAfter),
      metadata: input.metadata ?? {},
      before_version:
        input.beforeVersion === undefined || input.beforeVersion === null
          ? null
          : String(input.beforeVersion),
      after_version:
        input.afterVersion === undefined || input.afterVersion === null
          ? null
          : String(input.afterVersion),
    })
    .onConflict((conflict) =>
      conflict.columns(["request_id", "action", "result", "target_type", "target_id"]).doNothing(),
    )
    .execute();
}
