import { randomUUID } from "node:crypto";

import { type Kysely, type Selectable, type Transaction } from "kysely";

import { writeAudit } from "./foundation-repository.js";
import type { DatabaseSchema, WorkspaceLeaseTable } from "./types.js";

type DatabaseExecutor = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>;
type WorkspaceLeaseRow = Selectable<WorkspaceLeaseTable>;

export interface WorkspaceRecord {
  id: string;
  scopeType: "user" | "project" | "task";
  scopeId: string;
  lifecycle: "active" | "frozen" | "archived" | "deleted";
  workCycle: number;
  syncVersion: number;
}

export interface WorkspaceAuthorizationSnapshot {
  workspace: WorkspaceRecord;
  actor: {
    userId: string;
    active: boolean;
    membership?: {
      id: string;
      userId: string;
      projectId: string;
      permissionLevel: "admin" | "member";
      status: "pending" | "active" | "removed";
    };
  };
  context: {
    scopeType: "user" | "project" | "task";
    scopeOwnerUserId?: string;
    projectId?: string;
    projectOwnerMembershipId?: string;
    projectLifecycle?: "active" | "archived";
  };
  taskId?: string;
  tasks: Array<{
    id: string;
    projectId: string;
    parentTaskId: string | null;
    explicitOwnerMembershipId: string | null;
  }>;
  memberships: Array<{
    id: string;
    projectId: string;
    status: "pending" | "active" | "removed";
  }>;
}

export interface WorkspaceManifestRecord {
  workspaceId: string;
  syncVersion: number;
  manifestSha256: string;
  createdAt: Date;
  entries: Array<{ path: string; kind: "file"; size: number; sha256: string }>;
}

export interface WorkspaceLeaseRecord {
  id: string;
  workspaceId: string;
  workCycle: number;
  userId: string;
  deviceId: string;
  connectionId: string;
  tokenHash: string;
  baseSyncVersion: number;
  issuedAt: Date;
  renewedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
}

export type LeaseMutationResult =
  | { ok: true; lease: WorkspaceLeaseRecord }
  | {
      ok: false;
      reason:
        | "base_version_conflict"
        | "lease_conflict"
        | "lease_not_found"
        | "lease_revoked"
        | "lease_expired"
        | "work_cycle_changed"
        | "lease_user_mismatch"
        | "lease_device_mismatch"
        | "lease_connection_mismatch"
        | "lease_token_mismatch";
    };

export type CommitMutationResult =
  | { ok: true; syncVersion: number; manifestSha256: string; idempotentReplay: boolean }
  | {
      ok: false;
      reason:
        | "idempotency_conflict"
        | "lease_not_found"
        | "lease_revoked"
        | "lease_expired"
        | "work_cycle_changed"
        | "lease_user_mismatch"
        | "lease_device_mismatch"
        | "lease_connection_mismatch"
        | "lease_token_mismatch"
        | "base_version_conflict"
        | "object_not_found"
        | "object_metadata_mismatch";
    };

export class WorkspaceRepository {
  constructor(private readonly database: Kysely<DatabaseSchema>) {}

  async registerVerifiedObject(input: {
    sha256: string;
    size: number;
    storageKey: string;
    verifiedAt: Date;
  }): Promise<void> {
    await this.database
      .insertInto("workspace_objects")
      .values({
        sha256: input.sha256,
        size: String(input.size),
        storage_key: input.storageKey,
        integrity_status: "verified",
        verified_at: input.verifiedAt,
      })
      .onConflict((conflict) => conflict.column("sha256").doNothing())
      .execute();
    const stored = await this.database
      .selectFrom("workspace_objects")
      .select(["size", "storage_key", "integrity_status"])
      .where("sha256", "=", input.sha256)
      .executeTakeFirstOrThrow();
    if (
      Number(stored.size) !== input.size ||
      stored.storage_key !== input.storageKey ||
      stored.integrity_status !== "verified"
    ) {
      throw new Error("OBJECT_METADATA_CONFLICT");
    }
  }

