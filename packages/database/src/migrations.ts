import { sql, type Kysely, type Migration, type MigrationProvider } from "kysely";

const initialSystemMetadataMigration: Migration = {
  async up(database: Kysely<unknown>) {
    await database.schema
      .createTable("system_metadata")
      .addColumn("key", "varchar(120)", (column) => column.primaryKey())
      .addColumn("value", "text", (column) => column.notNull())
      .addColumn("updated_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
  },
  async down(database: Kysely<unknown>) {
    await database.schema.dropTable("system_metadata").execute();
  },
};

export class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {
      "0001-system-metadata": initialSystemMetadataMigration,
    };
  }
}
