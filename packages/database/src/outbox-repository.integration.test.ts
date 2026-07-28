import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase } from "./client.js";
import { FoundationRepository } from "./foundation-repository.js";
import { migrateToLatest } from "./migrator.js";
import { EventRepository, OutboxRepository } from "./outbox-repository.js";
import { canonicalDatabaseTarget, resetFormalSchema } from "./schema-profile.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const database = connectionString ? createDatabase(connectionString) : null;

const ownerId = "01000000-0000-4000-8000-000000000001";
const projectId = "02000000-0000-4000-8000-000000000001";
const otherOwnerId = "01000000-0000-4000-8000-000000000002";
const otherProjectId = "02000000-0000-4000-8000-000000000002";

describeWithDatabase("outbox projection PostgreSQL integration", () => {
  beforeAll(async () => {
    const target = canonicalDatabaseTarget(connectionString!);
    await resetFormalSchema({ database: database!, target, confirmation: target });
    await migrateToLatest(database!);
    const foundation = new FoundationRepository(database!);
    await seedProject(foundation, {
      ownerId,
      projectId,
      ownerMembershipId: "03000000-0000-4000-8000-000000000001",
      userWorkspaceId: "04000000-0000-4000-8000-000000000001",
      projectWorkspaceId: "05000000-0000-4000-8000-000000000001",
      login: "outbox-owner",
      key: "EVT",
    });
    await seedProject(foundation, {
      ownerId: otherOwnerId,
      projectId: otherProjectId,
      ownerMembershipId: "03000000-0000-4000-8000-000000000002",
      userWorkspaceId: "04000000-0000-4000-8000-000000000002",
      projectWorkspaceId: "05000000-0000-4000-8000-000000000002",
      login: "other-owner",
      key: "OTH",
    });
  });

  afterAll(async () => {
    await database?.destroy();
  });

  it("projects only committed outbox rows and retries a failed projection", async () => {
    const repository = new OutboxRepository(database!);
    await expect(
      database!.transaction().execute(async (transaction) => {
        await insertOutbox(transaction, {
          id: "10000000-0000-4000-8000-000000000001",
          projectId,
          aggregateId: "11000000-0000-4000-8000-000000000001",
        });
        throw new Error("ROLLBACK");
      }),
    ).rejects.toThrow("ROLLBACK");
    await expect(repository.dispatchNext({ now: farFuture() })).resolves.toEqual({
      status: "empty",
    });

    const outboxId = "10000000-0000-4000-8000-000000000002";
    await insertOutbox(database!, {
      id: outboxId,
      projectId,
      aggregateId: "11000000-0000-4000-8000-000000000002",
    });
    await expect(
      repository.dispatchNext({
        now: farFuture(),
        retryDelayMs: 0,
        beforeProjection: () => {
          throw Object.assign(new Error("fixture failure"), { code: "FIXTURE_RETRY" });
        },
      }),
    ).rejects.toMatchObject({
      outboxEventId: outboxId,
      errorCode: "FIXTURE_RETRY",
    });
    await expect(repository.dispatchNext({ now: farFuture() })).resolves.toMatchObject({
      status: "processed",
      outboxEventId: outboxId,
    });

    const outbox = await database!
      .selectFrom("outbox_events")
      .select(["attempt_count", "last_error_code", "processed_at"])
      .where("id", "=", outboxId)
      .executeTakeFirstOrThrow();
    expect(outbox).toMatchObject({ attempt_count: 1, last_error_code: null });
    expect(outbox.processed_at).toBeInstanceOf(Date);
  });

  it("uses SKIP LOCKED across two consumers and keeps outbox-id projection idempotent", async () => {
    const ids = Array.from({ length: 12 }, (_, index) => {
      const suffix = (index + 10).toString().padStart(12, "0");
      return {
        id: `10000000-0000-4000-8000-${suffix}`,
        aggregateId: `11000000-0000-4000-8000-${suffix}`,
      };
    });
    await database!
      .insertInto("outbox_events")
      .values(
        ids.map((entry) => ({
          id: entry.id,
          project_id: projectId,
          audience_type: "project",
          audience_id: projectId,
          aggregate_type: "task",
          aggregate_id: entry.aggregateId,
          event_type: "task.updated",
          request_id: `request-${entry.id}`,
          payload: {},
        })),
      )
      .execute();

    const claimBarrier = createClaimBarrier(2);
    const concurrent = await Promise.all([
      new OutboxRepository(database!).dispatchNext({
        now: farFuture(),
        beforeProjection: claimBarrier.arrive,
      }),
      new OutboxRepository(database!).dispatchNext({
        now: farFuture(),
        beforeProjection: claimBarrier.arrive,
      }),
    ]);
    expect(concurrent.every((result) => result.status === "processed")).toBe(true);
    expect(
      new Set(
        concurrent.flatMap((result) =>
          result.status === "processed" ? [result.outboxEventId] : [],
        ),
      ).size,
    ).toBe(2);
    const repository = new OutboxRepository(database!);
    for (let index = 2; index < ids.length; index += 1) {
      await expect(repository.dispatchNext({ now: farFuture() })).resolves.toMatchObject({
        status: "processed",
      });
    }

    const projections = await database!
      .selectFrom("resource_invalidation_events")
      .select(({ fn }) => [
        fn.countAll<string>().as("count"),
        fn.count<string>("outbox_event_id").distinct().as("distinct_count"),
      ])
      .where(
        "outbox_event_id",
        "in",
        ids.map((entry) => entry.id),
      )
      .executeTakeFirstOrThrow();
    expect(Number(projections.count)).toBe(ids.length);
    expect(Number(projections.distinct_count)).toBe(ids.length);

    const replayId = ids[0]!.id;
    const original = await database!
      .selectFrom("resource_invalidation_events")
      .select("cursor")
      .where("outbox_event_id", "=", replayId)
      .executeTakeFirstOrThrow();
    await database!
      .updateTable("outbox_events")
      .set({ processed_at: null })
      .where("id", "=", replayId)
      .execute();
    await new OutboxRepository(database!).dispatchNext({ now: farFuture() });
    const replayed = await database!
      .selectFrom("resource_invalidation_events")
      .select("cursor")
      .where("outbox_event_id", "=", replayId)
      .executeTakeFirstOrThrow();
    expect(replayed.cursor).toBe(original.cursor);
  });

  it("filters replay by server membership and rejects expired cursors", async () => {
    const otherOutboxId = "10000000-0000-4000-8000-000000000099";
    await insertOutbox(database!, {
      id: otherOutboxId,
      projectId: otherProjectId,
      aggregateId: "11000000-0000-4000-8000-000000000099",
    });
    await new OutboxRepository(database!).dispatchNext({ now: farFuture() });
    const ownerUserOutboxId = "10000000-0000-4000-8000-000000000097";
    const otherUserOutboxId = "10000000-0000-4000-8000-000000000098";
    await insertUserOutbox(database!, {
      id: ownerUserOutboxId,
      userId: ownerId,
      aggregateId: ownerId,
    });
    await insertUserOutbox(database!, {
      id: otherUserOutboxId,
      userId: otherOwnerId,
      aggregateId: otherOwnerId,
    });
    await new OutboxRepository(database!).dispatchNext({ now: farFuture() });
    await new OutboxRepository(database!).dispatchNext({ now: farFuture() });

    const events = new EventRepository(database!);
    const visible = await events.readAuthorized({ userId: ownerId, afterCursor: "0" });
    expect(visible.length).toBeGreaterThan(0);
    expect(
      new Set(
        visible.filter((event) => event.audienceType === "project").map((event) => event.projectId),
      ),
    ).toEqual(new Set([projectId]));
    expect(visible.some((event) => event.outboxEventId === otherOutboxId)).toBe(false);
    expect(visible.some((event) => event.outboxEventId === ownerUserOutboxId)).toBe(true);
    expect(visible.some((event) => event.outboxEventId === otherUserOutboxId)).toBe(false);

    const cursor = visible.at(-1)!.cursor;
    await events.pruneThrough(cursor);
    await expect(
      events.readAuthorized({ userId: ownerId, afterCursor: "0" }),
    ).rejects.toMatchObject({
      retentionFloor: cursor,
    });
    await expect(events.readAuthorized({ userId: ownerId, afterCursor: cursor })).resolves.toEqual(
      [],
    );
  });
});