  async findObject(sha256: string) {
    const object = await this.database
      .selectFrom("workspace_objects")
      .select(["sha256", "size", "storage_key", "integrity_status", "verified_at"])
      .where("sha256", "=", sha256)
      .executeTakeFirst();
    return object
      ? {
          sha256: object.sha256,
          size: Number(object.size),
          storageKey: object.storage_key,
          integrityStatus: object.integrity_status,
          verifiedAt: object.verified_at,
        }
      : undefined;
  }

  async getAuthorizationSnapshot(
    workspaceId: string,
    actorUserId: string,
  ): Promise<WorkspaceAuthorizationSnapshot | undefined> {
    const workspace = await this.database
      .selectFrom("workspaces")
      .selectAll()
      .where("id", "=", workspaceId)
      .executeTakeFirst();
    return workspace
      ? loadAuthorizationSnapshot(this.database, mapWorkspace(workspace), actorUserId)
      : undefined;
  }

  async getVersion(
    workspaceId: string,
    syncVersion?: number,
  ): Promise<WorkspaceManifestRecord | undefined> {
    const workspace = await this.database
      .selectFrom("workspaces")
      .select("sync_version")
      .where("id", "=", workspaceId)
      .executeTakeFirst();
    if (!workspace) {
      return undefined;
    }
    const selectedVersion = syncVersion ?? Number(workspace.sync_version);
    const version = await this.database
      .selectFrom("workspace_versions")
      .select(["workspace_id", "sync_version", "manifest_sha256", "created_at"])
      .where("workspace_id", "=", workspaceId)
      .where("sync_version", "=", String(selectedVersion))
      .executeTakeFirst();
    if (!version) {
      return undefined;
    }
    const entries = await this.database
      .selectFrom("workspace_manifest_entries")
      .select(["path", "kind", "size", "sha256"])
      .where("workspace_id", "=", workspaceId)
      .where("sync_version", "=", String(selectedVersion))
      .orderBy("path")
      .execute();
    return {
      workspaceId: version.workspace_id,
      syncVersion: Number(version.sync_version),
      manifestSha256: version.manifest_sha256,
      createdAt: version.created_at,
      entries: entries.map((entry) => ({
        path: entry.path,
        kind: entry.kind,
        size: Number(entry.size),
        sha256: entry.sha256,
      })),
    };
  }

  async withLockedWorkspace<T>(
    workspaceId: string,
    actorUserId: string,
    callback: (
      unit: WorkspaceUnitOfWork,
      authorization: WorkspaceAuthorizationSnapshot,
    ) => Promise<T>,
  ): Promise<T | undefined> {
    return this.database.transaction().execute(async (transaction) => {
      const workspaceScope = await transaction
        .selectFrom("workspaces")
        .select(["scope_type", "scope_id"])
        .where("id", "=", workspaceId)
        .executeTakeFirst();
      if (!workspaceScope) {
        return undefined;
      }
      const projectId =
        workspaceScope.scope_type === "project"
          ? workspaceScope.scope_id
          : workspaceScope.scope_type === "task"
            ? (
                await transaction
                  .selectFrom("tasks")
                  .select("project_id")
                  .where("id", "=", workspaceScope.scope_id)
                  .executeTakeFirst()
              )?.project_id
            : undefined;
      if (workspaceScope.scope_type === "task" && !projectId) {
        return undefined;
      }
      if (projectId) {
        const project = await transaction
          .selectFrom("projects")
          .select("id")
          .where("id", "=", projectId)
          .forUpdate()
          .executeTakeFirst();
        if (!project) {
          return undefined;
        }
        await transaction
          .selectFrom("memberships")
          .select("id")
          .where("project_id", "=", projectId)
          .where("user_id", "=", actorUserId)
          .orderBy("id")
          .forUpdate()
          .execute();
      }
      const workspace = await transaction
        .selectFrom("workspaces")
        .selectAll()
        .where("id", "=", workspaceId)
        .forUpdate()
        .executeTakeFirst();
      if (!workspace) {
        return undefined;
      }
      if (
        workspace.scope_type !== workspaceScope.scope_type ||
        workspace.scope_id !== workspaceScope.scope_id
      ) {
        throw new Error("WORKSPACE_SCOPE_CHANGED");
      }
      const mapped = mapWorkspace(workspace);
      const authorization = await loadAuthorizationSnapshot(transaction, mapped, actorUserId);
      return callback(new WorkspaceUnitOfWork(transaction, mapped), authorization);
    });
  }

