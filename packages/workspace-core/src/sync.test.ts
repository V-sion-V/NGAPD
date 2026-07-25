import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  WorkspaceCoreError,
  WorkspaceRemoteError,
  createWorkspaceManifest,
  syncWorkspace,
  useLocalWorkspace,
  useServerWorkspace,
  type DirectoryEntry,
  type FileSnapshot,
  type LocalWorkspaceState,
  type MaterializationFilePort,
  type MaterializationJournal,
  type RemoteWorkspaceLease,
  type RemoteWorkspaceLeaseGrant,
  type RemoteWorkspaceMetadata,
  type WorkspaceApiPort,
  type WorkspaceControlPort,
  type WorkspaceFilePort,
} from "./index.js";

const workspaceId = "10000000-0000-4000-8000-000000000001";
const connectionId = "20000000-0000-4000-8000-000000000001";

describe("Workspace sync orchestration", () => {
  it("uploads only changed content and advances local state after a matching commit", async () => {
    const base = manifest("base");
    const current = Buffer.from("current", "utf8");
    const files = new SingleFilePort(current);
    const control = new SyncControl(leasedState(base));
    const api = new FakeApi();

    const first = await syncWorkspace({
      api,
      files,
      control,
      secrets: {
        accessToken: "access-token-memory-only",
        leaseToken: "lease-token-memory-only",
      },
      idempotencyKey: "sync-request-0001",
    });

    expect(first.changed).toBe(true);
    expect(first.state.baseSyncVersion).toBe(2);
    expect(api.uploads).toEqual([digest(current)]);
    expect(api.commits).toBe(1);
    expect(JSON.stringify(first.state)).not.toContain("access-token-memory-only");
    expect(JSON.stringify(first.state)).not.toContain("lease-token-memory-only");

    const second = await syncWorkspace({
      api,
      files,
      control,
      secrets: {
        accessToken: "access-token-memory-only",
        leaseToken: "lease-token-memory-only",
      },
      idempotencyKey: "sync-request-0001",
    });
    expect(second.changed).toBe(false);
    expect(api.commits).toBe(1);
  });

  it("stops on a base conflict and never chooses a conflict direction automatically", async () => {
    const base = manifest("base");
    const files = new SingleFilePort(Buffer.from("local", "utf8"));
    const control = new SyncControl(leasedState(base));
    const api = new FakeApi();
    api.commitFailure = new WorkspaceRemoteError(
      "BASE_VERSION_CONFLICT",
      "Base changed",
      "request-conflict",
      2,
      "Choose a conflict direction",
    );

    await expect(
      syncWorkspace({
        api,
        files,
        control,
        secrets: { accessToken: "access", leaseToken: "lease" },
        idempotencyKey: "sync-request-conflict",
      }),
    ).rejects.toBe(api.commitFailure);
    expect(control.state).toMatchObject({
      replicaStatus: "conflict",
      connectionStatus: "lease_active",
      lease: { id: "30000000-0000-4000-8000-000000000001" },
    });
    expect(api.resolveChoices).toEqual([]);
  });

  it("uses a takeover lease base for an explicit local conflict choice", async () => {
    const base = manifest("base");
    const files = new SingleFilePort(Buffer.from("local", "utf8"));
    const state = leasedState(base);
    state.replicaStatus = "conflict";
    state.lease!.baseSyncVersion = 2;
    const control = new SyncControl(state);
    const api = new FakeApi();

    await useLocalWorkspace({
      api,
      files,
      control,
      secrets: { accessToken: "access", leaseToken: "lease" },
      idempotencyKey: "use-local-after-takeover",
    });

    expect(api.lastConflictBaseSyncVersion).toBe(2);
  });

  it("uses the local version only through the explicit use_local entry point", async () => {
    const base = manifest("base");
    const files = new SingleFilePort(Buffer.from("local", "utf8"));
    const control = new SyncControl(leasedState(base));
    const api = new FakeApi();

    const result = await useLocalWorkspace({
      api,
      files,
      control,
      secrets: { accessToken: "access", leaseToken: "lease" },
      idempotencyKey: "use-local-request",
    });

    expect(api.resolveChoices).toEqual(["use_local"]);
    expect(result.state.baseSyncVersion).toBe(2);
    expect(result.state.replicaStatus).toBe("clean");
  });

  it("persists device invalidation under the local lock without choosing a server conflict", async () => {
    const base = manifest("base");
    const control = new SyncControl(leasedState(base));
    const api = new FakeApi();
    api.resolveFailure = new WorkspaceRemoteError(
      "DEVICE_REVOKED",
      "Device revoked",
      "request-device-revoked",
      null,
      "Pair again",
    );

    await expect(
      useServerWorkspace({
        api,
        control,
        materializationFiles: unusedMaterializationFiles,
        secrets: { accessToken: "access", leaseToken: "lease" },
        transactionId: "use-server-device-revoked",
      }),
    ).rejects.toBe(api.resolveFailure);
    expect(control.state).toMatchObject({
      replicaStatus: "lease_or_base_invalid",
      connectionStatus: "read_only",
      lease: null,
      lastErrorCode: "DEVICE_REVOKED",
    });
    expect(api.resolveChoices).toEqual(["use_server"]);
  });
});

