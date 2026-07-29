import { Migrator, sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";

import { createDatabase } from "./client.js";
import { StaticMigrationProvider } from "./migrations.js";
import { migrateToLatest } from "./migrator.js";
import {
  canonicalDatabaseTarget,
  inspectDatabaseSchema,
  resetFormalSchema,
} from "./schema-profile.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const database = connectionString ? createDatabase(connectionString) : null;
const target = connectionString ? canonicalDatabaseTarget(connectionString) : "";

const ids = {
  user: "61000000-0000-4000-8000-000000000001",
  project: "62000000-0000-4000-8000-000000000001",
  membership: "63000000-0000-4000-8000-000000000001",
  role: "63500000-0000-4000-8000-000000000001",
  rootScope: "64000000-0000-4000-8000-000000000001",
  childScope: "64000000-0000-4000-8000-000000000002",
  task: "65000000-0000-4000-8000-000000000001",
  workspace: "66000000-0000-4000-8000-000000000001",
  audit: "67000000-0000-4000-8000-000000000001",
  outbox: "68000000-0000-4000-8000-000000000001",
};

const emptyManifestHash = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";

async function resetToM1Baseline(): Promise<void> {
  await resetFormalSchema({ database: database!, target, confirmation: target });
  const result = await new Migrator({
    db: database!,
    provider: new StaticMigrationProvider(),
  }).migrateTo("0008-m1-project-role-members");
  expect(result.error).toBeUndefined();
  await expect(inspectDatabaseSchema(database!)).resolves.toMatchObject({
    status: "behind",
    version: "2",
    expectedMigration: "0009-m2-task-management",
  });
}

async function seedM1Task(roleName: string): Promise<void> {
  await database!.transaction().execute(async (transaction) => {
    await sql`set constraints all deferred`.execute(transaction);
    await sql`
      insert into users (
        id,
        login_name,
        normalized_login_name,
        password_hash,
        display_name
      )
      values (
        ${ids.user}::uuid,
        'm2-migration-owner',
        'm2-migration-owner',
        'argon2id$fixture',
        'M2 migration owner'
      )
    `.execute(transaction);
    await sql`
      insert into projects (
        id,
        project_key,
        name,
        owner_membership_id,
        task_sequence
      )
      values (
        ${ids.project}::uuid,
        'MIG',
        'M2 migration project',
        ${ids.membership}::uuid,
        1
      )
    `.execute(transaction);
    await sql`
      insert into memberships (
        id,
        project_id,
        user_id,
        permission_level,
        status
      )
      values (
        ${ids.membership}::uuid,
        ${ids.project}::uuid,
        ${ids.user}::uuid,
        'admin',
        'active'
      )
    `.execute(transaction);
    await sql`
      insert into project_logical_roles (
        id,
        project_id,
        name,
        capability
      )
      values (
        ${ids.role}::uuid,
        ${ids.project}::uuid,
        'Gameplay Designer',
        'Owns gameplay design decisions'
      )
    `.execute(transaction);
    await sql`
      insert into sibling_task_graph_scopes (id, project_id, parent_task_id)
      values (${ids.rootScope}::uuid, ${ids.project}::uuid, null)
    `.execute(transaction);
    await sql`
      insert into tasks (
        id,
        project_id,
        task_sequence,
        task_key,
        title,
        body,
        logical_role,
        base_status,
        parent_task_id,
        parent_graph_scope_id,
        explicit_owner_membership_id
      )
      values (
        ${ids.task}::uuid,
        ${ids.project}::uuid,
        1,
        'MIG-1',
        'Preserved M1 task',
        'Preserved Markdown',
        ${roleName},
        'not_started',
        null,
        ${ids.rootScope}::uuid,
        ${ids.membership}::uuid
      )
    `.execute(transaction);
    await sql`
      insert into sibling_task_graph_scopes (id, project_id, parent_task_id)
      values (${ids.childScope}::uuid, ${ids.project}::uuid, ${ids.task}::uuid)
    `.execute(transaction);
    await sql`
      insert into workspaces (id, scope_type, scope_id, sync_version)
      values (${ids.workspace}::uuid, 'task', ${ids.task}::uuid, 2)
    `.execute(transaction);
    await sql`
      insert into workspace_versions (workspace_id, sync_version, manifest_sha256)
      values (${ids.workspace}::uuid, 2, ${emptyManifestHash})
    `.execute(transaction);
    await sql`
      insert into audit_events (
        id,
        actor_user_id,
        request_id,
        action,
        result,
        reason_code,
        actor_type,
        project_id,
        target_type,
        target_id
      )
      values (
        ${ids.audit}::uuid,
        ${ids.user}::uuid,
        'm2-migration-preserve',
        'task.seeded',
        'success',
        'TASK_SEEDED',
        'human',
        ${ids.project}::uuid,
        'task',
        ${ids.task}::uuid
      )
    `.execute(transaction);
    await sql`
      insert into outbox_events (
        id,
        project_id,
        audience_type,
        audience_id,
        aggregate_type,
        aggregate_id,
        event_type,
        request_id,
        payload
      )
      values (
        ${ids.outbox}::uuid,
        ${ids.project}::uuid,
        'project',
        ${ids.project}::uuid,
        'task',
        ${ids.task}::uuid,
        'task.seeded',
        'm2-migration-preserve',
        jsonb_build_object('taskId', ${ids.task}::text)
      )
    `.execute(transaction);
  });
}

async function firstProjectRoleName(): Promise<string> {
  const role = await database!
    .selectFrom("project_logical_roles")
    .select("name")
    .where("project_id", "=", ids.project)
    .orderBy("id")
    .executeTakeFirstOrThrow();
  return role.name;
}

describeWithDatabase("M2 forward migration", () => {
  afterAll(async () => {
    await database?.destroy();
  });

  it("preserves the M1 baseline and deterministically maps one legacy role", async () => {
    await resetToM1Baseline();
    await seedM1Task("");
    const role = await database!
      .selectFrom("project_logical_roles")
      .select(["id", "name"])
      .where("project_id", "=", ids.project)
      .orderBy("id")
      .executeTakeFirstOrThrow();
    await sql`
      update tasks set logical_role = ${role.name} where id = ${ids.task}::uuid
    `.execute(database!);

    await migrateToLatest(database!);

    await expect(inspectDatabaseSchema(database!)).resolves.toMatchObject({
      status: "ready",
      version: "3",
      expectedMigration: "0009-m2-task-management",
    });
    const task = await database!
      .selectFrom("tasks")
      .select([
        "id",
        "task_key",
        "content",
        "legacy_logical_role",
        "logical_role_id",
        "display_type",
        "created_by_membership_id",
        "version",
      ])
      .where("id", "=", ids.task)
      .executeTakeFirstOrThrow();
    expect(task).toEqual({
      id: ids.task,
      task_key: "MIG-1",
      content: "Preserved Markdown",
      legacy_logical_role: role.name,
      logical_role_id: role.id,
      display_type: "normal",
      created_by_membership_id: ids.membership,
      version: "1",
    });

    const preserved = await Promise.all([
      database!
        .selectFrom("workspaces")
        .select("sync_version")
        .where("id", "=", ids.workspace)
        .executeTakeFirstOrThrow(),
      database!
        .selectFrom("audit_events")
        .select("id")
        .where("id", "=", ids.audit)
        .executeTakeFirstOrThrow(),
      database!
        .selectFrom("outbox_events")
        .select("id")
        .where("id", "=", ids.outbox)
        .executeTakeFirstOrThrow(),
    ]);
    expect(preserved).toEqual([{ sync_version: "2" }, { id: ids.audit }, { id: ids.outbox }]);

    const migrationCountBefore = await sql<{ count: string }>`
      select count(*)::text as count from kysely_migration
    `.execute(database!);
    await migrateToLatest(database!);
    const migrationCountAfter = await sql<{ count: string }>`
      select count(*)::text as count from kysely_migration
    `.execute(database!);
    expect(migrationCountAfter.rows).toEqual(migrationCountBefore.rows);
  });

  it.each(["zero", "multiple"] as const)(
    "rolls back all of 0009 when a legacy role has %s exact matches",
    async (mode) => {
      await resetToM1Baseline();
      await seedM1Task("");
      const existingName = await firstProjectRoleName();
      if (mode === "multiple") {
        await database!
          .insertInto("project_logical_roles")
          .values({
            id: "69000000-0000-4000-8000-000000000001",
            project_id: ids.project,
            source_template_id: null,
            name: existingName,
            capability: "Ambiguous migration fixture",
          })
          .execute();
      }
      await sql`
        update tasks
        set logical_role = ${mode === "zero" ? "No such project role" : existingName}
        where id = ${ids.task}::uuid
      `.execute(database!);

      await expect(migrateToLatest(database!)).rejects.toBeDefined();

      const [metadata, migration, oldColumns, newColumns] = await Promise.all([
        database!
          .selectFrom("system_metadata")
          .select("value")
          .where("key", "=", "schema_profile_version")
          .executeTakeFirstOrThrow(),
        sql<{ name: string }>`
          select name from kysely_migration where name = '0009-m2-task-management'
        `.execute(database!),
        sql<{ column_name: string }>`
          select column_name
          from information_schema.columns
          where table_schema = current_schema()
            and table_name = 'tasks'
            and column_name in ('body', 'logical_role')
          order by column_name
        `.execute(database!),
        sql<{ column_name: string }>`
          select column_name
          from information_schema.columns
          where table_schema = current_schema()
            and table_name = 'tasks'
            and column_name in ('content', 'logical_role_id')
          order by column_name
        `.execute(database!),
      ]);
      expect(metadata.value).toBe("2");
      expect(migration.rows).toEqual([]);
      expect(oldColumns.rows).toEqual([{ column_name: "body" }, { column_name: "logical_role" }]);
      expect(newColumns.rows).toEqual([]);
    },
  );
});
