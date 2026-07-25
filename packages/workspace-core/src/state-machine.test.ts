import { describe, expect, it } from "vitest";

import {
  createUnmaterializedState,
  createWorkspaceManifest,
  deriveLocalReplicaStatus,
  sha256,
  type LocalWorkspaceState,
} from "./index.js";

describe("local Workspace replica state", () => {
  it("keeps materialization, connection, and lease state independent", () => {
    expect(
      createUnmaterializedState({
        workspaceId: "10000000-0000-4000-8000-000000000001",
        connectionId: "20000000-0000-4000-8000-000000000001",
        registeredPath: "workspace",
      }),
    ).toMatchObject({
      replicaStatus: "unmaterialized",
      connectionStatus: "disconnected",
      lease: null,
    });

    const state = cleanState();
    expect(
      deriveLocalReplicaStatus({
        state,
        currentManifest: state.baseManifest,
        leaseValid: false,
        baseValid: true,
      }),
    ).toBe("clean");
    const dirty = manifest("changed");
    expect(
      deriveLocalReplicaStatus({
        state,
        currentManifest: dirty,
        leaseValid: true,
        baseValid: true,
      }),
    ).toBe("dirty_with_lease");
    expect(
      deriveLocalReplicaStatus({
        state,
        currentManifest: dirty,
        leaseValid: false,
        baseValid: true,
      }),
    ).toBe("lease_or_base_invalid");
    expect(
      deriveLocalReplicaStatus({
        state,
        currentManifest: dirty,
        leaseValid: true,
        baseValid: false,
      }),
    ).toBe("conflict");
  });
});

function cleanState(): LocalWorkspaceState {
  return {
    schemaVersion: 1,
    revision: 1,
    workspaceId: "10000000-0000-4000-8000-000000000001",
    connectionId: "20000000-0000-4000-8000-000000000001",
    registeredPath: "workspace",
    baseSyncVersion: 1,
    baseManifest: manifest("base"),
    replicaStatus: "clean",
    connectionStatus: "lease_active",
    lease: {
      id: "30000000-0000-4000-8000-000000000001",
      connectionId: "20000000-0000-4000-8000-000000000001",
      baseSyncVersion: 1,
      expiresAt: "2026-07-25T00:01:00.000Z",
    },
    lastErrorCode: null,
  };
}

function manifest(content: string) {
  const bytes = Buffer.from(content, "utf8");
  return createWorkspaceManifest([
    {
      path: "file.txt",
      kind: "file",
      size: bytes.byteLength,
      sha256: sha256(bytes),
    },
  ]);
}
