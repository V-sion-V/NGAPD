import { randomUUID } from "node:crypto";

import { evaluateTaskCommentMutation, type TaskCommentAttachmentFact } from "@ngapd/domain";
import { sql, type Transaction } from "kysely";

import type { Database } from "./client.js";
import { writeAudit } from "./foundation-repository.js";
import type { DatabaseSchema } from "./types.js";

export interface TaskCommentAttachmentRecord {
  workspaceId: string;
  path: string;
  sha256?: string;
}

export interface TaskCommentRecord {
  id: string;
  projectId: string;
  taskId: string;
  authorMembershipId: string;
  body: string | null;
  attachments: TaskCommentAttachmentRecord[];
  version: number;
  editedAt: string | null;
  deletedAt: string | null;
  hiddenAt: string | null;
  hiddenByMembershipId: string | null;
  hiddenReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskCommentMutationResult =
  | { ok: true; comment: TaskCommentRecord; idempotentReplay: boolean }
  | {
      ok: false;
      reason:
        | "task_not_found"
        | "task_archived"
        | "task_version_conflict"
        | "comment_not_found"
        | "comment_version_conflict"
        | "comment_immutable"
        | "comment_attachment_forbidden"
        | "task_field_invalid"
        | "idempotency_conflict"
        | "forbidden";
    };

export class TaskCommentRepository {
  constructor(private readonly database: Database) {}

  async list(input: {
    projectId: string;
    taskId: string;
    after?: { createdAt: Date; id: string };
    afterId?: string;
    limit?: number;
  }): Promise<TaskCommentRecord[]> {
    const cursor =
      input.after ??
      (input.afterId
        ? await this.database
            .selectFrom("task_comments")
            .select(["created_at as createdAt", "id"])
            .where("project_id", "=", input.projectId)
            .where("task_id", "=", input.taskId)
            .where("id", "=", input.afterId)
            .executeTakeFirst()
        : undefined);
    let query = this.database
      .selectFrom("task_comments")
      .selectAll()
      .where("project_id", "=", input.projectId)
      .where("task_id", "=", input.taskId);
    if (cursor) {
      query = query.where((expression) =>
        expression.or([
          expression("created_at", ">", cursor.createdAt),
          expression.and([
            expression("created_at", "=", cursor.createdAt),
            expression("id", ">", cursor.id),
          ]),
        ]),
      );
    }
    const rows = await query
      .orderBy("created_at")
      .orderBy("id")
      .limit(Math.min(Math.max(input.limit ?? 50, 1), 200))
      .execute();
    return rows.map(mapComment);
  }

