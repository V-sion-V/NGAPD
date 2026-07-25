import { diffWorkspaceManifests, hasWorkspaceChanges } from "./diff.js";
import { WorkspaceCoreError } from "./errors.js";
import { createWorkspaceManifest } from "./manifest.js";
import { normalizeRegistrationPath } from "./path-policy.js";
import type {
  LocalLeaseSummary,
  LocalReplicaStatus,
  LocalWorkspaceState,
  WorkspaceConnectionStatus,
  WorkspaceManifest,
} from "./types.js";

export function createUnmaterializedState(input: {
  workspaceId: string;
  connectionId: string;
  registeredPath: string;
}): Omit<LocalWorkspaceState, "revision"> {
  return {
    schemaVersion: 1,
    workspaceId: input.workspaceId,
    connectionId: input.connectionId,
    registeredPath: normalizeRegistrationPath(input.registeredPath),
    baseSyncVersion: 0,
    baseManifest: createWorkspaceManifest([]),
    replicaStatus: "unmaterialized",
    connectionStatus: "disconnected",
    lease: null,
    lastErrorCode: null,
  };
}

export function deriveLocalReplicaStatus(input: {
  state: LocalWorkspaceState;
  currentManifest: WorkspaceManifest;
  leaseValid: boolean;
  baseValid: boolean;
}): LocalReplicaStatus {
  if (!input.baseValid) {
    return "conflict";
  }
  const changed = hasWorkspaceChanges(
    diffWorkspaceManifests(input.state.baseManifest, input.currentManifest),
  );
  if (!changed) {
    return "clean";
  }
  return input.leaseValid && input.state.lease ? "dirty_with_lease" : "lease_or_base_invalid";
}

export function withActiveLease(
  state: LocalWorkspaceState,
  lease: LocalLeaseSummary,
): Omit<LocalWorkspaceState, "revision"> {
  assertLeaseSummary(lease);
  return withoutRevision({
    ...state,
    connectionStatus: "lease_active",
    lease,
    lastErrorCode: null,
  });
}

export function withoutActiveLease(
  state: LocalWorkspaceState,
  connectionStatus: Exclude<WorkspaceConnectionStatus, "lease_active">,
): Omit<LocalWorkspaceState, "revision"> {
  return withoutRevision({
    ...state,
    connectionStatus,
    lease: null,
  });
}

export function markLeaseOrBaseInvalid(
  state: LocalWorkspaceState,
  errorCode: string,
): Omit<LocalWorkspaceState, "revision"> {
  return withoutRevision({
    ...state,
    replicaStatus: "lease_or_base_invalid",
    connectionStatus: "read_only",
    lease: null,
    lastErrorCode: errorCode,
  });
}

export function markConflict(
  state: LocalWorkspaceState,
  errorCode: string,
): Omit<LocalWorkspaceState, "revision"> {
  return withoutRevision({
    ...state,
    replicaStatus: "conflict",
    connectionStatus: state.lease === null ? "read_only" : "lease_active",
    lastErrorCode: errorCode,
  });
}

export function withoutRevision(state: LocalWorkspaceState): Omit<LocalWorkspaceState, "revision"> {
  const copy: Partial<LocalWorkspaceState> = { ...state };
  delete copy.revision;
  return copy as Omit<LocalWorkspaceState, "revision">;
}

function assertLeaseSummary(lease: LocalLeaseSummary): void {
  if (
    lease.id.length === 0 ||
    lease.connectionId.length === 0 ||
    !Number.isSafeInteger(lease.baseSyncVersion) ||
    lease.baseSyncVersion < 0 ||
    !Number.isFinite(Date.parse(lease.expiresAt))
  ) {
    throw new WorkspaceCoreError("STATE_INVALID", "Local lease summary is invalid.");
  }
}
