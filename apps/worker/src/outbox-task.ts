import { OutboxRepository, type Database } from "@ngapd/database";
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
  };
}
