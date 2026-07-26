import { randomBytes, randomUUID } from "node:crypto";
import process from "node:process";

import {
  WorkspaceCoreError,
  WorkspaceRemoteError,
  createWorkspaceManifest,
  deriveLocalReplicaStatus,
  diffWorkspaceManifests,
  materializeWorkspace,
  markLeaseOrBaseInvalid,
  recoverMaterialization,
  scanWorkspace,
  syncWorkspace,
  useLocalWorkspace,
  useServerWorkspace,
  withActiveLease,
  withoutActiveLease,
  type ClockPort,
  type CredentialPort,
  type CredentialReference,
  type LocalWorkspaceState,
  type MaterializationFilePort,
  type RemoteWorkspaceLease,
  type RemoteWorkspaceLeaseGrant,
  type WorkspaceApiPort,
  type WorkspaceControlPort,
  type WorkspaceFilePort,
  type WorkspaceRegistration,
  type WorkspaceRegistryPort,
} from "@ngapd/workspace-core";

import { NodeWorkspaceFileAdapter } from "./adapters/filesystem.js";
import { HttpWorkspaceApiAdapter } from "./adapters/http.js";
import {
  NodeWorkspaceControlAdapter,
  NodeWorkspaceRegistryAdapter,
} from "./adapters/local-state.js";
import { MacOsKeychainCredentialAdapter } from "./adapters/macos-keychain.js";
import { WindowsPasswordVaultCredentialAdapter } from "./adapters/windows-password-vault.js";
import type {
  WorkspaceCliCommand,
  WorkspaceCliResult,
  WorkspaceCliResultStatus,
  WorkspaceCommandRuntime,
} from "./commands.js";
import { NodeClockAdapter } from "./node-platform.js";

const AUTH_ACCOUNT = "current-device";
const DEFAULT_PAIR_POLL_MS = 1_000;
const DEFAULT_PAIR_TIMEOUT_MS = 10 * 60 * 1_000;
const LEASE_RENEW_INTERVAL_MS = 20_000;

export interface WorkspaceRuntimeContext {
  files: WorkspaceFilePort & MaterializationFilePort;
  control: WorkspaceControlPort;
}

export interface WorkspaceRuntimeLifecycle {
  waitForSignalOrDelay(milliseconds: number): Promise<"delay" | "SIGINT" | "SIGTERM">;
}

export interface WorkspaceRuntimeDependencies {
  apiOrigin: string;
  configuredRoot: string;
  api: WorkspaceApiPort;
  credentials: CredentialPort;
  registry: WorkspaceRegistryPort;
  clock: ClockPort;
  platform: "macos" | "windows" | "linux";
  pairPollMs: number;
  pairTimeoutMs: number;
  lifecycle: WorkspaceRuntimeLifecycle;
  openWorkspace(registration: WorkspaceRegistration): Promise<WorkspaceRuntimeContext>;
  randomId(): string;
  randomSecret(): string;
}

export class DefaultWorkspaceCommandRuntime implements WorkspaceCommandRuntime {
  constructor(private readonly dependencies: WorkspaceRuntimeDependencies) {}

  async execute(
    command: WorkspaceCliCommand,
    emit: (result: WorkspaceCliResult) => void,
  ): Promise<WorkspaceCliResult> {
    switch (command.kind) {
      case "pair":
        return this.pair(command.deviceName, emit);
      case "auth-status":
        return this.authStatus();
      case "auth-logout":
        return this.authLogout();
      case "connect":
        return this.connect(command);
      case "workspace-status":
        return this.workspaceStatus(command.workspace);
      case "lease":
        return this.lease(command.action, command.workspace, command.confirmed, emit);
      case "sync":
        return this.sync(command.workspace);
      case "conflict":
        return this.resolveConflict(command.choice, command.workspace, command.confirmed);
    }
  }

