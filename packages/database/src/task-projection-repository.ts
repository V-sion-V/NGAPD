import { createHash, randomUUID } from "node:crypto";

import {
  evaluateCompletionReadiness,
  isCriticalTaskNotification,
  type TaskNotificationKind,
} from "@ngapd/domain";
import { sql, type Transaction } from "kysely";

import type { Database } from "./client.js";
import { writeAudit } from "./foundation-repository.js";
import type { DatabaseSchema } from "./types.js";

export interface TaskProjectionOutboxEvent {
  id: string;
  projectId: string | null;
  audienceType: "user" | "project";
  audienceId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  requestId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface TaskActivityProjectionRecord {
  cursor: string;
  id: string;
  projectId: string;
  taskId: string;
  eventType: string;
  actorUserId: string | null;
  resourceRefs: Record<string, string>;
  occurredAt: Date;
}

export interface TaskNotificationRecord {
  id: string;
  projectId: string;
  taskId: string | null;
  projectKey: string | null;
  taskKey: string | null;
  eventType: string;
  critical: boolean;
  resourceRefs: Record<string, string>;
  read: boolean;
  version: number;
  createdAt: Date;
}

type TaskProjectionTransaction = Transaction<DatabaseSchema>;

const NOTIFICATION_EVENT_TYPES = new Set<TaskNotificationKind>([
  "task.owner.changed",
  "task.blocker.changed",
  "task.dependency.requested",
  "task.dependency.resolved",
  "task.comment.created",
  "task.comment.mentioned",
  "task.due.reminder",
  "task.archived",
  "task.deleted",
  "task.permission.result",
]);

/**
 * Projects a committed Task outbox event in the same transaction that marks it
 * processed. The outbox id is the idempotency boundary for every derived row.
 */
export async function projectTaskOutboxEvent(
  transaction: TaskProjectionTransaction,
  event: TaskProjectionOutboxEvent,
): Promise<void> {
  const projected = await transaction
    .selectFrom("task_projection_events")
    .select("outbox_event_id")
    .where("outbox_event_id", "=", event.id)
    .executeTakeFirst();
  if (projected) {
    return;
  }

  const taskId = taskIdFromEvent(event);
  const projectId =
    event.projectId ??
    (typeof event.payload.projectId === "string" ? event.payload.projectId : null);
  if (projectId && taskId && isTaskSourceEvent(event)) {
    const actor = await transaction
      .selectFrom("audit_events")
      .select("actor_user_id")
      .where("request_id", "=", event.requestId)
      .orderBy("created_at")
      .executeTakeFirst();
    await transaction
      .insertInto("task_activity_projection")
      .values({
        id: randomUUID(),
        outbox_event_id: event.id,
        project_id: projectId,
        task_id: taskId,
        event_type: event.eventType,
        actor_user_id: actor?.actor_user_id ?? null,
        resource_refs: safeResourceRefs(event, taskId),
        occurred_at: event.createdAt,
      })
      .onConflict((conflict) => conflict.column("outbox_event_id").doNothing())
      .execute();
  }

  if (projectId && taskId && isTaskSourceEvent(event)) {
    await projectReadiness(transaction, projectId, taskId, event);
  }
  if (
    projectId &&
    taskId &&
    NOTIFICATION_EVENT_TYPES.has(event.eventType as TaskNotificationKind)
  ) {
    await projectEventNotification(
      transaction,
      event,
      projectId,
      taskId,
      event.eventType as TaskNotificationKind,
    );
  }

  await transaction
    .insertInto("task_projection_events")
    .values({ outbox_event_id: event.id })
    .onConflict((conflict) => conflict.column("outbox_event_id").doNothing())
    .execute();
}

export class TaskProjectionRepository {
  constructor(private readonly database: Database) {}

