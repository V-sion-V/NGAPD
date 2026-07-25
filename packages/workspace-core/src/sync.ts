import { diffWorkspaceManifests, hasWorkspaceChanges } from "./diff.js";
import { WorkspaceCoreError, WorkspaceRemoteError } from "./errors.js";
import { readStableScannedFile, scanWorkspace } from "./manifest.js";
import { materializeWorkspace } from "./materialization.js";
import { markConflict, markLeaseOrBaseInvalid, withoutRevision } from "./state-machine.js";
import type {
  LocalWorkspaceState,
  MaterializationFilePort,
  MaterializationResult,
  WorkspaceApiPort,
  WorkspaceControlPort,
  WorkspaceFilePort,
  WorkspaceLimits,
} from "./types.js";

export interface WorkspaceSyncSecrets {
  accessToken: string;
  leaseToken: string;
}

export interface WorkspaceSyncResult {
  state: LocalWorkspaceState;
  changed: boolean;
  idempotentReplay: boolean;
}

export async function syncWorkspace(input: {
  api: WorkspaceApiPort;
  files: WorkspaceFilePort;
  control: WorkspaceControlPort;
  secrets: WorkspaceSyncSecrets;
  idempotencyKey: string;
  limits?: WorkspaceLimits;
}): Promise<WorkspaceSyncResult> {
  assertIdempotencyKey(input.idempotencyKey);
  const release = await input.control.acquireLock();
  try {
    const state = await requireLeasedState(input.control);
    const scan = await scanWorkspace(input.files, input.limits);
    const diff = diffWorkspaceManifests(state.baseManifest, scan.manifest);
    if (!hasWorkspaceChanges(diff)) {
      return { state, changed: false, idempotentReplay: false };
    }
    if (state.lease!.baseSyncVersion !== state.baseSyncVersion) {
      const next = await input.control.writeState(
        markConflict(state, "BASE_VERSION_CONFLICT"),
        state.revision,
      );
      return { state: next, changed: true, idempotentReplay: false };
    }

    try {
      await uploadChangedFiles(input, state, scan.files, changedTargetPaths(diff));
      const committed = await input.api.commit({
        workspaceId: state.workspaceId,
        leaseId: state.lease!.id,
        connectionId: state.connectionId,
        leaseToken: input.secrets.leaseToken,
        baseSyncVersion: state.baseSyncVersion,
        idempotencyKey: input.idempotencyKey,
        manifest: scan.manifest,
        accessToken: input.secrets.accessToken,
      });
      if (
        committed.workspaceId !== state.workspaceId ||
        committed.manifestHash !== scan.manifest.hash ||
        committed.syncVersion < state.baseSyncVersion
      ) {
        throw new WorkspaceCoreError(
          "REMOTE_RESPONSE_INVALID",
          "Commit response does not match the requested Workspace manifest.",
        );
      }
      const nextState = await input.control.writeState(
        {
          ...withoutRevision(state),
          baseSyncVersion: committed.syncVersion,
          baseManifest: scan.manifest,
          replicaStatus: "clean",
          lease: { ...state.lease!, baseSyncVersion: committed.syncVersion },
          lastErrorCode: null,
        },
        state.revision,
      );
      return {
        state: nextState,
        changed: true,
        idempotentReplay: committed.idempotentReplay,
      };
    } catch (error) {
      await persistRemoteFailure(input.control, state, error);
      throw error;
    }
  } finally {
    await release();
  }
}

export async function useLocalWorkspace(input: {
  api: WorkspaceApiPort;
  files: WorkspaceFilePort;
  control: WorkspaceControlPort;
  secrets: WorkspaceSyncSecrets;
  idempotencyKey: string;
  limits?: WorkspaceLimits;
}): Promise<WorkspaceSyncResult> {
  assertIdempotencyKey(input.idempotencyKey);
  const release = await input.control.acquireLock();
  try {
    const state = await requireLeasedState(input.control);
    const scan = await scanWorkspace(input.files, input.limits);
    try {
      await uploadChangedFiles(
        input,
        state,
        scan.files,
        new Set(scan.files.map((file) => file.canonicalPath)),
      );
      const resolved = await input.api.resolveConflict({
        choice: "use_local",
        workspaceId: state.workspaceId,
        leaseId: state.lease!.id,
        connectionId: state.connectionId,
        leaseToken: input.secrets.leaseToken,
        baseSyncVersion: state.lease!.baseSyncVersion,
        idempotencyKey: input.idempotencyKey,
        manifest: scan.manifest,
        accessToken: input.secrets.accessToken,
      });
      if (
        resolved.choice !== "use_local" ||
        resolved.authoritativeVersion.workspaceId !== state.workspaceId ||
        resolved.authoritativeVersion.manifest.hash !== scan.manifest.hash
      ) {
        throw new WorkspaceCoreError(
          "REMOTE_RESPONSE_INVALID",
          "Conflict response does not match the local choice.",
        );
      }
      const syncVersion = resolved.authoritativeVersion.syncVersion;
      const nextState = await input.control.writeState(
        {
          ...withoutRevision(state),
          baseSyncVersion: syncVersion,
          baseManifest: scan.manifest,
          replicaStatus: "clean",
          lease: { ...state.lease!, baseSyncVersion: syncVersion },
          lastErrorCode: null,
        },
        state.revision,
      );
      return {
        state: nextState,
        changed: true,
        idempotentReplay: resolved.idempotentReplay,
      };
    } catch (error) {
      await persistRemoteFailure(input.control, state, error);
      throw error;
    }
  } finally {
    await release();
  }
}