  async writeAudit(input: {
    actorUserId: string;
    deviceId?: string;
    workspaceId: string;
    requestId: string;
    action: string;
    result: string;
    reasonCode: string;
    beforeVersion?: number;
    afterVersion?: number;
    metadata?: Record<string, string | number | boolean | null>;
  }): Promise<void> {
    await writeAudit(this.database, input);
  }
}

export class WorkspaceUnitOfWork {
  constructor(
    private readonly transaction: Transaction<DatabaseSchema>,
    readonly workspace: WorkspaceRecord,
  ) {}

  async recordAudit(input: {
    actorUserId: string;
    deviceId?: string;
    requestId: string;
    action: string;
    result: string;
    reasonCode: string;
    beforeVersion?: number;
    afterVersion?: number;
    metadata?: Record<string, string | number | boolean | null>;
  }): Promise<void> {
    await writeAudit(this.transaction, {
      ...input,
      workspaceId: this.workspace.id,
    });
  }

  async acquireLease(input: {
    id?: string;
    userId: string;
    deviceId: string;
    connectionId: string;
    tokenHash: string;
    baseSyncVersion: number;
    now: Date;
    expiresAt: Date;
    requestId: string;
  }): Promise<LeaseMutationResult> {
    await this.expireLeases(input.now);
    if (input.baseSyncVersion !== this.workspace.syncVersion) {
      return { ok: false, reason: "base_version_conflict" };
    }
    const active = await this.findActiveLease();
    if (active) {
      return { ok: false, reason: "lease_conflict" };
    }
    const lease = await this.insertLease(input);
    await writeAudit(this.transaction, {
      actorUserId: input.userId,
      deviceId: input.deviceId,
      workspaceId: this.workspace.id,
      requestId: input.requestId,
      action: "workspace.lease.acquire",
      result: "success",
      reasonCode: "LEASE_ACQUIRED",
      beforeVersion: this.workspace.syncVersion,
      afterVersion: this.workspace.syncVersion,
      metadata: { leaseId: lease.id, connectionId: lease.connectionId },
    });
    return { ok: true, lease };
  }

  async takeoverLease(input: {
    id?: string;
    userId: string;
    deviceId: string;
    connectionId: string;
    tokenHash: string;
    now: Date;
    expiresAt: Date;
    requestId: string;
  }): Promise<{ lease: WorkspaceLeaseRecord; previousLeaseId: string | null }> {
    await this.expireLeases(input.now);
    const active = await this.findActiveLease();
    if (active) {
      await this.transaction
        .updateTable("workspace_leases")
        .set({ revoked_at: input.now, revoke_reason: "taken_over" })
        .where("id", "=", active.id)
        .execute();
    }
    const lease = await this.insertLease({
      ...input,
      baseSyncVersion: this.workspace.syncVersion,
    });
    await writeAudit(this.transaction, {
      actorUserId: input.userId,
      deviceId: input.deviceId,
      workspaceId: this.workspace.id,
      requestId: input.requestId,
      action: "workspace.lease.takeover",
      result: "success",
      reasonCode: "LEASE_TAKEN_OVER",
      beforeVersion: this.workspace.syncVersion,
      afterVersion: this.workspace.syncVersion,
      metadata: { previousLeaseId: active?.id ?? null, leaseId: lease.id },
    });
    return { lease, previousLeaseId: active?.id ?? null };
  }