  private async pair(
    deviceName: string,
    emit: (result: WorkspaceCliResult) => void,
  ): Promise<WorkspaceCliResult> {
    if ((await this.readStoredDevice(false)) !== null) {
      throw new WorkspaceCoreError(
        "CREDENTIAL_INVALID",
        "This credential store is already paired; log out before pairing another device.",
      );
    }
    const correlationSecret = this.dependencies.randomSecret();
    const created = await this.dependencies.api.createPairing({
      deviceName,
      platform: this.dependencies.platform,
      correlationSecret,
    });
    emit(
      result("pair", "pending", "Pairing is waiting for explicit Web approval.", null, {
        pairingId: created.pairingId,
        code: created.code,
        verificationUrl: `${this.dependencies.apiOrigin}${created.verificationPath}`,
        expiresAt: created.expiresAt,
      }),
    );

    let elapsed = 0;
    while (elapsed < this.dependencies.pairTimeoutMs) {
      await wait(this.dependencies.pairPollMs);
      elapsed += this.dependencies.pairPollMs;
      const status = await this.dependencies.api.pairingStatus({
        pairingId: created.pairingId,
        correlationSecret,
      });
      if (status.status === "pending") {
        continue;
      }
      if (status.status !== "approved") {
        throw new WorkspaceCoreError(
          "CREDENTIAL_UNAVAILABLE",
          `Pairing finished with status '${status.status}'.`,
        );
      }
      const credential = await this.dependencies.api.consumePairing({
        pairingId: created.pairingId,
        correlationSecret,
      });
      await this.dependencies.credentials.put(
        deviceCredentialReference(this.dependencies.apiOrigin),
        packDeviceCredential(credential.deviceId, credential.deviceCredential),
      );
      return result("pair", "success", "Device pairing completed.", null, {
        deviceId: credential.deviceId,
        accessTokenExpiresAt: credential.accessTokenExpiresAt,
      });
    }
    return result(
      "pair",
      "pending",
      "Pairing approval was not observed before the local wait timeout.",
      null,
      {
        pairingId: created.pairingId,
        code: created.code,
        expiresAt: created.expiresAt,
      },
      "Approve the code in Web and run pair again if this request expires.",
      1,
    );
  }

  private async authStatus(): Promise<WorkspaceCliResult> {
    const stored = await this.readStoredDevice(false);
    if (stored === null) {
      return result(
        "auth.status",
        "read_only",
        "This CLI is not paired.",
        null,
        { paired: false },
        "Run `ngapd-workspace pair --device-name <name>`.",
        1,
      );
    }
    const access = await this.dependencies.api.issueDeviceAccessToken(stored);
    return result("auth.status", "success", "Device authentication is active.", null, {
      paired: true,
      deviceId: stored.deviceId,
      accessTokenExpiresAt: access.accessTokenExpiresAt,
    });
  }

  private async authLogout(): Promise<WorkspaceCliResult> {
    const stored = await this.readStoredDevice(false);
    if (stored === null) {
      return result("auth.logout", "success", "This CLI was already logged out.", null, {
        revoked: false,
      });
    }
    let revoked = false;
    try {
      const access = await this.dependencies.api.issueDeviceAccessToken(stored);
      await this.dependencies.api.revokeCurrentDevice(access.accessToken);
      revoked = true;
    } catch (error) {
      if (!isCredentialAlreadyInvalid(error)) {
        throw error;
      }
    }
    const registry = await this.dependencies.registry.readRegistry();
    await Promise.all(
      registry.registrations.map((registration) =>
        this.dependencies.credentials.delete(
          leaseCredentialReference(
            this.dependencies.apiOrigin,
            stored.deviceId,
            registration.workspaceId,
          ),
        ),
      ),
    );
    await this.dependencies.credentials.delete(
      deviceCredentialReference(this.dependencies.apiOrigin),
    );
    return result("auth.logout", "success", "Current device credentials were removed.", null, {
      revoked,
      paired: false,
    });
  }

