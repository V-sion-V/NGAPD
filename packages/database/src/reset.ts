import { createDatabase } from "./client.js";
import { migrateToLatest } from "./migrator.js";
import {
  canonicalDatabaseTarget,
  readResetConfirmation,
  resetFormalSchema,
} from "./schema-profile.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to reset the formal M0 schema");
}

const target = canonicalDatabaseTarget(connectionString);
const confirmation = readResetConfirmation(process.argv.slice(2));
const database = createDatabase(connectionString);

try {
  await resetFormalSchema({ database, target, confirmation });
  await migrateToLatest(database);
  console.info(`formal M0 schema rebuilt for ${target}`);
} finally {
  await database.destroy();
}