  async listActivity(input: {
    projectId: string;
    taskId: string;
    afterCursor?: string;
    limit?: number;
  }): Promise<TaskActivityProjectionRecord[]> {
    const rows = await this.database
      .selectFrom("task_activity_projection")
      .selectAll()
      .where("project_id", "=", input.projectId)
      .where("task_id", "=", input.taskId)
      .where("cursor", ">", normalizeBigintCursor(input.afterCursor ?? "0"))
      .orderBy("cursor")
      .limit(Math.min(Math.max(input.limit ?? 50, 1), 200))
      .execute();
    return rows.map((row) => ({
      cursor: row.cursor,
      id: row.id,
      projectId: row.project_id,
      taskId: row.task_id,
      eventType: row.event_type,
      actorUserId: row.actor_user_id,
      resourceRefs: stringRecord(row.resource_refs),
      occurredAt: row.occurred_at,
    }));
  }

  async listNotifications(input: {
    userId: string;
    after?: { createdAt: Date; id: string };
    afterId?: string;
    limit?: number;
  }): Promise<TaskNotificationRecord[]> {
    const cursor =
      input.after ??
      (input.afterId
        ? await this.database
            .selectFrom("task_notifications")
            .select(["created_at as createdAt", "id"])
            .where("recipient_user_id", "=", input.userId)
            .where("id", "=", input.afterId)
            .executeTakeFirst()
        : undefined);
    let query = this.database
      .selectFrom("task_notifications as notification")
      .leftJoin("memberships as navigation_membership", (join) =>
        join
          .onRef("navigation_membership.project_id", "=", "notification.project_id")
          .onRef("navigation_membership.user_id", "=", "notification.recipient_user_id")
          .on("navigation_membership.status", "=", "active"),
      )
      .leftJoin("projects as navigation_project", (join) =>
        join.onRef("navigation_project.id", "=", "navigation_membership.project_id"),
      )
      .leftJoin("tasks as navigation_task", (join) =>
        join
          .onRef("navigation_task.id", "=", "notification.task_id")
          .onRef("navigation_task.project_id", "=", "navigation_membership.project_id"),
      )
      .selectAll("notification")
      .select([
        "navigation_project.project_key as navigation_project_key",
        "navigation_task.task_key as navigation_task_key",
      ])
      .where("notification.recipient_user_id", "=", input.userId);
    if (cursor) {
      query = query.where((expression) =>
        expression.or([
          expression("notification.created_at", ">", cursor.createdAt),
          expression.and([
            expression("notification.created_at", "=", cursor.createdAt),
            expression("notification.id", ">", cursor.id),
          ]),
        ]),
      );
    }
    const rows = await query
      .orderBy("notification.created_at")
      .orderBy("notification.id")
      .limit(Math.min(Math.max(input.limit ?? 50, 1), 200))
      .execute();
    return rows.map(mapNotification);
  }

  async markNotificationRead(input: {
    userId: string;
    notificationId: string;
    expectedVersion: number;
    read: boolean;
    now: Date;
    requestId: string;
  }): Promise<
    | { ok: true; notification: TaskNotificationRecord }
    | { ok: false; reason: "notification_not_found" | "notification_version_conflict" }
  > {
    return this.database.transaction().execute(async (transaction) => {
      const notification = await transaction
        .selectFrom("task_notifications")
        .selectAll()
        .where("id", "=", input.notificationId)
        .where("recipient_user_id", "=", input.userId)
        .forUpdate()
        .executeTakeFirst();
      if (!notification) {
        return { ok: false, reason: "notification_not_found" };
      }
      if (Number(notification.version) !== input.expectedVersion) {
        return { ok: false, reason: "notification_version_conflict" };
      }
      const updated = await transaction
        .updateTable("task_notifications")
        .set({
          read_at: input.read ? input.now : null,
          version: String(input.expectedVersion + 1),
          updated_at: input.now,
        })
        .where("id", "=", input.notificationId)
        .returningAll()
        .executeTakeFirstOrThrow();
      await writeAudit(transaction, {
        actorUserId: input.userId,
        actorType: "human",
        projectId: notification.project_id,
        targetType: "notification",
        targetId: notification.id,
        requestId: input.requestId,
        action: "task.notification.read",
        result: "success",
        reasonCode: "TASK_NOTIFICATION_READ_CHANGED",
        beforeVersion: Number(notification.version),
        afterVersion: Number(updated.version),
        metadata: {},
      });
      await transaction
        .insertInto("outbox_events")
        .values({
          id: randomUUID(),
          project_id: null,
          audience_type: "user",
          audience_id: input.userId,
          aggregate_type: "notification",
          aggregate_id: notification.id,
          event_type: "notification.read.changed",
          request_id: input.requestId,
          payload: {
            notificationId: notification.id,
            version: Number(updated.version),
          },
          created_at: input.now,
          available_at: input.now,
        })
        .onConflict((conflict) =>
          conflict.columns(["request_id", "event_type", "aggregate_id"]).doNothing(),
        )
        .execute();
      const updatedWithNavigation = await transaction
        .selectFrom("task_notifications as notification")
        .leftJoin("memberships as navigation_membership", (join) =>
          join
            .onRef("navigation_membership.project_id", "=", "notification.project_id")
            .onRef("navigation_membership.user_id", "=", "notification.recipient_user_id")
            .on("navigation_membership.status", "=", "active"),
        )
        .leftJoin("projects as navigation_project", (join) =>
          join.onRef("navigation_project.id", "=", "navigation_membership.project_id"),
        )
        .leftJoin("tasks as navigation_task", (join) =>
          join
            .onRef("navigation_task.id", "=", "notification.task_id")
            .onRef("navigation_task.project_id", "=", "navigation_membership.project_id"),
        )
        .selectAll("notification")
        .select([
          "navigation_project.project_key as navigation_project_key",
          "navigation_task.task_key as navigation_task_key",
        ])
        .where("notification.id", "=", updated.id)
        .executeTakeFirstOrThrow();
      return { ok: true, notification: mapNotification(updatedWithNavigation) };
    });
  }