class SingleFilePort implements WorkspaceFilePort {
  constructor(private readonly content: Uint8Array) {}

  inspect(relativePath: string): Promise<FileSnapshot> {
    if (relativePath === "") {
      return Promise.resolve(snapshot("directory", 0, 1));
    }
    if (relativePath === "file.txt") {
      return Promise.resolve(snapshot("file", this.content.byteLength, 2));
    }
    throw new Error("missing path");
  }

  listDirectory(relativePath: string): Promise<readonly DirectoryEntry[]> {
    if (relativePath !== "") {
      throw new Error("missing directory");
    }
    return Promise.resolve([{ name: "file.txt", kind: "file" }]);
  }

  hashFile(relativePath: string): Promise<string> {
    if (relativePath !== "file.txt") {
      throw new Error("missing file");
    }
    return Promise.resolve(digest(this.content));
  }

  readFile(relativePath: string): Promise<Uint8Array> {
    if (relativePath !== "file.txt") {
      throw new Error("missing file");
    }
    return Promise.resolve(this.content);
  }
}

class SyncControl implements WorkspaceControlPort {
  journal: MaterializationJournal | null = null;
  private locked = false;

  constructor(public state: LocalWorkspaceState) {}

  acquireLock(): Promise<() => Promise<void>> {
    if (this.locked) {
      throw new WorkspaceCoreError("STATE_BUSY", "busy", true);
    }
    this.locked = true;
    return Promise.resolve(async () => {
      this.locked = false;
    });
  }

  readState(): Promise<LocalWorkspaceState> {
    return Promise.resolve(structuredClone(this.state));
  }

  writeState(
    next: Omit<LocalWorkspaceState, "revision">,
    expectedRevision: number | null,
  ): Promise<LocalWorkspaceState> {
    if (expectedRevision !== this.state.revision) {
      throw new WorkspaceCoreError("STATE_CONFLICT", "revision");
    }
    this.state = { ...structuredClone(next), revision: this.state.revision + 1 };
    return Promise.resolve(structuredClone(this.state));
  }

  readJournal(): Promise<MaterializationJournal | null> {
    return Promise.resolve(this.journal);
  }

  writeJournal(journal: MaterializationJournal): Promise<void> {
    this.journal = journal;
    return Promise.resolve();
  }

  clearJournal(): Promise<void> {
    this.journal = null;
    return Promise.resolve();
  }
}

class FakeApi implements WorkspaceApiPort {
  readonly uploads: string[] = [];
  readonly resolveChoices: string[] = [];
  commits = 0;
  commitFailure: WorkspaceRemoteError | null = null;
  resolveFailure: WorkspaceRemoteError | null = null;
  lastConflictBaseSyncVersion: number | null = null;

