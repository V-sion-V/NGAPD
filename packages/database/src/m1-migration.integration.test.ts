import { sql } from "kysely";
import { Migrator } from "kysely";
import { afterAll, describe, expect, it } from "vitest";

import { SYSTEM_LOGICAL_ROLE_TEMPLATES } from "@ngapd/domain";

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
  ownerUser: "51000000-0000-4000-8000-000000000001",
  removedUser: "51000000-0000-4000-8000-000000000002",
  project: "52000000-0000-4000-8000-000000000001",
  ownerMembership: "53000000-0000-4000-8000-000000000001",
  removedMembership: "53000000-0000-4000-8000-000000000002",
  rootScope: "54000000-0000-4000-8000-000000000001",
  task: "55000000-0000-4000-8000-000000000001",
  projectWorkspace: "56000000-0000-4000-8000-000000000001",
  taskWorkspace: "56000000-0000-4000-8000-000000000002",
  audit: "57000000-0000-4000-8000-000000000001",
};

const emptyManifestHash = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";

async function resetToPreviousFormalBaseline(): Promise<void> {
  await resetFormalSchema({ database: database!, target, confirmation: target });
  const migrator = new Migrator({
    db: database!,
    provider: new StaticMigrationProvider(),
  });
  const result = await migrator.migrateTo("0007-application-projections");
  expect(result.error).toBeUndefined();
  await database!
    .updateTable("system_metadata")
    .set({ value: "1" })
    .where("key", "=", "schema_profile_version")
    .execute();
}

async function seedRepresentativeVersionOneData(): Promise<void> {
  await database!.transaction().execute(async (transaction) => {
    await sql`set constraints all deferred`.execute(transaction);

    await sql`
      insert into users (id, login_name, normalized_login_name, password_hash)
      values
        (${ids.ownerUser}::uuid, 'OwnerUser', 'owneruser', 'argon2id$owner'),
        (${ids.removedUser}::uuid, 'RemovedUser', 'removeduser', 'argon2id$removed')
    `.execute(transaction);

    await sql`
      insert into projects (id, project_key, name, owner_membership_id)
      values (
        ${ids.project}::uuid,
        'GAME',
        'Migrated project',
        ${ids.ownerMembership}::uuid
      )
    `.execute(transaction);

    await sql`
      insert into memberships (id, project_id, user_id, role, active)
      values
        (
          ${ids.ownerMembership}::uuid,
          ${ids.project}::uuid,
          ${ids.ownerUser}::uuid,
          'admin',
          true
        ),
        (
          ${ids.removedMembership}::uuid,
          ${ids.project}::uuid,
          ${ids.removedUser}::uuid,
          'admin',
          false
        )
    `.execute(transaction);

    await sql`
      insert into sibling_task_graph_scopes (id, project_id, parent_task_id)
      values (${ids.rootScope}::uuid, ${ids.project}::uuid, null)
    `.execute(transaction);

    await sql`
      update projects set task_sequence = 1 where id = ${ids.project}::uuid
    `.execute(transaction);

    await sql`
      insert into tasks (
        id,
        project_id,
        task_sequence,
        task_key,
        title,
        base_status,
        parent_task_id,
        parent_graph_scope_id,
        explicit_owner_membership_id
      )
      values (
        ${ids.task}::uuid,
        ${ids.project}::uuid,
        1,
        'GAME-1',
        'Preserved task',
        'not_started',
        null,
        ${ids.rootScope}::uuid,
        ${ids.ownerMembership}::uuid
      )
    `.execute(transaction);

    await sql`
      insert into sibling_task_graph_scopes (id, project_id, parent_task_id)
      values (
        md5(${ids.task}::text || ':children')::uuid,
        ${ids.project}::uuid,
        ${ids.task}::uuid
      )
    `.execute(transaction);

    await sql`
      insert into workspaces (id, scope_type, scope_id, sync_version)
      values
        (${ids.projectWorkspace}::uuid, 'project', ${ids.project}::uuid, 3),
        (${ids.taskWorkspace}::uuid, 'task', ${ids.task}::uuid, 2)
    `.execute(transaction);

    await sql`
      insert into workspace_versions (
        workspace_id,
        sync_version,
        manifest_sha256,
        created_by_user_id,
        device_id,
        lease_id
      )
      values
        (
          ${ids.projectWorkspace}::uuid,
          3,
          ${emptyManifestHash},
          ${ids.ownerUser}::uuid,
          null,
          null
        ),
        (
          ${ids.taskWorkspace}::uuid,
          2,
          ${emptyManifestHash},
          ${ids.ownerUser}::uuid,
          null,
          null
        )
    `.execute(transaction);

    await sql`
      insert into audit_events (
        id,
        actor_user_id,
        request_id,
        action,
        result,
        reason_code,
        project_id,
        target_type,
        target_id
      )
      values (
        ${ids.audit}::uuid,
        ${ids.ownerUser}::uuid,
        'migration-preserve',
        'task.created',
        'success',
        'allowed',
        ${ids.project}::uuid,
        'task',
        ${ids.task}::uuid
      )
    `.execute(transaction);
  });
}

