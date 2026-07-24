import { createDatabase, pingDatabase } from "@ngapd/database";

import { buildApp } from "./app.js";

const host = process.env.API_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.API_PORT ?? "3000", 10);
const connectionString = process.env.DATABASE_URL;

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid API_PORT: ${process.env.API_PORT}`);
}

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const database = createDatabase(connectionString);
const app = await buildApp({
  databaseCheck: () => pingDatabase(database),
  logger: true,
});

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await database.destroy();
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  await database.destroy();
  process.exitCode = 1;
}
