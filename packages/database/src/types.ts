import type { ColumnType, Generated } from "kysely";

type CreatedAt = ColumnType<Date, Date | string | undefined, never>;
type UpdatedAt = ColumnType<Date, Date | string | undefined, Date | string>;
type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>;

export interface SystemMetadataTable {
  key: string;
  value: string;
  updated_at: UpdatedAt;
}

export interface UserTable {
  id: string;
  login_name: string;
  normalized_login_name: string;
  password_hash: string;
  active: Generated<boolean>;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface WebSessionTable {
  id: string;
  token_hash: string;
  user_id: string;
  expires_at: ColumnType<Date, Date | string, Date | string>;
  revoked_at: NullableTimestamp;
  created_at: CreatedAt;
}

export interface DeviceTable {
  id: string;
  user_id: string;
  name: string;
  platform: "macos" | "windows" | "linux";
  revoked_at: NullableTimestamp;
  created_at: CreatedAt;
}

export interface DeviceCredentialTable {
  id: string;
  device_id: string;
  secret_hash: string;
  expires_at: NullableTimestamp;
  revoked_at: NullableTimestamp;
  created_at: CreatedAt;
}

export interface DeviceAccessTokenTable {
  id: string;
  device_id: string;
  user_id: string;
  token_hash: string;
  expires_at: ColumnType<Date, Date | string, Date | string>;
  revoked_at: NullableTimestamp;
  created_at: CreatedAt;
}

export interface PairingRequestTable {
  id: string;
  code_hash: string;
  correlation_hash: string;
  device_name: string;
  platform: "macos" | "windows" | "linux";
  status: "pending" | "approved" | "denied" | "consumed" | "expired" | "revoked";
  attempts: Generated<number>;
  expires_at: ColumnType<Date, Date | string, Date | string>;
  approved_by_user_id: string | null;
  device_id: string | null;
  consumed_at: NullableTimestamp;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface ProjectTable {
  id: string;
  project_key: string;
  name: string;
  owner_membership_id: string;
  created_at: CreatedAt;
}

export interface MembershipTable {
  id: string;
  project_id: string;
  user_id: string;
  role: "admin" | "member";
  active: Generated<boolean>;
  created_at: CreatedAt;
}

export interface TaskTable {
  id: string;
  project_id: string;
  task_key: string;
  title: string;
  status: "open" | "in_progress" | "done" | "archived";
  parent_task_id: string | null;
  explicit_owner_membership_id: string | null;
  created_at: CreatedAt;
}

export interface WorkspaceTable {
  id: string;
  scope_type: "user" | "project" | "task";
  scope_id: string;
  lifecycle: Generated<"active" | "archived" | "deleted">;
  work_cycle: Generated<number>;
  sync_version: Generated<string>;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface AuditEventTable {
  id: string;
  actor_user_id: string | null;
  device_id: string | null;
  workspace_id: string | null;
  request_id: string;
  action: string;
  result: string;
  reason_code: string;
  before_version: string | null;
  after_version: string | null;
  metadata: ColumnType<
    Record<string, string | number | boolean | null>,
    Record<string, string | number | boolean | null> | undefined,
    Record<string, string | number | boolean | null>
  >;
  created_at: CreatedAt;
}

export interface WorkspaceLeaseTable {
  id: string;
  workspace_id: string;
  work_cycle: number;
  user_id: string;
  device_id: string;
  connection_id: string;
  token_hash: string;
  base_sync_version: string;
  issued_at: ColumnType<Date, Date | string, never>;
  renewed_at: ColumnType<Date, Date | string, Date | string>;
  expires_at: ColumnType<Date, Date | string, Date | string>;
  revoked_at: NullableTimestamp;
  revoke_reason: string | null;
}

export interface WorkspaceObjectTable {
  sha256: string;
  size: string;
  storage_key: string;
  integrity_status: "verified";
  verified_at: ColumnType<Date, Date | string, Date | string>;
  created_at: CreatedAt;
}

export interface WorkspaceVersionTable {
  workspace_id: string;
  sync_version: string;
  manifest_sha256: string;
  created_by_user_id: string | null;
  device_id: string | null;
  lease_id: string | null;
  created_at: CreatedAt;
}

export interface WorkspaceManifestEntryTable {
  workspace_id: string;
  sync_version: string;
  path: string;
  kind: "file";
  size: string;
  sha256: string;
}

export interface IdempotencyRecordTable {
  id: string;
  actor_user_id: string;
  device_id: string;
  workspace_id: string;
  operation: "commit" | "conflict_use_local";
  idempotency_key: string;
  request_sha256: string;
  response_sync_version: string;
  response_manifest_sha256: string;
  created_at: CreatedAt;
}

export interface DatabaseSchema {
  system_metadata: SystemMetadataTable;
  users: UserTable;
  web_sessions: WebSessionTable;
  devices: DeviceTable;
  device_credentials: DeviceCredentialTable;
  device_access_tokens: DeviceAccessTokenTable;
  pairing_requests: PairingRequestTable;
  projects: ProjectTable;
  memberships: MembershipTable;
  tasks: TaskTable;
  workspaces: WorkspaceTable;
  workspace_leases: WorkspaceLeaseTable;
  workspace_objects: WorkspaceObjectTable;
  workspace_versions: WorkspaceVersionTable;
  workspace_manifest_entries: WorkspaceManifestEntryTable;
  idempotency_records: IdempotencyRecordTable;
  audit_events: AuditEventTable;
}
