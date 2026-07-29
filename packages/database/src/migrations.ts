import { sql, type Kysely, type Migration, type MigrationProvider } from "kysely";
import { SYSTEM_LOGICAL_ROLE_TEMPLATES } from "@ngapd/domain";

import { FORMAL_SCHEMA_PROFILE, FORMAL_SCHEMA_VERSION } from "./schema-profile.js";

const initialSystemMetadataMigration: Migration = {
  async up(database: Kysely<unknown>) {
    await database.schema
      .createTable("system_metadata")
      .addColumn("key", "varchar(120)", (column) => column.primaryKey())
      .addColumn("value", "text", (column) => column.notNull())
      .addColumn("updated_at", "timestamptz", (column) => column.notNull().defaultTo(sql`now()`))
      .execute();
    await sql`
      insert into system_metadata (key, value)
      values
        ('schema_profile', ${FORMAL_SCHEMA_PROFILE}),
        ('schema_profile_version', ${FORMAL_SCHEMA_VERSION})
    `.execute(database);
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

const m0DomainBaselineMigration: Migration = {
  async up(database: Kysely<unknown>) {
    await sql`
      alter table projects
        add column task_sequence bigint not null default 0 check (task_sequence >= 0),
        add column completed_successor_reopen_policy varchar(16) not null default 'deny'
          check (completed_successor_reopen_policy in ('deny', 'cascade')),
        add column lifecycle varchar(16) not null default 'active'
          check (lifecycle in ('active', 'archived')),
        add column recovery_epoch bigint not null default 0 check (recovery_epoch >= 0),
        add column version bigint not null default 1 check (version >= 1),
        add column updated_at timestamptz not null default now(),
        add constraint projects_key_format_check check (project_key ~ '^[A-Z]{2,6}$');

      alter table memberships
        add constraint memberships_id_project_unique unique (id, project_id);

      alter table projects
        drop constraint projects_owner_membership_fk,
        add constraint projects_owner_membership_fk
          foreign key (owner_membership_id, id)
          references memberships(id, project_id)
          deferrable initially deferred;

      alter table tasks
        add column task_sequence bigint,
        add column base_status varchar(20),
        add column archived boolean not null default false,
        add column body text not null default '',
        add column due_at timestamptz,
        add column logical_role varchar(80),
        add column labels jsonb not null default '[]'::jsonb,
        add column display_type varchar(40),
        add column version bigint not null default 1 check (version >= 1),
        add column frozen boolean not null default false,
        add column updated_at timestamptz not null default now();

      with numbered as (
        select
          id,
          row_number() over (partition by project_id order by created_at, id)::bigint as value
        from tasks
      )
      update tasks
      set task_sequence = numbered.value
      from numbered
      where numbered.id = tasks.id;

      update tasks
      set
        base_status = case status
          when 'in_progress' then 'in_progress'
          when 'done' then 'done'
          else 'not_started'
        end,
        archived = status = 'archived',
        frozen = status = 'done';

      update tasks
      set task_key = projects.project_key || '-' || tasks.task_sequence::text
      from projects
      where projects.id = tasks.project_id;

      update projects
      set task_sequence = coalesce((
        select max(tasks.task_sequence)
        from tasks
        where tasks.project_id = projects.id
      ), 0);

      alter table tasks
        alter column task_sequence set not null,
        alter column base_status set not null,
        add constraint tasks_sequence_positive_check check (task_sequence >= 1),
        add constraint tasks_key_format_check check (task_key ~ '^[A-Z]{2,6}-[1-9][0-9]*$'),
        add constraint tasks_base_status_check
          check (base_status in ('not_started', 'in_progress', 'done')),
        add constraint tasks_frozen_status_check check (not frozen or base_status = 'done'),
        add constraint tasks_id_project_unique unique (id, project_id),
        add constraint tasks_project_sequence_unique unique (project_id, task_sequence),
        add constraint tasks_key_global_unique unique (task_key),
        add constraint tasks_owner_project_fk
          foreign key (explicit_owner_membership_id, project_id)
          references memberships(id, project_id),
        add constraint tasks_parent_project_fk
          foreign key (parent_task_id, project_id)
          references tasks(id, project_id)
          deferrable initially deferred,
        drop column status;

      create table sibling_task_graph_scopes (
        id uuid primary key,
        project_id uuid not null references projects(id) on delete cascade,
        parent_task_id uuid,
        graph_version bigint not null default 0 check (graph_version >= 0),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (id, project_id),
        foreign key (parent_task_id, project_id)
          references tasks(id, project_id)
          on delete cascade
          deferrable initially deferred
      );

      create unique index sibling_task_graph_scopes_root_unique
        on sibling_task_graph_scopes(project_id)
        where parent_task_id is null;
      create unique index sibling_task_graph_scopes_parent_unique
        on sibling_task_graph_scopes(parent_task_id)
        where parent_task_id is not null;

      insert into sibling_task_graph_scopes (id, project_id, parent_task_id)
      select md5(projects.id::text || ':root')::uuid, projects.id, null
      from projects;

      insert into sibling_task_graph_scopes (id, project_id, parent_task_id)
      select md5(tasks.id::text || ':children')::uuid, tasks.project_id, tasks.id
      from tasks;

      alter table tasks add column parent_graph_scope_id uuid;

      update tasks
      set parent_graph_scope_id = scopes.id
      from sibling_task_graph_scopes scopes
      where scopes.project_id = tasks.project_id
        and scopes.parent_task_id is not distinct from tasks.parent_task_id;

      alter table tasks
        alter column parent_graph_scope_id set not null,
        add constraint tasks_parent_graph_scope_project_fk
          foreign key (parent_graph_scope_id, project_id)
          references sibling_task_graph_scopes(id, project_id),
        add constraint tasks_id_parent_scope_unique unique (id, parent_graph_scope_id);

      create table task_dependencies (
        id uuid primary key,
        project_id uuid not null references projects(id) on delete cascade,
        graph_scope_id uuid not null,
        predecessor_task_id uuid not null,
        successor_task_id uuid not null,
        enabled boolean not null default true,
        created_by_membership_id uuid references memberships(id),
        request_id varchar(128) not null,
        created_at timestamptz not null default now(),
        check (predecessor_task_id <> successor_task_id),
        unique (predecessor_task_id, successor_task_id),
        foreign key (graph_scope_id, project_id)
          references sibling_task_graph_scopes(id, project_id),
        foreign key (predecessor_task_id, graph_scope_id)
          references tasks(id, parent_graph_scope_id),
        foreign key (successor_task_id, graph_scope_id)
          references tasks(id, parent_graph_scope_id)
      );
      create index task_dependencies_scope_idx
        on task_dependencies(graph_scope_id, predecessor_task_id, successor_task_id);

      create table task_dependency_change_requests (
        id uuid primary key,
        project_id uuid not null references projects(id) on delete cascade,
        graph_scope_id uuid not null,
        action varchar(12) not null check (action in ('add', 'remove')),
        predecessor_task_id uuid not null,
        successor_task_id uuid not null,
        expected_graph_version bigint not null check (expected_graph_version >= 0),
        predecessor_owner_membership_id uuid not null references memberships(id),
        successor_owner_membership_id uuid not null references memberships(id),
        requested_by_membership_id uuid not null references memberships(id),
        required_acceptance_by_membership_id uuid not null references memberships(id),
        status varchar(16) not null default 'pending'
          check (status in ('pending', 'accepted', 'rejected', 'expired', 'stale')),
        expires_at timestamptz not null,
        resolved_at timestamptz,
        request_id varchar(128) not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        check (predecessor_task_id <> successor_task_id),
        foreign key (graph_scope_id, project_id)
          references sibling_task_graph_scopes(id, project_id),
        foreign key (predecessor_task_id, graph_scope_id)
          references tasks(id, parent_graph_scope_id),
        foreign key (successor_task_id, graph_scope_id)
          references tasks(id, parent_graph_scope_id)
      );
      create index task_dependency_requests_pending_idx
        on task_dependency_change_requests(required_acceptance_by_membership_id, status, expires_at);

      create table task_follows (
        id uuid primary key,
        project_id uuid not null references projects(id) on delete cascade,
        source_task_id uuid not null,
        target_task_id uuid not null,
        created_by_membership_id uuid not null references memberships(id),
        created_at timestamptz not null default now(),
        check (source_task_id <> target_task_id),
        unique (source_task_id, target_task_id),
        foreign key (source_task_id, project_id) references tasks(id, project_id),
        foreign key (target_task_id, project_id) references tasks(id, project_id)
      );
      create index task_follows_target_idx on task_follows(target_task_id);

      create table task_blockers (
        id uuid primary key,
        project_id uuid not null references projects(id) on delete cascade,
        task_id uuid not null,
        reason text not null check (length(reason) between 1 and 2000),
        created_by_membership_id uuid not null references memberships(id),
        resolved_by_membership_id uuid references memberships(id),
        resolved_at timestamptz,
        created_at timestamptz not null default now(),
        foreign key (task_id, project_id) references tasks(id, project_id),
        check (
          (resolved_at is null and resolved_by_membership_id is null)
          or (resolved_at is not null and resolved_by_membership_id is not null)
        )
      );
      create index task_blockers_active_idx on task_blockers(task_id) where resolved_at is null;

      alter table workspaces drop constraint workspaces_lifecycle_check;
      alter table workspaces
        add constraint workspaces_lifecycle_check
          check (lifecycle in ('active', 'frozen', 'archived', 'deleted'));

      create table task_completion_snapshots (
        id uuid primary key,
        project_id uuid not null references projects(id) on delete cascade,
        task_id uuid not null,
        task_version bigint not null check (task_version >= 1),
        owner_membership_id uuid not null references memberships(id),
        workspace_id uuid not null references workspaces(id) on delete cascade,
        workspace_sync_version bigint not null check (workspace_sync_version >= 0),
        work_cycle integer not null check (work_cycle >= 1),
        task_snapshot jsonb not null,
        created_at timestamptz not null default now(),
        unique (task_id, task_version),
        foreign key (task_id, project_id) references tasks(id, project_id),
        foreign key (workspace_id, workspace_sync_version)
          references workspace_versions(workspace_id, sync_version)
      );

      create table task_operation_idempotency (
        id uuid primary key,
        project_id uuid not null references projects(id) on delete cascade,
        actor_membership_id uuid not null references memberships(id),
        operation varchar(32) not null check (
          operation in (
            'create_task',
            'dependency_change',
            'task_move',
            'task_complete',
            'task_reopen',
            'task_owner_change',
            'task_archive',
            'task_delete',
            'task_follow'
          )
        ),
        idempotency_key varchar(128) not null,
        request_sha256 char(64) not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
        response jsonb not null,
        response_task_id uuid references tasks(id),
        created_at timestamptz not null default now(),
        unique (project_id, actor_membership_id, operation, idempotency_key)
      );

      alter table audit_events
        add column actor_type varchar(16) not null default 'human'
          check (actor_type in ('human', 'agent', 'system')),
        add column project_id uuid references projects(id),
        add column target_type varchar(32),
        add column target_id uuid,
        add column task_version_before bigint,
        add column task_version_after bigint;
      create index audit_events_project_target_idx
        on audit_events(project_id, target_type, target_id, created_at);

      create table outbox_events (
        id uuid primary key,
        project_id uuid references projects(id) on delete cascade,
        aggregate_type varchar(32) not null,
        aggregate_id uuid not null,
        event_type varchar(80) not null,
        request_id varchar(128) not null,
        payload jsonb not null,
        created_at timestamptz not null default now(),
        available_at timestamptz not null default now(),
        attempt_count integer not null default 0 check (attempt_count >= 0),
        processed_at timestamptz,
        last_error_code varchar(80),
        unique (request_id, event_type, aggregate_id)
      );
      create index outbox_events_pending_idx
        on outbox_events(available_at, created_at)
        where processed_at is null;

      create index tasks_project_parent_idx on tasks(project_id, parent_task_id, id);
      create index tasks_project_status_idx on tasks(project_id, archived, base_status, id);
      create index tasks_explicit_owner_idx on tasks(explicit_owner_membership_id)
        where explicit_owner_membership_id is not null;
    `.execute(database);
  },
  async down(database: Kysely<unknown>) {
    await sql`
      drop table outbox_events;
      drop index audit_events_project_target_idx;
      alter table audit_events
        drop column task_version_after,
        drop column task_version_before,
        drop column target_id,
        drop column target_type,
        drop column project_id,
        drop column actor_type;
      drop table task_operation_idempotency;
      drop table task_completion_snapshots;
      alter table workspaces drop constraint workspaces_lifecycle_check;
      alter table workspaces
        add constraint workspaces_lifecycle_check
          check (lifecycle in ('active', 'archived', 'deleted'));
      drop table task_blockers;
      drop table task_follows;
      drop table task_dependency_change_requests;
      drop table task_dependencies;
      drop index tasks_explicit_owner_idx;
      drop index tasks_project_status_idx;
      drop index tasks_project_parent_idx;
      alter table tasks
        drop constraint tasks_id_parent_scope_unique,
        drop constraint tasks_parent_graph_scope_project_fk,
        drop column parent_graph_scope_id;
      drop table sibling_task_graph_scopes;
      alter table tasks
        add column status varchar(20);
      update tasks
      set status = case
        when archived then 'archived'
        when base_status = 'not_started' then 'open'
        else base_status
      end;
      alter table tasks
        alter column status set not null,
        add constraint tasks_status_check check (status in ('open', 'in_progress', 'done', 'archived')),
        drop constraint tasks_parent_project_fk,
        drop constraint tasks_owner_project_fk,
        drop constraint tasks_key_global_unique,
        drop constraint tasks_project_sequence_unique,
        drop constraint tasks_id_project_unique,
        drop constraint tasks_frozen_status_check,
        drop constraint tasks_base_status_check,
        drop constraint tasks_key_format_check,
        drop constraint tasks_sequence_positive_check,
        drop column updated_at,
        drop column frozen,
        drop column version,
        drop column display_type,
        drop column labels,
        drop column logical_role,
        drop column due_at,
        drop column body,
        drop column archived,
        drop column base_status,
        drop column task_sequence;
      alter table projects
        drop constraint projects_owner_membership_fk;
      alter table memberships
        drop constraint memberships_id_project_unique;
      alter table projects
        add constraint projects_owner_membership_fk
          foreign key (owner_membership_id) references memberships(id)
          deferrable initially deferred,
        drop constraint projects_key_format_check,
        drop column updated_at,
        drop column version,
        drop column recovery_epoch,
        drop column lifecycle,
        drop column completed_successor_reopen_policy,
        drop column task_sequence;
    `.execute(database);
  },
};

const taskGraphGuardsMigration: Migration = {
  async up(database: Kysely<unknown>) {
    await sql`
      create function ngapd_guard_project_key_immutable()
      returns trigger
      language plpgsql
      as $function$
      begin
        if new.project_key is distinct from old.project_key then
          raise exception using errcode = '23514', message = 'PROJECT_KEY_IMMUTABLE';
        end if;
        return new;
      end
      $function$;

      create trigger projects_key_immutable
      before update on projects
      for each row execute function ngapd_guard_project_key_immutable();

      create function ngapd_guard_task_update()
      returns trigger
      language plpgsql
      as $function$
      begin
        if new.project_id is distinct from old.project_id
          or new.task_sequence is distinct from old.task_sequence
          or new.task_key is distinct from old.task_key then
          raise exception using errcode = '23514', message = 'TASK_KEY_IMMUTABLE';
        end if;

        if old.frozen then
          if new.base_status = 'in_progress'
            and not new.frozen
            and new.title is not distinct from old.title
            and new.body is not distinct from old.body
            and new.due_at is not distinct from old.due_at
            and new.logical_role is not distinct from old.logical_role
            and new.labels is not distinct from old.labels
            and new.display_type is not distinct from old.display_type
            and new.explicit_owner_membership_id is not distinct from old.explicit_owner_membership_id
            and new.parent_task_id is not distinct from old.parent_task_id
            and new.parent_graph_scope_id is not distinct from old.parent_graph_scope_id
            and new.archived is not distinct from old.archived then
            return new;
          end if;
          if old.parent_task_id is null
            and new.archived is distinct from old.archived
            and new.base_status is not distinct from old.base_status
            and new.frozen is not distinct from old.frozen
            and new.title is not distinct from old.title
            and new.body is not distinct from old.body
            and new.due_at is not distinct from old.due_at
            and new.logical_role is not distinct from old.logical_role
            and new.labels is not distinct from old.labels
            and new.display_type is not distinct from old.display_type
            and new.explicit_owner_membership_id is not distinct from old.explicit_owner_membership_id
            and new.parent_task_id is not distinct from old.parent_task_id
            and new.parent_graph_scope_id is not distinct from old.parent_graph_scope_id then
            return new;
          end if;
          if new.title is distinct from old.title
            or new.body is distinct from old.body
            or new.due_at is distinct from old.due_at
            or new.logical_role is distinct from old.logical_role
            or new.labels is distinct from old.labels
            or new.display_type is distinct from old.display_type
            or new.explicit_owner_membership_id is distinct from old.explicit_owner_membership_id
            or new.parent_task_id is distinct from old.parent_task_id
            or new.parent_graph_scope_id is distinct from old.parent_graph_scope_id
            or new.base_status is distinct from old.base_status
            or new.archived is distinct from old.archived
            or new.frozen is distinct from old.frozen then
            raise exception using errcode = '23514', message = 'COMPLETED_TASK_FROZEN';
          end if;
        end if;
        return new;
      end
      $function$;

      create trigger tasks_update_guard
      before update on tasks
      for each row execute function ngapd_guard_task_update();

      create function ngapd_guard_task_parent_cycle()
      returns trigger
      language plpgsql
      as $function$
      declare
        cycle_found boolean;
      begin
        if new.parent_task_id is null then
          return new;
        end if;
        if new.parent_task_id = new.id then
          raise exception using errcode = '23514', message = 'TASK_TREE_CYCLE';
        end if;
        with recursive ancestors(id, parent_task_id) as (
          select id, parent_task_id
          from tasks
          where id = new.parent_task_id
          union all
          select parent.id, parent.parent_task_id
          from tasks parent
          join ancestors child on parent.id = child.parent_task_id
        )
        select exists(select 1 from ancestors where id = new.id) into cycle_found;
        if cycle_found then
          raise exception using errcode = '23514', message = 'TASK_TREE_CYCLE';
        end if;
        return new;
      end
      $function$;

      create trigger tasks_parent_cycle_guard
      before insert or update of parent_task_id on tasks
      for each row execute function ngapd_guard_task_parent_cycle();

      create function ngapd_guard_dependency_mutation()
      returns trigger
      language plpgsql
      as $function$
      declare
        predecessor_done boolean;
        successor_done boolean;
        creates_cycle boolean;
      begin
        if tg_op = 'DELETE' then
          select frozen into predecessor_done from tasks where id = old.predecessor_task_id;
          select frozen into successor_done from tasks where id = old.successor_task_id;
        else
          select frozen into predecessor_done from tasks where id = new.predecessor_task_id;
          select frozen into successor_done from tasks where id = new.successor_task_id;
        end if;
        if coalesce(predecessor_done, false) or coalesce(successor_done, false) then
          raise exception using errcode = '23514', message = 'COMPLETED_TASK_FROZEN';
        end if;
        if tg_op <> 'DELETE' and new.enabled then
          with recursive reachable(task_id) as (
            select new.successor_task_id
            union
            select dependency.successor_task_id
            from task_dependencies dependency
            join reachable on dependency.predecessor_task_id = reachable.task_id
            where dependency.enabled
              and dependency.graph_scope_id = new.graph_scope_id
              and dependency.id <> new.id
          )
          select exists(
            select 1 from reachable where task_id = new.predecessor_task_id
          ) into creates_cycle;
          if creates_cycle then
            raise exception using errcode = '23514', message = 'TASK_DEPENDENCY_CYCLE';
          end if;
        end if;
        return case when tg_op = 'DELETE' then old else new end;
      end
      $function$;

      create trigger task_dependencies_mutation_guard
      before insert or update or delete on task_dependencies
      for each row execute function ngapd_guard_dependency_mutation();

      create function ngapd_increment_graph_versions_for_dependency()
      returns trigger
      language plpgsql
      as $function$
      declare
        scope_id uuid;
      begin
        for scope_id in
          select distinct value
          from unnest(array[
            case when tg_op <> 'INSERT' then old.graph_scope_id end,
            case when tg_op <> 'DELETE' then new.graph_scope_id end
          ]) as scopes(value)
          where value is not null
          order by value
        loop
          update sibling_task_graph_scopes
          set graph_version = graph_version + 1, updated_at = now()
          where id = scope_id;
        end loop;
        return case when tg_op = 'DELETE' then old else new end;
      end
      $function$;

      create trigger task_dependencies_graph_version
      after insert or update or delete on task_dependencies
      for each row execute function ngapd_increment_graph_versions_for_dependency();

      create function ngapd_increment_graph_versions_for_task()
      returns trigger
      language plpgsql
      as $function$
      declare
        scope_id uuid;
      begin
        if tg_op = 'UPDATE'
          and old.parent_graph_scope_id is not distinct from new.parent_graph_scope_id
          and old.archived is not distinct from new.archived then
          return new;
        end if;
        for scope_id in
          select distinct value
          from unnest(array[
            case when tg_op <> 'INSERT' then old.parent_graph_scope_id end,
            case when tg_op <> 'DELETE' then new.parent_graph_scope_id end
          ]) as scopes(value)
          where value is not null
          order by value
        loop
          update sibling_task_graph_scopes
          set graph_version = graph_version + 1, updated_at = now()
          where id = scope_id;
        end loop;
        return case when tg_op = 'DELETE' then old else new end;
      end
      $function$;

      create trigger tasks_graph_version
      after update or delete on tasks
      for each row execute function ngapd_increment_graph_versions_for_task();

      create function ngapd_guard_blocker_mutation()
      returns trigger
      language plpgsql
      as $function$
      declare
        task_frozen boolean;
      begin
        select frozen into task_frozen
        from tasks
        where id = case when tg_op = 'DELETE' then old.task_id else new.task_id end;
        if coalesce(task_frozen, false) then
          raise exception using errcode = '23514', message = 'COMPLETED_TASK_FROZEN';
        end if;
        return case when tg_op = 'DELETE' then old else new end;
      end
      $function$;

      create trigger task_blockers_mutation_guard
      before insert or update or delete on task_blockers
      for each row execute function ngapd_guard_blocker_mutation();
    `.execute(database);
  },
  async down(database: Kysely<unknown>) {
    await sql`
      drop trigger task_blockers_mutation_guard on task_blockers;
      drop function ngapd_guard_blocker_mutation();
      drop trigger tasks_graph_version on tasks;
      drop function ngapd_increment_graph_versions_for_task();
      drop trigger task_dependencies_graph_version on task_dependencies;
      drop function ngapd_increment_graph_versions_for_dependency();
      drop trigger task_dependencies_mutation_guard on task_dependencies;
      drop function ngapd_guard_dependency_mutation();
      drop trigger tasks_parent_cycle_guard on tasks;
      drop function ngapd_guard_task_parent_cycle();
      drop trigger tasks_update_guard on tasks;
      drop function ngapd_guard_task_update();
      drop trigger projects_key_immutable on projects;
      drop function ngapd_guard_project_key_immutable();
    `.execute(database);
  },
};

const taskWorkspaceLifecycleMigration: Migration = {
  async up(database: Kysely<unknown>) {
    await sql`
      create table task_workspace_transition_snapshots (
        id uuid primary key,
        project_id uuid not null references projects(id) on delete cascade,
        task_id uuid not null,
        task_version bigint not null check (task_version >= 1),
        transition_type varchar(24) not null
          check (transition_type in ('owner_change', 'reopen')),
        owner_membership_id uuid not null references memberships(id),
        workspace_id uuid not null references workspaces(id) on delete cascade,
        workspace_sync_version bigint not null check (workspace_sync_version >= 0),
        work_cycle integer not null check (work_cycle >= 1),
        snapshot jsonb not null,
        created_at timestamptz not null default now(),
        unique (task_id, task_version, transition_type),
        foreign key (task_id, project_id) references tasks(id, project_id),
        foreign key (workspace_id, workspace_sync_version)
          references workspace_versions(workspace_id, sync_version)
      );

      create unique index audit_events_attempt_unique
        on audit_events(request_id, action, result, target_type, target_id);

      create function ngapd_reject_immutable_record_change()
      returns trigger
      language plpgsql
      as $function$
      begin
        raise exception using errcode = '23514', message = 'IMMUTABLE_RECORD';
      end
      $function$;

      create trigger audit_events_immutable
      before update or delete on audit_events
      for each row execute function ngapd_reject_immutable_record_change();
      create trigger workspace_versions_immutable
      before update or delete on workspace_versions
      for each row execute function ngapd_reject_immutable_record_change();
      create trigger workspace_manifest_entries_immutable
      before update or delete on workspace_manifest_entries
      for each row execute function ngapd_reject_immutable_record_change();
      create trigger task_completion_snapshots_immutable
      before update or delete on task_completion_snapshots
      for each row execute function ngapd_reject_immutable_record_change();
      create trigger task_workspace_transition_snapshots_immutable
      before update or delete on task_workspace_transition_snapshots
      for each row execute function ngapd_reject_immutable_record_change();

      create function ngapd_guard_task_workspace_version_insert()
      returns trigger
      language plpgsql
      as $function$
      declare
        workspace_lifecycle varchar(20);
      begin
        select lifecycle into workspace_lifecycle
        from workspaces
        where id = new.workspace_id;
        if workspace_lifecycle in ('frozen', 'archived', 'deleted') then
          raise exception using errcode = '23514', message = 'TASK_WORKSPACE_FROZEN';
        end if;
        return new;
      end
      $function$;

      create trigger workspace_versions_insert_guard
      before insert on workspace_versions
      for each row execute function ngapd_guard_task_workspace_version_insert();

      create function ngapd_guard_task_workspace_transition()
      returns trigger
      language plpgsql
      as $function$
      begin
        if old.scope_type <> 'task' then
          return new;
        end if;
        if new.scope_type is distinct from old.scope_type
          or new.scope_id is distinct from old.scope_id then
          raise exception using errcode = '23514', message = 'WORKSPACE_SCOPE_IMMUTABLE';
        end if;
        if new.work_cycle < old.work_cycle or new.work_cycle > old.work_cycle + 1 then
          raise exception using errcode = '23514', message = 'WORK_CYCLE_INVALID';
        end if;
        if old.lifecycle = 'frozen' then
          if new.sync_version is distinct from old.sync_version then
            raise exception using errcode = '23514', message = 'TASK_WORKSPACE_FROZEN';
          end if;
          if new.lifecycle = 'active' and new.work_cycle <> old.work_cycle + 1 then
            raise exception using errcode = '23514', message = 'WORK_CYCLE_INVALID';
          end if;
        end if;
        if old.lifecycle = 'active' and new.lifecycle = 'frozen'
          and new.work_cycle <> old.work_cycle then
          raise exception using errcode = '23514', message = 'WORK_CYCLE_INVALID';
        end if;
        return new;
      end
      $function$;

      create trigger task_workspace_transition_guard
      before update on workspaces
      for each row execute function ngapd_guard_task_workspace_transition();

      create function ngapd_check_task_workspace_consistency()
      returns trigger
      language plpgsql
      as $function$
      declare
        task_id_value uuid;
        task_done boolean;
        workspace_lifecycle varchar(20);
      begin
        if tg_table_name = 'tasks' then
          task_id_value := new.id;
          task_done := new.base_status = 'done' and new.frozen;
          select lifecycle into workspace_lifecycle
          from workspaces
          where scope_type = 'task' and scope_id = task_id_value;
          if workspace_lifecycle is null then
            raise exception using errcode = '23514', message = 'TASK_WORKSPACE_MISSING';
          end if;
        else
          if new.scope_type <> 'task' then
            return new;
          end if;
          task_id_value := new.scope_id;
          workspace_lifecycle := new.lifecycle;
          select base_status = 'done' and frozen into task_done
          from tasks
          where id = task_id_value;
          if task_done is null then
            raise exception using errcode = '23514', message = 'TASK_NOT_FOUND';
          end if;
        end if;
        if task_done and workspace_lifecycle not in ('frozen', 'archived') then
          raise exception using errcode = '23514', message = 'TASK_WORKSPACE_STATE_MISMATCH';
        end if;
        if not task_done and workspace_lifecycle = 'frozen' then
          raise exception using errcode = '23514', message = 'TASK_WORKSPACE_STATE_MISMATCH';
        end if;
        return new;
      end
      $function$;

      create constraint trigger tasks_workspace_consistency
      after insert or update on tasks
      deferrable initially deferred
      for each row execute function ngapd_check_task_workspace_consistency();

      create constraint trigger workspaces_task_consistency
      after insert or update on workspaces
      deferrable initially deferred
      for each row execute function ngapd_check_task_workspace_consistency();
    `.execute(database);
  },
  async down(database: Kysely<unknown>) {
    await sql`
      drop trigger workspaces_task_consistency on workspaces;
      drop trigger tasks_workspace_consistency on tasks;
      drop function ngapd_check_task_workspace_consistency();
      drop trigger task_workspace_transition_guard on workspaces;
      drop function ngapd_guard_task_workspace_transition();
      drop trigger workspace_versions_insert_guard on workspace_versions;
      drop function ngapd_guard_task_workspace_version_insert();
      drop trigger task_workspace_transition_snapshots_immutable
        on task_workspace_transition_snapshots;
      drop trigger task_completion_snapshots_immutable on task_completion_snapshots;
      drop trigger workspace_manifest_entries_immutable on workspace_manifest_entries;
      drop trigger workspace_versions_immutable on workspace_versions;
      drop trigger audit_events_immutable on audit_events;
      drop function ngapd_reject_immutable_record_change();
      drop index audit_events_attempt_unique;
      drop table task_workspace_transition_snapshots;
    `.execute(database);
  },
};

const applicationProjectionsMigration: Migration = {
  async up(database: Kysely<unknown>) {
    await sql`
      create table resource_invalidation_events (
        cursor bigserial primary key,
        outbox_event_id uuid not null unique references outbox_events(id),
        project_id uuid not null references projects(id) on delete cascade,
        resource_type varchar(80) not null,
        resource_id uuid not null,
        event_type varchar(120) not null,
        created_at timestamptz not null default now()
      );

      create index resource_invalidation_events_project_cursor_idx
        on resource_invalidation_events(project_id, cursor);

      create table event_projection_state (
        id smallint primary key check (id = 1),
        retention_floor bigint not null default 0 check (retention_floor >= 0),
        updated_at timestamptz not null default now()
      );

      insert into event_projection_state (id) values (1);
    `.execute(database);
  },
  async down(database: Kysely<unknown>) {
    await sql`
      drop table event_projection_state;
      drop table resource_invalidation_events;
    `.execute(database);
  },
};

const m1ProjectRoleMembersMigration: Migration = {
  async up(database: Kysely<unknown>) {
    await sql`
      alter table users
        add column display_name varchar(80),
        add column default_introduction text not null default '',
        add column version bigint not null default 1 check (version >= 1);

      update users set display_name = login_name where display_name is null;

      alter table users
        alter column display_name set not null,
        add constraint users_display_name_length_check
          check (char_length(display_name) between 1 and 80),
        add constraint users_default_introduction_length_check
          check (char_length(default_introduction) <= 4000);

      create table system_logical_role_templates (
        id varchar(160) primary key,
        title varchar(160) not null check (char_length(title) between 1 and 160),
        description text not null check (char_length(description) between 1 and 4000),
        created_at timestamptz not null default now()
      );

      create table user_default_role_templates (
        user_id uuid not null references users(id) on delete cascade,
        template_id varchar(160) not null references system_logical_role_templates(id),
        created_at timestamptz not null default now(),
        primary key (user_id, template_id)
      );

      alter table projects
        add column description text not null default '',
        add constraint projects_description_length_check
          check (char_length(description) <= 8000);

      alter table memberships rename column role to permission_level;
      alter table memberships
        add column status varchar(16),
        add column introduction text not null default '',
        add column version bigint not null default 1 check (version >= 1),
        add column has_been_active boolean not null default true,
        add column updated_at timestamptz not null default now();

      update memberships
      set
        status = case when active then 'active' else 'removed' end,
        permission_level = case when active then permission_level else 'member' end;

      alter table memberships
        alter column status set not null,
        drop column active,
        add constraint memberships_status_check
          check (status in ('pending', 'active', 'removed')),
        add constraint memberships_introduction_length_check
          check (char_length(introduction) <= 4000);

      create table membership_join_requests (
        id uuid primary key,
        project_id uuid not null references projects(id) on delete cascade,
        membership_id uuid not null,
        requested_by_user_id uuid not null references users(id),
        resolved_by_membership_id uuid references memberships(id),
        status varchar(16) not null default 'pending'
          check (status in ('pending', 'approved', 'rejected', 'stale')),
        version bigint not null default 1 check (version >= 1),
        idempotency_key varchar(128) not null,
        created_at timestamptz not null default now(),
        resolved_at timestamptz,
        updated_at timestamptz not null default now(),
        foreign key (membership_id, project_id)
          references memberships(id, project_id),
        unique (project_id, requested_by_user_id, idempotency_key),
        check (
          (status = 'pending' and resolved_at is null and resolved_by_membership_id is null)
          or (status <> 'pending' and resolved_at is not null)
        )
      );
      create unique index membership_join_requests_pending_unique
        on membership_join_requests(membership_id)
        where status = 'pending';
      create index membership_join_requests_project_status_idx
        on membership_join_requests(project_id, status, created_at, id);

      create table project_logical_roles (
        id uuid primary key,
        project_id uuid not null references projects(id) on delete cascade,
        source_template_id varchar(160) references system_logical_role_templates(id),
        name varchar(160) not null check (char_length(name) between 1 and 160),
        capability text not null check (char_length(capability) between 1 and 4000),
        status varchar(16) not null default 'active'
          check (status in ('active', 'archived')),
        version bigint not null default 1 check (version >= 1),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (id, project_id)
      );
      create unique index project_logical_roles_template_snapshot_unique
        on project_logical_roles(project_id, source_template_id)
        where source_template_id is not null;
      create index project_logical_roles_project_status_idx
        on project_logical_roles(project_id, status, name, id);

      create table membership_logical_roles (
        membership_id uuid not null,
        project_id uuid not null,
        role_id uuid not null,
        created_at timestamptz not null default now(),
        primary key (membership_id, role_id),
        foreign key (membership_id, project_id)
          references memberships(id, project_id),
        foreign key (role_id, project_id)
          references project_logical_roles(id, project_id)
      );

      create table project_ownership_transfer_requests (
        id uuid primary key,
        project_id uuid not null references projects(id) on delete cascade,
        from_owner_membership_id uuid not null,
        target_membership_id uuid not null,
        status varchar(16) not null default 'pending'
          check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'stale')),
        version bigint not null default 1 check (version >= 1),
        idempotency_key varchar(128) not null,
        created_at timestamptz not null default now(),
        resolved_at timestamptz,
        updated_at timestamptz not null default now(),
        foreign key (from_owner_membership_id, project_id)
          references memberships(id, project_id),
        foreign key (target_membership_id, project_id)
          references memberships(id, project_id),
        unique (project_id, from_owner_membership_id, idempotency_key),
        check (from_owner_membership_id <> target_membership_id),
        check (
          (status = 'pending' and resolved_at is null)
          or (status <> 'pending' and resolved_at is not null)
        )
      );
      create unique index project_ownership_transfer_pending_unique
        on project_ownership_transfer_requests(project_id)
        where status = 'pending';

      create table admin_mode_sessions (
        id uuid primary key,
        web_session_id uuid not null references web_sessions(id) on delete cascade,
        project_id uuid not null references projects(id) on delete cascade,
        membership_id uuid not null,
        status varchar(16) not null default 'active'
          check (status in ('active', 'closed', 'expired', 'revoked')),
        issued_at timestamptz not null,
        last_protected_activity_at timestamptz not null,
        expires_at timestamptz not null,
        revoked_reason varchar(80),
        version bigint not null default 1 check (version >= 1),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        foreign key (membership_id, project_id)
          references memberships(id, project_id),
        check (expires_at > issued_at),
        check (last_protected_activity_at >= issued_at)
      );
      create unique index admin_mode_sessions_active_scope_unique
        on admin_mode_sessions(web_session_id, project_id)
        where status = 'active';
      create index admin_mode_sessions_expiry_idx
        on admin_mode_sessions(status, expires_at);

      create table m1_idempotency_records (
        id uuid primary key,
        actor_user_id uuid not null references users(id),
        project_id uuid references projects(id) on delete cascade,
        operation varchar(80) not null,
        idempotency_key varchar(128) not null,
        request_sha256 char(64) not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
        response jsonb not null,
        created_at timestamptz not null default now(),
        unique (actor_user_id, operation, idempotency_key)
      );

      alter table outbox_events
        add column audience_type varchar(16),
        add column audience_id uuid;
      update outbox_events
      set audience_type = 'project', audience_id = project_id
      where project_id is not null;
      alter table outbox_events
        alter column audience_type set not null,
        alter column audience_id set not null,
        add constraint outbox_events_audience_type_check
          check (audience_type in ('user', 'project')),
        add constraint outbox_events_audience_scope_check
          check (
            (audience_type = 'project' and project_id = audience_id)
            or (audience_type = 'user' and project_id is null)
          );
      create index outbox_events_audience_pending_idx
        on outbox_events(audience_type, audience_id, available_at, created_at)
        where processed_at is null;

      alter table resource_invalidation_events
        alter column project_id drop not null,
        add column audience_type varchar(16),
        add column audience_id uuid;
      update resource_invalidation_events
      set audience_type = 'project', audience_id = project_id;
      alter table resource_invalidation_events
        alter column audience_type set not null,
        alter column audience_id set not null,
        add constraint resource_invalidation_events_audience_type_check
          check (audience_type in ('user', 'project')),
        add constraint resource_invalidation_events_audience_scope_check
          check (
            (audience_type = 'project' and project_id = audience_id)
            or (audience_type = 'user' and project_id is null)
          );
      create index resource_invalidation_events_audience_cursor_idx
        on resource_invalidation_events(audience_type, audience_id, cursor);
    `.execute(database);

    for (const template of SYSTEM_LOGICAL_ROLE_TEMPLATES) {
      await sql`
        insert into system_logical_role_templates (id, title, description)
        values (${template.id}, ${template.title}, ${template.desc})
      `.execute(database);
    }

    await sql`
      insert into project_logical_roles (
        id,
        project_id,
        source_template_id,
        name,
        capability
      )
      select
        md5(projects.id::text || ':' || templates.id)::uuid,
        projects.id,
        templates.id,
        templates.title,
        templates.description
      from projects
      cross join system_logical_role_templates templates
      on conflict (project_id, source_template_id)
        where source_template_id is not null
        do nothing
    `.execute(database);

    await sql`
      create function ngapd_check_project_active_owner()
      returns trigger
      language plpgsql
      as $function$
      begin
        if exists (
          select 1
          from projects
          left join memberships
            on memberships.id = projects.owner_membership_id
          where memberships.id is null
             or memberships.project_id <> projects.id
             or memberships.status <> 'active'
        ) then
          raise exception using errcode = '23514', message = 'PROJECT_ACTIVE_OWNER_REQUIRED';
        end if;
        return null;
      end
      $function$
    `.execute(database);

    await sql`
      create constraint trigger projects_active_owner_guard
      after insert or update on projects
      deferrable initially deferred
      for each row execute function ngapd_check_project_active_owner()
    `.execute(database);

    await sql`
      create constraint trigger memberships_active_owner_guard
      after insert or update or delete on memberships
      deferrable initially deferred
      for each row execute function ngapd_check_project_active_owner()
    `.execute(database);

    await sql`
      update system_metadata
      set value = '2', updated_at = now()
      where key = 'schema_profile_version'
    `.execute(database);
  },
};

const m2TaskManagementMigration: Migration = {
  async up(database: Kysely<unknown>) {
    await sql`
      alter table tasks disable trigger tasks_update_guard;
      alter table tasks rename column body to content;
      alter table tasks rename column logical_role to legacy_logical_role;

      alter table task_workspace_transition_snapshots
        drop constraint if exists task_workspace_transition_snapshots_task_id_project_id_fkey;
      alter table task_operation_idempotency
        drop constraint if exists task_operation_idempotency_response_task_id_fkey,
        add constraint task_operation_idempotency_response_task_id_fkey
          foreign key (response_task_id) references tasks(id) on delete set null;

      alter table tasks
        add column logical_role_id uuid,
        add column created_by_membership_id uuid,
        add column archived_at timestamptz;

      do $migration$
      declare
        unresolved_count bigint;
      begin
        select count(*)
        into unresolved_count
        from tasks
        where legacy_logical_role is not null
          and (
            select count(*)
            from project_logical_roles
            where project_logical_roles.project_id = tasks.project_id
              and project_logical_roles.name = tasks.legacy_logical_role
          ) <> 1;

        if unresolved_count <> 0 then
          raise exception using
            errcode = '23514',
            message = 'M2_LOGICAL_ROLE_BACKFILL_REQUIRES_UNIQUE_PROJECT_ROLE',
            detail = unresolved_count::text || ' task role values have zero or multiple exact matches';
        end if;
      end
      $migration$;

      update tasks
      set logical_role_id = project_logical_roles.id
      from project_logical_roles
      where tasks.legacy_logical_role is not null
        and project_logical_roles.project_id = tasks.project_id
        and project_logical_roles.name = tasks.legacy_logical_role;

      with recursive ownership as (
        select
          tasks.id as task_id,
          tasks.id as current_task_id,
          tasks.parent_task_id,
          tasks.explicit_owner_membership_id,
          0 as depth
        from tasks
        union all
        select
          ownership.task_id,
          parent.id,
          parent.parent_task_id,
          parent.explicit_owner_membership_id,
          ownership.depth + 1
        from ownership
        join tasks parent on parent.id = ownership.parent_task_id
        where ownership.explicit_owner_membership_id is null
          and ownership.depth < 1000
      ),
      resolved as (
        select distinct on (task_id)
          task_id,
          explicit_owner_membership_id
        from ownership
        where explicit_owner_membership_id is not null
        order by task_id, depth
      )
      update tasks
      set created_by_membership_id = resolved.explicit_owner_membership_id
      from resolved
      where resolved.task_id = tasks.id;

      update tasks
      set
        display_type = coalesce(display_type, 'normal'),
        archived_at = case when archived then updated_at else null end;

      set constraints all immediate;

      alter table tasks
        alter column display_type set default 'normal',
        alter column display_type set not null,
        alter column created_by_membership_id set not null,
        add constraint tasks_content_length_check
          check (char_length(content) <= 65536),
        add constraint tasks_labels_array_check
          check (jsonb_typeof(labels) = 'array'),
        add constraint tasks_display_type_check
          check (display_type in ('normal', 'sprint', 'milestone')),
        add constraint tasks_archive_timestamp_check
          check ((archived and archived_at is not null) or (not archived and archived_at is null)),
        add constraint tasks_logical_role_project_fk
          foreign key (logical_role_id, project_id)
          references project_logical_roles(id, project_id),
        add constraint tasks_creator_project_fk
          foreign key (created_by_membership_id, project_id)
          references memberships(id, project_id);

      create or replace function ngapd_guard_task_update()
      returns trigger
      language plpgsql
      as $function$
      begin
        if new.project_id is distinct from old.project_id
          or new.task_sequence is distinct from old.task_sequence
          or new.task_key is distinct from old.task_key
          or new.created_by_membership_id is distinct from old.created_by_membership_id then
          raise exception using errcode = '23514', message = 'TASK_KEY_IMMUTABLE';
        end if;

        if old.frozen then
          if new.base_status = 'in_progress'
            and not new.frozen
            and new.title is not distinct from old.title
            and new.content is not distinct from old.content
            and new.due_at is not distinct from old.due_at
            and new.legacy_logical_role is not distinct from old.legacy_logical_role
            and new.logical_role_id is not distinct from old.logical_role_id
            and new.labels is not distinct from old.labels
            and new.display_type is not distinct from old.display_type
            and new.explicit_owner_membership_id is not distinct from old.explicit_owner_membership_id
            and new.parent_task_id is not distinct from old.parent_task_id
            and new.parent_graph_scope_id is not distinct from old.parent_graph_scope_id
            and new.archived is not distinct from old.archived
            and new.archived_at is not distinct from old.archived_at then
            return new;
          end if;
          if new.archived
            and not old.archived
            and new.archived_at is distinct from old.archived_at
            and new.base_status is not distinct from old.base_status
            and new.frozen is not distinct from old.frozen
            and new.title is not distinct from old.title
            and new.content is not distinct from old.content
            and new.due_at is not distinct from old.due_at
            and new.legacy_logical_role is not distinct from old.legacy_logical_role
            and new.logical_role_id is not distinct from old.logical_role_id
            and new.labels is not distinct from old.labels
            and new.display_type is not distinct from old.display_type
            and new.explicit_owner_membership_id is not distinct from old.explicit_owner_membership_id
            and new.parent_task_id is not distinct from old.parent_task_id
            and new.parent_graph_scope_id is not distinct from old.parent_graph_scope_id then
            if old.parent_task_id is null or exists (
              with recursive ancestors as (
                select id, parent_task_id, archived
                from tasks
                where id = old.parent_task_id
                union all
                select parent.id, parent.parent_task_id, parent.archived
                from tasks parent
                join ancestors child on child.parent_task_id = parent.id
              )
              select 1 from ancestors where parent_task_id is null and archived
            ) then
              return new;
            end if;
          end if;
          if new.title is distinct from old.title
            or new.content is distinct from old.content
            or new.due_at is distinct from old.due_at
            or new.legacy_logical_role is distinct from old.legacy_logical_role
            or new.logical_role_id is distinct from old.logical_role_id
            or new.labels is distinct from old.labels
            or new.display_type is distinct from old.display_type
            or new.explicit_owner_membership_id is distinct from old.explicit_owner_membership_id
            or new.parent_task_id is distinct from old.parent_task_id
            or new.parent_graph_scope_id is distinct from old.parent_graph_scope_id
            or new.base_status is distinct from old.base_status
            or new.archived is distinct from old.archived
            or new.archived_at is distinct from old.archived_at
            or new.frozen is distinct from old.frozen then
            raise exception using errcode = '23514', message = 'COMPLETED_TASK_FROZEN';
          end if;
        end if;
        return new;
      end
      $function$;
      alter table tasks enable trigger tasks_update_guard;

      create or replace function ngapd_guard_dependency_mutation()
      returns trigger
      language plpgsql
      as $function$
      declare
        predecessor_done boolean;
        successor_done boolean;
        creates_cycle boolean;
      begin
        if tg_op = 'DELETE' then
          select frozen into predecessor_done from tasks where id = old.predecessor_task_id;
          select frozen into successor_done from tasks where id = old.successor_task_id;
        else
          select frozen into predecessor_done from tasks where id = new.predecessor_task_id;
          select frozen into successor_done from tasks where id = new.successor_task_id;
        end if;
        if (coalesce(predecessor_done, false) or coalesce(successor_done, false))
          and not (
            tg_op = 'UPDATE'
            and old.enabled
            and not new.enabled
          ) then
          raise exception using errcode = '23514', message = 'COMPLETED_TASK_FROZEN';
        end if;
        if tg_op <> 'DELETE' and new.enabled then
          with recursive reachable(task_id) as (
            select new.successor_task_id
            union
            select dependency.successor_task_id
            from task_dependencies dependency
            join reachable on dependency.predecessor_task_id = reachable.task_id
            where dependency.enabled
              and dependency.graph_scope_id = new.graph_scope_id
              and dependency.id <> new.id
          )
          select exists(
            select 1 from reachable where task_id = new.predecessor_task_id
          ) into creates_cycle;
          if creates_cycle then
            raise exception using errcode = '23514', message = 'TASK_DEPENDENCY_CYCLE';
          end if;
        end if;
        return case when tg_op = 'DELETE' then old else new end;
      end
      $function$;

      create or replace function ngapd_check_task_workspace_consistency()
      returns trigger
      language plpgsql
      as $function$
      declare
        task_id_value uuid;
        task_done boolean;
        workspace_lifecycle varchar(20);
      begin
        if tg_table_name = 'tasks' then
          task_id_value := new.id;
          task_done := new.base_status = 'done' and new.frozen;
          select lifecycle into workspace_lifecycle
          from workspaces
          where scope_type = 'task' and scope_id = task_id_value;
          if workspace_lifecycle is null then
            raise exception using errcode = '23514', message = 'TASK_WORKSPACE_MISSING';
          end if;
        else
          if new.scope_type <> 'task' then
            return new;
          end if;
          task_id_value := new.scope_id;
          workspace_lifecycle := new.lifecycle;
          select base_status = 'done' and frozen into task_done
          from tasks
          where id = task_id_value;
          if task_done is null then
            if workspace_lifecycle = 'deleted' then
              return new;
            end if;
            raise exception using errcode = '23514', message = 'TASK_NOT_FOUND';
          end if;
        end if;
        if task_done and workspace_lifecycle not in ('frozen', 'archived') then
          raise exception using errcode = '23514', message = 'TASK_WORKSPACE_STATE_MISMATCH';
        end if;
        if not task_done and workspace_lifecycle = 'frozen' then
          raise exception using errcode = '23514', message = 'TASK_WORKSPACE_STATE_MISMATCH';
        end if;
        return new;
      end
      $function$;

      create table task_key_tombstones (
        project_id uuid not null references projects(id) on delete cascade,
        task_sequence bigint not null check (task_sequence >= 1),
        task_key varchar(32) not null,
        deleted_task_id uuid not null,
        deleted_by_membership_id uuid not null,
        deleted_at timestamptz not null default now(),
        primary key (project_id, task_sequence),
        unique (task_key),
        unique (deleted_task_id),
        foreign key (deleted_by_membership_id, project_id)
          references memberships(id, project_id),
        check (task_key ~ '^[A-Z]{2,6}-[1-9][0-9]*$')
      );

      create table task_comments (
        id uuid primary key,
        project_id uuid not null references projects(id) on delete cascade,
        task_id uuid not null,
        author_membership_id uuid not null,
        body text,
        attachments jsonb not null default '[]'::jsonb,
        version bigint not null default 1 check (version >= 1),
        edited_at timestamptz,
        deleted_at timestamptz,
        hidden_at timestamptz,
        hidden_by_membership_id uuid,
        hidden_reason text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (id, project_id),
        foreign key (task_id, project_id)
          references tasks(id, project_id)
          on delete cascade,
        foreign key (author_membership_id, project_id)
          references memberships(id, project_id),
        foreign key (hidden_by_membership_id, project_id)
          references memberships(id, project_id),
        check (jsonb_typeof(attachments) = 'array'),
        check (
          (deleted_at is null and body is not null and char_length(body) between 1 and 32768)
          or
          (deleted_at is not null and body is null and attachments = '[]'::jsonb)
        ),
        check (
          (hidden_at is null and hidden_by_membership_id is null and hidden_reason is null)
          or
          (
            hidden_at is not null
            and hidden_by_membership_id is not null
            and hidden_reason is not null
            and char_length(hidden_reason) between 1 and 2000
            and deleted_at is null
          )
        )
      );
      create index task_comments_task_cursor_idx
        on task_comments(task_id, created_at, id);
      create index task_comments_author_idx
        on task_comments(author_membership_id, created_at, id);

      create table task_activity_projection (
        cursor bigserial primary key,
        id uuid not null unique,
        outbox_event_id uuid not null unique references outbox_events(id) on delete cascade,
        project_id uuid not null references projects(id) on delete cascade,
        task_id uuid not null,
        event_type varchar(120) not null,
        actor_user_id uuid references users(id),
        resource_refs jsonb not null default '{}'::jsonb,
        occurred_at timestamptz not null,
        created_at timestamptz not null default now(),
        check (jsonb_typeof(resource_refs) = 'object')
      );
      create index task_activity_project_cursor_idx
        on task_activity_projection(project_id, cursor);
      create index task_activity_task_cursor_idx
        on task_activity_projection(task_id, cursor);

      create table task_completion_readiness (
        task_id uuid primary key,
        project_id uuid not null,
        ready boolean not null default false,
        condition_fingerprint char(64),
        version bigint not null default 1 check (version >= 1),
        evaluated_at timestamptz not null default now(),
        foreign key (task_id, project_id)
          references tasks(id, project_id)
          on delete cascade,
        check (
          (ready and condition_fingerprint ~ '^[0-9a-f]{64}$')
          or (not ready and condition_fingerprint is null)
        )
      );
      create index task_completion_readiness_project_idx
        on task_completion_readiness(project_id, ready, task_id);

      create table task_completion_ready_occurrences (
        id uuid primary key,
        project_id uuid not null references projects(id) on delete cascade,
        task_id uuid not null,
        owner_membership_id uuid not null,
        condition_fingerprint char(64) not null
          check (condition_fingerprint ~ '^[0-9a-f]{64}$'),
        source_outbox_event_id uuid not null references outbox_events(id) on delete cascade,
        created_at timestamptz not null default now(),
        foreign key (task_id, project_id)
          references tasks(id, project_id)
          on delete cascade,
        foreign key (owner_membership_id, project_id)
          references memberships(id, project_id),
        unique (task_id, condition_fingerprint)
      );

      create table task_notifications (
        id uuid primary key,
        project_id uuid not null references projects(id) on delete cascade,
        recipient_user_id uuid not null references users(id) on delete cascade,
        recipient_membership_id uuid,
        task_id uuid,
        event_type varchar(120) not null,
        occurrence_key varchar(240) not null,
        critical boolean not null default true,
        resource_refs jsonb not null default '{}'::jsonb,
        read_at timestamptz,
        version bigint not null default 1 check (version >= 1),
        source_outbox_event_id uuid references outbox_events(id) on delete cascade,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        foreign key (recipient_membership_id, project_id)
          references memberships(id, project_id),
        unique (recipient_user_id, occurrence_key),
        check (jsonb_typeof(resource_refs) = 'object')
      );
      create index task_notifications_recipient_cursor_idx
        on task_notifications(recipient_user_id, created_at, id);
      create index task_notifications_unread_idx
        on task_notifications(recipient_user_id, created_at, id)
        where read_at is null;
      create index task_notifications_project_task_idx
        on task_notifications(project_id, task_id, created_at, id);

      create table task_notification_preferences (
        user_id uuid not null references users(id) on delete cascade,
        event_type varchar(120) not null,
        enabled boolean not null default true,
        version bigint not null default 1 check (version >= 1),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (user_id, event_type)
      );

      create table task_projection_events (
        outbox_event_id uuid primary key references outbox_events(id) on delete cascade,
        projected_at timestamptz not null default now()
      );

      alter table task_operation_idempotency
        drop constraint task_operation_idempotency_operation_check,
        add constraint task_operation_idempotency_operation_check check (
          operation in (
            'create_task',
            'update_task',
            'dependency_change',
            'dependency_request_resolve',
            'task_move',
            'task_complete',
            'task_reopen',
            'task_owner_change',
            'task_archive',
            'task_delete',
            'task_follow',
            'task_blocker_add',
            'task_blocker_resolve',
            'task_status',
            'comment_create',
            'comment_update',
            'comment_delete',
            'comment_hide',
            'notification_read',
            'notification_preference'
          )
        );

      update system_metadata
      set value = '3', updated_at = now()
      where key = 'schema_profile_version';
    `.execute(database);
  },
  async down(database: Kysely<unknown>) {
    await sql`
      alter table task_operation_idempotency
        drop constraint task_operation_idempotency_operation_check,
        add constraint task_operation_idempotency_operation_check check (
          operation in (
            'create_task',
            'dependency_change',
            'task_move',
            'task_complete',
            'task_reopen',
            'task_owner_change',
            'task_archive',
            'task_delete',
            'task_follow'
          )
        );
      drop table task_projection_events;
      drop table task_notification_preferences;
      drop table task_notifications;
      drop table task_completion_ready_occurrences;
      drop table task_completion_readiness;
      drop table task_activity_projection;
      drop table task_comments;
      drop table task_key_tombstones;
      alter table tasks
        drop constraint tasks_creator_project_fk,
        drop constraint tasks_logical_role_project_fk,
        drop constraint tasks_archive_timestamp_check,
        drop constraint tasks_display_type_check,
        drop constraint tasks_labels_array_check,
        drop constraint tasks_content_length_check,
        alter column display_type drop not null,
        alter column display_type drop default,
        drop column archived_at,
        drop column created_by_membership_id,
        drop column logical_role_id;
      alter table tasks rename column legacy_logical_role to logical_role;
      alter table tasks rename column content to body;
      alter table task_operation_idempotency
        drop constraint task_operation_idempotency_response_task_id_fkey,
        add constraint task_operation_idempotency_response_task_id_fkey
          foreign key (response_task_id) references tasks(id);
      alter table task_workspace_transition_snapshots
        add constraint task_workspace_transition_snapshots_task_id_project_id_fkey
          foreign key (task_id, project_id) references tasks(id, project_id);
      update system_metadata
      set value = '2', updated_at = now()
      where key = 'schema_profile_version';
    `.execute(database);
  },
};

export class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {
      "0001-system-metadata": initialSystemMetadataMigration,
      "0002-workspace-foundation": workspaceFoundationMigration,
      "0003-workspace-sync-protocol": workspaceSyncProtocolMigration,
      "0004-m0-domain-baseline": m0DomainBaselineMigration,
      "0005-task-graph-guards": taskGraphGuardsMigration,
      "0006-task-workspace-lifecycle": taskWorkspaceLifecycleMigration,
      "0007-application-projections": applicationProjectionsMigration,
      "0008-m1-project-role-members": m1ProjectRoleMembersMigration,
      "0009-m2-task-management": m2TaskManagementMigration,
    };
  }
}