  private async connect(
    command: Extract<WorkspaceCliCommand, { kind: "connect" }>,
  ): Promise<WorkspaceCliResult> {
    const access = await this.accessToken();
    const metadata = await this.dependencies.api.getMetadata(command.workspace, access.accessToken);
    const registration: WorkspaceRegistration = {
      workspaceId: metadata.workspace.id,
      alias: command.alias,
      relativePath: command.registeredPath,
    };
    const opened = await this.dependencies.openWorkspace(registration);
    const prior = await this.dependencies.registry.resolve(registration.workspaceId);
    let registeredHere = false;
    if (prior === null) {
      await this.dependencies.registry.register(registration);
      registeredHere = true;
    } else if (
      prior.relativePath !== registration.relativePath ||
      prior.alias !== registration.alias
    ) {
      throw new WorkspaceCoreError(
        "REGISTRATION_CONFLICT",
        "Workspace ID is already registered with different local details.",
      );
    }

    let state = await opened.control.readState();
    if (state === null) {
      const release = await opened.control.acquireLock();
      try {
        state = await opened.control.writeState(
          {
            schemaVersion: 1,
            workspaceId: registration.workspaceId,
            connectionId: this.dependencies.randomId(),
            registeredPath: registration.relativePath,
            baseSyncVersion: 0,
            baseManifest: createWorkspaceManifest([]),
            replicaStatus: "unmaterialized",
            connectionStatus: "read_only",
            lease: null,
            lastErrorCode: null,
          },
          null,
        );
      } catch (error) {
        if (registeredHere) {
          await this.dependencies.registry.unregister(registration.workspaceId);
        }
        throw error;
      } finally {
        await release();
      }
    } else {
      assertStateMatchesRegistration(state, registration);
    }

    const materialized = await materializeWorkspace({
      request: {
        workspaceId: registration.workspaceId,
        syncVersion: metadata.currentVersion.syncVersion,
        manifest: metadata.currentVersion.manifest,
        expectedStateRevision: state.revision,
      },
      transactionId: this.dependencies.randomId(),
      control: opened.control,
      files: opened.files,
      objects: {
        readObject: (sha256) =>
          this.dependencies.api.readObject(registration.workspaceId, sha256, access.accessToken),
      },
    });
    const recovered =
      materialized.recoveredInterruptedTransaction || materialized.preservedConflicts.length > 0;
    return result(
      "connect",
      recovered ? "recovered" : "success",
      recovered
        ? "Workspace connected and local differences were preserved."
        : "Workspace connected and materialized.",
      registration.workspaceId,
      {
        alias: registration.alias,
        registeredPath: registration.relativePath,
        syncVersion: materialized.state.baseSyncVersion,
        preservedConflicts: materialized.preservedConflicts.map((item) => item.conflictPath),
      },
      recovered ? "Review preserved conflict copies before acquiring a lease." : null,
    );
  }

  private async workspaceStatus(workspace: string): Promise<WorkspaceCliResult> {
    const context = await this.openRegisteredWorkspace(workspace);
    const recovered = await recoverMaterialization({
      control: context.control,
      files: context.files,
    });
    const state = requireState(await context.control.readState());
    const scan = await scanWorkspace(context.files);
    const access = await this.accessToken();
    const metadata = await this.dependencies.api.getMetadata(state.workspaceId, access.accessToken);
    const leaseValid =
      state.lease !== null &&
      state.connectionStatus === "lease_active" &&
      Date.parse(state.lease.expiresAt) > this.dependencies.clock.now().getTime();
    const replicaStatus = deriveLocalReplicaStatus({
      state,
      currentManifest: scan.manifest,
      leaseValid,
      baseValid: state.baseSyncVersion === metadata.currentVersion.syncVersion,
    });
    const diff = diffWorkspaceManifests(state.baseManifest, scan.manifest);
    const status: WorkspaceCliResultStatus =
      recovered || state.replicaStatus === "materialization_failed"
        ? "recovered"
        : replicaStatus === "conflict" || replicaStatus === "lease_or_base_invalid"
          ? "conflict"
          : state.connectionStatus === "read_only"
            ? "read_only"
            : "success";
    return result(
      "workspace.status",
      status,
      statusMessage(status),
      state.workspaceId,
      {
        connectionStatus: state.connectionStatus,
        replicaStatus,
        baseSyncVersion: state.baseSyncVersion,
        remoteSyncVersion: metadata.currentVersion.syncVersion,
        manifestHash: scan.manifest.hash,
        fileCount: scan.manifest.entries.length,
        totalBytes: scan.totalBytes,
        changes: {
          added: diff.added.length,
          modified: diff.modified.length,
          deleted: diff.deleted.length,
          renamed: diff.renamed.length,
        },
        leaseExpiresAt: state.lease?.expiresAt ?? null,
        leaseExpiresInSeconds:
          state.lease === null
            ? null
            : Math.max(
                0,
                Math.floor(
                  (Date.parse(state.lease.expiresAt) - this.dependencies.clock.now().getTime()) /
                    1_000,
                ),
              ),
        recoveredInterruptedMaterialization: recovered,
        lastErrorCode: state.lastErrorCode,
      },
      statusRecovery(status, replicaStatus),
      status === "conflict" ? 1 : 0,
    );
  }

  private async lease(
    action: "acquire" | "renew" | "hold" | "release" | "takeover",
    workspace: string,
    confirmed: boolean,
    emit: (result: WorkspaceCliResult) => void,
  ): Promise<WorkspaceCliResult> {
    if (action === "acquire") {
      return this.acquireLease(workspace, false);
    }
    if (action === "takeover") {
      if (!confirmed) {
        throw new WorkspaceCoreError("STATE_INVALID", "Lease takeover requires confirmation.");
      }
      return this.acquireLease(workspace, true);
    }
    if (action === "renew") {
      return this.renewLease(workspace);
    }
    if (action === "release") {
      return this.releaseLease(workspace);
    }
    return this.holdLease(workspace, emit);
  }

