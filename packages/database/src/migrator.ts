import { Migrator } from "kysely";

import type { DatabaseSchema } from "./types.js";
import type { Kysely } from "kysely";

import { StaticMigrationProvider } from "./migrations.js";
import {
  DatabaseSchemaError,
  inspectDatabaseSchema,
  type DatabaseSchemaStatus,
} from "./schema-profile.js";

export async function migrateToLatest(database: Kysely<DatabaseSchema>): Promise<void> {
  const before = await inspectDatabaseSchema(database);
  assertSchemaMayMigrate(before);

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

  const after = await inspectDatabaseSchema(database);
  if (after.status !== "ready") {
    throw new DatabaseSchemaError(
      "DATABASE_SCHEMA_NOT_READY",
      `migration finished without a ready formal schema: ${after.status}`,
    );
  }
}

function assertSchemaMayMigrate(status: DatabaseSchemaStatus): void {
  if (status.status === "empty" || status.status === "behind" || status.status === "ready") {
    return;
  }
  if (status.status === "prototype_reset_required") {
    throw new DatabaseSchemaError(
      "DATABASE_SCHEMA_RESET_REQUIRED",
      "prototype database requires the explicit target-confirmed M0 reset workflow",
    );
  }
  throw new DatabaseSchemaError(
    "DATABASE_SCHEMA_UNKNOWN",
    `database schema is not recognized: ${"reason" in status ? status.reason : status.status}`,
  );
}
