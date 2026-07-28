import { sql } from "kysely";

import type { Database } from "./client.js";

export interface ResourceInvalidationRecord {
  cursor: string;
  outboxEventId: string;
  projectId: string | null;
  audienceType: "user" | "project";
  audienceId: string;
  resourceType: string;
  resourceId: string;
  eventType: string;
  createdAt: Date;
}

export type OutboxDispatchResult =
  { status: "empty" } | { status: "processed"; outboxEventId: string; cursor: string };

export class OutboxDispatchError extends Error {
  constructor(
    public readonly outboxEventId: string,
    public readonly errorCode: string,
    options?: ErrorOptions,
  ) {
    super(`outbox event ${outboxEventId} could not be projected`, options);
    this.name = "OutboxDispatchError";
  }
}

export class EventCursorExpiredError extends Error {
  constructor(
    public readonly requestedCursor: string,
    public readonly retentionFloor: string,
  ) {
    super(`event cursor ${requestedCursor} is older than retention floor ${retentionFloor}`);
    this.name = "EventCursorExpiredError";
  }
}

export class OutboxRepository {
  constructor(private readonly database: Database) {}

  async dispatchNext(
    options: {
      beforeProjection?: (outboxEventId: string) => Promise<void> | void;
      now?: Date;
      retryDelayMs?: number;
    } = {},
  ): Promise<OutboxDispatchResult> {
    const now = options.now ?? new Date();
    let selectedId: string | undefined;

    try {
      return await this.database.transaction().execute(async (transaction) => {
        const outbox = await transaction
          .selectFrom("outbox_events")
          .select([
            "id",
            "project_id",
            "audience_type",
            "audience_id",
            "aggregate_type",
            "aggregate_id",
            "event_type",
            "created_at",
          ])
          .where("processed_at", "is", null)
          .where("available_at", "<=", now)
          .orderBy("available_at")
          .orderBy("created_at")
          .orderBy("id")
          .limit(1)
          .forUpdate()
          .skipLocked()
          .executeTakeFirst();

        if (!outbox) {
          return { status: "empty" };
        }
        selectedId = outbox.id;
        await options.beforeProjection?.(outbox.id);

        const inserted = await transaction
          .insertInto("resource_invalidation_events")
          .values({
            outbox_event_id: outbox.id,
            project_id: outbox.project_id!,
            audience_type: outbox.audience_type,
            audience_id: outbox.audience_id,
            resource_type: outbox.aggregate_type,
            resource_id: outbox.aggregate_id,
            event_type: outbox.event_type,
            created_at: outbox.created_at,
          })
          .onConflict((conflict) => conflict.column("outbox_event_id").doNothing())
          .returning("cursor")
          .executeTakeFirst();

        const projection =
          inserted ??
          (await transaction
            .selectFrom("resource_invalidation_events")
            .select("cursor")
            .where("outbox_event_id", "=", outbox.id)
            .executeTakeFirstOrThrow());

        await transaction
          .updateTable("outbox_events")
          .set({
            processed_at: now,
            last_error_code: null,
          })
          .where("id", "=", outbox.id)
          .where("processed_at", "is", null)
          .executeTakeFirstOrThrow();

        return {
          status: "processed",
          outboxEventId: outbox.id,
          cursor: projection.cursor,
        };
      });
    } catch (error) {
      if (!selectedId) {
        throw error;
      }
      const errorCode = stableErrorCode(error);
      const retryAt = new Date(now.getTime() + (options.retryDelayMs ?? 1_000));
      await this.database
        .updateTable("outbox_events")
        .set({
          attempt_count: sql`attempt_count + 1`,
          last_error_code: errorCode,
          available_at: retryAt,
        })
        .where("id", "=", selectedId)
        .where("processed_at", "is", null)
        .execute();
      throw new OutboxDispatchError(selectedId, errorCode, { cause: error });
    }
  }

  async countPending(): Promise<number> {
    const row = await this.database
      .selectFrom("outbox_events")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("processed_at", "is", null)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }
}

export class EventRepository {
  constructor(private readonly database: Database) {}

  async readAuthorized(input: {
    userId: string;
    afterCursor: string;
    limit?: number;
  }): Promise<ResourceInvalidationRecord[]> {
    const afterCursor = normalizeCursor(input.afterCursor);
    const state = await this.database
      .selectFrom("event_projection_state")
      .select("retention_floor")
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();
    if (BigInt(afterCursor) < BigInt(state.retention_floor)) {
      throw new EventCursorExpiredError(afterCursor, state.retention_floor);
    }

    const rows = await this.database
      .selectFrom("resource_invalidation_events as event")
      .leftJoin("memberships as membership", (join) =>
        join
          .onRef("membership.project_id", "=", "event.project_id")
          .on("membership.user_id", "=", input.userId)
          .on("membership.status", "=", "active"),
      )
      .select([
        "event.cursor",
        "event.outbox_event_id",
        "event.project_id",
        "event.audience_type",
        "event.audience_id",
        "event.resource_type",
        "event.resource_id",
        "event.event_type",
        "event.created_at",
      ])
      .where("event.cursor", ">", afterCursor)
      .where((expression) =>
        expression.or([
          expression.and([
            expression("event.audience_type", "=", "user"),
            expression("event.audience_id", "=", input.userId),
          ]),
          expression.and([
            expression("event.audience_type", "=", "project"),
            expression("membership.id", "is not", null),
          ]),
        ]),
      )
      .orderBy("event.cursor")
      .limit(Math.min(Math.max(input.limit ?? 100, 1), 500))
      .execute();

    return rows.map((row) => ({
      cursor: row.cursor,
      outboxEventId: row.outbox_event_id,
      projectId: row.project_id,
      audienceType: row.audience_type,
      audienceId: row.audience_id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      eventType: row.event_type,
      createdAt: row.created_at,
    }));
  }

  async pruneThrough(cursor: string, now = new Date()): Promise<void> {
    const normalized = normalizeCursor(cursor);
    await this.database.transaction().execute(async (transaction) => {
      await transaction
        .deleteFrom("resource_invalidation_events")
        .where("cursor", "<=", normalized)
        .execute();
      await transaction
        .updateTable("event_projection_state")
        .set({
          retention_floor: sql`greatest(retention_floor, ${normalized}::bigint)`,
          updated_at: now,
        })
        .where("id", "=", 1)
        .executeTakeFirstOrThrow();
    });
  }
}

function normalizeCursor(cursor: string): string {
  if (!/^(0|[1-9][0-9]*)$/u.test(cursor)) {
    throw new TypeError("event cursor must be an unsigned decimal integer");
  }
  const value = BigInt(cursor);
  if (value > 9_223_372_036_854_775_807n) {
    throw new TypeError("event cursor exceeds PostgreSQL bigint");
  }
  return value.toString();
}

function stableErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]{1,80}$/u.test(error.code)
  ) {
    return error.code;
  }
  return "OUTBOX_PROJECTION_FAILED";
}
