import { assertDatabaseSchemaReady, createDatabase, inspectDatabaseSchema } from "@ngapd/database";
import { makeWorkerUtils, run } from "graphile-worker";

import { startWorkerHealthServer } from "./health-server.js";
import { createOutboxTaskList } from "./outbox-task.js";

const connectionString = process.env.DATABASE_URL;
const healthHost = process.env.WORKER_HEALTH_HOST ?? "127.0.0.1";
const healthPort = Number.parseInt(process.env.WORKER_HEALTH_PORT ?? "3001", 10);

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}
if (!Number.isInteger(healthPort) || healthPort < 1 || healthPort > 65_535) {
  throw new Error(`Invalid WORKER_HEALTH_PORT: ${process.env.WORKER_HEALTH_PORT}`);
}

const database = createDatabase(connectionString);
await assertDatabaseSchemaReady(database);

const runner = await run({
  connectionString,
  concurrency: 1,
  noHandleSignals: true,
  taskList: createOutboxTaskList(database),
});

const workerUtils = await makeWorkerUtils({ connectionString });
await workerUtils.addJob(
  "outbox_dispatch",
  {},
  {
    jobKey: "ngapd-outbox-dispatch",
    jobKeyMode: "preserve_run_at",
    maxAttempts: 25,
  },
);

let runnerReady = true;
const healthServer = await startWorkerHealthServer({
  host: healthHost,
  port: healthPort,
  isReady: async () => runnerReady && (await inspectDatabaseSchema(database)).status === "ready",
});
let shutdownPromise: Promise<void> | undefined;

async function shutdown(signal: string): Promise<void> {
  shutdownPromise ??= (async () => {
    runnerReady = false;
    console.info(JSON.stringify({ service: "ngapd-worker", signal, message: "shutting down" }));
    await healthServer.close();
    await runner.stop();
    await workerUtils.release();
    await database.destroy();
  })();
  await shutdownPromise;
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

console.info(
  JSON.stringify({
    service: "ngapd-worker",
    status: "ready",
    healthHost,
    healthPort,
    timestamp: new Date().toISOString(),
  }),
);