describeWithDatabase("M1 forward migration", () => {
  afterAll(async () => {
    await database?.destroy();
  });

  it("recognizes complete version 1 as behind and preserves representative data", async () => {
    await resetToPreviousFormalBaseline();
    await seedRepresentativeVersionOneData();

    await expect(inspectDatabaseSchema(database!)).resolves.toMatchObject({
      status: "behind",
      profile: "m0-domain-baseline",
      version: "1",
      expectedMigration: "0008-m1-project-role-members",
    });

    await migrateToLatest(database!);
    await expect(inspectDatabaseSchema(database!)).resolves.toMatchObject({
      status: "ready",
      version: "3",
    });

    const [users, memberships, task, workspaces, audit, templateCount, projectRoleCount] =
      await Promise.all([
        database!
          .selectFrom("users")
          .select(["id", "login_name", "display_name", "default_introduction"])
          .where("id", "in", [ids.ownerUser, ids.removedUser])
          .orderBy("id")
          .execute(),
        database!
          .selectFrom("memberships")
          .select(["id", "permission_level", "status", "introduction"])
          .where("id", "in", [ids.ownerMembership, ids.removedMembership])
          .orderBy("id")
          .execute(),
        database!
          .selectFrom("tasks")
          .select(["id", "explicit_owner_membership_id", "base_status"])
          .where("id", "=", ids.task)
          .executeTakeFirstOrThrow(),
        database!
          .selectFrom("workspaces")
          .select(["id", "sync_version"])
          .where("id", "in", [ids.projectWorkspace, ids.taskWorkspace])
          .orderBy("id")
          .execute(),
        database!
          .selectFrom("audit_events")
          .select(["id", "request_id", "target_id"])
          .where("id", "=", ids.audit)
          .executeTakeFirstOrThrow(),
        database!
          .selectFrom("system_logical_role_templates")
          .select(({ fn }) => fn.countAll<string>().as("count"))
          .executeTakeFirstOrThrow(),
        database!
          .selectFrom("project_logical_roles")
          .select(({ fn }) => fn.countAll<string>().as("count"))
          .where("project_id", "=", ids.project)
          .executeTakeFirstOrThrow(),
      ]);

    expect(users).toEqual([
      {
        id: ids.ownerUser,
        login_name: "OwnerUser",
        display_name: "OwnerUser",
        default_introduction: "",
      },
      {
        id: ids.removedUser,
        login_name: "RemovedUser",
        display_name: "RemovedUser",
        default_introduction: "",
      },
    ]);
    expect(memberships).toEqual([
      {
        id: ids.ownerMembership,
        permission_level: "admin",
        status: "active",
        introduction: "",
      },
      {
        id: ids.removedMembership,
        permission_level: "member",
        status: "removed",
        introduction: "",
      },
    ]);
    expect(task).toEqual({
      id: ids.task,
      explicit_owner_membership_id: ids.ownerMembership,
      base_status: "not_started",
    });
    expect(workspaces).toEqual([
      { id: ids.projectWorkspace, sync_version: "3" },
      { id: ids.taskWorkspace, sync_version: "2" },
    ]);
    expect(audit).toEqual({
      id: ids.audit,
      request_id: "migration-preserve",
      target_id: ids.task,
    });
    expect(Number(templateCount.count)).toBe(SYSTEM_LOGICAL_ROLE_TEMPLATES.length);
    expect(Number(projectRoleCount.count)).toBe(SYSTEM_LOGICAL_ROLE_TEMPLATES.length);

    const migrationCountBefore = await sql<{ count: string }>`
      select count(*)::text as count from kysely_migration
    `.execute(database!);
    await migrateToLatest(database!);
    const migrationCountAfter = await sql<{ count: string }>`
      select count(*)::text as count from kysely_migration
    `.execute(database!);
    expect(migrationCountAfter.rows).toEqual(migrationCountBefore.rows);
  });

  it("rolls back all of 0008 when migrated version 1 data violates a new constraint", async () => {
    await resetToPreviousFormalBaseline();
    await sql`
      insert into users (id, login_name, normalized_login_name, password_hash)
      values (
        '58000000-0000-4000-8000-000000000001'::uuid,
        '',
        'empty-display-name',
        'argon2id$invalid'
      )
    `.execute(database!);

    await expect(migrateToLatest(database!)).rejects.toBeDefined();

    const [metadata, migration, displayNameColumn, originalUser] = await Promise.all([
      database!
        .selectFrom("system_metadata")
        .select("value")
        .where("key", "=", "schema_profile_version")
        .executeTakeFirstOrThrow(),
      sql<{ name: string }>`
        select name
        from kysely_migration
        where name = '0008-m1-project-role-members'
      `.execute(database!),
      sql<{ column_name: string }>`
        select column_name
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = 'users'
          and column_name = 'display_name'
      `.execute(database!),
      sql<{ login_name: string }>`
        select login_name
        from users
        where id = '58000000-0000-4000-8000-000000000001'::uuid
      `.execute(database!),
    ]);

    expect(metadata.value).toBe("1");
    expect(migration.rows).toEqual([]);
    expect(displayNameColumn.rows).toEqual([]);
    expect(originalUser.rows).toEqual([{ login_name: "" }]);
  });
});
