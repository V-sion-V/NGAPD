import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";

import type { DatabaseSchema } from "./types.js";

export type Database = Kysely<DatabaseSchema>;

export function createDatabase(connectionString: string): Database {
  return new Kysely<DatabaseSchema>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString,
        max: 10,
      }),
    }),
  });
}

export async function pingDatabase(database: Database): Promise<boolean> {
  await sql`select 1`.execute(database);
  return true;
}