  async create(input: {
    projectId: string;
    taskId: string;
    actorMembershipId: string;
    actorType: "human" | "agent";
    expectedTaskVersion: number;
    body: string;
    attachments: TaskCommentAttachmentRecord[];
    requestId: string;
    idempotencyKey: string;
    requestSha256: string;
  }): Promise<TaskCommentMutationResult> {
    if (
      input.body.trim().length < 1 ||
      input.body.length > 32_768 ||
      input.attachments.length > 100
    ) {
      return { ok: false, reason: "task_field_invalid" };
    }
    return this.database.transaction().execute(async (transaction) => {
      const task = await lockTask(transaction, input.projectId, input.taskId);
      if (!task) {
        return { ok: false, reason: "task_not_found" };
      }
      const actor = await lockActor(transaction, input.projectId, input.actorMembershipId);
      if (!actor || actor.status !== "active" || !actor.user_active) {
        return { ok: false, reason: "forbidden" };
      }
      const replay = await readCommentReplay(transaction, input, "comment_create");
      if (replay) {
        return replay;
      }
      if (Number(task.version) !== input.expectedTaskVersion) {
        return { ok: false, reason: "task_version_conflict" };
      }
      const attachmentFacts = await validateAttachments(
        transaction,
        input.projectId,
        actor.user_id,
        input.attachments,
      );
      const decision = evaluateTaskCommentMutation({
        operation: "create",
        actorMembershipId: actor.id,
        actorMembershipActive: true,
        taskBaseStatus: task.base_status,
        taskArchived: task.archived,
        adminModeActive: false,
        comment: null,
        attachments: attachmentFacts,
      });
      if (!decision.ok) {
        return { ok: false, reason: mapDecisionReason(decision.reason) };
      }
      const id = randomUUID();
      const row = await transaction
        .insertInto("task_comments")
        .values({
          id,
          project_id: input.projectId,
          task_id: input.taskId,
          author_membership_id: actor.id,
          body: input.body,
          attachments: sql`${JSON.stringify(input.attachments)}::jsonb`,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      const comment = mapComment(row);
      await writeCommentMutationRecords(transaction, {
        operation: "comment_create",
        actorMembershipId: actor.id,
        actorUserId: actor.user_id,
        actorType: input.actorType,
        projectId: input.projectId,
        taskId: input.taskId,
        comment,
        requestId: input.requestId,
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
        action: "task.comment.create",
        reasonCode: "TASK_COMMENT_CREATED",
        eventType: "task.comment.created",
      });
      return { ok: true, comment, idempotentReplay: false };
    });
  }

  async update(input: {
    projectId: string;
    taskId: string;
    commentId: string;
    actorMembershipId: string;
    actorType: "human" | "agent";
    expectedTaskVersion: number;
    expectedCommentVersion: number;
    body: string;
    attachments: TaskCommentAttachmentRecord[];
    requestId: string;
    idempotencyKey: string;
    requestSha256: string;
    now: Date;
  }): Promise<TaskCommentMutationResult> {
    if (
      input.body.trim().length < 1 ||
      input.body.length > 32_768 ||
      input.attachments.length > 100
    ) {
      return { ok: false, reason: "task_field_invalid" };
    }
    return this.database.transaction().execute(async (transaction) => {
      const task = await lockTask(transaction, input.projectId, input.taskId);
      if (!task) {
        return { ok: false, reason: "task_not_found" };
      }
      const actor = await lockActor(transaction, input.projectId, input.actorMembershipId);
      if (!actor || actor.status !== "active" || !actor.user_active) {
        return { ok: false, reason: "forbidden" };
      }
      const replay = await readCommentReplay(transaction, input, "comment_update");
      if (replay) {
        return replay;
      }
      const comment = await lockComment(
        transaction,
        input.projectId,
        input.taskId,
        input.commentId,
      );
      if (!comment) {
        return { ok: false, reason: "comment_not_found" };
      }
      if (Number(task.version) !== input.expectedTaskVersion) {
        return { ok: false, reason: "task_version_conflict" };
      }
      if (Number(comment.version) !== input.expectedCommentVersion) {
        return { ok: false, reason: "comment_version_conflict" };
      }
      const attachmentFacts = await validateAttachments(
        transaction,
        input.projectId,
        actor.user_id,
        input.attachments,
      );
      const decision = evaluateTaskCommentMutation({
        operation: "update",
        actorMembershipId: actor.id,
        actorMembershipActive: true,
        taskBaseStatus: task.base_status,
        taskArchived: task.archived,
        adminModeActive: false,
        comment: {
          authorMembershipId: comment.author_membership_id,
          deleted: comment.deleted_at !== null,
          hidden: comment.hidden_at !== null,
        },
        attachments: attachmentFacts,
      });
      if (!decision.ok) {
        return { ok: false, reason: mapDecisionReason(decision.reason) };
      }
      const row = await transaction
        .updateTable("task_comments")
        .set({
          body: input.body,
          attachments: sql`${JSON.stringify(input.attachments)}::jsonb`,
          version: sql`version + 1`,
          edited_at: input.now,
          updated_at: input.now,
        })
        .where("id", "=", comment.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      const updated = mapComment(row);
      await writeCommentMutationRecords(transaction, {
        operation: "comment_update",
        actorMembershipId: actor.id,
        actorUserId: actor.user_id,
        actorType: input.actorType,
        projectId: input.projectId,
        taskId: input.taskId,
        comment: updated,
        requestId: input.requestId,
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
        action: "task.comment.update",
        reasonCode: "TASK_COMMENT_UPDATED",
        eventType: "task.comment.updated",
      });
      return { ok: true, comment: updated, idempotentReplay: false };
    });
  }

  async delete(input: {
    projectId: string;
    taskId: string;
    commentId: string;
    actorMembershipId: string;
    actorType: "human" | "agent";
    expectedTaskVersion: number;
    expectedCommentVersion: number;
    requestId: string;
    idempotencyKey: string;
    requestSha256: string;
    now: Date;
  }): Promise<TaskCommentMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const task = await lockTask(transaction, input.projectId, input.taskId);
      if (!task) {
        return { ok: false, reason: "task_not_found" };
      }
      const actor = await lockActor(transaction, input.projectId, input.actorMembershipId);
      if (!actor || actor.status !== "active" || !actor.user_active) {
        return { ok: false, reason: "forbidden" };
      }
      const replay = await readCommentReplay(transaction, input, "comment_delete");
      if (replay) {
        return replay;
      }
      const comment = await lockComment(
        transaction,
        input.projectId,
        input.taskId,
        input.commentId,
      );
      if (!comment) {
        return { ok: false, reason: "comment_not_found" };
      }
      if (Number(task.version) !== input.expectedTaskVersion) {
        return { ok: false, reason: "task_version_conflict" };
      }
      if (Number(comment.version) !== input.expectedCommentVersion) {
        return { ok: false, reason: "comment_version_conflict" };
      }
      const decision = evaluateTaskCommentMutation({
        operation: "delete",
        actorMembershipId: actor.id,
        actorMembershipActive: true,
        taskBaseStatus: task.base_status,
        taskArchived: task.archived,
        adminModeActive: false,
        comment: {
          authorMembershipId: comment.author_membership_id,
          deleted: comment.deleted_at !== null,
          hidden: comment.hidden_at !== null,
        },
      });
      if (!decision.ok) {
        return { ok: false, reason: mapDecisionReason(decision.reason) };
      }
      const row = await transaction
        .updateTable("task_comments")
        .set({
          body: null,
          attachments: sql`'[]'::jsonb`,
          version: sql`version + 1`,
          deleted_at: input.now,
          updated_at: input.now,
        })
        .where("id", "=", comment.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      const deleted = mapComment(row);
      await writeCommentMutationRecords(transaction, {
        operation: "comment_delete",
        actorMembershipId: actor.id,
        actorUserId: actor.user_id,
        actorType: input.actorType,
        projectId: input.projectId,
        taskId: input.taskId,
        comment: deleted,
        requestId: input.requestId,
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
        action: "task.comment.delete",
        reasonCode: "TASK_COMMENT_DELETED",
        eventType: "task.comment.deleted",
      });
      return { ok: true, comment: deleted, idempotentReplay: false };
    });
  }

  async hide(input: {
    projectId: string;
    taskId: string;
    commentId: string;
    actorMembershipId: string;
    actorType: "human" | "agent";
    adminModeActive: boolean;
    expectedCommentVersion: number;
    reason: string;
    requestId: string;
    idempotencyKey: string;
    requestSha256: string;
    now: Date;
  }): Promise<TaskCommentMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const task = await lockTask(transaction, input.projectId, input.taskId);
      if (!task) {
        return { ok: false, reason: "task_not_found" };
      }
      const actor = await lockActor(transaction, input.projectId, input.actorMembershipId);
      if (!actor || actor.status !== "active" || !actor.user_active) {
        return { ok: false, reason: "forbidden" };
      }
      const replay = await readCommentReplay(transaction, input, "comment_hide");
      if (replay) {
        return replay;
      }
      const comment = await lockComment(
        transaction,
        input.projectId,
        input.taskId,
        input.commentId,
      );
      if (!comment) {
        return { ok: false, reason: "comment_not_found" };
      }
      if (Number(comment.version) !== input.expectedCommentVersion) {
        return { ok: false, reason: "comment_version_conflict" };
      }
      const decision = evaluateTaskCommentMutation({
        operation: "hide",
        actorMembershipId: actor.id,
        actorMembershipActive: true,
        taskBaseStatus: task.base_status,
        taskArchived: task.archived,
        adminModeActive: input.adminModeActive && actor.permission_level === "admin",
        comment: {
          authorMembershipId: comment.author_membership_id,
          deleted: comment.deleted_at !== null,
          hidden: comment.hidden_at !== null,
        },
      });
      if (!decision.ok) {
        return { ok: false, reason: mapDecisionReason(decision.reason) };
      }
      const row = await transaction
        .updateTable("task_comments")
        .set({
          version: sql`version + 1`,
          hidden_at: input.now,
          hidden_by_membership_id: actor.id,
          hidden_reason: input.reason,
          updated_at: input.now,
        })
        .where("id", "=", comment.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      const hidden = mapComment(row);
      await writeCommentMutationRecords(transaction, {
        operation: "comment_hide",
        actorMembershipId: actor.id,
        actorUserId: actor.user_id,
        actorType: input.actorType,
        projectId: input.projectId,
        taskId: input.taskId,
        comment: hidden,
        requestId: input.requestId,
        idempotencyKey: input.idempotencyKey,
        requestSha256: input.requestSha256,
        action: "task.comment.hide",
        reasonCode: "TASK_COMMENT_HIDDEN",
        eventType: "task.comment.hidden",
      });
      return { ok: true, comment: hidden, idempotentReplay: false };
    });
  }
}

