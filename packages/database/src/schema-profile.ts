import { sql, type Kysely } from "kysely";

import type { DatabaseSchema } from "./types.js";

export const FORMAL_SCHEMA_PROFILE = "m0-domain-baseline";
export const FORMAL_SCHEMA_VERSION = "1";

export const FORMAL_MIGRATION_NAMES = [
  "0001-system-metadata",
  "0002-workspace-foundation",
  "0003-workspace-sync-protocol",
  "0004-m0-domain-baseline",
  "0005-task-graph-guards",
  "0006-task-workspace-lifecycle",
  "0007-application-projections",
] as const;

export type DatabaseSchemaStatus =
  | { status: "empty"; appliedMigrations: [] }
  | {
      status: "ready" | "behind";
      profile: typeof FORMAL_SCHEMA_PROFILE;
      version: typeof FORMAL_SCHEMA_VERSION;
      appliedMigrations: string[];
      expectedMigration: string;
    }
  | {
      status: "prototype_reset_required" | "unknown";
      reason: string;
      appliedMigrations: string[];
      profile: string | null;
      version: string | null;
    };

interface TableInventoryRow {
  table_name: string;
}

interface MetadataRow {
  key: string;
  value: string;
}

interface MigrationRow {
  name: string;
}

export class DatabaseSchemaError extends Error {
  constructor(
    public readonly code:
      "DATABASE_SCHEMA_RESET_REQUIRED" | "DATABASE_SCHEMA_UNKNOWN" | "DATABASE_SCHEMA_NOT_READY",
    message: string,
  ) {
    super(message);
    this.name = "DatabaseSchemaError";
  }
}

export async function inspectDatabaseSchema(
  database: Kysely<DatabaseSchema>,
): Promise<DatabaseSchemaStatus> {
  const inventory = await sql<TableInventoryRow>`
    select table_name
    from information_schema.tables
    where table_schema = current_schema()
      and table_type = 'BASE TABLE'
    order by table_name
  `.execute(database);
  const tableNames = new Set(inventory.rows.map((row) => row.table_name));

  if (tableNames.size === 0) {
    return { status: "empty", appliedMigrations: [] };
  }

  const appliedMigrations = tableNames.has("kysely_migration")
    ? (
        await sql<MigrationRow>`
          select name
          from kysely_migration
          order by timestamp, name
        `.execute(database)
      ).rows.map((row) => row.name)
    : [];

  if (!tableNames.has("system_metadata")) {
    return {
      status: appliedMigrations.some((name) =>
        FORMAL_MIGRATION_NAMES.slice(0, 3).includes(
          name as (typeof FORMAL_MIGRATION_NAMES)[number],
        ),
      )
        ? "prototype_reset_required"
        : "unknown",
      reason: "system_metadata or the formal schema profile is missing",
      appliedMigrations,
      profile: null,
      version: null,
    };
  }

  const metadataRows = await sql<MetadataRow>`
    select key, value
    from system_metadata
    where key in ('schema_profile', 'schema_profile_version')
    order by key
  `.execute(database);
  const metadata = new Map(metadataRows.rows.map((row) => [row.key, row.value]));
  const profile = metadata.get("schema_profile") ?? null;
  const version = metadata.get("schema_profile_version") ?? null;

  if (profile === null && appliedMigrations.length > 0) {
    return {
      status: "prototype_reset_required",
      reason: "prototype migration history has no formal schema profile",
      appliedMigrations,
      profile,
      version,
    };
  }
  if (profile !== FORMAL_SCHEMA_PROFILE || version !== FORMAL_SCHEMA_VERSION) {
    return {
      status: "unknown",
      reason: "schema profile or profile version is not recognized",
      appliedMigrations,
      profile,
      version,
    };
  }

  const expected: string[] = [...FORMAL_MIGRATION_NAMES];
  const unexpected = appliedMigrations.filter((name) => !expected.includes(name));
  const isPrefix = appliedMigrations.every((name, index) => expected[index] === name);
  if (unexpected.length > 0 || !isPrefix || appliedMigrations.length > expected.length) {
    return {
      status: "unknown",
      reason: "migration history is not a recognized prefix of the formal baseline",
      appliedMigrations,
      profile,
      version,
    };
  }

  return {
    status: appliedMigrations.length === expected.length ? "ready" : "behind",
    profile,
    version,
    appliedMigrations,
    expectedMigration: expected.at(-1)!,
  };
}

export async function assertDatabaseSchemaReady(database: Kysely<DatabaseSchema>): Promise<void> {
  const status = await inspectDatabaseSchema(database);
  if (status.status !== "ready") {
    throw new DatabaseSchemaError(
      "DATABASE_SCHEMA_NOT_READY",
      `database schema is ${status.status}; run the explicit migration workflow`,
    );
  }
}

export function canonicalDatabaseTarget(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new DatabaseSchemaError(
      "DATABASE_SCHEMA_UNKNOWN",
      "DATABASE_URL must be a valid PostgreSQL URL",
    );
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new DatabaseSchemaError(
      "DATABASE_SCHEMA_UNKNOWN",
      "DATABASE_URL must use the postgres or postgresql protocol",
    );
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!url.hostname || !databaseName || databaseName.includes("/")) {
    throw new DatabaseSchemaError(
      "DATABASE_SCHEMA_UNKNOWN",
      "DATABASE_URL must identify one host and database",
    );
  }
  const host = url.hostname.includes(":") ? `[${url.hostname}]` : url.hostname.toLowerCase();
  return `${host}:${url.port || "5432"}/${databaseName}`;
}

export function readResetConfirmation(arguments_: readonly string[]): string {
  const normalized = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  if (normalized.length !== 2 || normalized[0] !== "--confirm-destroy" || !normalized[1]) {
    throw new DatabaseSchemaError(
      "DATABASE_SCHEMA_RESET_REQUIRED",
      "reset requires exactly --confirm-destroy <host:port/database>",
    );
  }
  return normalized[1];
}

export async function resetFormalSchema(input: {
  database: Kysely<DatabaseSchema>;
  target: string;
  confirmation: string;
}): Promise<void> {
  if (input.confirmation !== input.target) {
    throw new DatabaseSchemaError(
      "DATABASE_SCHEMA_RESET_REQUIRED",
      "reset confirmation does not match the canonical database target",
    );
  }
  await sql`
    drop schema if exists public cascade;
    create schema public;
    grant all on schema public to current_user;
    grant all on schema public to public
  `.execute(input.database);
}