  async renewLease(input: {
    leaseId: string;
    userId: string;
    deviceId: string;
    connectionId: string;
    tokenHash: string;
    now: Date;
    expiresAt: Date;
    requestId: string;
  }): Promise<LeaseMutationResult> {
    const lease = await this.findLease(input.leaseId);
    const failure = validateLease(lease, this.workspace, input);
    if (failure) {
      return { ok: false, reason: failure };
    }
    const updated = await this.transaction
      .updateTable("workspace_leases")
      .set({ renewed_at: input.now, expires_at: input.expiresAt })
      .where("id", "=", input.leaseId)
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAudit(this.transaction, {
      actorUserId: input.userId,
      deviceId: input.deviceId,
      workspaceId: this.workspace.id,
      requestId: input.requestId,
      action: "workspace.lease.renew",
      result: "success",
      reasonCode: "LEASE_RENEWED",
      beforeVersion: this.workspace.syncVersion,
      afterVersion: this.workspace.syncVersion,
      metadata: { leaseId: input.leaseId },
    });
    return { ok: true, lease: mapLease(updated) };
  }

  async releaseLease(input: {
    leaseId: string;
    userId: string;
    deviceId: string;
    connectionId: string;
    tokenHash: string;
    now: Date;
    requestId: string;
  }): Promise<LeaseMutationResult> {
    const lease = await this.findLease(input.leaseId);
    const failure = validateLease(lease, this.workspace, input);
    if (failure) {
      return { ok: false, reason: failure };
    }
    const updated = await this.transaction
      .updateTable("workspace_leases")
      .set({ revoked_at: input.now, revoke_reason: "released" })
      .where("id", "=", input.leaseId)
      .returningAll()
      .executeTakeFirstOrThrow();
    await writeAudit(this.transaction, {
      actorUserId: input.userId,
      deviceId: input.deviceId,
      workspaceId: this.workspace.id,
      requestId: input.requestId,
      action: "workspace.lease.release",
      result: "success",
      reasonCode: "LEASE_RELEASED",
      beforeVersion: this.workspace.syncVersion,
      afterVersion: this.workspace.syncVersion,
      metadata: { leaseId: input.leaseId },
    });
    return { ok: true, lease: mapLease(updated) };
  }