async function lockTask(
  transaction: Transaction<DatabaseSchema>,
  projectId: string,
  taskId: string,
) {
  return transaction
    .selectFrom("tasks")
    .select(["id", "project_id", "base_status", "archived", "version"])
    .where("id", "=", taskId)
    .where("project_id", "=", projectId)
    .forUpdate()
    .executeTakeFirst();
}

async function lockActor(
  transaction: Transaction<DatabaseSchema>,
  projectId: string,
  membershipId: string,
) {
  return transaction
    .selectFrom("memberships")
    .innerJoin("users", "users.id", "memberships.user_id")
    .select([
      "memberships.id",
      "memberships.user_id",
      "memberships.status",
      "memberships.permission_level",
      "users.active as user_active",
    ])
    .where("memberships.id", "=", membershipId)
    .where("memberships.project_id", "=", projectId)
    .forUpdate("memberships")
    .executeTakeFirst();
}

async function lockComment(
  transaction: Transaction<DatabaseSchema>,
  projectId: string,
  taskId: string,
  commentId: string,
) {
  return transaction
    .selectFrom("task_comments")
    .selectAll()
    .where("id", "=", commentId)
    .where("project_id", "=", projectId)
    .where("task_id", "=", taskId)
    .forUpdate()
    .executeTakeFirst();
}

