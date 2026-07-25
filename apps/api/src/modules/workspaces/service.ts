import {
  type CommitWorkspaceRequest,
  type ResolveWorkspaceConflictRequest,
  type WorkspaceManifest,
} from "@ngapd/contracts";
import {
  type CommitMutationResult,
  type LeaseMutationResult,
  type WorkspaceAuthorizationSnapshot,
  type WorkspaceLeaseRecord,
  type WorkspaceRepository,
} from "@ngapd/database";
import {
  ManifestValidationError,
  assertManifestHash,
  hashCommitRequest,
  resolveEffectiveTaskOwner,
  resolveWorkspaceReadAccess,
  resolveWorkspaceWriteEligibility,
} from "@ngapd/domain";
import { ObjectHashMismatchError, ObjectMissingError, type ObjectStore } from "@ngapd/object-store";

import { ApplicationError } from "../identity/errors.js";
import { createSecret, hashSecret } from "../identity/security.js";

const DEFAULT_LEASE_TTL_MS = 60_000;

export interface DeviceActor {
  userId: string;
  deviceId: string;
}

export interface WorkspaceServiceContext {
  requestId: string;
  now: Date;
}

export interface LeaseCredentials {
  leaseId: string;
  connectionId: string;
  leaseToken: string;
}

export class WorkspaceService {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly objectStore: ObjectStore,
    private readonly leaseTtlMs = DEFAULT_LEASE_TTL_MS,
  ) {}

  async metadata(workspaceId: string, actor: DeviceActor) {
    const authorization = await this.readAuthorization(workspaceId, actor);
    const version = await this.repository.getVersion(workspaceId);
    if (!version) {
      throw workspaceNotFound();
    }
    return {
      workspace: authorization.workspace,
      currentVersion: mapVersion(version),
    };
  }

  async version(workspaceId: string, syncVersion: number, actor: DeviceActor) {
    await this.readAuthorization(workspaceId, actor);
    const version = await this.repository.getVersion(workspaceId, syncVersion);
    if (!version) {
      throw new ApplicationError(
        404,
        "WORKSPACE_NOT_FOUND",
        "Workspace 版本不存在",
        "请刷新 Workspace 元数据后重试",
      );
    }
    return mapVersion(version);
  }

  async uploadObject(
    workspaceId: string,
    sha256: string,
    content: Uint8Array,
    credentials: LeaseCredentials,
    actor: DeviceActor,
    context: WorkspaceServiceContext,
  ) {
    const validation = await this.repository.withLockedWorkspace(
      workspaceId,
      actor.userId,
      async (unit, authorization) => {
        const authorizationError = writeAuthorizationError(authorization);
        if (authorizationError) {
          return { authorizationError, currentVersion: authorization.workspace.syncVersion };
        }
        const lease = await unit.validateLeaseAccess({
          leaseId: credentials.leaseId,
          userId: actor.userId,
          deviceId: actor.deviceId,
          connectionId: credentials.connectionId,
          tokenHash: hashSecret(credentials.leaseToken),
          now: context.now,
        });
        return { lease, currentVersion: authorization.workspace.syncVersion };
      },
    );
    if (!validation) {
      throw workspaceNotFound();
    }
    if ("authorizationError" in validation) {
      await this.auditRejected(
        workspaceId,
        actor,
        context,
        "workspace.object.upload",
        validation.authorizationError.code,
        validation.currentVersion,
      );
      throw validation.authorizationError;
    }
    if (!validation.lease.ok) {
      return this.rejectLeaseMutation(
        workspaceId,
        actor,
        context,
        "workspace.object.upload",
        validation.lease,
        validation.currentVersion,
      );
    }

    try {
      const stored = await this.objectStore.putVerified(sha256, content);
      await this.repository.registerVerifiedObject({
        ...stored,
        verifiedAt: context.now,
      });
      return { sha256: stored.sha256, size: stored.size };
    } catch (error) {
      if (error instanceof ObjectHashMismatchError) {
        await this.auditRejected(
          workspaceId,
          actor,
          context,
          "workspace.object.upload",
          "OBJECT_HASH_MISMATCH",
          validation.currentVersion,
        );
        throw new ApplicationError(
          422,
          "OBJECT_HASH_MISMATCH",
          "对象内容与声明的 SHA-256 不一致",
          "请重新扫描文件并上传正确对象",
          validation.currentVersion,
        );
      }
      throw error;
    }
  }

  async downloadObject(workspaceId: string, sha256: string, actor: DeviceActor) {
    await this.readAuthorization(workspaceId, actor);
    const stored = await this.repository.findObject(sha256);
    if (!stored) {
      throw objectNotFound();
    }
    try {
      const content = await this.objectStore.readVerified(sha256);
      if (content.byteLength !== stored.size) {
        throw new ObjectHashMismatchError();
      }
      return content;
    } catch (error) {
      if (error instanceof ObjectMissingError) {
        throw objectNotFound();
      }
      if (error instanceof ObjectHashMismatchError) {
        throw new ApplicationError(
          500,
          "OBJECT_HASH_MISMATCH",
          "服务端对象完整性校验失败",
          "请携带 requestId 联系管理员；不要覆盖本地内容",
        );
      }
      throw error;
    }
  }

  async acquireLease(
    workspaceId: string,
    input: { connectionId: string; baseSyncVersion: number },
    actor: DeviceActor,
    context: WorkspaceServiceContext,
  ) {
    const leaseToken = createSecret();
    const result = await this.repository.withLockedWorkspace(
      workspaceId,
      actor.userId,
      async (unit, authorization) => {
        const authorizationError = writeAuthorizationError(authorization);
        if (authorizationError) {
          return { authorizationError, currentVersion: authorization.workspace.syncVersion };
        }
        const lease = await unit.acquireLease({
          userId: actor.userId,
          deviceId: actor.deviceId,
          connectionId: input.connectionId,
          tokenHash: hashSecret(leaseToken),
          baseSyncVersion: input.baseSyncVersion,
          now: context.now,
          expiresAt: new Date(context.now.getTime() + this.leaseTtlMs),
          requestId: context.requestId,
        });
        return { lease, currentVersion: authorization.workspace.syncVersion };
      },
    );
    return this.finishLeaseMutation(
      workspaceId,
      actor,
      context,
      "workspace.lease.acquire",
      result,
      leaseToken,
    );
  }

  async renewLease(
    workspaceId: string,
    input: LeaseCredentials,
    actor: DeviceActor,
    context: WorkspaceServiceContext,
  ) {
    const result = await this.repository.withLockedWorkspace(
      workspaceId,
      actor.userId,
      async (unit, authorization) => {
        const authorizationError = writeAuthorizationError(authorization);
        if (authorizationError) {
          return { authorizationError, currentVersion: authorization.workspace.syncVersion };
        }
        const lease = await unit.renewLease({
          leaseId: input.leaseId,
          userId: actor.userId,
          deviceId: actor.deviceId,
          connectionId: input.connectionId,
          tokenHash: hashSecret(input.leaseToken),
          now: context.now,
          expiresAt: new Date(context.now.getTime() + this.leaseTtlMs),
          requestId: context.requestId,
        });
        return { lease, currentVersion: authorization.workspace.syncVersion };
      },
    );
    const lease = await this.assertLeaseResult(
      workspaceId,
      actor,
      context,
      "workspace.lease.renew",
      result,
    );
    return mapLease(lease, context.now);
  }

  async releaseLease(
    workspaceId: string,
    input: LeaseCredentials,
    actor: DeviceActor,
    context: WorkspaceServiceContext,
  ) {
    const result = await this.repository.withLockedWorkspace(
      workspaceId,
      actor.userId,
      async (unit, authorization) => {
        const authorizationError = writeAuthorizationError(authorization);
        if (authorizationError) {
          return { authorizationError, currentVersion: authorization.workspace.syncVersion };
        }
        const lease = await unit.releaseLease({
          leaseId: input.leaseId,
          userId: actor.userId,
          deviceId: actor.deviceId,
          connectionId: input.connectionId,
          tokenHash: hashSecret(input.leaseToken),
          now: context.now,
          requestId: context.requestId,
        });
        return { lease, currentVersion: authorization.workspace.syncVersion };
      },
    );
    const lease = await this.assertLeaseResult(
      workspaceId,
      actor,
      context,
      "workspace.lease.release",
      result,
    );
    return mapLease(lease, context.now);
  }

  async takeoverLease(
    workspaceId: string,
    input: { connectionId: string; confirmed: true },
    actor: DeviceActor,
    context: WorkspaceServiceContext,
  ) {
    if (!input.confirmed) {
      throw new ApplicationError(
        400,
        "VALIDATION_ERROR",
        "接管必须由用户明确确认",
        "请确认接管后重试",
      );
    }
    const leaseToken = createSecret();
    const result = await this.repository.withLockedWorkspace(
      workspaceId,
      actor.userId,
      async (unit, authorization) => {
        const authorizationError = writeAuthorizationError(authorization);
        if (authorizationError) {
          return { authorizationError, currentVersion: authorization.workspace.syncVersion };
        }
        const takeover = await unit.takeoverLease({
          userId: actor.userId,
          deviceId: actor.deviceId,
          connectionId: input.connectionId,
          tokenHash: hashSecret(leaseToken),
          now: context.now,
          expiresAt: new Date(context.now.getTime() + this.leaseTtlMs),
          requestId: context.requestId,
        });
        return {
          lease: { ok: true as const, lease: takeover.lease },
          currentVersion: authorization.workspace.syncVersion,
        };
      },
    );
    return this.finishLeaseMutation(
      workspaceId,
      actor,
      context,
      "workspace.lease.takeover",
      result,
      leaseToken,
    );
  }

  async commit(
    workspaceId: string,
    input: CommitWorkspaceRequest,
    actor: DeviceActor,
    context: WorkspaceServiceContext,
  ) {
    const manifest = validateManifest(input.manifest);
    await this.assertObjectsAvailable(workspaceId, actor, context, manifest);
    const requestSha256 = hashCommitRequest({
      workspaceId,
      baseSyncVersion: input.baseSyncVersion,
      manifestHash: manifest.hash,
    });
    const result = await this.commitTransaction(
      workspaceId,
      input,
      actor,
      context,
      manifest,
      requestSha256,
      "commit",
      "workspace.commit",
    );
    return {
      workspaceId,
      syncVersion: result.syncVersion,
      manifestHash: result.manifestSha256,
      idempotentReplay: result.idempotentReplay,
    };
  }

  async resolveConflict(
    workspaceId: string,
    input: ResolveWorkspaceConflictRequest,
    actor: DeviceActor,
    context: WorkspaceServiceContext,
  ) {
    if (input.choice === "use_local") {
      const manifest = validateManifest(input.manifest);
      await this.assertObjectsAvailable(workspaceId, actor, context, manifest);
      const requestSha256 = hashCommitRequest({
        workspaceId,
        baseSyncVersion: input.baseSyncVersion,
        manifestHash: manifest.hash,
      });
      const result = await this.commitTransaction(
        workspaceId,
        input,
        actor,
        context,
        manifest,
        requestSha256,
        "conflict_use_local",
        "workspace.conflict.use_local",
      );
      const version = await this.repository.getVersion(workspaceId, result.syncVersion);
      if (!version) {
        throw workspaceNotFound();
      }
      return {
        choice: "use_local" as const,
        authoritativeVersion: mapVersion(version),
        idempotentReplay: result.idempotentReplay,
      };
    }

    const result = await this.repository.withLockedWorkspace(
      workspaceId,
      actor.userId,
      async (unit, authorization) => {
        const authorizationError = writeAuthorizationError(authorization);
        if (authorizationError) {
          return { authorizationError, currentVersion: authorization.workspace.syncVersion };
        }
        const lease = await unit.chooseServer({
          leaseId: input.leaseId,
          userId: actor.userId,
          deviceId: actor.deviceId,
          connectionId: input.connectionId,
          tokenHash: hashSecret(input.leaseToken),
          now: context.now,
          requestId: context.requestId,
        });
        return { lease, currentVersion: authorization.workspace.syncVersion };
      },
    );
    await this.assertLeaseResult(
      workspaceId,
      actor,
      context,
      "workspace.conflict.use_server",
      result,
    );
    const version = await this.repository.getVersion(workspaceId);
    if (!version) {
      throw workspaceNotFound();
    }
    return {
      choice: "use_server" as const,
      authoritativeVersion: mapVersion(version),
      idempotentReplay: false,
    };
  }

  private async readAuthorization(workspaceId: string, actor: DeviceActor) {
    const authorization = await this.repository.getAuthorizationSnapshot(workspaceId, actor.userId);
    if (!authorization || authorization.workspace.lifecycle === "deleted") {
      throw workspaceNotFound();
    }
    const decision = accessDecision(authorization, "read");
    if (!decision.allowed) {
      throw new ApplicationError(
        403,
        "FORBIDDEN",
        "没有读取该 Workspace 的权限",
        "请确认当前账号仍是有效成员",
        authorization.workspace.syncVersion,
      );
    }
    return authorization;
  }

  private async commitTransaction(
    workspaceId: string,
    input: CommitWorkspaceRequest,
    actor: DeviceActor,
    context: WorkspaceServiceContext,
    manifest: WorkspaceManifest,
    requestSha256: string,
    operation: "commit" | "conflict_use_local",
    auditAction: "workspace.commit" | "workspace.conflict.use_local",
  ) {
    const result = await this.repository.withLockedWorkspace(
      workspaceId,
      actor.userId,
      async (unit, authorization) => {
        const authorizationError = writeAuthorizationError(authorization);
        if (authorizationError) {
          return { authorizationError, currentVersion: authorization.workspace.syncVersion };
        }
        const commit = await unit.commit({
          operation,
          idempotencyKey: input.idempotencyKey,
          requestSha256,
          manifestSha256: manifest.hash,
          entries: manifest.entries,
          leaseId: input.leaseId,
          userId: actor.userId,
          deviceId: actor.deviceId,
          connectionId: input.connectionId,
          tokenHash: hashSecret(input.leaseToken),
          baseSyncVersion: input.baseSyncVersion,
          now: context.now,
          requestId: context.requestId,
          auditAction,
        });
        return { commit, currentVersion: authorization.workspace.syncVersion };
      },
    );
    if (!result) {
      throw workspaceNotFound();
    }
    if ("authorizationError" in result) {
      await this.auditRejected(
        workspaceId,
        actor,
        context,
        auditAction,
        result.authorizationError.code,
        result.currentVersion,
      );
      throw result.authorizationError;
    }
    if (!result.commit.ok) {
      return this.rejectCommitMutation(
        workspaceId,
        actor,
        context,
        auditAction,
        result.commit,
        result.currentVersion,
      );
    }
    return result.commit;
  }

  private async assertObjectsAvailable(
    workspaceId: string,
    actor: DeviceActor,
    context: WorkspaceServiceContext,
    manifest: WorkspaceManifest,
  ): Promise<void> {
    for (const entry of manifest.entries) {
      const registered = await this.repository.findObject(entry.sha256);
      if (
        !registered ||
        registered.size !== entry.size ||
        !(await this.objectStore.hasVerified(entry.sha256, entry.size))
      ) {
        const current = await this.repository.getVersion(workspaceId);
        await this.auditRejected(
          workspaceId,
          actor,
          context,
          "workspace.commit",
          "OBJECT_NOT_FOUND",
          current?.syncVersion ?? 0,
        );
        throw new ApplicationError(
          422,
          "OBJECT_NOT_FOUND",
          "manifest 引用了缺失或未通过完整性校验的对象",
          "请重新上传缺失对象后使用相同幂等键重试",
          current?.syncVersion,
        );
      }
    }
  }

  private finishLeaseMutation(
    workspaceId: string,
    actor: DeviceActor,
    context: WorkspaceServiceContext,
    action: string,
    result:
      | {
          authorizationError: ApplicationError;
          currentVersion: number;
        }
      | { lease: LeaseMutationResult; currentVersion: number }
      | undefined,
    leaseToken: string,
  ) {
    return this.assertLeaseResult(workspaceId, actor, context, action, result).then((lease) => ({
      lease: mapLease(lease, context.now),
      leaseToken,
    }));
  }

  private async assertLeaseResult(
    workspaceId: string,
    actor: DeviceActor,
    context: WorkspaceServiceContext,
    action: string,
    result:
      | {
          authorizationError: ApplicationError;
          currentVersion: number;
        }
      | { lease: LeaseMutationResult; currentVersion: number }
      | undefined,
  ): Promise<WorkspaceLeaseRecord> {
    if (!result) {
      throw workspaceNotFound();
    }
    if ("authorizationError" in result) {
      await this.auditRejected(
        workspaceId,
        actor,
        context,
        action,
        result.authorizationError.code,
        result.currentVersion,
      );
      throw result.authorizationError;
    }
    if (!result.lease.ok) {
      return this.rejectLeaseMutation(
        workspaceId,
        actor,
        context,
        action,
        result.lease,
        result.currentVersion,
      );
    }
    return result.lease.lease;
  }

  private async rejectLeaseMutation(
    workspaceId: string,
    actor: DeviceActor,
    context: WorkspaceServiceContext,
    action: string,
    mutation: Extract<LeaseMutationResult, { ok: false }>,
    currentVersion: number,
  ): Promise<never> {
    await this.auditRejected(
      workspaceId,
      actor,
      context,
      action,
      mutation.reason.toUpperCase(),
      currentVersion,
    );
    throw leaseError(mutation.reason, currentVersion);
  }

  private async rejectCommitMutation(
    workspaceId: string,
    actor: DeviceActor,
    context: WorkspaceServiceContext,
    action: string,
    mutation: Extract<CommitMutationResult, { ok: false }>,
    currentVersion: number,
  ): Promise<never> {
    await this.auditRejected(
      workspaceId,
      actor,
      context,
      action,
      mutation.reason.toUpperCase(),
      currentVersion,
    );
    throw commitError(mutation.reason, currentVersion);
  }

  private async auditRejected(
    workspaceId: string,
    actor: DeviceActor,
    context: WorkspaceServiceContext,
    action: string,
    reasonCode: string,
    currentVersion: number,
  ): Promise<void> {
    await this.repository.writeAudit({
      actorUserId: actor.userId,
      deviceId: actor.deviceId,
      workspaceId,
      requestId: context.requestId,
      action,
      result: "rejected",
      reasonCode,
      beforeVersion: currentVersion,
      afterVersion: currentVersion,
    });
  }
}