  async commit(input: {
    idempotencyId?: string;
    operation: "commit" | "conflict_use_local";
    idempotencyKey: string;
    requestSha256: string;
    manifestSha256: string;
    entries: Array<{ path: string; kind: "file"; size: number; sha256: string }>;
    leaseId: string;
    userId: string;
    deviceId: string;
    connectionId: string;
    tokenHash: string;
    baseSyncVersion: number;
    now: Date;
    requestId: string;
    auditAction: "workspace.commit" | "workspace.conflict.use_local";
  }): Promise<CommitMutationResult> {
    const replay = await this.transaction
      .selectFrom("idempotency_records")
      .select(["request_sha256", "response_sync_version", "response_manifest_sha256"])
      .where("device_id", "=", input.deviceId)
      .where("workspace_id", "=", this.workspace.id)
      .where("operation", "=", input.operation)
      .where("idempotency_key", "=", input.idempotencyKey)
      .executeTakeFirst();
    if (replay) {
      return replay.request_sha256 === input.requestSha256
        ? {
            ok: true,
            syncVersion: Number(replay.response_sync_version),
            manifestSha256: replay.response_manifest_sha256,
            idempotentReplay: true,
          }
        : { ok: false, reason: "idempotency_conflict" };
    }

    const lease = await this.findLease(input.leaseId);
    const failure = validateLease(lease, this.workspace, input);
    if (failure) {
      return { ok: false, reason: failure };
    }
    if (input.baseSyncVersion !== this.workspace.syncVersion) {
      return { ok: false, reason: "base_version_conflict" };
    }

    const hashes = [...new Set(input.entries.map((entry) => entry.sha256))];
    const objects =
      hashes.length === 0
        ? []
        : await this.transaction
            .selectFrom("workspace_objects")
            .select(["sha256", "size", "integrity_status"])
            .where("sha256", "in", hashes)
            .execute();
    const objectByHash = new Map(objects.map((object) => [object.sha256, object]));
    for (const entry of input.entries) {
      const object = objectByHash.get(entry.sha256);
      if (!object) {
        return { ok: false, reason: "object_not_found" };
      }
      if (object.integrity_status !== "verified" || Number(object.size) !== entry.size) {
        return { ok: false, reason: "object_metadata_mismatch" };
      }
    }

    const nextVersion = this.workspace.syncVersion + 1;
    await this.transaction
      .insertInto("workspace_versions")
      .values({
        workspace_id: this.workspace.id,
        sync_version: String(nextVersion),
        manifest_sha256: input.manifestSha256,
        created_by_user_id: input.userId,
        device_id: input.deviceId,
        lease_id: input.leaseId,
        created_at: input.now,
      })
      .execute();
    if (input.entries.length > 0) {
      await this.transaction
        .insertInto("workspace_manifest_entries")
        .values(
          input.entries.map((entry) => ({
            workspace_id: this.workspace.id,
            sync_version: String(nextVersion),
            path: entry.path,
            kind: entry.kind,
            size: String(entry.size),
            sha256: entry.sha256,
          })),
        )
        .execute();
    }
    const updated = await this.transaction
      .updateTable("workspaces")
      .set({ sync_version: String(nextVersion), updated_at: input.now })
      .where("id", "=", this.workspace.id)
      .where("sync_version", "=", String(this.workspace.syncVersion))
      .executeTakeFirst();
    if (updated.numUpdatedRows !== 1n) {
      throw new Error("WORKSPACE_CAS_FAILED");
    }
    await this.transaction
      .updateTable("workspace_leases")
      .set({ base_sync_version: String(nextVersion), renewed_at: input.now })
      .where("id", "=", input.leaseId)
      .execute();
    await this.transaction
      .insertInto("idempotency_records")
      .values({
        id: input.idempotencyId ?? randomUUID(),
        actor_user_id: input.userId,
        device_id: input.deviceId,
        workspace_id: this.workspace.id,
        operation: input.operation,
        idempotency_key: input.idempotencyKey,
        request_sha256: input.requestSha256,
        response_sync_version: String(nextVersion),
        response_manifest_sha256: input.manifestSha256,
      })
      .execute();
    await writeAudit(this.transaction, {
      actorUserId: input.userId,
      deviceId: input.deviceId,
      workspaceId: this.workspace.id,
      requestId: input.requestId,
      action: input.auditAction,
      result: "success",
      reasonCode:
        input.operation === "commit" ? "WORKSPACE_COMMITTED" : "CONFLICT_USE_LOCAL_APPLIED",
      beforeVersion: this.workspace.syncVersion,
      afterVersion: nextVersion,
      metadata: {
        manifestSha256: input.manifestSha256,
        entryCount: input.entries.length,
      },
    });
    this.workspace.syncVersion = nextVersion;
    return {
      ok: true,
      syncVersion: nextVersion,
      manifestSha256: input.manifestSha256,
      idempotentReplay: false,
    };
  }

  async chooseServer(input: {
    leaseId: string;
    userId: string;
    deviceId: string;
    connectionId: string;
    tokenHash: string;
    now: Date;
    requestId: string;
  }): Promise<LeaseMutationResult> {
    const lease = await this.findLease(input.leaseId);
    const failure = validateLease(lease, this.workspace, input);
    if (failure) {
      return { ok: false, reason: failure };
    }
    await writeAudit(this.transaction, {
      actorUserId: input.userId,
      deviceId: input.deviceId,
      workspaceId: this.workspace.id,
      requestId: input.requestId,
      action: "workspace.conflict.use_server",
      result: "success",
      reasonCode: "CONFLICT_USE_SERVER_SELECTED",
      beforeVersion: this.workspace.syncVersion,
      afterVersion: this.workspace.syncVersion,
      metadata: { leaseId: input.leaseId },
    });
    return { ok: true, lease: mapLease(lease!) };
  }