  private async acquireLease(workspace: string, takeover: boolean): Promise<WorkspaceCliResult> {
    const context = await this.openRegisteredWorkspace(workspace);
    await recoverMaterialization({ control: context.control, files: context.files });
    const state = requireState(await context.control.readState());
    const access = await this.accessToken();
    const grant = takeover
      ? await this.dependencies.api.takeoverLease({
          workspaceId: state.workspaceId,
          connectionId: state.connectionId,
          accessToken: access.accessToken,
          confirmed: true,
        })
      : await this.dependencies.api.acquireLease({
          workspaceId: state.workspaceId,
          connectionId: state.connectionId,
          baseSyncVersion: state.baseSyncVersion,
          accessToken: access.accessToken,
        });
    await this.persistLeaseGrant(
      context.control,
      state,
      access.deviceId,
      access.accessToken,
      grant,
    );
    return result(
      takeover ? "lease.takeover" : "lease.acquire",
      "success",
      takeover ? "Workspace lease was explicitly taken over." : "Workspace lease acquired.",
      state.workspaceId,
      {
        leaseId: grant.lease.id,
        baseSyncVersion: grant.lease.baseSyncVersion,
        expiresAt: grant.lease.expiresAt,
        renewIntervalSeconds: LEASE_RENEW_INTERVAL_MS / 1_000,
      },
    );
  }

  private async renewLease(workspace: string): Promise<WorkspaceCliResult> {
    const context = await this.openRegisteredWorkspace(workspace);
    const state = requireLeasedState(await context.control.readState());
    const access = await this.accessToken();
    const leaseToken = await this.requireLeaseToken(access.deviceId, state.workspaceId);
    let renewed: RemoteWorkspaceLease;
    try {
      renewed = await this.dependencies.api.renewLease({
        workspaceId: state.workspaceId,
        leaseId: state.lease.id,
        connectionId: state.connectionId,
        leaseToken,
        accessToken: access.accessToken,
      });
    } catch (error) {
      if (isLeaseInvalidatingError(error)) {
        await this.invalidateLocalLease(context.control, state, access.deviceId, error.remoteCode);
      }
      throw error;
    }
    const release = await context.control.acquireLock();
    try {
      const current = requireLeasedState(await context.control.readState());
      if (current.lease.id !== state.lease.id) {
        throw new WorkspaceCoreError(
          "STATE_CONFLICT",
          "Local lease changed while renewal was in flight.",
          true,
        );
      }
      await context.control.writeState(
        withActiveLease(current, {
          id: renewed.id,
          connectionId: renewed.connectionId,
          baseSyncVersion: renewed.baseSyncVersion,
          expiresAt: renewed.expiresAt,
        }),
        current.revision,
      );
    } finally {
      await release();
    }
    return result("lease.renew", "success", "Workspace lease renewed.", state.workspaceId, {
      leaseId: renewed.id,
      baseSyncVersion: renewed.baseSyncVersion,
      expiresAt: renewed.expiresAt,
    });
  }

  private async holdLease(
    workspace: string,
    emit: (result: WorkspaceCliResult) => void,
  ): Promise<WorkspaceCliResult> {
    const initial = await this.workspaceStatus(workspace);
    if (initial.data.connectionStatus !== "lease_active") {
      throw new WorkspaceCoreError(
        "LEASE_OR_BASE_INVALID",
        "Lease hold requires an active local lease.",
      );
    }
    emit(
      result(
        "lease.hold",
        "success",
        "Lease hold started; renewal runs every 20 seconds.",
        initial.workspaceId,
        { renewIntervalSeconds: LEASE_RENEW_INTERVAL_MS / 1_000 },
      ),
    );
    while (true) {
      const event = await this.dependencies.lifecycle.waitForSignalOrDelay(LEASE_RENEW_INTERVAL_MS);
      if (event !== "delay") {
        const released = await this.releaseLease(workspace);
        return {
          ...released,
          action: "lease.hold",
          message: `Lease hold received ${event} and released safely.`,
          data: { ...released.data, signal: event },
        };
      }
      emit(await this.renewLease(workspace));
    }
  }

