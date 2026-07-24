import { run } from "graphile-worker";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const runner = await run({
  connectionString,
  concurrency: 1,
  noHandleSignals: true,
  taskList: {
    async health_check(payload, helpers) {
      helpers.logger.info("worker health check", { payload });
    },
  },
});

async function shutdown(signal: string): Promise<void> {
  console.info(JSON.stringify({ service: "ngapd-worker", signal, message: "shutting down" }));
  await runner.stop();
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
    timestamp: new Date().toISOString(),
  }),
);
