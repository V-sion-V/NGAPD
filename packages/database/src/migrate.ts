import { createDatabase } from "./client.js";
import { migrateToLatest } from "./migrator.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const database = createDatabase(connectionString);

try {
  await migrateToLatest(database);
} finally {
  await database.destroy();
}