  private async releaseLease(workspace: string): Promise<WorkspaceCliResult> {
    const context = await this.openRegisteredWorkspace(workspace);
    const state = requireState(await context.control.readState());
    if (state.lease === null) {
      return result(
        "lease.release",
        "success",
        "Workspace lease was already released.",
        state.workspaceId,
        { released: false },
      );
    }
    const access = await this.accessToken();
    const leaseToken = await this.requireLeaseToken(access.deviceId, state.workspaceId);
    try {
      await this.dependencies.api.releaseLease({
        workspaceId: state.workspaceId,
        leaseId: state.lease.id,
        connectionId: state.connectionId,
        leaseToken,
        accessToken: access.accessToken,
      });
    } catch (error) {
      if (!isLeaseInvalidatingError(error)) {
        throw error;
      }
      await this.invalidateLocalLease(context.control, state, access.deviceId, error.remoteCode);
      return result(
        "lease.release",
        "recovered",
        "The remote lease was already invalid; local lease state was cleared.",
        state.workspaceId,
        { released: false, remoteCode: error.remoteCode },
      );
    }
    await this.clearLocalLease(context.control, state, access.deviceId);
    return result("lease.release", "success", "Workspace lease released.", state.workspaceId, {
      released: true,
    });
  }

  private async sync(workspace: string): Promise<WorkspaceCliResult> {
    const context = await this.openRegisteredWorkspace(workspace);
    await recoverMaterialization({ control: context.control, files: context.files });
    const state = requireLeasedState(await context.control.readState());
    const access = await this.accessToken();
    const leaseToken = await this.requireLeaseToken(access.deviceId, state.workspaceId);
    try {
      const synced = await syncWorkspace({
        api: this.dependencies.api,
        files: context.files,
        control: context.control,
        secrets: { accessToken: access.accessToken, leaseToken },
        idempotencyKey: this.dependencies.randomId(),
      });
      return result(
        "sync",
        "success",
        synced.changed ? "Workspace synchronized." : "Workspace was already synchronized.",
        state.workspaceId,
        {
          changed: synced.changed,
          idempotentReplay: synced.idempotentReplay,
          syncVersion: synced.state.baseSyncVersion,
          manifestHash: synced.state.baseManifest.hash,
        },
      );
    } catch (error) {
      await this.deleteLeaseSecretIfStateCleared(
        context.control,
        access.deviceId,
        state.workspaceId,
      );
      throw error;
    }
  }

  private async resolveConflict(
    choice: "use_local" | "use_server",
    workspace: string,
    confirmed: boolean,
  ): Promise<WorkspaceCliResult> {
    if (!confirmed) {
      throw new WorkspaceCoreError("STATE_INVALID", "Conflict resolution requires confirmation.");
    }
    const context = await this.openRegisteredWorkspace(workspace);
    const state = requireLeasedState(await context.control.readState());
    const access = await this.accessToken();
    const leaseToken = await this.requireLeaseToken(access.deviceId, state.workspaceId);
    if (choice === "use_local") {
      const resolved = await useLocalWorkspace({
        api: this.dependencies.api,
        files: context.files,
        control: context.control,
        secrets: { accessToken: access.accessToken, leaseToken },
        idempotencyKey: this.dependencies.randomId(),
      });
      return result(
        "conflict.use_local",
        "success",
        "Local content was explicitly selected as authoritative.",
        state.workspaceId,
        {
          syncVersion: resolved.state.baseSyncVersion,
          manifestHash: resolved.state.baseManifest.hash,
          idempotentReplay: resolved.idempotentReplay,
        },
      );
    }
    const resolved = await useServerWorkspace({
      api: this.dependencies.api,
      control: context.control,
      materializationFiles: context.files,
      secrets: { accessToken: access.accessToken, leaseToken },
      transactionId: this.dependencies.randomId(),
    });
    return result(
      "conflict.use_server",
      resolved.preservedConflicts.length > 0 ? "recovered" : "success",
      "Server content was explicitly selected and materialized.",
      state.workspaceId,
      {
        syncVersion: resolved.state.baseSyncVersion,
        manifestHash: resolved.state.baseManifest.hash,
        preservedConflicts: resolved.preservedConflicts.map((item) => item.conflictPath),
      },
      resolved.preservedConflicts.length > 0
        ? "Review the preserved conflict copies before deleting them."
        : null,
    );
  }