  async validateLeaseAccess(input: {
    leaseId: string;
    userId: string;
    deviceId: string;
    connectionId: string;
    tokenHash: string;
    now: Date;
  }): Promise<LeaseMutationResult> {
    const lease = await this.findLease(input.leaseId);
    const failure = validateLease(lease, this.workspace, input);
    return failure ? { ok: false, reason: failure } : { ok: true, lease: mapLease(lease!) };
  }

  private async expireLeases(now: Date): Promise<void> {
    await this.transaction
      .updateTable("workspace_leases")
      .set({ revoked_at: now, revoke_reason: "expired" })
      .where("workspace_id", "=", this.workspace.id)
      .where("work_cycle", "=", this.workspace.workCycle)
      .where("revoked_at", "is", null)
      .where("expires_at", "<=", now)
      .execute();
  }

  private async findActiveLease() {
    return this.transaction
      .selectFrom("workspace_leases")
      .selectAll()
      .where("workspace_id", "=", this.workspace.id)
      .where("work_cycle", "=", this.workspace.workCycle)
      .where("revoked_at", "is", null)
      .executeTakeFirst();
  }

  private async findLease(leaseId: string) {
    return this.transaction
      .selectFrom("workspace_leases")
      .selectAll()
      .where("id", "=", leaseId)
      .forUpdate()
      .executeTakeFirst();
  }