function accessDecision(snapshot: WorkspaceAuthorizationSnapshot, mode: "read" | "write") {
  const effectiveTaskOwner =
    snapshot.context.scopeType === "task" && snapshot.taskId
      ? resolveEffectiveTaskOwner(snapshot.taskId, snapshot.tasks, snapshot.memberships)
      : undefined;
  const context = {
    ...snapshot.context,
    ...(effectiveTaskOwner?.ok
      ? { effectiveTaskOwnerMembershipId: effectiveTaskOwner.membershipId }
      : {}),
  };
  return mode === "read"
    ? resolveWorkspaceReadAccess(context, snapshot.actor)
    : resolveWorkspaceWriteEligibility(context, snapshot.actor);
}

function writeAuthorizationError(
  snapshot: WorkspaceAuthorizationSnapshot,
): ApplicationError | undefined {
  if (snapshot.workspace.lifecycle !== "active") {
    return new ApplicationError(
      409,
      "WORKSPACE_NOT_ACTIVE",
      "Workspace 当前不可写",
      "请刷新 Workspace 生命周期状态",
      snapshot.workspace.syncVersion,
    );
  }
  const decision = accessDecision(snapshot, "write");
  return decision.allowed
    ? undefined
    : new ApplicationError(
        403,
        "FORBIDDEN",
        "当前用户没有该 Workspace 的写资格",
        "请刷新成员或 Owner 状态；本地变化只能保留为冲突副本",
        snapshot.workspace.syncVersion,
      );
}