  async readPreference(userId: string, eventType: string) {
    const critical = isCriticalNotification(eventType);
    const row = await this.database
      .selectFrom("task_notification_preferences")
      .selectAll()
      .where("user_id", "=", userId)
      .where("event_type", "=", eventType)
      .executeTakeFirst();
    return {
      eventType,
      enabled: critical ? true : (row?.enabled ?? true),
      configurable: !critical,
      version: Number(row?.version ?? 1),
    };
  }

  async updatePreference(input: {
    userId: string;
    eventType: string;
    enabled: boolean;
    expectedVersion: number;
    now: Date;
    requestId: string;
  }): Promise<
    | {
        ok: true;
        preference: {
          eventType: string;
          enabled: boolean;
          configurable: true;
          version: number;
        };
      }
    | {
        ok: false;
        reason: "notification_preference_critical" | "notification_version_conflict";
      }
  > {
    if (isCriticalNotification(input.eventType)) {
      return { ok: false, reason: "notification_preference_critical" };
    }
    return this.database.transaction().execute(async (transaction) => {
      const existing = await transaction
        .selectFrom("task_notification_preferences")
        .selectAll()
        .where("user_id", "=", input.userId)
        .where("event_type", "=", input.eventType)
        .forUpdate()
        .executeTakeFirst();
      const currentVersion = Number(existing?.version ?? 1);
      if (currentVersion !== input.expectedVersion) {
        return { ok: false, reason: "notification_version_conflict" };
      }
      const nextVersion = existing ? currentVersion + 1 : 1;
      await transaction
        .insertInto("task_notification_preferences")
        .values({
          user_id: input.userId,
          event_type: input.eventType,
          enabled: input.enabled,
          version: String(nextVersion),
          created_at: input.now,
          updated_at: input.now,
        })
        .onConflict((conflict) =>
          conflict.columns(["user_id", "event_type"]).doUpdateSet({
            enabled: input.enabled,
            version: String(nextVersion),
            updated_at: input.now,
          }),
        )
        .execute();
      await writeAudit(transaction, {
        actorUserId: input.userId,
        actorType: "human",
        projectId: null,
        targetType: "notification_preference",
        targetId: input.userId,
        requestId: input.requestId,
        action: "task.notification.preference.update",
        result: "success",
        reasonCode: "TASK_NOTIFICATION_PREFERENCE_UPDATED",
        beforeVersion: currentVersion,
        afterVersion: nextVersion,
        metadata: { eventType: input.eventType, enabled: input.enabled },
      });
      await transaction
        .insertInto("outbox_events")
        .values({
          id: randomUUID(),
          project_id: null,
          audience_type: "user",
          audience_id: input.userId,
          aggregate_type: "notification_preference",
          aggregate_id: input.userId,
          event_type: "notification.preference.changed",
          request_id: input.requestId,
          payload: { eventType: input.eventType, version: nextVersion },
          created_at: input.now,
          available_at: input.now,
        })
        .onConflict((conflict) =>
          conflict.columns(["request_id", "event_type", "aggregate_id"]).doNothing(),
        )
        .execute();
      return {
        ok: true,
        preference: {
          eventType: input.eventType,
          enabled: input.enabled,
          configurable: true as const,
          version: nextVersion,
        },
      };
    });
  }