async function validateAttachments(
  transaction: Transaction<DatabaseSchema>,
  projectId: string,
  actorUserId: string,
  attachments: TaskCommentAttachmentRecord[],
): Promise<TaskCommentAttachmentFact[]> {
  const results: TaskCommentAttachmentFact[] = [];
  for (const attachment of attachments) {
    const workspace = await transaction
      .selectFrom("workspaces")
      .select(["id", "scope_type", "scope_id", "sync_version", "lifecycle"])
      .where("id", "=", attachment.workspaceId)
      .executeTakeFirst();
    let inReadableScope = false;
    if (workspace?.scope_type === "project") {
      inReadableScope = workspace.scope_id === projectId;
    } else if (workspace?.scope_type === "user") {
      inReadableScope = workspace.scope_id === actorUserId;
    } else if (workspace?.scope_type === "task") {
      const task = await transaction
        .selectFrom("tasks")
        .select("id")
        .where("id", "=", workspace.scope_id)
        .where("project_id", "=", projectId)
        .executeTakeFirst();
      inReadableScope = task !== undefined;
    }
    const entry =
      workspace && inReadableScope
        ? await transaction
            .selectFrom("workspace_manifest_entries")
            .select(["sha256"])
            .where("workspace_id", "=", workspace.id)
            .where("sync_version", "=", workspace.sync_version)
            .where("path", "=", attachment.path)
            .executeTakeFirst()
        : undefined;
    const readable =
      workspace !== undefined &&
      workspace.lifecycle !== "deleted" &&
      inReadableScope &&
      entry !== undefined &&
      (attachment.sha256 === undefined || attachment.sha256 === entry.sha256);
    results.push({
      workspaceId: attachment.workspaceId,
      taskWorkspaceId: attachment.workspaceId,
      path: attachment.path,
      readable,
    });
  }
  return results;
}