async function seedProject(
  foundation: FoundationRepository,
  input: {
    ownerId: string;
    projectId: string;
    ownerMembershipId: string;
    userWorkspaceId: string;
    projectWorkspaceId: string;
    login: string;
    key: string;
  },
) {
  await foundation.createUserWithWorkspace({
    id: input.ownerId,
    workspaceId: input.userWorkspaceId,
    loginName: input.login,
    normalizedLoginName: input.login,
    passwordHash: "argon2id$fixture",
  });
  await foundation.createProjectWithWorkspace({
    id: input.projectId,
    ownerMembershipId: input.ownerMembershipId,
    workspaceId: input.projectWorkspaceId,
    key: input.key,
    name: `${input.key} project`,
    ownerUserId: input.ownerId,
  });
}

async function insertOutbox(
  executor: Pick<NonNullable<typeof database>, "insertInto">,
  input: { id: string; projectId: string; aggregateId: string },
) {
  await executor
    .insertInto("outbox_events")
    .values({
      id: input.id,
      project_id: input.projectId,
      audience_type: "project",
      audience_id: input.projectId,
      aggregate_type: "task",
      aggregate_id: input.aggregateId,
      event_type: "task.updated",
      request_id: `request-${input.id}`,
      payload: {},
    })
    .execute();
}

async function insertUserOutbox(
  executor: Pick<NonNullable<typeof database>, "insertInto">,
  input: { id: string; userId: string; aggregateId: string },
) {
  await executor
    .insertInto("outbox_events")
    .values({
      id: input.id,
      project_id: null,
      audience_type: "user",
      audience_id: input.userId,
      aggregate_type: "user-profile",
      aggregate_id: input.aggregateId,
      event_type: "user-profile.updated",
      request_id: `request-${input.id}`,
      payload: {},
    })
    .execute();
}

function createClaimBarrier(required: number) {
  let arrivals = 0;
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    arrive: async () => {
      arrivals += 1;
      if (arrivals >= required) {
        release();
      }
      await released;
    },
  };
}

function farFuture(): Date {
  return new Date("2099-01-01T00:00:00.000Z");
}
