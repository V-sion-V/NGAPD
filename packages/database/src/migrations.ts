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

const workspaceFoundationMigration: Migration = {
  async up(database: Kysely<unknown>) {
    await sql`
      create table users (
        id uuid primary key,
        login_name varchar(80) not null,
        normalized_login_name varchar(80) not null unique,
        password_hash text not null,
        active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table web_sessions (
        id uuid primary key,
        token_hash varchar(128) not null unique,
        user_id uuid not null references users(id) on delete cascade,
        expires_at timestamptz not null,
        revoked_at timestamptz,
        created_at timestamptz not null default now()
      );

      create table devices (
        id uuid primary key,
        user_id uuid not null references users(id) on delete cascade,
        name varchar(120) not null,
        platform varchar(20) not null check (platform in ('macos', 'windows', 'linux')),
        revoked_at timestamptz,
        created_at timestamptz not null default now()
      );

      create table device_credentials (
        id uuid primary key,
        device_id uuid not null unique references devices(id) on delete cascade,
        secret_hash varchar(128) not null unique,
        expires_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz not null default now()
      );

      create table device_access_tokens (
        id uuid primary key,
        device_id uuid not null references devices(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade,
        token_hash varchar(128) not null unique,
        expires_at timestamptz not null,
        revoked_at timestamptz,
        created_at timestamptz not null default now()
      );

      create table pairing_requests (
        id uuid primary key,
        code_hash varchar(128) not null unique,
        correlation_hash varchar(128) not null,
        device_name varchar(120) not null,
        platform varchar(20) not null check (platform in ('macos', 'windows', 'linux')),
        status varchar(20) not null check (
          status in ('pending', 'approved', 'denied', 'consumed', 'expired', 'revoked')
        ),
        attempts integer not null default 0 check (attempts >= 0),
        expires_at timestamptz not null,
        approved_by_user_id uuid references users(id),
        device_id uuid references devices(id),
        consumed_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table projects (
        id uuid primary key,
        project_key varchar(16) not null unique,
        name varchar(160) not null,
        owner_membership_id uuid not null,
        created_at timestamptz not null default now()
      );

      create table memberships (
        id uuid primary key,
        project_id uuid not null references projects(id) on delete cascade,
        user_id uuid not null references users(id) on delete cascade,
        role varchar(16) not null check (role in ('admin', 'member')),
        active boolean not null default true,
        created_at timestamptz not null default now(),
        unique (project_id, user_id)
      );

      alter table projects
        add constraint projects_owner_membership_fk
        foreign key (owner_membership_id) references memberships(id)
        deferrable initially deferred;

      create table tasks (
        id uuid primary key,
        project_id uuid not null references projects(id) on delete cascade,
        task_key varchar(32) not null,
        title varchar(240) not null,
        status varchar(20) not null check (status in ('open', 'in_progress', 'done', 'archived')),
        parent_task_id uuid references tasks(id),
        explicit_owner_membership_id uuid references memberships(id),
        created_at timestamptz not null default now(),
        unique (project_id, task_key),
        check (parent_task_id is not null or explicit_owner_membership_id is not null)
      );

      create table workspaces (
        id uuid primary key,
        scope_type varchar(16) not null check (scope_type in ('user', 'project', 'task')),
        scope_id uuid not null,
        lifecycle varchar(20) not null default 'active'
          check (lifecycle in ('active', 'archived', 'deleted')),
        work_cycle integer not null default 1 check (work_cycle >= 1),
        sync_version bigint not null default 0 check (sync_version >= 0),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (scope_type, scope_id)
      );

      create table audit_events (
        id uuid primary key,
        actor_user_id uuid references users(id),
        device_id uuid references devices(id),
        workspace_id uuid references workspaces(id),
        request_id varchar(128) not null,
        action varchar(80) not null,
        result varchar(40) not null,
        reason_code varchar(80) not null,
        before_version bigint,
        after_version bigint,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );

      create index web_sessions_user_idx on web_sessions(user_id);
      create index devices_user_idx on devices(user_id);
      create index device_access_tokens_device_idx on device_access_tokens(device_id);
      create index pairing_requests_expires_idx on pairing_requests(status, expires_at);
      create index memberships_user_idx on memberships(user_id);
      create index tasks_parent_idx on tasks(parent_task_id);
      create index audit_events_scope_idx on audit_events(workspace_id, created_at);
    `.execute(database);
  },
  async down(database: Kysely<unknown>) {
    await sql`
      drop table audit_events;
      drop table workspaces;
      drop table tasks;
      alter table projects drop constraint projects_owner_membership_fk;
      drop table memberships;
      drop table projects;
      drop table pairing_requests;
      drop table device_access_tokens;
      drop table device_credentials;
      drop table devices;
      drop table web_sessions;
      drop table users;
    `.execute(database);
  },
};