function validateManifest(manifest: WorkspaceManifest): WorkspaceManifest {
  try {
    return {
      hash: manifest.hash,
      entries: assertManifestHash(manifest.entries, manifest.hash),
    };
  } catch (error) {
    if (error instanceof ManifestValidationError) {
      throw new ApplicationError(
        422,
        "MANIFEST_INVALID",
        "manifest 不符合规范或摘要不一致",
        `请修正 manifest 后重试（${error.reason}）`,
      );
    }
    throw error;
  }
}

function leaseError(reason: string, currentVersion: number): ApplicationError {
  switch (reason) {
    case "lease_conflict":
      return new ApplicationError(
        409,
        "LEASE_CONFLICT",
        "Workspace 已有活动写租约",
        "保持只读，或由用户明确确认接管",
        currentVersion,
      );
    case "lease_expired":
      return new ApplicationError(
        409,
        "LEASE_EXPIRED",
        "写租约已过期",
        "停止自动上传并重新获取租约",
        currentVersion,
      );
    case "base_version_conflict":
      return new ApplicationError(
        409,
        "BASE_VERSION_CONFLICT",
        "本地基线不是当前服务端版本",
        "停止自动上传并明确选择 use_local 或 use_server",
        currentVersion,
      );
    case "work_cycle_changed":
      return new ApplicationError(
        409,
        "WORK_CYCLE_CHANGED",
        "Workspace 工作周期已变化",
        "刷新 Workspace 并重新连接",
        currentVersion,
      );
    case "lease_not_found":
      return new ApplicationError(
        404,
        "LEASE_NOT_FOUND",
        "写租约不存在",
        "重新获取租约",
        currentVersion,
      );
    default:
      return new ApplicationError(
        409,
        "LEASE_INVALID",
        "写租约不再有效",
        "停止自动上传并重新获取租约",
        currentVersion,
      );
  }
}