  async enqueueDueReminders(input: { now: Date; through: Date }): Promise<number> {
    const dueTasks = await this.database
      .selectFrom("tasks")
      .select(["id", "project_id", "due_at"])
      .where("archived", "=", false)
      .where("frozen", "=", false)
      .where("base_status", "!=", "done")
      .where("due_at", "is not", null)
      .where("due_at", ">", input.now)
      .where("due_at", "<=", input.through)
      .execute();
    let inserted = 0;
    for (const task of dueTasks) {
      const owner = await resolveEffectiveOwner(this.database, task.project_id, task.id);
      if (!owner) {
        continue;
      }
      const occurrence = `due:${task.id}:${task.due_at!.toISOString()}`;
      const outbox = await this.database
        .insertInto("outbox_events")
        .values({
          id: randomUUID(),
          project_id: null,
          audience_type: "user",
          audience_id: owner.userId,
          aggregate_type: "task",
          aggregate_id: task.id,
          event_type: "task.due.reminder",
          request_id: occurrence.slice(0, 128),
          payload: {
            taskId: task.id,
            projectId: task.project_id,
            dueAt: task.due_at!.toISOString(),
            ownerMembershipId: owner.membershipId,
          },
          created_at: input.now,
          available_at: input.now,
        })
        .onConflict((conflict) =>
          conflict.columns(["request_id", "event_type", "aggregate_id"]).doNothing(),
        )
        .returning("id")
        .executeTakeFirst();
      inserted += outbox ? 1 : 0;
    }
    return inserted;
  }