const workspaceSyncProtocolMigration: Migration = {
  async up(database: Kysely<unknown>) {
    await sql`
      create table workspace_leases (
        id uuid primary key,
        workspace_id uuid not null references workspaces(id) on delete cascade,
        work_cycle integer not null check (work_cycle >= 1),
        user_id uuid not null references users(id),
        device_id uuid not null references devices(id),
        connection_id uuid not null,
        token_hash varchar(128) not null unique,
        base_sync_version bigint not null check (base_sync_version >= 0),
        issued_at timestamptz not null,
        renewed_at timestamptz not null,
        expires_at timestamptz not null,
        revoked_at timestamptz,
        revoke_reason varchar(40),
        check (expires_at > issued_at),
        check (
          (revoked_at is null and revoke_reason is null)
          or (revoked_at is not null and revoke_reason is not null)
        )
      );

      create unique index workspace_leases_one_active_idx
        on workspace_leases(workspace_id, work_cycle)
        where revoked_at is null;
      create index workspace_leases_holder_idx
        on workspace_leases(user_id, device_id, expires_at);

      create table workspace_objects (
        sha256 char(64) primary key check (sha256 ~ '^[0-9a-f]{64}$'),
        size bigint not null check (size >= 0),
        storage_key text not null unique,
        integrity_status varchar(16) not null check (integrity_status = 'verified'),
        verified_at timestamptz not null,
        created_at timestamptz not null default now()
      );

      create table workspace_versions (
        workspace_id uuid not null references workspaces(id) on delete cascade,
        sync_version bigint not null check (sync_version >= 0),
        manifest_sha256 char(64) not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
        created_by_user_id uuid references users(id),
        device_id uuid references devices(id),
        lease_id uuid references workspace_leases(id),
        created_at timestamptz not null default now(),
        primary key (workspace_id, sync_version)
      );

      insert into workspace_versions (workspace_id, sync_version, manifest_sha256)
      select id, 0, '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
      from workspaces;

      create table workspace_manifest_entries (
        workspace_id uuid not null,
        sync_version bigint not null,
        path text not null,
        kind varchar(16) not null check (kind = 'file'),
        size bigint not null check (size >= 0),
        sha256 char(64) not null references workspace_objects(sha256),
        primary key (workspace_id, sync_version, path),
        foreign key (workspace_id, sync_version)
          references workspace_versions(workspace_id, sync_version)
          on delete cascade,
        check (path <> '' and path !~ '(^/|\\|(^|/)\.\.?(/|$))')
      );
      create index workspace_manifest_entries_object_idx
        on workspace_manifest_entries(sha256);

      create table idempotency_records (
        id uuid primary key,
        actor_user_id uuid not null references users(id),
        device_id uuid not null references devices(id),
        workspace_id uuid not null references workspaces(id) on delete cascade,
        operation varchar(32) not null check (operation in ('commit', 'conflict_use_local')),
        idempotency_key varchar(128) not null,
        request_sha256 char(64) not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
        response_sync_version bigint not null check (response_sync_version >= 1),
        response_manifest_sha256 char(64) not null
          check (response_manifest_sha256 ~ '^[0-9a-f]{64}$'),
        created_at timestamptz not null default now(),
        unique (device_id, workspace_id, operation, idempotency_key),
        foreign key (workspace_id, response_sync_version)
          references workspace_versions(workspace_id, sync_version)
      );
    `.execute(database);
  },
  async down(database: Kysely<unknown>) {
    await sql`
      drop table idempotency_records;
      drop table workspace_manifest_entries;
      drop table workspace_versions;
      drop table workspace_objects;
      drop table workspace_leases;
    `.execute(database);
  },
};

export class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {
      "0001-system-metadata": initialSystemMetadataMigration,
      "0002-workspace-foundation": workspaceFoundationMigration,
      "0003-workspace-sync-protocol": workspaceSyncProtocolMigration,
    };
  }
}
