import {
  FoundationRepository,
  canonicalDatabaseTarget,
  createDatabase,
  migrateToLatest,
  resetFormalSchema,
} from "@ngapd/database";
import { run, runMigrations, type Runner, type WorkerEvents } from "graphile-worker";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createOutboxTaskList } from "./outbox-task.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const database = connectionString ? createDatabase(connectionString) : null;
const projectId = "22000000-0000-4000-8000-000000000001";

describeWithDatabase("Graphile outbox task PostgreSQL integration", () => {
  beforeAll(async () => {
    const target = canonicalDatabaseTarget(connectionString!);
    await resetFormalSchema({ database: database!, target, confirmation: target });
    await database!.schema.dropSchema("graphile_worker").ifExists().cascade().execute();
    await migrateToLatest(database!);
    const foundation = new FoundationRepository(database!);
    const user = await foundation.createUserWithWorkspace({
      id: "21000000-0000-4000-8000-000000000001",
      workspaceId: "24000000-0000-4000-8000-000000000001",
      loginName: "worker-owner",
      normalizedLoginName: "worker-owner",
      passwordHash: "argon2id$fixture",
    });
    await foundation.createProjectWithWorkspace({
      id: projectId,
      ownerMembershipId: "23000000-0000-4000-8000-000000000001",
      workspaceId: "25000000-0000-4000-8000-000000000001",
      key: "WORK",
      name: "Worker project",
      ownerUserId: user.user.id,
    });
    await runMigrations({ connectionString: connectionString! });
  });

  afterAll(async () => {
    await database?.destroy();
  });

  it("uses two real workers to claim distinct rows and project each outbox id once", async () => {
    const rows = Array.from({ length: 12 }, (_, index) => {
      const suffix = (index + 1).toString().padStart(12, "0");
      return {
        id: `30000000-0000-4000-8000-${suffix}`,
        project_id: projectId,
        audience_type: "project" as const,
        audience_id: projectId,
        aggregate_type: "task",
        aggregate_id: `31000000-0000-4000-8000-${suffix}`,
        event_type: "task.updated",
        request_id: `worker-request-${index + 1}`,
        payload: {},
      };
    });
    await database!.insertInto("outbox_events").values(rows).execute();

    const claimBarrier = createClaimBarrier(2);
    const taskList = createOutboxTaskList(database!, {
      beforeProjection: claimBarrier.arrive,
      scheduleNext: false,
    });
    const runnerA = await startRunner(taskList);
    const runnerB = await startRunner(taskList);

    try {
      const completed = waitForJobs([runnerA.events, runnerB.events], "job:success", rows.length);
      await Promise.all(
        rows.map((_, index) =>
          (index % 2 === 0 ? runnerA : runnerB).addJob("outbox_dispatch", {}, { maxAttempts: 3 }),
        ),
      );
      await completed;
      expect(claimBarrier.arrivals()).toBeGreaterThanOrEqual(2);

      const [outbox, projections] = await Promise.all([
        database!
          .selectFrom("outbox_events")
          .select(({ fn }) => fn.countAll<string>().as("count"))
          .where(
            "id",
            "in",
            rows.map((row) => row.id),
          )
          .where("processed_at", "is not", null)
          .executeTakeFirstOrThrow(),
        database!
          .selectFrom("resource_invalidation_events")
          .select(({ fn }) => [
            fn.countAll<string>().as("count"),
            fn.count<string>("outbox_event_id").distinct().as("distinct_count"),
          ])
          .where(
            "outbox_event_id",
            "in",
            rows.map((row) => row.id),
          )
          .executeTakeFirstOrThrow(),
      ]);
      expect(Number(outbox.count)).toBe(rows.length);
      expect(Number(projections.count)).toBe(rows.length);
      expect(Number(projections.distinct_count)).toBe(rows.length);
    } finally {
      await Promise.all([runnerA.stop(), runnerB.stop()]);
    }
  });

  it("lets Graphile Worker retry after the repository records a failed attempt", async () => {
    const outboxId = "30000000-0000-4000-8000-000000000099";
    await database!
      .insertInto("outbox_events")
      .values({
        id: outboxId,
        project_id: projectId,
        audience_type: "project",
        audience_id: projectId,
        aggregate_type: "task",
        aggregate_id: "31000000-0000-4000-8000-000000000099",
        event_type: "task.updated",
        request_id: "worker-retry-request",
        payload: {},
      })
      .execute();

    let injectedFailures = 0;
    const runner = await startRunner(
      createOutboxTaskList(database!, {
        beforeProjection: () => {
          if (injectedFailures++ === 0) {
            throw Object.assign(new Error("retry fixture"), { code: "WORKER_RETRY_FIXTURE" });
          }
        },
        retryDelayMs: 0,
        scheduleNext: false,
      }),
    );

    try {
      const failed = waitForJobs([runner.events], "job:error", 1);
      const succeeded = waitForJobs([runner.events], "job:success", 1);
      await runner.addJob("outbox_dispatch", {}, { maxAttempts: 3 });
      await failed;
      await succeeded;

      const outbox = await database!
        .selectFrom("outbox_events")
        .select(["attempt_count", "processed_at", "last_error_code"])
        .where("id", "=", outboxId)
        .executeTakeFirstOrThrow();
      expect(outbox.attempt_count).toBe(1);
      expect(outbox.processed_at).toBeInstanceOf(Date);
      expect(outbox.last_error_code).toBeNull();
      const projections = await database!
        .selectFrom("resource_invalidation_events")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("outbox_event_id", "=", outboxId)
        .executeTakeFirstOrThrow();
      expect(Number(projections.count)).toBe(1);
    } finally {
      await runner.stop();
    }
  });
});

async function startRunner(taskList: ReturnType<typeof createOutboxTaskList>): Promise<Runner> {
  return run({
    connectionString: connectionString!,
    concurrency: 1,
    noHandleSignals: true,
    pollInterval: 50,
    taskList,
  });
}

function waitForJobs(
  eventSources: WorkerEvents[],
  eventName: "job:success" | "job:error",
  count: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let observed = 0;
    const timeout = setTimeout(() => finish(new Error(`${eventName} barrier timed out`)), 20_000);
    const listener = () => {
      observed += 1;
      if (observed >= count) {
        finish();
      }
    };
    for (const events of eventSources) {
      events.on(eventName, listener);
    }

    function finish(error?: Error) {
      clearTimeout(timeout);
      for (const events of eventSources) {
        events.off(eventName, listener);
      }
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    }
  });
}

function createClaimBarrier(required: number) {
  let arrivals = 0;
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    arrivals: () => arrivals,
    arrive: async () => {
      arrivals += 1;
      if (arrivals >= required) {
        release();
      }
      await released;
    },
  };
}