function commitError(reason: string, currentVersion: number): ApplicationError {
  if (reason === "idempotency_conflict") {
    return new ApplicationError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "幂等键已绑定到不同请求",
      "为不同内容生成新的幂等键",
      currentVersion,
    );
  }
  if (reason === "object_not_found" || reason === "object_metadata_mismatch") {
    return new ApplicationError(
      422,
      reason === "object_not_found" ? "OBJECT_NOT_FOUND" : "OBJECT_HASH_MISMATCH",
      "manifest 引用的对象缺失或元数据不一致",
      "重新上传对象并重试；服务端版本未改变",
      currentVersion,
    );
  }
  return leaseError(reason, currentVersion);
}

function workspaceNotFound() {
  return new ApplicationError(
    404,
    "WORKSPACE_NOT_FOUND",
    "Workspace 不存在或不可访问",
    "请检查 Workspace 标识和当前账号权限",
  );
}

function objectNotFound() {
  return new ApplicationError(
    404,
    "OBJECT_NOT_FOUND",
    "对象不存在",
    "请刷新 manifest；不要覆盖本地内容",
  );
}

function mapVersion(version: {
  workspaceId: string;
  syncVersion: number;
  manifestSha256: string;
  createdAt: Date;
  entries: Array<{ path: string; kind: "file"; size: number; sha256: string }>;
}) {
  return {
    workspaceId: version.workspaceId,
    syncVersion: version.syncVersion,
    manifest: {
      hash: version.manifestSha256,
      entries: version.entries,
    },
    createdAt: version.createdAt.toISOString(),
  };
}

function mapLease(lease: WorkspaceLeaseRecord, now: Date) {
  const state =
    lease.revokedAt === null
      ? lease.expiresAt.getTime() <= now.getTime()
        ? ("expired" as const)
        : ("active" as const)
      : lease.revokeReason === "released"
        ? ("released" as const)
        : lease.revokeReason === "taken_over"
          ? ("taken_over" as const)
          : ("invalidated" as const);
  return {
    id: lease.id,
    workspaceId: lease.workspaceId,
    workCycle: lease.workCycle,
    userId: lease.userId,
    deviceId: lease.deviceId,
    connectionId: lease.connectionId,
    baseSyncVersion: lease.baseSyncVersion,
    issuedAt: lease.issuedAt.toISOString(),
    expiresAt: lease.expiresAt.toISOString(),
    state,
  };
}
