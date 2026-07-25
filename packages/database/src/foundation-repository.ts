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
}

export interface CreateProjectInput {
  id?: string;
  ownerMembershipId?: string;
  workspaceId?: string;
  key: string;
  name: string;
  ownerUserId: string;
}

export interface CreateTaskInput {
  id?: string;
  workspaceId?: string;
  projectId: string;
  key: string;
  title: string;
  parentTaskId: string | null;
  explicitOwnerMembershipId: string | null;
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
      await sql`set constraints all deferred`.execute(transaction);
      const project = await transaction
        .insertInto("projects")
        .values({
          id: projectId,
          project_key: input.key,
          name: input.name,
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
          role: "admin",
        })
        .returning(["id", "project_id", "user_id", "role", "active"])
        .executeTakeFirstOrThrow();
      const workspace = await insertWorkspace(transaction, workspaceId, "project", projectId);
      return { project, ownerMembership, workspace };
    });
  }

  async createMembership(input: {
    id?: string;
    projectId: string;
    userId: string;
    role: "admin" | "member";
  }) {
    return this.database
      .insertInto("memberships")
      .values({
        id: input.id ?? randomUUID(),
        project_id: input.projectId,
        user_id: input.userId,
        role: input.role,
      })
      .returning(["id", "project_id", "user_id", "role", "active"])
      .executeTakeFirstOrThrow();
  }

  async createTaskWithWorkspace(input: CreateTaskInput) {
    return this.database.transaction().execute(async (transaction) => {
      await validateTaskReferences(transaction, input);
      const taskId = input.id ?? randomUUID();
      const workspaceId = input.workspaceId ?? randomUUID();
      const task = await transaction
        .insertInto("tasks")
        .values({
          id: taskId,
          project_id: input.projectId,
          task_key: input.key,
          title: input.title,
          status: "open",
          parent_task_id: input.parentTaskId,
          explicit_owner_membership_id: input.explicitOwnerMembershipId,
        })
        .returning([
          "id",
          "project_id",
          "task_key",
          "title",
          "parent_task_id",
          "explicit_owner_membership_id",
        ])
        .executeTakeFirstOrThrow();
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
      .select(["project_id", "active"])
      .where("id", "=", input.explicitOwnerMembershipId)
      .executeTakeFirst();
    if (!membership || !membership.active || membership.project_id !== input.projectId) {
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
    .execute();
}