export async function useServerWorkspace(input: {
  api: WorkspaceApiPort;
  control: WorkspaceControlPort;
  materializationFiles: MaterializationFilePort;
  secrets: WorkspaceSyncSecrets;
  transactionId: string;
  limits?: WorkspaceLimits;
}): Promise<MaterializationResult> {
  const state = await input.control.readState();
  if (!state?.lease) {
    throw new WorkspaceCoreError(
      "LEASE_OR_BASE_INVALID",
      "An active local lease is required for conflict resolution.",
    );
  }
  try {
    const resolved = await input.api.resolveConflict({
      choice: "use_server",
      workspaceId: state.workspaceId,
      leaseId: state.lease.id,
      connectionId: state.connectionId,
      leaseToken: input.secrets.leaseToken,
      accessToken: input.secrets.accessToken,
    });
    if (
      resolved.choice !== "use_server" ||
      resolved.authoritativeVersion.workspaceId !== state.workspaceId
    ) {
      throw new WorkspaceCoreError(
        "REMOTE_RESPONSE_INVALID",
        "Conflict response does not match the server choice.",
      );
    }
    return materializeWorkspace({
      request: {
        workspaceId: state.workspaceId,
        syncVersion: resolved.authoritativeVersion.syncVersion,
        manifest: resolved.authoritativeVersion.manifest,
        expectedStateRevision: state.revision,
      },
      transactionId: input.transactionId,
      control: input.control,
      files: input.materializationFiles,
      objects: {
        readObject: (objectHash) =>
          input.api.readObject(state.workspaceId, objectHash, input.secrets.accessToken),
      },
      ...(input.limits ? { limits: input.limits } : {}),
    });
  } catch (error) {
    await persistRemoteFailureWithLock(input.control, state, error);
    throw error;
  }
}

async function requireLeasedState(control: WorkspaceControlPort): Promise<LocalWorkspaceState> {
  const state = await control.readState();
  if (!state?.lease || state.connectionStatus !== "lease_active") {
    throw new WorkspaceCoreError(
      "LEASE_OR_BASE_INVALID",
      "An active local lease is required to synchronize.",
    );
  }
  return state;
}

async function uploadChangedFiles(
  input: {
    api: WorkspaceApiPort;
    files: WorkspaceFilePort;
    secrets: WorkspaceSyncSecrets;
  },
  state: LocalWorkspaceState,
  files: readonly {
    canonicalPath: string;
    sourcePath: string;
    size: number;
    sha256: string;
  }[],
  paths: ReadonlySet<string>,
): Promise<void> {
  for (const file of files) {
    if (!paths.has(file.canonicalPath)) {
      continue;
    }
    const content = await readStableScannedFile(input.files, file);
    await input.api.uploadObject({
      workspaceId: state.workspaceId,
      sha256: file.sha256,
      content,
      accessToken: input.secrets.accessToken,
      leaseId: state.lease!.id,
      connectionId: state.connectionId,
      leaseToken: input.secrets.leaseToken,
    });
  }
}

function changedTargetPaths(diff: {
  added: readonly string[];
  modified: readonly string[];
  renamed: readonly { to: string }[];
}): ReadonlySet<string> {
  return new Set([...diff.added, ...diff.modified, ...diff.renamed.map((renamed) => renamed.to)]);
}

async function persistRemoteFailure(
  control: WorkspaceControlPort,
  state: LocalWorkspaceState,
  error: unknown,
): Promise<void> {
  if (!(error instanceof WorkspaceRemoteError)) {
    return;
  }
  const conflictCodes = new Set(["BASE_VERSION_CONFLICT", "IDEMPOTENCY_CONFLICT", "CONFLICT"]);
  const invalidCodes = new Set([
    "LEASE_NOT_FOUND",
    "LEASE_EXPIRED",
    "LEASE_INVALID",
    "LEASE_CONFLICT",
    "WORK_CYCLE_CHANGED",
    "DEVICE_REVOKED",
    "ACCOUNT_INACTIVE",
    "FORBIDDEN",
    "WORKSPACE_NOT_ACTIVE",
  ]);
  if (conflictCodes.has(error.remoteCode)) {
    await control.writeState(markConflict(state, error.remoteCode), state.revision);
  } else if (invalidCodes.has(error.remoteCode)) {
    await control.writeState(markLeaseOrBaseInvalid(state, error.remoteCode), state.revision);
  }
}

async function persistRemoteFailureWithLock(
  control: WorkspaceControlPort,
  observedState: LocalWorkspaceState,
  error: unknown,
): Promise<void> {
  if (!(error instanceof WorkspaceRemoteError)) {
    return;
  }
  const release = await control.acquireLock();
  try {
    const currentState = await control.readState();
    if (!currentState || currentState.revision !== observedState.revision) {
      return;
    }
    await persistRemoteFailure(control, currentState, error);
  } finally {
    await release();
  }
}

function assertIdempotencyKey(value: string): void {
  if (value.length < 8 || value.length > 128) {
    throw new WorkspaceCoreError("STATE_INVALID", "Idempotency key length is invalid.");
  }
}
