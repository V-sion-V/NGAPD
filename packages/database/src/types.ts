import type { ColumnType, Generated } from "kysely";

type CreatedAt = ColumnType<Date, Date | string | undefined, never>;
type UpdatedAt = ColumnType<Date, Date | string | undefined, Date | string>;
type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>;
type NullableValue<Value> = ColumnType<Value | null, Value | null | undefined, Value | null>;

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
  project_key: ColumnType<string, string, never>;
  name: string;
  owner_membership_id: string;
  task_sequence: Generated<string>;
  completed_successor_reopen_policy: Generated<"deny" | "cascade">;
  lifecycle: Generated<"active" | "archived">;
  recovery_epoch: Generated<string>;
  version: Generated<string>;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
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
  project_id: ColumnType<string, string, never>;
  task_sequence: ColumnType<string, string | number, never>;
  task_key: ColumnType<string, string, never>;
  title: string;
  body: Generated<string>;
  due_at: NullableTimestamp;
  logical_role: NullableValue<string>;
  labels: ColumnType<string[], string[] | undefined, string[]>;
  display_type: NullableValue<string>;
  base_status: "not_started" | "in_progress" | "done";
  archived: Generated<boolean>;
  parent_task_id: string | null;
  parent_graph_scope_id: string;
  explicit_owner_membership_id: string | null;
  version: Generated<string>;
  frozen: Generated<boolean>;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface WorkspaceTable {
  id: string;
  scope_type: "user" | "project" | "task";
  scope_id: string;
  lifecycle: Generated<"active" | "frozen" | "archived" | "deleted">;
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
  actor_type: Generated<"human" | "agent" | "system">;
  project_id: NullableValue<string>;
  target_type: NullableValue<string>;
  target_id: NullableValue<string>;
  task_version_before: NullableValue<string>;
  task_version_after: NullableValue<string>;
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

export interface SiblingTaskGraphScopeTable {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  graph_version: Generated<string>;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface TaskDependencyTable {
  id: string;
  project_id: string;
  graph_scope_id: string;
  predecessor_task_id: string;
  successor_task_id: string;
  enabled: Generated<boolean>;
  created_by_membership_id: NullableValue<string>;
  request_id: string;
  created_at: CreatedAt;
}

export interface TaskDependencyChangeRequestTable {
  id: string;
  project_id: string;
  graph_scope_id: string;
  action: "add" | "remove";
  predecessor_task_id: string;
  successor_task_id: string;
  expected_graph_version: ColumnType<string, string | number, never>;
  predecessor_owner_membership_id: string;
  successor_owner_membership_id: string;
  requested_by_membership_id: string;
  required_acceptance_by_membership_id: string;
  status: Generated<"pending" | "accepted" | "rejected" | "expired" | "stale">;
  expires_at: ColumnType<Date, Date | string, Date | string>;
  resolved_at: NullableTimestamp;
  request_id: string;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
}

export interface TaskFollowTable {
  id: string;
  project_id: string;
  source_task_id: string;
  target_task_id: string;
  created_by_membership_id: string;
  created_at: CreatedAt;
}

export interface TaskBlockerTable {
  id: string;
  project_id: string;
  task_id: string;
  reason: string;
  created_by_membership_id: string;
  resolved_by_membership_id: NullableValue<string>;
  resolved_at: NullableTimestamp;
  created_at: CreatedAt;
}

export interface TaskCompletionSnapshotTable {
  id: string;
  project_id: string;
  task_id: string;
  task_version: ColumnType<string, string | number, never>;
  owner_membership_id: string;
  workspace_id: string;
  workspace_sync_version: ColumnType<string, string | number, never>;
  work_cycle: number;
  task_snapshot: ColumnType<
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>
  >;
  created_at: CreatedAt;
}

export interface TaskWorkspaceTransitionSnapshotTable {
  id: string;
  project_id: string;
  task_id: string;
  task_version: ColumnType<string, string | number, never>;
  transition_type: "owner_change" | "reopen";
  owner_membership_id: string;
  workspace_id: string;
  workspace_sync_version: ColumnType<string, string | number, never>;
  work_cycle: number;
  snapshot: ColumnType<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  created_at: CreatedAt;
}

export interface TaskOperationIdempotencyTable {
  id: string;
  project_id: string;
  actor_membership_id: string;
  operation:
    | "create_task"
    | "dependency_change"
    | "task_move"
    | "task_complete"
    | "task_reopen"
    | "task_owner_change"
    | "task_archive"
    | "task_delete"
    | "task_follow";
  idempotency_key: string;
  request_sha256: string;
  response: ColumnType<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  response_task_id: NullableValue<string>;
  created_at: CreatedAt;
}

export interface OutboxEventTable {
  id: string;
  project_id: NullableValue<string>;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  request_id: string;
  payload: ColumnType<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
  created_at: CreatedAt;
  available_at: ColumnType<Date, Date | string | undefined, Date | string>;
  attempt_count: Generated<number>;
  processed_at: NullableTimestamp;
  last_error_code: NullableValue<string>;
}

export interface ResourceInvalidationEventTable {
  cursor: Generated<string>;
  outbox_event_id: string;
  project_id: string;
  resource_type: string;
  resource_id: string;
  event_type: string;
  created_at: CreatedAt;
}

export interface EventProjectionStateTable {
  id: number;
  retention_floor: ColumnType<string, string | undefined, string>;
  updated_at: UpdatedAt;
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
  sibling_task_graph_scopes: SiblingTaskGraphScopeTable;
  task_dependencies: TaskDependencyTable;
  task_dependency_change_requests: TaskDependencyChangeRequestTable;
  task_follows: TaskFollowTable;
  task_blockers: TaskBlockerTable;
  task_completion_snapshots: TaskCompletionSnapshotTable;
  task_workspace_transition_snapshots: TaskWorkspaceTransitionSnapshotTable;
  task_operation_idempotency: TaskOperationIdempotencyTable;
  workspaces: WorkspaceTable;
  workspace_leases: WorkspaceLeaseTable;
  workspace_objects: WorkspaceObjectTable;
  workspace_versions: WorkspaceVersionTable;
  workspace_manifest_entries: WorkspaceManifestEntryTable;
  idempotency_records: IdempotencyRecordTable;
  audit_events: AuditEventTable;
  outbox_events: OutboxEventTable;
  resource_invalidation_events: ResourceInvalidationEventTable;
  event_projection_state: EventProjectionStateTable;
}