  createPairing(): Promise<never> {
    return Promise.reject(new Error("unused"));
  }

  pairingStatus(): Promise<never> {
    return Promise.reject(new Error("unused"));
  }

  consumePairing(): Promise<never> {
    return Promise.reject(new Error("unused"));
  }

  issueDeviceAccessToken(): Promise<never> {
    return Promise.reject(new Error("unused"));
  }

  revokeCurrentDevice(): Promise<void> {
    return Promise.reject(new Error("unused"));
  }

  getMetadata(): Promise<RemoteWorkspaceMetadata> {
    return Promise.reject(new Error("unused"));
  }

  readObject(): Promise<Uint8Array> {
    return Promise.reject(new Error("unused"));
  }

  uploadObject(input: Parameters<WorkspaceApiPort["uploadObject"]>[0]): Promise<void> {
    this.uploads.push(input.sha256);
    return Promise.resolve();
  }

  acquireLease(): Promise<RemoteWorkspaceLeaseGrant> {
    return Promise.reject(new Error("unused"));
  }

  renewLease(): Promise<RemoteWorkspaceLease> {
    return Promise.reject(new Error("unused"));
  }

  releaseLease(): Promise<RemoteWorkspaceLease> {
    return Promise.reject(new Error("unused"));
  }

  takeoverLease(): Promise<RemoteWorkspaceLeaseGrant> {
    return Promise.reject(new Error("unused"));
  }

  commit(input: Parameters<WorkspaceApiPort["commit"]>[0]) {
    this.commits += 1;
    if (this.commitFailure) {
      return Promise.reject(this.commitFailure);
    }
    return Promise.resolve({
      workspaceId: input.workspaceId,
      syncVersion: 2,
      manifestHash: input.manifest.hash,
      idempotentReplay: false,
    });
  }

  resolveConflict(input: Parameters<WorkspaceApiPort["resolveConflict"]>[0]) {
    this.resolveChoices.push(input.choice);
    if (this.resolveFailure) {
      return Promise.reject(this.resolveFailure);
    }
    if (input.choice !== "use_local") {
      return Promise.reject(new Error("unused"));
    }
    this.lastConflictBaseSyncVersion = input.baseSyncVersion;
    return Promise.resolve({
      choice: "use_local" as const,
      authoritativeVersion: {
        workspaceId: input.workspaceId,
        syncVersion: 2,
        manifest: input.manifest,
        createdAt: "2026-07-25T00:00:00.000Z",
      },
      idempotentReplay: false,
    });
  }
}

const unusedMaterializationFiles: MaterializationFilePort = {
  exists: () => Promise.reject(new Error("unused")),
  readFile: () => Promise.reject(new Error("unused")),
  backup: () => Promise.reject(new Error("unused")),
  writeFileAtomically: () => Promise.reject(new Error("unused")),
  restore: () => Promise.reject(new Error("unused")),
  syncWorkspace: () => Promise.reject(new Error("unused")),
  finishRecovery: () => Promise.reject(new Error("unused")),
};

function leasedState(baseManifest: ReturnType<typeof manifest>): LocalWorkspaceState {
  return {
    schemaVersion: 1,
    revision: 1,
    workspaceId,
    connectionId,
    registeredPath: "workspace",
    baseSyncVersion: 1,
    baseManifest,
    replicaStatus: "clean",
    connectionStatus: "lease_active",
    lease: {
      id: "30000000-0000-4000-8000-000000000001",
      connectionId,
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
      sha256: digest(bytes),
    },
  ]);
}

function digest(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function snapshot(kind: FileSnapshot["kind"], size: number, inode: number): FileSnapshot {
  return {
    kind,
    size,
    modifiedAtMs: 1,
    changedAtMs: 1,
    device: 1,
    inode,
  };
}