  private async openRegisteredWorkspace(
    workspaceIdOrAlias: string,
  ): Promise<WorkspaceRuntimeContext> {
    const registration = await this.dependencies.registry.resolve(workspaceIdOrAlias);
    if (registration === null) {
      throw new WorkspaceCoreError(
        "STATE_INVALID",
        "Workspace ID or alias is not registered under the configured root.",
      );
    }
    const opened = await this.dependencies.openWorkspace(registration);
    const state = await opened.control.readState();
    if (state !== null) {
      assertStateMatchesRegistration(state, registration);
    }
    return opened;
  }

  private async accessToken(): Promise<{ deviceId: string; accessToken: string }> {
    const stored = await this.readStoredDevice(true);
    const access = await this.dependencies.api.issueDeviceAccessToken(stored!);
    return { deviceId: access.deviceId, accessToken: access.accessToken };
  }

  private async readStoredDevice(
    required: boolean,
  ): Promise<{ deviceId: string; deviceCredential: string } | null> {
    const value = await this.dependencies.credentials.get(
      deviceCredentialReference(this.dependencies.apiOrigin),
    );
    if (value === null) {
      if (required) {
        throw new WorkspaceCoreError(
          "CREDENTIAL_UNAVAILABLE",
          "No paired device credential is available.",
        );
      }
      return null;
    }
    return unpackDeviceCredential(value);
  }

  private async persistLeaseGrant(
    control: WorkspaceControlPort,
    observed: LocalWorkspaceState,
    deviceId: string,
    accessToken: string,
    grant: RemoteWorkspaceLeaseGrant,
  ): Promise<void> {
    const reference = leaseCredentialReference(
      this.dependencies.apiOrigin,
      deviceId,
      observed.workspaceId,
    );
    await this.dependencies.credentials.put(reference, grant.leaseToken);
    try {
      const release = await control.acquireLock();
      try {
        const current = requireState(await control.readState());
        if (current.revision !== observed.revision) {
          throw new WorkspaceCoreError(
            "STATE_CONFLICT",
            "Local state changed while lease acquisition was in flight.",
            true,
          );
        }
        await control.writeState(
          withActiveLease(current, {
            id: grant.lease.id,
            connectionId: grant.lease.connectionId,
            baseSyncVersion: grant.lease.baseSyncVersion,
            expiresAt: grant.lease.expiresAt,
          }),
          current.revision,
        );
      } finally {
        await release();
      }
    } catch (error) {
      try {
        await this.dependencies.api.releaseLease({
          workspaceId: observed.workspaceId,
          leaseId: grant.lease.id,
          connectionId: grant.lease.connectionId,
          leaseToken: grant.leaseToken,
          accessToken,
        });
      } catch {
        // The original local CAS failure remains authoritative and contains no secret material.
      }
      await this.dependencies.credentials.delete(reference);
      throw error;
    }
  }

  private async requireLeaseToken(deviceId: string, workspaceId: string): Promise<string> {
    const token = await this.dependencies.credentials.get(
      leaseCredentialReference(this.dependencies.apiOrigin, deviceId, workspaceId),
    );
    if (token === null) {
      throw new WorkspaceCoreError(
        "CREDENTIAL_UNAVAILABLE",
        "The active lease token is unavailable in OS credential storage.",
      );
    }
    return token;
  }

  private async clearLocalLease(
    control: WorkspaceControlPort,
    observed: LocalWorkspaceState,
    deviceId: string,
  ): Promise<void> {
    await this.dependencies.credentials.delete(
      leaseCredentialReference(this.dependencies.apiOrigin, deviceId, observed.workspaceId),
    );
    const release = await control.acquireLock();
    try {
      const current = requireState(await control.readState());
      if (current.lease?.id === observed.lease?.id) {
        await control.writeState(withoutActiveLease(current, "read_only"), current.revision);
      }
    } finally {
      await release();
    }
  }

  private async invalidateLocalLease(
    control: WorkspaceControlPort,
    observed: LocalWorkspaceState,
    deviceId: string,
    errorCode: string,
  ): Promise<void> {
    await this.dependencies.credentials.delete(
      leaseCredentialReference(this.dependencies.apiOrigin, deviceId, observed.workspaceId),
    );
    const release = await control.acquireLock();
    try {
      const current = requireState(await control.readState());
      if (current.lease?.id === observed.lease?.id) {
        await control.writeState(markLeaseOrBaseInvalid(current, errorCode), current.revision);
      }
    } finally {
      await release();
    }
  }