  async rebuildProject(projectId: string, now = new Date()): Promise<void> {
    await this.database.transaction().execute(async (transaction) => {
      await transaction
        .deleteFrom("task_completion_readiness")
        .where("project_id", "=", projectId)
        .execute();
      const sourceEvents = await transaction
        .selectFrom("outbox_events")
        .select([
          "id",
          "project_id",
          "audience_type",
          "audience_id",
          "aggregate_type",
          "aggregate_id",
          "event_type",
          "request_id",
          "payload",
          "created_at",
        ])
        .where("aggregate_type", "in", ["task", "comment"])
        .orderBy("created_at")
        .orderBy("id")
        .execute();
      for (const event of sourceEvents) {
        const eventProjectId =
          event.project_id ??
          (typeof event.payload.projectId === "string" ? event.payload.projectId : null);
        if (eventProjectId !== projectId) {
          continue;
        }
        await transaction
          .deleteFrom("task_projection_events")
          .where("outbox_event_id", "=", event.id)
          .execute();
        await projectTaskOutboxEvent(transaction, {
          id: event.id,
          projectId: event.project_id,
          audienceType: event.audience_type,
          audienceId: event.audience_id,
          aggregateType: event.aggregate_type,
          aggregateId: event.aggregate_id,
          eventType: event.event_type,
          requestId: event.request_id,
          payload: event.payload,
          createdAt: event.created_at,
        });
      }
      const tasksWithoutSourceEvents = await transaction
        .selectFrom("tasks")
        .select("id")
        .where("project_id", "=", projectId)
        .where(
          "id",
          "not in",
          sourceEvents.length > 0
            ? sourceEvents
                .map((event) =>
                  taskIdFromEvent({
                    id: event.id,
                    projectId: event.project_id,
                    audienceType: event.audience_type,
                    audienceId: event.audience_id,
                    aggregateType: event.aggregate_type,
                    aggregateId: event.aggregate_id,
                    eventType: event.event_type,
                    requestId: event.request_id,
                    payload: event.payload,
                    createdAt: event.created_at,
                  }),
                )
                .filter((taskId): taskId is string => taskId !== null)
            : [randomUUID()],
        )
        .execute();
      for (const task of tasksWithoutSourceEvents) {
        await projectReadiness(
          transaction,
          projectId,
          task.id,
          {
            id: randomUUID(),
            projectId,
            audienceType: "project",
            audienceId: projectId,
            aggregateType: "task",
            aggregateId: task.id,
            eventType: "task.projection.rebuilt",
            requestId: `projection-rebuild:${projectId}`,
            payload: { taskId: task.id },
            createdAt: now,
          },
          false,
        );
      }
    });
  }
}

async function projectReadiness(
  transaction: TaskProjectionTransaction,
  projectId: string,
  changedTaskId: string,
  event: TaskProjectionOutboxEvent,
  notify = true,
): Promise<void> {
  const changed = await transaction
    .selectFrom("tasks")
    .select(["id", "parent_task_id"])
    .where("project_id", "=", projectId)
    .where("id", "=", changedTaskId)
    .executeTakeFirst();
  const successorRows = await transaction
    .selectFrom("task_dependencies")
    .select("successor_task_id")
    .where("project_id", "=", projectId)
    .where("predecessor_task_id", "=", changedTaskId)
    .execute();
  const candidateIds = new Set<string>([
    changedTaskId,
    ...(changed?.parent_task_id ? [changed.parent_task_id] : []),
    ...successorRows.map((row) => row.successor_task_id),
  ]);
  for (const taskId of [...candidateIds].sort()) {
    const task = await transaction
      .selectFrom("tasks")
      .select(["id", "project_id", "parent_graph_scope_id", "base_status", "archived", "version"])
      .where("project_id", "=", projectId)
      .where("id", "=", taskId)
      .executeTakeFirst();
    if (!task) {
      continue;
    }
    const [children, predecessors, blockers, graph, owner] = await Promise.all([
      transaction
        .selectFrom("tasks")
        .select(["id", "base_status", "archived", "version"])
        .where("project_id", "=", projectId)
        .where("parent_task_id", "=", task.id)
        .execute(),
      transaction
        .selectFrom("task_dependencies as dependency")
        .innerJoin("tasks as predecessor", "predecessor.id", "dependency.predecessor_task_id")
        .select([
          "predecessor.id",
          "predecessor.base_status",
          "predecessor.archived",
          "predecessor.version",
        ])
        .where("dependency.project_id", "=", projectId)
        .where("dependency.successor_task_id", "=", task.id)
        .execute(),
      transaction
        .selectFrom("task_blockers")
        .select("id")
        .where("task_id", "=", task.id)
        .where("resolved_at", "is", null)
        .execute(),
      transaction
        .selectFrom("sibling_task_graph_scopes")
        .select("graph_version")
        .where("id", "=", task.parent_graph_scope_id)
        .executeTakeFirstOrThrow(),
      resolveEffectiveOwner(transaction, projectId, task.id),
    ]);
    if (!owner) {
      continue;
    }
    const decision = evaluateCompletionReadiness({
      taskId: task.id,
      taskVersion: Number(task.version),
      graphVersion: Number(graph.graph_version),
      baseStatus: task.base_status,
      archived: task.archived,
      effectiveOwnerMembershipId: owner.membershipId,
      directChildren: children.map((child) => ({
        id: child.id,
        status: child.base_status,
        archived: child.archived,
        version: Number(child.version),
      })),
      predecessors: predecessors.map((predecessor) => ({
        id: predecessor.id,
        status: predecessor.base_status,
        archived: predecessor.archived,
        version: Number(predecessor.version),
      })),
      unresolvedBlockerIds: blockers.map((blocker) => blocker.id),
    });
    const fingerprint = decision.conditionMaterial
      ? createHash("sha256").update(decision.conditionMaterial).digest("hex")
      : null;
    const previous = await transaction
      .selectFrom("task_completion_readiness")
      .selectAll()
      .where("task_id", "=", task.id)
      .forUpdate()
      .executeTakeFirst();
    const changedState =
      !previous ||
      previous.ready !== decision.ready ||
      previous.condition_fingerprint !== fingerprint;
    await transaction
      .insertInto("task_completion_readiness")
      .values({
        task_id: task.id,
        project_id: projectId,
        ready: decision.ready,
        condition_fingerprint: fingerprint,
        version: String(previous ? Number(previous.version) + (changedState ? 1 : 0) : 1),
        evaluated_at: event.createdAt,
      })
      .onConflict((conflict) =>
        conflict.column("task_id").doUpdateSet({
          ready: decision.ready,
          condition_fingerprint: fingerprint,
          version: String(previous ? Number(previous.version) + (changedState ? 1 : 0) : 1),
          evaluated_at: event.createdAt,
        }),
      )
      .execute();
    if (notify && decision.ready && fingerprint) {
      const occurrenceId = randomUUID();
      const occurrence = await transaction
        .insertInto("task_completion_ready_occurrences")
        .values({
          id: occurrenceId,
          project_id: projectId,
          task_id: task.id,
          owner_membership_id: owner.membershipId,
          condition_fingerprint: fingerprint,
          source_outbox_event_id: event.id,
          created_at: event.createdAt,
        })
        .onConflict((conflict) =>
          conflict.columns(["task_id", "condition_fingerprint"]).doNothing(),
        )
        .returning("id")
        .executeTakeFirst();
      if (occurrence) {
        await insertNotification(transaction, {
          event,
          projectId,
          taskId: task.id,
          recipientUserId: owner.userId,
          recipientMembershipId: owner.membershipId,
          kind: "task.completion_ready",
          occurrenceKey: `completion-ready:${task.id}:${fingerprint}`,
          resourceRefs: { taskId: task.id },
        });
      }
    }
  }
}

async function projectEventNotification(
  transaction: TaskProjectionTransaction,
  event: TaskProjectionOutboxEvent,
  projectId: string,
  taskId: string,
  kind: TaskNotificationKind,
): Promise<void> {
  const recipient =
    event.audienceType === "user"
      ? await transaction
          .selectFrom("memberships")
          .select(["id as membershipId", "user_id as userId"])
          .where("project_id", "=", projectId)
          .where("user_id", "=", event.audienceId)
          .where("status", "=", "active")
          .executeTakeFirst()
      : await resolveEffectiveOwner(transaction, projectId, taskId);
  if (!recipient) {
    return;
  }
  if (!isCriticalTaskNotification(kind)) {
    const preference = await transaction
      .selectFrom("task_notification_preferences")
      .select("enabled")
      .where("user_id", "=", recipient.userId)
      .where("event_type", "=", kind)
      .executeTakeFirst();
    if (preference?.enabled === false) {
      return;
    }
  }
  await insertNotification(transaction, {
    event,
    projectId,
    taskId,
    recipientUserId: recipient.userId,
    recipientMembershipId: recipient.membershipId,
    kind,
    occurrenceKey: `outbox:${event.id}:${recipient.userId}:${kind}`,
    resourceRefs: safeResourceRefs(event, taskId),
  });
}

async function insertNotification(
  transaction: TaskProjectionTransaction,
  input: {
    event: TaskProjectionOutboxEvent;
    projectId: string;
    taskId: string;
    recipientUserId: string;
    recipientMembershipId: string;
    kind: TaskNotificationKind;
    occurrenceKey: string;
    resourceRefs: Record<string, string>;
  },
): Promise<void> {
  const id = randomUUID();
  const inserted = await transaction
    .insertInto("task_notifications")
    .values({
      id,
      project_id: input.projectId,
      recipient_user_id: input.recipientUserId,
      recipient_membership_id: input.recipientMembershipId,
      task_id: input.taskId,
      event_type: input.kind,
      occurrence_key: input.occurrenceKey,
      critical: isCriticalTaskNotification(input.kind),
      resource_refs: input.resourceRefs,
      source_outbox_event_id: input.event.id,
      created_at: input.event.createdAt,
      updated_at: input.event.createdAt,
    })
    .onConflict((conflict) => conflict.columns(["recipient_user_id", "occurrence_key"]).doNothing())
    .returning("id")
    .executeTakeFirst();
  if (!inserted) {
    return;
  }
  await transaction
    .insertInto("outbox_events")
    .values({
      id: randomUUID(),
      project_id: null,
      audience_type: "user",
      audience_id: input.recipientUserId,
      aggregate_type: "notification",
      aggregate_id: id,
      event_type: "notification.created",
      request_id: input.event.id,
      payload: {
        notificationId: id,
        taskId: input.taskId,
        projectId: input.projectId,
      },
      created_at: input.event.createdAt,
      available_at: input.event.createdAt,
    })
    .onConflict((conflict) =>
      conflict.columns(["request_id", "event_type", "aggregate_id"]).doNothing(),
    )
    .execute();
}

async function resolveEffectiveOwner(
  executor: Database | TaskProjectionTransaction,
  projectId: string,
  taskId: string,
): Promise<{ membershipId: string; userId: string } | undefined> {
  const rows = await sql<{
    membership_id: string;
    user_id: string;
  }>`
    with recursive lineage as (
      select id, parent_task_id, explicit_owner_membership_id, 0 as depth
      from tasks
      where id = ${taskId}::uuid and project_id = ${projectId}::uuid
      union all
      select parent.id, parent.parent_task_id, parent.explicit_owner_membership_id, child.depth + 1
      from tasks parent
      join lineage child on child.parent_task_id = parent.id
      where parent.project_id = ${projectId}::uuid
    )
    select membership.id as membership_id, membership.user_id
    from lineage
    join memberships membership on membership.id = lineage.explicit_owner_membership_id
    where membership.status = 'active'
    order by lineage.depth
    limit 1
  `.execute(executor);
  const owner = rows.rows[0];
  return owner ? { membershipId: owner.membership_id, userId: owner.user_id } : undefined;
}

function taskIdFromEvent(event: TaskProjectionOutboxEvent): string | null {
  if (event.aggregateType === "task") {
    return event.aggregateId;
  }
  return typeof event.payload.taskId === "string" ? event.payload.taskId : null;
}

function isTaskSourceEvent(event: TaskProjectionOutboxEvent): boolean {
  return (
    event.aggregateType === "task" ||
    event.aggregateType === "comment" ||
    event.eventType.startsWith("task.") ||
    event.eventType.startsWith("comment.")
  );
}

function safeResourceRefs(
  event: TaskProjectionOutboxEvent,
  taskId: string,
): Record<string, string> {
  const refs: Record<string, string> = {
    taskId,
    aggregateType: event.aggregateType.slice(0, 80),
    aggregateId: event.aggregateId.slice(0, 160),
  };
  for (const [key, value] of Object.entries(event.payload)) {
    if (
      /^[A-Za-z][A-Za-z0-9]{0,79}$/u.test(key) &&
      typeof value === "string" &&
      value.length <= 160 &&
      /(Id|Key|Version|At)$/u.test(key)
    ) {
      refs[key] = value;
    }
  }
  return refs;
}

function stringRecord(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function normalizeBigintCursor(value: string): string {
  if (!/^(0|[1-9][0-9]*)$/u.test(value)) {
    throw new TypeError("cursor must be an unsigned decimal integer");
  }
  return BigInt(value).toString();
}

function isCriticalNotification(eventType: string): boolean {
  return (
    NOTIFICATION_EVENT_TYPES.has(eventType as TaskNotificationKind) &&
    isCriticalTaskNotification(eventType as TaskNotificationKind)
  );
}

function mapNotification(row: {
  id: string;
  project_id: string;
  task_id: string | null;
  navigation_project_key?: string | null;
  navigation_task_key?: string | null;
  event_type: string;
  critical: boolean;
  resource_refs: Record<string, unknown>;
  read_at: Date | null;
  version: string;
  created_at: Date;
}): TaskNotificationRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    taskId: row.task_id,
    projectKey: row.navigation_project_key ?? null,
    taskKey: row.navigation_task_key ?? null,
    eventType: row.event_type,
    critical: row.critical,
    resourceRefs: stringRecord(row.resource_refs),
    read: row.read_at !== null,
    version: Number(row.version),
    createdAt: row.created_at,
  };
}
