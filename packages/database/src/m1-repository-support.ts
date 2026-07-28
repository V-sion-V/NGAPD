import { randomUUID } from "node:crypto";

import { sql, type Kysely, type Transaction } from "kysely";

import { writeAudit, type AuditEventInput } from "./foundation-repository.js";
import type { DatabaseSchema } from "./types.js";

export type DatabaseExecutor = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>;

export type M1ReplayResult =
  | { status: "miss" }
  | { status: "conflict" }
  | { status: "replay"; response: Record<string, unknown> };

export async function lockM1IdempotencyKey(
  transaction: Transaction<DatabaseSchema>,
  input: {
    actorUserId: string;
    operation: string;
    idempotencyKey: string;
  },
): Promise<void> {
  const lockKey = JSON.stringify([input.actorUserId, input.operation, input.idempotencyKey]);
  await sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`.execute(transaction);
}

export async function readM1Replay(
  executor: DatabaseExecutor,
  input: {
    actorUserId: string;
    operation: string;
    idempotencyKey: string;
    requestSha256: string;
  },
): Promise<M1ReplayResult> {
  const replay = await executor
    .selectFrom("m1_idempotency_records")
    .select(["request_sha256", "response"])
    .where("actor_user_id", "=", input.actorUserId)
    .where("operation", "=", input.operation)
    .where("idempotency_key", "=", input.idempotencyKey)
    .executeTakeFirst();
  if (!replay) {
    return { status: "miss" };
  }
  return replay.request_sha256 === input.requestSha256
    ? { status: "replay", response: replay.response }
    : { status: "conflict" };
}

export async function writeM1Replay(
  executor: DatabaseExecutor,
  input: {
    actorUserId: string;
    projectId?: string | null;
    operation: string;
    idempotencyKey: string;
    requestSha256: string;
    response: Record<string, unknown>;
  },
): Promise<void> {
  await executor
    .insertInto("m1_idempotency_records")
    .values({
      id: randomUUID(),
      actor_user_id: input.actorUserId,
      project_id: input.projectId ?? null,
      operation: input.operation,
      idempotency_key: input.idempotencyKey,
      request_sha256: input.requestSha256,
      response: input.response,
    })
    .execute();
}

export async function writeM1Success(
  executor: DatabaseExecutor,
  input: {
    actorUserId: string;
    actorType?: "human" | "agent" | "system";
    projectId?: string | null;
    requestId: string;
    action: string;
    reasonCode: string;
    targetType: string;
    targetId: string;
    beforeVersion?: number | null;
    afterVersion?: number | null;
    audienceType: "user" | "project";
    audienceId: string;
    eventType: string;
    payload?: Record<string, unknown>;
    metadata?: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  await writeAudit(executor, {
    actorUserId: input.actorUserId,
    requestId: input.requestId,
    action: input.action,
    result: "success",
    reasonCode: input.reasonCode,
    targetType: input.targetType,
    targetId: input.targetId,
    ...(input.actorType ? { actorType: input.actorType } : {}),
    ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
    ...(input.beforeVersion !== undefined ? { beforeVersion: input.beforeVersion } : {}),
    ...(input.afterVersion !== undefined ? { afterVersion: input.afterVersion } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  });
  await executor
    .insertInto("outbox_events")
    .values({
      id: randomUUID(),
      project_id: input.audienceType === "project" ? (input.projectId ?? null) : null,
      audience_type: input.audienceType,
      audience_id: input.audienceId,
      aggregate_type: input.targetType,
      aggregate_id: input.targetId,
      event_type: input.eventType,
      request_id: input.requestId,
      payload: input.payload ?? {},
    })
    .execute();
}

export async function writeM1FailureAudit(
  executor: DatabaseExecutor,
  input: AuditEventInput,
): Promise<void> {
  await writeAudit(executor, {
    ...input,
    result: "failure",
  });
}

export async function revokeAdminModes(
  executor: DatabaseExecutor,
  input: {
    projectId: string;
    now: Date;
    reason: string;
    membershipId?: string;
    webSessionId?: string;
  },
): Promise<number> {
  let selection = executor
    .selectFrom("admin_mode_sessions")
    .select("id")
    .where("project_id", "=", input.projectId)
    .where("status", "=", "active")
    .orderBy("id")
    .forUpdate();
  if (input.membershipId) {
    selection = selection.where("membership_id", "=", input.membershipId);
  }
  if (input.webSessionId) {
    selection = selection.where("web_session_id", "=", input.webSessionId);
  }
  const sessions = await selection.execute();
  if (sessions.length === 0) {
    return 0;
  }
  const result = await executor
    .updateTable("admin_mode_sessions")
    .set({
      status: "revoked",
      revoked_reason: input.reason,
      version: (expression) => expression("version", "+", "1"),
      updated_at: input.now,
    })
    .where(
      "id",
      "in",
      sessions.map((session) => session.id),
    )
    .executeTakeFirst();
  return Number(result.numUpdatedRows);
}

export async function revokeWorkspaceLeases(
  executor: DatabaseExecutor,
  input: {
    projectId: string;
    now: Date;
    reason: string;
    userId?: string;
    includeProjectWorkspace?: boolean;
    includeTaskWorkspaces?: boolean;
  },
): Promise<number> {
  const scopeTypes: Array<"project" | "task"> = [];
  if (input.includeProjectWorkspace ?? true) {
    scopeTypes.push("project");
  }
  if (input.includeTaskWorkspaces ?? true) {
    scopeTypes.push("task");
  }
  if (scopeTypes.length === 0) {
    return 0;
  }

  const workspaceQuery = executor
    .selectFrom("workspaces as workspace")
    .leftJoin("tasks as task", (join) =>
      join.on("workspace.scope_type", "=", "task").onRef("task.id", "=", "workspace.scope_id"),
    )
    .select("workspace.id")
    .where("workspace.scope_type", "in", scopeTypes)
    .where((expression) =>
      expression.or([
        expression.and([
          expression("workspace.scope_type", "=", "project"),
          expression("workspace.scope_id", "=", input.projectId),
        ]),
        expression.and([
          expression("workspace.scope_type", "=", "task"),
          expression("task.project_id", "=", input.projectId),
        ]),
      ]),
    );
  const workspaces = await workspaceQuery.orderBy("workspace.id").execute();
  if (workspaces.length === 0) {
    return 0;
  }

  let leaseSelection = executor
    .selectFrom("workspace_leases")
    .select("id")
    .where(
      "workspace_id",
      "in",
      workspaces.map((workspace) => workspace.id),
    )
    .where("revoked_at", "is", null)
    .orderBy("id")
    .forUpdate();
  if (input.userId) {
    leaseSelection = leaseSelection.where("user_id", "=", input.userId);
  }
  const leases = await leaseSelection.execute();
  if (leases.length === 0) {
    return 0;
  }
  const result = await executor
    .updateTable("workspace_leases")
    .set({ revoked_at: input.now, revoke_reason: input.reason })
    .where(
      "id",
      "in",
      leases.map((lease) => lease.id),
    )
    .executeTakeFirst();
  return Number(result.numUpdatedRows);
}

export async function lockMemberships(
  transaction: Transaction<DatabaseSchema>,
  projectId: string,
  membershipIds: readonly string[],
) {
  const ids = [...new Set(membershipIds)].sort((left, right) => left.localeCompare(right, "en"));
  if (ids.length === 0) {
    return [];
  }
  return transaction
    .selectFrom("memberships")
    .selectAll()
    .where("project_id", "=", projectId)
    .where("id", "in", ids)
    .orderBy("id")
    .forUpdate()
    .execute();
}

export function numberField(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`M1_IDEMPOTENCY_${name.toUpperCase()}_INVALID`);
  }
  return value;
}

export function stringField(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`M1_IDEMPOTENCY_${name.toUpperCase()}_INVALID`);
  }
  return value;
}

export function stringArrayField(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`M1_IDEMPOTENCY_${name.toUpperCase()}_INVALID`);
  }
  return value;
}
