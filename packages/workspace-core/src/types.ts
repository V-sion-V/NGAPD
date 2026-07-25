export type WorkspaceCapability = "workspace_status" | "workspace_doctor";

export interface PlatformInformation {
  platform: string;
  architecture: string;
  nodeVersion: string;
}

export interface PlatformAdapter {
  getPlatformInformation(): PlatformInformation;
}

export interface ConfigurationStatus {
  ready: boolean;
  workspaceRegistered: boolean;
  summary: string;
}

export interface WorkspaceStatus {
  serviceName: string;
  applicationVersion: string;
  protocolCapabilityVersion: string;
  platform: PlatformInformation;
  capabilities: readonly WorkspaceCapability[];
  configuration: ConfigurationStatus;
  accessMode: "read-only-diagnostics";
}

export type DiagnosticCheckStatus = "pass" | "warning" | "fail";

export interface DiagnosticCheck {
  id: string;
  status: DiagnosticCheckStatus;
  summary: string;
}

export interface DoctorResult {
  serviceName: string;
  applicationVersion: string;
  checks: readonly DiagnosticCheck[];
  summary: {
    passed: number;
    warnings: number;
    failed: number;
    ready: boolean;
  };
}

export type LocalReplicaStatus =
  | "unmaterialized"
  | "clean"
  | "dirty_with_lease"
  | "lease_or_base_invalid"
  | "conflict"
  | "materialization_failed";

export type WorkspaceConnectionStatus = "disconnected" | "read_only" | "lease_active";

export interface WorkspaceManifestEntry {
  path: string;
  kind: "file";
  size: number;
  sha256: string;
}

export interface WorkspaceManifest {
  hash: string;
  entries: readonly WorkspaceManifestEntry[];
}

export interface WorkspaceLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxWorkspaceBytes: number;
}

export interface FileSnapshot {
  kind: "file" | "directory" | "symlink" | "other";
  size: number;
  modifiedAtMs: number;
  changedAtMs: number;
  device: number;
  inode: number;
}

export interface DirectoryEntry {
  name: string;
  kind: FileSnapshot["kind"];
}

export interface WorkspaceFilePort {
  inspect(relativePath: string): Promise<FileSnapshot>;
  listDirectory(relativePath: string): Promise<readonly DirectoryEntry[]>;
  hashFile(relativePath: string): Promise<string>;
  readFile(relativePath: string): Promise<Uint8Array>;
}

export interface ScannedWorkspaceFile {
  canonicalPath: string;
  sourcePath: string;
  size: number;
  sha256: string;
}

export interface WorkspaceScanResult {
  manifest: WorkspaceManifest;
  files: readonly ScannedWorkspaceFile[];
  totalBytes: number;
}

export interface RenamedWorkspaceFile {
  from: string;
  to: string;
}

export interface WorkspaceDiff {
  added: readonly string[];
  modified: readonly string[];
  deleted: readonly string[];
  renamed: readonly RenamedWorkspaceFile[];
  unchanged: readonly string[];
}

export interface LocalLeaseSummary {
  id: string;
  connectionId: string;
  baseSyncVersion: number;
  expiresAt: string;
}

export interface LocalWorkspaceState {
  schemaVersion: 1;
  revision: number;
  workspaceId: string;
  connectionId: string;
  registeredPath: string;
  baseSyncVersion: number;
  baseManifest: WorkspaceManifest;
  replicaStatus: LocalReplicaStatus;
  connectionStatus: WorkspaceConnectionStatus;
  lease: LocalLeaseSummary | null;
  lastErrorCode: string | null;
}

export interface WorkspaceRegistration {
  workspaceId: string;
  alias: string | null;
  relativePath: string;
}

export interface WorkspaceRegistry {
  schemaVersion: 1;
  revision: number;
  registrations: readonly WorkspaceRegistration[];
}

export interface WorkspaceRegistryPort {
  register(registration: WorkspaceRegistration): Promise<WorkspaceRegistry>;
  unregister(workspaceId: string): Promise<WorkspaceRegistry>;
  readRegistry(): Promise<WorkspaceRegistry>;
  resolve(workspaceIdOrAlias: string): Promise<WorkspaceRegistration | null>;
}

export interface MaterializationOperation {
  path: string;
  kind: "write" | "delete";
  previousExisted: boolean;
  preserveConflict: boolean;
  applied: boolean;
}

export interface MaterializationJournal {
  schemaVersion: 1;
  transactionId: string;
  workspaceId: string;
  targetSyncVersion: number;
  targetManifestHash: string;
  phase: "prepared" | "applying";
  priorState: LocalWorkspaceState;
  operations: readonly MaterializationOperation[];
}

export interface WorkspaceControlPort {
  acquireLock(): Promise<() => Promise<void>>;
  readState(): Promise<LocalWorkspaceState | null>;
  writeState(
    next: Omit<LocalWorkspaceState, "revision">,
    expectedRevision: number | null,
  ): Promise<LocalWorkspaceState>;
  readJournal(): Promise<MaterializationJournal | null>;
  writeJournal(journal: MaterializationJournal): Promise<void>;
  clearJournal(): Promise<void>;
}

export interface PreservedConflict {
  originalPath: string;
  conflictPath: string;
}

export interface MaterializationFilePort {
  exists(relativePath: string): Promise<boolean>;
  readFile(relativePath: string): Promise<Uint8Array>;
  backup(transactionId: string, relativePath: string): Promise<void>;
  writeFileAtomically(relativePath: string, content: Uint8Array): Promise<void>;
  restore(transactionId: string, relativePath: string, previousExisted: boolean): Promise<void>;
  syncWorkspace(): Promise<void>;
  finishRecovery(
    transactionId: string,
    preservedPaths: readonly string[],
  ): Promise<readonly PreservedConflict[]>;
}