  private async insertLease(input: {
    id?: string;
    userId: string;
    deviceId: string;
    connectionId: string;
    tokenHash: string;
    baseSyncVersion: number;
    now: Date;
    expiresAt: Date;
  }): Promise<WorkspaceLeaseRecord> {
    const lease = await this.transaction
      .insertInto("workspace_leases")
      .values({
        id: input.id ?? randomUUID(),
        workspace_id: this.workspace.id,
        work_cycle: this.workspace.workCycle,
        user_id: input.userId,
        device_id: input.deviceId,
        connection_id: input.connectionId,
        token_hash: input.tokenHash,
        base_sync_version: String(input.baseSyncVersion),
        issued_at: input.now,
        renewed_at: input.now,
        expires_at: input.expiresAt,
        revoked_at: null,
        revoke_reason: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return mapLease(lease);
  }
}

async function loadAuthorizationSnapshot(
  executor: DatabaseExecutor,
  workspace: WorkspaceRecord,
  actorUserId: string,
): Promise<WorkspaceAuthorizationSnapshot> {
  const user = await executor
    .selectFrom("users")
    .select(["id", "active"])
    .where("id", "=", actorUserId)
    .executeTakeFirst();
  const actor = { userId: actorUserId, active: user?.active ?? false };
  if (workspace.scopeType === "user") {
    return {
      workspace,
      actor,
      context: { scopeType: "user", scopeOwnerUserId: workspace.scopeId },
      tasks: [],
      memberships: [],
    };
  }

  const task =
    workspace.scopeType === "task"
      ? await executor
          .selectFrom("tasks")
          .select(["id", "project_id"])
          .where("id", "=", workspace.scopeId)
          .executeTakeFirst()
      : undefined;
  const projectId = workspace.scopeType === "project" ? workspace.scopeId : task?.project_id;
  const project = projectId
    ? await executor
        .selectFrom("projects")
        .select(["id", "owner_membership_id", "lifecycle"])
        .where("id", "=", projectId)
        .executeTakeFirst()
    : undefined;
  const membership = projectId
    ? await executor
        .selectFrom("memberships")
        .select(["id", "user_id", "project_id", "permission_level", "status"])
        .where("project_id", "=", projectId)
        .where("user_id", "=", actorUserId)
        .executeTakeFirst()
    : undefined;
  const tasks = projectId
    ? await executor
        .selectFrom("tasks")
        .select(["id", "project_id", "parent_task_id", "explicit_owner_membership_id"])
        .where("project_id", "=", projectId)
        .execute()
    : [];
  const memberships = projectId
    ? await executor
        .selectFrom("memberships")
        .select(["id", "project_id", "status"])
        .where("project_id", "=", projectId)
        .execute()
    : [];
  return {
    workspace:
      project?.lifecycle === "archived"
        ? { ...workspace, lifecycle: "archived" as const }
        : workspace,
    actor: membership
      ? {
          ...actor,
          membership: {
            id: membership.id,
            userId: membership.user_id,
            projectId: membership.project_id,
            permissionLevel: membership.permission_level,
            status: membership.status,
          },
        }
      : actor,
    context: {
      scopeType: workspace.scopeType,
      ...(projectId ? { projectId } : {}),
      ...(project?.owner_membership_id
        ? { projectOwnerMembershipId: project.owner_membership_id }
        : {}),
      ...(project?.lifecycle ? { projectLifecycle: project.lifecycle } : {}),
    },
    ...(task ? { taskId: task.id } : {}),
    tasks: tasks.map((node) => ({
      id: node.id,
      projectId: node.project_id,
      parentTaskId: node.parent_task_id,
      explicitOwnerMembershipId: node.explicit_owner_membership_id,
    })),
    memberships: memberships.map((item) => ({
      id: item.id,
      projectId: item.project_id,
      status: item.status,
    })),
  };
}

function validateLease(
  lease: WorkspaceLeaseRow | undefined,
  workspace: WorkspaceRecord,
  input: {
    userId: string;
    deviceId: string;
    connectionId: string;
    tokenHash: string;
    now: Date;
  },
):
  | "lease_not_found"
  | "lease_revoked"
  | "lease_expired"
  | "work_cycle_changed"
  | "lease_user_mismatch"
  | "lease_device_mismatch"
  | "lease_connection_mismatch"
  | "lease_token_mismatch"
  | "base_version_conflict"
  | undefined {
  if (!lease || lease.workspace_id !== workspace.id) {
    return "lease_not_found";
  }
  if (lease.revoked_at) {
    return "lease_revoked";
  }
  if (lease.expires_at.getTime() <= input.now.getTime()) {
    return "lease_expired";
  }
  if (lease.work_cycle !== workspace.workCycle) {
    return "work_cycle_changed";
  }
  if (lease.user_id !== input.userId) {
    return "lease_user_mismatch";
  }
  if (lease.device_id !== input.deviceId) {
    return "lease_device_mismatch";
  }
  if (lease.connection_id !== input.connectionId) {
    return "lease_connection_mismatch";
  }
  if (lease.token_hash !== input.tokenHash) {
    return "lease_token_mismatch";
  }
  if (Number(lease.base_sync_version) !== workspace.syncVersion) {
    return "base_version_conflict";
  }
  return undefined;
}

function mapWorkspace(workspace: {
  id: string;
  scope_type: "user" | "project" | "task";
  scope_id: string;
  lifecycle: "active" | "frozen" | "archived" | "deleted";
  work_cycle: number;
  sync_version: string;
}): WorkspaceRecord {
  return {
    id: workspace.id,
    scopeType: workspace.scope_type,
    scopeId: workspace.scope_id,
    lifecycle: workspace.lifecycle,
    workCycle: workspace.work_cycle,
    syncVersion: Number(workspace.sync_version),
  };
}

function mapLease(lease: WorkspaceLeaseRow): WorkspaceLeaseRecord {
  return {
    id: lease.id,
    workspaceId: lease.workspace_id,
    workCycle: lease.work_cycle,
    userId: lease.user_id,
    deviceId: lease.device_id,
    connectionId: lease.connection_id,
    tokenHash: lease.token_hash,
    baseSyncVersion: Number(lease.base_sync_version),
    issuedAt: lease.issued_at,
    renewedAt: lease.renewed_at,
    expiresAt: lease.expires_at,
    revokedAt: lease.revoked_at,
    revokeReason: lease.revoke_reason,
  };
}