  private async deleteLeaseSecretIfStateCleared(
    control: WorkspaceControlPort,
    deviceId: string,
    workspaceId: string,
  ): Promise<void> {
    if ((await control.readState())?.lease === null) {
      await this.dependencies.credentials.delete(
        leaseCredentialReference(this.dependencies.apiOrigin, deviceId, workspaceId),
      );
    }
  }
}

export async function createDefaultWorkspaceCommandRuntime(
  environment: NodeJS.ProcessEnv,
): Promise<WorkspaceCommandRuntime> {
  const apiOrigin = requireEnvironment(environment, "NGAPD_WORKSPACE_API_ORIGIN");
  const configuredRoot = requireEnvironment(environment, "NGAPD_WORKSPACE_ROOT");
  const registry = await NodeWorkspaceRegistryAdapter.open(configuredRoot);
  const credentials = await openCredentials(environment);
  const pairPollMs = positiveInteger(
    environment.NGAPD_WORKSPACE_PAIR_POLL_MS,
    DEFAULT_PAIR_POLL_MS,
  );
  const pairTimeoutMs = positiveInteger(
    environment.NGAPD_WORKSPACE_PAIR_TIMEOUT_MS,
    DEFAULT_PAIR_TIMEOUT_MS,
  );
  const dependencies: WorkspaceRuntimeDependencies = {
    apiOrigin,
    configuredRoot,
    api: new HttpWorkspaceApiAdapter(apiOrigin),
    credentials,
    registry,
    clock: new NodeClockAdapter(),
    platform: nodePlatform(),
    pairPollMs,
    pairTimeoutMs,
    lifecycle: { waitForSignalOrDelay },
    async openWorkspace(registration) {
      const files = await NodeWorkspaceFileAdapter.open(configuredRoot, registration.relativePath);
      return {
        files,
        control: await NodeWorkspaceControlAdapter.open(files.workspaceRoot),
      };
    },
    randomId: randomUUID,
    randomSecret: () => randomBytes(32).toString("base64url"),
  };
  return new DefaultWorkspaceCommandRuntime(dependencies);
}

async function openCredentials(environment: NodeJS.ProcessEnv): Promise<CredentialPort> {
  const path = environment.NGAPD_WORKSPACE_KEYCHAIN_PATH;
  const password = environment.NGAPD_WORKSPACE_KEYCHAIN_PASSWORD;
  if (process.platform === "win32") {
    if (path !== undefined || password !== undefined) {
      throw new WorkspaceCoreError(
        "CREDENTIAL_INVALID",
        "macOS Keychain configuration is not supported on Windows.",
      );
    }
    return WindowsPasswordVaultCredentialAdapter.forCurrentUser(
      environment.NGAPD_WORKSPACE_VAULT_NAMESPACE ?? "com.ngapd.workspace",
    );
  }
  if (process.platform !== "darwin") {
    throw new WorkspaceCoreError(
      "CREDENTIAL_UNAVAILABLE",
      "Workspace credentials are supported only on macOS and Windows.",
    );
  }
  const namespace = environment.NGAPD_WORKSPACE_KEYCHAIN_NAMESPACE ?? "com.ngapd.workspace";
  if ((path === undefined) !== (password === undefined)) {
    throw new WorkspaceCoreError(
      "CREDENTIAL_INVALID",
      "Isolated Keychain path and password must be configured together.",
    );
  }
  return path === undefined
    ? MacOsKeychainCredentialAdapter.forLoginKeychain(namespace)
    : MacOsKeychainCredentialAdapter.openIsolated(path, password!, namespace);
}

function deviceCredentialReference(origin: string): CredentialReference {
  return { origin, account: AUTH_ACCOUNT, kind: "device", workspaceId: null };
}

function leaseCredentialReference(
  origin: string,
  deviceId: string,
  workspaceId: string,
): CredentialReference {
  return { origin, account: deviceId, kind: "lease", workspaceId };
}

function packDeviceCredential(deviceId: string, deviceCredential: string): string {
  if (!/^[0-9a-f-]{36}$/iu.test(deviceId) || deviceCredential.length === 0) {
    throw new WorkspaceCoreError("CREDENTIAL_INVALID", "Device credential response is invalid.");
  }
  return `${deviceId}.${deviceCredential}`;
}

function unpackDeviceCredential(value: string): {
  deviceId: string;
  deviceCredential: string;
} {
  if (value.length < 38 || value[36] !== "." || !/^[0-9a-f-]{36}$/iu.test(value.slice(0, 36))) {
    throw new WorkspaceCoreError("CREDENTIAL_INVALID", "Stored device credential is invalid.");
  }
  return { deviceId: value.slice(0, 36), deviceCredential: value.slice(37) };
}