export interface WorkspaceObjectReaderPort {
  readObject(sha256: string): Promise<Uint8Array>;
}

export interface MaterializationRequest {
  workspaceId: string;
  syncVersion: number;
  manifest: WorkspaceManifest;
  expectedStateRevision?: number;
}

export interface MaterializationResult {
  state: LocalWorkspaceState;
  preservedConflicts: readonly PreservedConflict[];
  recoveredInterruptedTransaction: boolean;
}

export interface ClockPort {
  now(): Date;
}

export type CredentialKind = "device" | "lease";

export interface CredentialReference {
  origin: string;
  account: string;
  kind: CredentialKind;
  workspaceId: string | null;
}

export interface CredentialPort {
  put(reference: CredentialReference, value: string): Promise<void>;
  get(reference: CredentialReference): Promise<string | null>;
  delete(reference: CredentialReference): Promise<void>;
}

export interface RemoteWorkspaceVersion {
  workspaceId: string;
  syncVersion: number;
  manifest: WorkspaceManifest;
  createdAt: string;
}

export interface RemoteWorkspaceMetadata {
  workspace: {
    id: string;
    scopeType: "user" | "project" | "task";
    scopeId: string;
    lifecycle: "active" | "archived" | "deleted";
    workCycle: number;
    syncVersion: number;
  };
  currentVersion: RemoteWorkspaceVersion;
}

export interface RemoteWorkspaceLease {
  id: string;
  workspaceId: string;
  workCycle: number;
  userId: string;
  deviceId: string;
  connectionId: string;
  baseSyncVersion: number;
  issuedAt: string;
  expiresAt: string;
  state: "active" | "expired" | "released" | "taken_over" | "invalidated";
}

export interface RemoteWorkspaceLeaseGrant {
  lease: RemoteWorkspaceLease;
  leaseToken: string;
}

export type RemotePairingStatus =
  "pending" | "approved" | "denied" | "consumed" | "expired" | "revoked";

export interface RemotePairingCreated {
  pairingId: string;
  code: string;
  verificationPath: string;
  expiresAt: string;
}

export interface RemotePairingCliStatus {
  pairingId: string;
  status: RemotePairingStatus;
  expiresAt: string;
}

export interface RemotePairingCredential {
  deviceId: string;
  accessToken: string;
  deviceCredential: string;
  accessTokenExpiresAt: string;
}

export interface RemoteDeviceAccessToken {
  deviceId: string;
  accessToken: string;
  accessTokenExpiresAt: string;
}

export interface WorkspaceApiPort {
  createPairing(input: {
    deviceName: string;
    platform: "macos" | "windows" | "linux";
    correlationSecret: string;
  }): Promise<RemotePairingCreated>;
  pairingStatus(input: {
    pairingId: string;
    correlationSecret: string;
  }): Promise<RemotePairingCliStatus>;
  consumePairing(input: {
    pairingId: string;
    correlationSecret: string;
  }): Promise<RemotePairingCredential>;
  issueDeviceAccessToken(input: {
    deviceId: string;
    deviceCredential: string;
  }): Promise<RemoteDeviceAccessToken>;
  revokeCurrentDevice(accessToken: string): Promise<void>;
  getMetadata(workspaceId: string, accessToken: string): Promise<RemoteWorkspaceMetadata>;
  readObject(workspaceId: string, sha256: string, accessToken: string): Promise<Uint8Array>;
  uploadObject(input: {
    workspaceId: string;
    sha256: string;
    content: Uint8Array;
    accessToken: string;
    leaseId: string;
    connectionId: string;
    leaseToken: string;
  }): Promise<void>;
  acquireLease(input: {
    workspaceId: string;
    connectionId: string;
    baseSyncVersion: number;
    accessToken: string;
  }): Promise<RemoteWorkspaceLeaseGrant>;
  renewLease(input: {
    workspaceId: string;
    leaseId: string;
    connectionId: string;
    leaseToken: string;
    accessToken: string;
  }): Promise<RemoteWorkspaceLease>;
  releaseLease(input: {
    workspaceId: string;
    leaseId: string;
    connectionId: string;
    leaseToken: string;
    accessToken: string;
  }): Promise<RemoteWorkspaceLease>;
  takeoverLease(input: {
    workspaceId: string;
    connectionId: string;
    accessToken: string;
    confirmed: true;
  }): Promise<RemoteWorkspaceLeaseGrant>;
  commit(input: {
    workspaceId: string;
    leaseId: string;
    connectionId: string;
    leaseToken: string;
    baseSyncVersion: number;
    idempotencyKey: string;
    manifest: WorkspaceManifest;
    accessToken: string;
  }): Promise<{
    workspaceId: string;
    syncVersion: number;
    manifestHash: string;
    idempotentReplay: boolean;
  }>;
  resolveConflict(
    input:
      | {
          choice: "use_local";
          workspaceId: string;
          leaseId: string;
          connectionId: string;
          leaseToken: string;
          baseSyncVersion: number;
          idempotencyKey: string;
          manifest: WorkspaceManifest;
          accessToken: string;
        }
      | {
          choice: "use_server";
          workspaceId: string;
          leaseId: string;
          connectionId: string;
          leaseToken: string;
          accessToken: string;
        },
  ): Promise<{
    choice: "use_local" | "use_server";
    authoritativeVersion: RemoteWorkspaceVersion;
    idempotentReplay: boolean;
  }>;
}
