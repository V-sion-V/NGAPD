import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  EMPTY_MANIFEST_HASH,
  ManifestValidationError,
  assertManifestHash,
  canonicalizeManifest,
  evaluateLeaseWrite,
  hashCommitRequest,
  hashManifest,
  type AuthoritativeLeaseSnapshot,
} from "./workspace.js";

const contentHash = createHash("sha256").update("hello").digest("hex");
const entries = [
  { path: "zeta/file.txt", kind: "file" as const, size: 5, sha256: contentHash },
  { path: "alpha/file.txt", kind: "file" as const, size: 5, sha256: contentHash },
];

describe("workspace manifest rules", () => {
  it("canonicalizes entries and produces deterministic hashes", () => {
    expect(canonicalizeManifest(entries).map((entry) => entry.path)).toEqual([
      "alpha/file.txt",
      "zeta/file.txt",
    ]);
    expect(hashManifest(entries)).toBe(hashManifest([...entries].reverse()));
    expect(hashManifest([])).toBe(EMPTY_MANIFEST_HASH);
    expect(assertManifestHash(entries, hashManifest(entries))).toEqual(
      canonicalizeManifest(entries),
    );
  });

  it.each([
    "../escape.txt",
    "/absolute.txt",
    "alpha\\windows.txt",
    ".ngapd/state.json",
    "TASK.md",
    "SUMMARY.md",
  ])("rejects unsafe or protected path %s", (path) => {
    expect(() => hashManifest([{ ...entries[0]!, path }])).toThrow(ManifestValidationError);
  });

  it("rejects duplicate paths and mismatched manifest hashes", () => {
    expect(() => hashManifest([entries[0]!, entries[0]!])).toThrow("duplicate_path");
    expect(() => assertManifestHash(entries, "0".repeat(64))).toThrow("manifest_hash_mismatch");
  });

  it("binds commit request hashes to workspace, base and manifest", () => {
    const first = hashCommitRequest({
      workspaceId: "workspace-a",
      baseSyncVersion: 1,
      manifestHash: hashManifest(entries),
    });
    expect(first).toBe(
      hashCommitRequest({
        workspaceId: "workspace-a",
        baseSyncVersion: 1,
        manifestHash: hashManifest([...entries].reverse()),
      }),
    );
    expect(first).not.toBe(
      hashCommitRequest({
        workspaceId: "workspace-a",
        baseSyncVersion: 2,
        manifestHash: hashManifest(entries),
      }),
    );
  });
});

describe("workspace lease rules", () => {
  const lease: AuthoritativeLeaseSnapshot = {
    workspaceId: "workspace-a",
    workCycle: 3,
    userId: "user-a",
    deviceId: "device-a",
    connectionId: "connection-a",
    tokenHash: "token-hash",
    baseSyncVersion: 7,
    expiresAt: new Date("2026-07-25T04:01:00.000Z"),
    revokedAt: null,
  };
  const input = {
    workspaceId: "workspace-a",
    workCycle: 3,
    currentSyncVersion: 7,
    userId: "user-a",
    deviceId: "device-a",
    connectionId: "connection-a",
    tokenHash: "token-hash",
    baseSyncVersion: 7,
    now: new Date("2026-07-25T04:00:00.000Z"),
  };

  it("accepts only a fully matching active lease and current base", () => {
    expect(evaluateLeaseWrite(lease, input)).toEqual({ allowed: true, reason: "allowed" });
  });

  it.each([
    ["lease_expired", { now: new Date("2026-07-25T04:01:00.000Z") }],
    ["work_cycle_changed", { workCycle: 4 }],
    ["lease_device_mismatch", { deviceId: "device-b" }],
    ["lease_connection_mismatch", { connectionId: "connection-b" }],
    ["lease_token_mismatch", { tokenHash: "other" }],
    ["base_version_conflict", { currentSyncVersion: 8 }],
  ] as const)("rejects %s", (reason, change) => {
    expect(evaluateLeaseWrite(lease, { ...input, ...change })).toEqual({
      allowed: false,
      reason,
    });
  });
});