function requireState(state: LocalWorkspaceState | null): LocalWorkspaceState {
  if (state === null) {
    throw new WorkspaceCoreError("STATE_INVALID", "Registered Workspace state is missing.");
  }
  return state;
}

function requireLeasedState(state: LocalWorkspaceState | null): LocalWorkspaceState & {
  lease: NonNullable<LocalWorkspaceState["lease"]>;
} {
  const required = requireState(state);
  if (required.lease === null || required.connectionStatus !== "lease_active") {
    throw new WorkspaceCoreError("LEASE_OR_BASE_INVALID", "An active local lease is required.");
  }
  return required as LocalWorkspaceState & {
    lease: NonNullable<LocalWorkspaceState["lease"]>;
  };
}

function assertStateMatchesRegistration(
  state: LocalWorkspaceState,
  registration: WorkspaceRegistration,
): void {
  if (
    state.workspaceId !== registration.workspaceId ||
    state.registeredPath !== registration.relativePath
  ) {
    throw new WorkspaceCoreError(
      "STATE_INVALID",
      "Workspace state does not match the root registry.",
    );
  }
}

function result(
  action: string,
  status: WorkspaceCliResultStatus,
  message: string,
  workspaceId: string | null,
  data: Readonly<Record<string, unknown>>,
  recovery: string | null = null,
  exitCode = 0,
): WorkspaceCliResult {
  return { action, status, message, workspaceId, data, recovery, exitCode };
}

function statusMessage(status: WorkspaceCliResultStatus): string {
  if (status === "conflict") {
    return "Workspace requires explicit recovery before synchronization.";
  }
  if (status === "read_only") {
    return "Workspace is connected without an active write lease.";
  }
  if (status === "recovered") {
    return "Workspace recovered an interrupted materialization.";
  }
  return "Workspace is ready.";
}

function statusRecovery(
  status: WorkspaceCliResultStatus,
  replicaStatus: LocalWorkspaceState["replicaStatus"],
): string | null {
  if (status === "conflict") {
    return replicaStatus === "conflict"
      ? "Acquire or explicitly take over a current lease, then choose use-local or use-server."
      : "Acquire a valid lease before synchronizing local changes.";
  }
  if (status === "read_only") {
    return "Run lease acquire before making synchronized changes.";
  }
  if (status === "recovered") {
    return "Inspect local files and preserved conflict copies before continuing.";
  }
  return null;
}

function isCredentialAlreadyInvalid(error: unknown): error is WorkspaceRemoteError {
  return (
    error instanceof WorkspaceRemoteError &&
    new Set(["DEVICE_REVOKED", "ACCOUNT_INACTIVE", "AUTHENTICATION_REQUIRED"]).has(error.remoteCode)
  );
}

function isLeaseInvalidatingError(error: unknown): error is WorkspaceRemoteError {
  return (
    error instanceof WorkspaceRemoteError &&
    new Set([
      "LEASE_NOT_FOUND",
      "LEASE_EXPIRED",
      "LEASE_INVALID",
      "DEVICE_REVOKED",
      "ACCOUNT_INACTIVE",
      "FORBIDDEN",
      "WORKSPACE_NOT_ACTIVE",
      "WORK_CYCLE_CHANGED",
    ]).has(error.remoteCode)
  );
}

function requireEnvironment(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name];
  if (value === undefined || value.length === 0) {
    throw new WorkspaceCoreError("STATE_INVALID", `${name} is required for Workspace commands.`);
  }
  return value;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new WorkspaceCoreError("STATE_INVALID", "Runtime interval configuration is invalid.");
  }
  return parsed;
}

function nodePlatform(): "macos" | "windows" | "linux" {
  if (process.platform === "darwin") {
    return "macos";
  }
  if (process.platform === "win32") {
    return "windows";
  }
  return "linux";
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function waitForSignalOrDelay(milliseconds: number): Promise<"delay" | "SIGINT" | "SIGTERM"> {
  return new Promise((resolve) => {
    const finish = (value: "delay" | "SIGINT" | "SIGTERM") => {
      clearTimeout(timer);
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onTerminate);
      resolve(value);
    };
    const onInterrupt = () => finish("SIGINT");
    const onTerminate = () => finish("SIGTERM");
    const timer = setTimeout(() => finish("delay"), milliseconds);
    process.once("SIGINT", onInterrupt);
    process.once("SIGTERM", onTerminate);
  });
}