async function readCommentReplay(
  transaction: Transaction<DatabaseSchema>,
  input: {
    projectId: string;
    actorMembershipId: string;
    idempotencyKey: string;
    requestSha256: string;
  },
  operation: "comment_create" | "comment_update" | "comment_delete" | "comment_hide",
): Promise<TaskCommentMutationResult | null> {
  const replay = await transaction
    .selectFrom("task_operation_idempotency")
    .select(["request_sha256", "response"])
    .where("project_id", "=", input.projectId)
    .where("actor_membership_id", "=", input.actorMembershipId)
    .where("operation", "=", operation)
    .where("idempotency_key", "=", input.idempotencyKey)
    .executeTakeFirst();
  if (!replay) {
    return null;
  }
  if (replay.request_sha256 !== input.requestSha256) {
    return { ok: false, reason: "idempotency_conflict" };
  }
  const commentId = replay.response.commentId;
  if (typeof commentId !== "string") {
    throw new Error("TASK_COMMENT_IDEMPOTENCY_RESPONSE_MISSING");
  }
  const comment = await transaction
    .selectFrom("task_comments")
    .selectAll()
    .where("id", "=", commentId)
    .executeTakeFirstOrThrow();
  return { ok: true, comment: mapComment(comment), idempotentReplay: true };
}

async function writeCommentMutationRecords(
  transaction: Transaction<DatabaseSchema>,
  input: {
    operation: "comment_create" | "comment_update" | "comment_delete" | "comment_hide";
    actorMembershipId: string;
    actorUserId: string;
    actorType: "human" | "agent";
    projectId: string;
    taskId: string;
    comment: TaskCommentRecord;
    requestId: string;
    idempotencyKey: string;
    requestSha256: string;
    action: string;
    reasonCode: string;
    eventType: string;
  },
): Promise<void> {
  await transaction
    .insertInto("task_operation_idempotency")
    .values({
      id: randomUUID(),
      project_id: input.projectId,
      actor_membership_id: input.actorMembershipId,
      operation: input.operation,
      idempotency_key: input.idempotencyKey,
      request_sha256: input.requestSha256,
      response: { commentId: input.comment.id, commentVersion: input.comment.version },
      response_task_id: input.taskId,
    })
    .execute();
  await writeAudit(transaction, {
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    projectId: input.projectId,
    targetType: "task_comment",
    targetId: input.comment.id,
    requestId: input.requestId,
    action: input.action,
    result: "success",
    reasonCode: input.reasonCode,
    taskVersionBefore: null,
    taskVersionAfter: null,
    metadata: {
      taskId: input.taskId,
      commentVersion: input.comment.version,
    },
  });
  await transaction
    .insertInto("outbox_events")
    .values({
      id: randomUUID(),
      project_id: input.projectId,
      audience_type: "project",
      audience_id: input.projectId,
      aggregate_type: "task_comment",
      aggregate_id: input.comment.id,
      event_type: input.eventType,
      request_id: input.requestId,
      payload: {
        taskId: input.taskId,
        commentId: input.comment.id,
        commentVersion: input.comment.version,
      },
    })
    .execute();
}

function mapDecisionReason(
  reason:
    | "membership_inactive"
    | "task_archived"
    | "comment_not_found"
    | "comment_deleted"
    | "comment_hidden"
    | "comment_immutable"
    | "forbidden"
    | "attachment_forbidden",
): Exclude<TaskCommentMutationResult, { ok: true }>["reason"] {
  if (reason === "attachment_forbidden") {
    return "comment_attachment_forbidden";
  }
  if (
    reason === "comment_deleted" ||
    reason === "comment_hidden" ||
    reason === "comment_immutable"
  ) {
    return "comment_immutable";
  }
  if (reason === "membership_inactive") {
    return "forbidden";
  }
  return reason;
}

function mapComment(comment: {
  id: string;
  project_id: string;
  task_id: string;
  author_membership_id: string;
  body: string | null;
  attachments: TaskCommentAttachmentRecord[];
  version: string;
  edited_at: Date | null;
  deleted_at: Date | null;
  hidden_at: Date | null;
  hidden_by_membership_id: string | null;
  hidden_reason: string | null;
  created_at: Date;
  updated_at: Date;
}): TaskCommentRecord {
  return {
    id: comment.id,
    projectId: comment.project_id,
    taskId: comment.task_id,
    authorMembershipId: comment.author_membership_id,
    body: comment.body,
    attachments: comment.attachments,
    version: Number(comment.version),
    editedAt: comment.edited_at?.toISOString() ?? null,
    deletedAt: comment.deleted_at?.toISOString() ?? null,
    hiddenAt: comment.hidden_at?.toISOString() ?? null,
    hiddenByMembershipId: comment.hidden_by_membership_id,
    hiddenReason: comment.hidden_reason,
    createdAt: comment.created_at.toISOString(),
    updatedAt: comment.updated_at.toISOString(),
  };
}
