import { createHash } from "node:crypto";

export const WORKSPACE_SCOPES = ["user", "project", "task"] as const;
export const EMPTY_MANIFEST_HASH = createHash("sha256").update("[]", "utf8").digest("hex");

export type WorkspaceScope = (typeof WORKSPACE_SCOPES)[number];

export interface LeaseSnapshot {
  workspaceId: string;
  holderConnectionId: string;
  token: string;
  expiresAt: Date;
}

export interface WorkspaceManifestEntry {
  path: string;
  kind: "file";
  size: number;
  sha256: string;
}

export type ManifestInvalidReason =
  | "path_not_normalized"
  | "path_not_relative"
  | "path_uses_backslash"
  | "path_segment_invalid"
  | "protected_path"
  | "duplicate_path"
  | "kind_invalid"
  | "size_invalid"
  | "sha256_invalid"
  | "manifest_hash_mismatch";

export class ManifestValidationError extends Error {
  constructor(readonly reason: ManifestInvalidReason) {
    super(reason);
    this.name = "ManifestValidationError";
  }
}

export interface AuthoritativeLeaseSnapshot {
  workspaceId: string;
  workCycle: number;
  userId: string;
  deviceId: string;
  connectionId: string;
  tokenHash: string;
  baseSyncVersion: number;
  expiresAt: Date;
  revokedAt: Date | null;
}

export type LeaseWriteReason =
  | "allowed"
  | "lease_revoked"
  | "lease_expired"
  | "lease_workspace_mismatch"
  | "work_cycle_changed"
  | "lease_user_mismatch"
  | "lease_device_mismatch"
  | "lease_connection_mismatch"
  | "lease_token_mismatch"
  | "base_version_conflict";

export interface LeaseWriteInput {
  workspaceId: string;
  workCycle: number;
  currentSyncVersion: number;
  userId: string;
  deviceId: string;
  connectionId: string;
  tokenHash: string;
  baseSyncVersion: number;
  now: Date;
}

export function isLeaseActive(lease: LeaseSnapshot, now: Date): boolean {
  return lease.expiresAt.getTime() > now.getTime();
}

export function canCommitLease(
  lease: LeaseSnapshot,
  connectionId: string,
  token: string,
  now: Date,
): boolean {
  return (
    isLeaseActive(lease, now) && lease.holderConnectionId === connectionId && lease.token === token
  );
}

export function evaluateLeaseWrite(
  lease: AuthoritativeLeaseSnapshot,
  input: LeaseWriteInput,
):
  | { allowed: true; reason: "allowed" }
  | { allowed: false; reason: Exclude<LeaseWriteReason, "allowed"> } {
  if (lease.revokedAt) {
    return { allowed: false, reason: "lease_revoked" };
  }
  if (lease.expiresAt.getTime() <= input.now.getTime()) {
    return { allowed: false, reason: "lease_expired" };
  }
  if (lease.workspaceId !== input.workspaceId) {
    return { allowed: false, reason: "lease_workspace_mismatch" };
  }
  if (lease.workCycle !== input.workCycle) {
    return { allowed: false, reason: "work_cycle_changed" };
  }
  if (lease.userId !== input.userId) {
    return { allowed: false, reason: "lease_user_mismatch" };
  }
  if (lease.deviceId !== input.deviceId) {
    return { allowed: false, reason: "lease_device_mismatch" };
  }
  if (lease.connectionId !== input.connectionId) {
    return { allowed: false, reason: "lease_connection_mismatch" };
  }
  if (lease.tokenHash !== input.tokenHash) {
    return { allowed: false, reason: "lease_token_mismatch" };
  }
  if (
    lease.baseSyncVersion !== input.baseSyncVersion ||
    input.currentSyncVersion !== input.baseSyncVersion
  ) {
    return { allowed: false, reason: "base_version_conflict" };
  }
  return { allowed: true, reason: "allowed" };
}

export function canonicalizeManifest(
  entries: readonly WorkspaceManifestEntry[],
): WorkspaceManifestEntry[] {
  const paths = new Set<string>();
  const normalized = entries.map((entry) => {
    validateManifestEntry(entry);
    if (paths.has(entry.path)) {
      throw new ManifestValidationError("duplicate_path");
    }
    paths.add(entry.path);
    return { ...entry };
  });
  return normalized.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

export function hashManifest(entries: readonly WorkspaceManifestEntry[]): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizeManifest(entries)), "utf8")
    .digest("hex");
}

export function assertManifestHash(
  entries: readonly WorkspaceManifestEntry[],
  expectedHash: string,
): WorkspaceManifestEntry[] {
  const canonical = canonicalizeManifest(entries);
  const actual = createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
  if (actual !== expectedHash) {
    throw new ManifestValidationError("manifest_hash_mismatch");
  }
  return canonical;
}

export function hashCommitRequest(input: {
  workspaceId: string;
  baseSyncVersion: number;
  manifestHash: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        workspaceId: input.workspaceId,
        baseSyncVersion: input.baseSyncVersion,
        manifestHash: input.manifestHash,
      }),
      "utf8",
    )
    .digest("hex");
}

function validateManifestEntry(entry: WorkspaceManifestEntry): void {
  if (entry.path.normalize("NFC") !== entry.path) {
    throw new ManifestValidationError("path_not_normalized");
  }
  if (entry.path.startsWith("/") || /^[A-Za-z]:/.test(entry.path)) {
    throw new ManifestValidationError("path_not_relative");
  }
  if (entry.path.includes("\\")) {
    throw new ManifestValidationError("path_uses_backslash");
  }
  const segments = entry.path.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new ManifestValidationError("path_segment_invalid");
  }
  const root = segments[0];
  if (root === ".ngapd" || entry.path === "TASK.md" || entry.path === "SUMMARY.md") {
    throw new ManifestValidationError("protected_path");
  }
  if (entry.kind !== "file") {
    throw new ManifestValidationError("kind_invalid");
  }
  if (!Number.isSafeInteger(entry.size) || entry.size < 0) {
    throw new ManifestValidationError("size_invalid");
  }
  if (!/^[0-9a-f]{64}$/.test(entry.sha256)) {
    throw new ManifestValidationError("sha256_invalid");
  }
}
