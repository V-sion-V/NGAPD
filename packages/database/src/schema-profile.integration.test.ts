import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";

import { createDatabase } from "./client.js";
import { migrateToLatest } from "./migrator.js";
import {
  canonicalDatabaseTarget,
  inspectDatabaseSchema,
  resetFormalSchema,
  type DatabaseSchemaError,
} from "./schema-profile.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const database = connectionString ? createDatabase(connectionString) : null;

interface FingerprintRow {
  object_type: string;
  object_name: string;
  definition: string;
}

async function schemaFingerprint(): Promise<string> {
  const result = await sql<FingerprintRow>`
    select 'column' as object_type,
      table_name || '.' || column_name as object_name,
      data_type || ':' || is_nullable || ':' || coalesce(column_default, '') as definition
    from information_schema.columns
    where table_schema = current_schema()
    union all
    select 'constraint',
      c.conrelid::regclass::text || '.' || c.conname,
      pg_get_constraintdef(c.oid, true)
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = current_schema()
    union all
    select 'index', tablename || '.' || indexname, indexdef
    from pg_indexes
    where schemaname = current_schema()
    order by object_type, object_name, definition
  `.execute(database!);
  return JSON.stringify(result.rows);
}

async function rebuild(target: string): Promise<string> {
  await resetFormalSchema({ database: database!, target, confirmation: target });
  await migrateToLatest(database!);
  return schemaFingerprint();
}

describeWithDatabase("formal schema profile PostgreSQL integration", () => {
  afterAll(async () => {
    await database?.destroy();
  });

  it("fails closed and produces an identical repeatable baseline", async () => {
    const target = canonicalDatabaseTarget(connectionString!);
    await expect(
      resetFormalSchema({
        database: database!,
        target,
        confirmation: `${target}-wrong`,
      }),
    ).rejects.toMatchObject({
      code: "DATABASE_SCHEMA_RESET_REQUIRED",
    });

    const firstFingerprint = await rebuild(target);
    await expect(inspectDatabaseSchema(database!)).resolves.toMatchObject({
      status: "ready",
      profile: "m0-domain-baseline",
      version: "3",
      appliedMigrations: [
        "0001-system-metadata",
        "0002-workspace-foundation",
        "0003-workspace-sync-protocol",
        "0004-m0-domain-baseline",
        "0005-task-graph-guards",
        "0006-task-workspace-lifecycle",
        "0007-application-projections",
        "0008-m1-project-role-members",
        "0009-m2-task-management",
      ],
    });

    await migrateToLatest(database!);
    expect(await schemaFingerprint()).toBe(firstFingerprint);

    await database!
      .deleteFrom("system_metadata")
      .where("key", "in", ["schema_profile", "schema_profile_version"])
      .execute();
    await expect(migrateToLatest(database!)).rejects.toEqual(
      expect.objectContaining<Partial<DatabaseSchemaError>>({
        code: "DATABASE_SCHEMA_RESET_REQUIRED",
      }),
    );

    const secondFingerprint = await rebuild(target);
    expect(secondFingerprint).toBe(firstFingerprint);

    await database!
      .updateTable("system_metadata")
      .set({ value: "unknown-profile" })
      .where("key", "=", "schema_profile")
      .execute();
    await expect(migrateToLatest(database!)).rejects.toEqual(
      expect.objectContaining<Partial<DatabaseSchemaError>>({
        code: "DATABASE_SCHEMA_UNKNOWN",
      }),
    );

    expect(await rebuild(target)).toBe(firstFingerprint);
  });
});
