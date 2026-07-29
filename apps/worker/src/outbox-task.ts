import { OutboxRepository, TaskProjectionRepository, type Database } from "@ngapd/database";
import type { TaskList } from "graphile-worker";

export interface OutboxTaskOptions {
  beforeProjection?: (outboxEventId: string) => Promise<void> | void;
  retryDelayMs?: number;
  pollIntervalMs?: number;
  scheduleNext?: boolean;
}

export function createOutboxTaskList(
  database: Database,
  options: OutboxTaskOptions = {},
): TaskList {
  const repository = new OutboxRepository(database);
  const projections = new TaskProjectionRepository(database);

  return {
    async outbox_dispatch(_payload, helpers) {
      try {
        await repository.dispatchNext({
          ...(options.beforeProjection === undefined
            ? {}
            : { beforeProjection: options.beforeProjection }),
          ...(options.retryDelayMs === undefined ? {} : { retryDelayMs: options.retryDelayMs }),
        });
      } finally {
        if (options.scheduleNext !== false) {
          await helpers.addJob(
            "outbox_dispatch",
            {},
            {
              jobKey: "ngapd-outbox-dispatch",
              jobKeyMode: "preserve_run_at",
              maxAttempts: 25,
              runAt: new Date(Date.now() + (options.pollIntervalMs ?? 500)),
            },
          );
        }
      }
    },
    async task_due_reminders(_payload, helpers) {
      const now = new Date();
      await projections.enqueueDueReminders({
        now,
        through: new Date(now.getTime() + 24 * 60 * 60 * 1_000),
      });
      if (options.scheduleNext !== false) {
        await helpers.addJob(
          "task_due_reminders",
          {},
          {
            jobKey: "ngapd-task-due-reminders",
            jobKeyMode: "preserve_run_at",
            maxAttempts: 25,
            runAt: new Date(now.getTime() + 15 * 60 * 1_000),
          },
        );
      }
    },
  };
}
