import { Migrator } from "kysely";

import type { DatabaseSchema } from "./types.js";
import type { Kysely } from "kysely";

import { StaticMigrationProvider } from "./migrations.js";

export async function migrateToLatest(database: Kysely<DatabaseSchema>): Promise<void> {
  const migrator = new Migrator({
    db: database,
    provider: new StaticMigrationProvider(),
  });

  const { error, results } = await migrator.migrateToLatest();

  for (const result of results ?? []) {
    const message = `${result.migrationName}: ${result.status}`;
    if (result.status === "Success") {
      console.info(message);
    } else {
      console.error(message);
    }
  }

  if (error) {
    throw error;
  }
}
