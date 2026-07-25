import { describe, expect, it } from "vitest";

import {
  WorkspaceCoreError,
  WorkspaceRemoteError,
  createWorkspaceManifest,
  materializeWorkspace,
  recoverMaterialization,
  sha256,
  type LocalWorkspaceState,
  type MaterializationFilePort,
  type MaterializationJournal,
  type PreservedConflict,
  type WorkspaceControlPort,
} from "./index.js";

const workspaceId = "10000000-0000-4000-8000-000000000001";

describe("Workspace materialization", () => {
  it("atomically replaces managed content and preserves recognizable local conflicts", async () => {
    const base = manifest({
      "delete.txt": "delete-base",
      "keep.txt": "keep-base",
    });
    const target = manifest({
      "keep.txt": "keep-server",
      "server.txt": "server-content",
    });
    const control = new FakeControl(state(base));
    const files = new FakeMaterializationFiles({
      "delete.txt": bytes("delete-base"),
      "keep.txt": bytes("keep-local-change"),
      "server.txt": bytes("untracked-local"),
    });

    const result = await materializeWorkspace({
      request: { workspaceId, syncVersion: 2, manifest: target },
      transactionId: "transaction-success",
      control,
      files,
      objects: objectReader({
        [target.entries[0]!.sha256]: "keep-server",
        [target.entries[1]!.sha256]: "server-content",
      }),
    });

    expect(text(files.managed.get("keep.txt"))).toBe("keep-server");
    expect(text(files.managed.get("server.txt"))).toBe("server-content");
    expect(files.managed.has("delete.txt")).toBe(false);
    expect(result.state).toMatchObject({
      baseSyncVersion: 2,
      baseManifest: target,
      replicaStatus: "clean",
    });
    expect(result.preservedConflicts).toHaveLength(2);
    expect(result.preservedConflicts.map((conflict) => conflict.originalPath).sort()).toEqual([
      "keep.txt",
      "server.txt",
    ]);
    expect(control.journal).toBeNull();
  });

  it("rejects missing or invalid objects before creating a journal or changing state", async () => {
    const base = manifest({ "file.txt": "base" });
    const target = manifest({ "file.txt": "server" });
    const control = new FakeControl(state(base));
    const files = new FakeMaterializationFiles({ "file.txt": bytes("base") });

    await expect(
      materializeWorkspace({
        request: { workspaceId, syncVersion: 2, manifest: target },
        transactionId: "transaction-missing",
        control,
        files,
        objects: { readObject: () => Promise.reject(new Error("missing")) },
      }),
    ).rejects.toMatchObject({ code: "OBJECT_MISSING" });
    expect(text(files.managed.get("file.txt"))).toBe("base");
    expect(control.state.baseSyncVersion).toBe(1);
    expect(control.journal).toBeNull();

    await expect(
      materializeWorkspace({
        request: { workspaceId, syncVersion: 2, manifest: target },
        transactionId: "transaction-invalid",
        control,
        files,
        objects: { readObject: () => Promise.resolve(bytes("wrong")) },
      }),
    ).rejects.toMatchObject({ code: "OBJECT_HASH_MISMATCH" });
    expect(control.journal).toBeNull();

    const remoteFailure = new WorkspaceRemoteError(
      "DEVICE_REVOKED",
      "Device revoked",
      "request-device-revoked",
      null,
      "Pair again",
    );
    await expect(
      materializeWorkspace({
        request: { workspaceId, syncVersion: 2, manifest: target },
        transactionId: "transaction-remote-failure",
        control,
        files,
        objects: { readObject: () => Promise.reject(remoteFailure) },
      }),
    ).rejects.toBe(remoteFailure);
    expect(control.journal).toBeNull();
  });

  it("rejects a stale state revision before creating a recovery journal", async () => {
    const base = manifest({ "file.txt": "base" });
    const target = manifest({ "file.txt": "server" });
    const control = new FakeControl(state(base));
    const files = new FakeMaterializationFiles({ "file.txt": bytes("base") });

    await expect(
      materializeWorkspace({
        request: {
          workspaceId,
          syncVersion: 2,
          manifest: target,
          expectedStateRevision: 0,
        },
        transactionId: "transaction-stale-state",
        control,
        files,
        objects: objectReader({ [target.entries[0]!.sha256]: "server" }),
      }),
    ).rejects.toMatchObject({ code: "STATE_CONFLICT", retryable: true });
    expect(control.journal).toBeNull();
    expect(text(files.managed.get("file.txt"))).toBe("base");
  });

  for (const failure of ["backup", "write", "sync", "state"] as const) {
    it(`rolls back and keeps the prior baseline when ${failure} fails`, async () => {
      const base = manifest({ "file.txt": "base" });
      const target = manifest({ "file.txt": "server" });
      const control = new FakeControl(state(base));
      const files = new FakeMaterializationFiles({ "file.txt": bytes("base") });
      if (failure === "state") {
        control.failNextStateWrite = true;
      } else {
        files.failNext = failure;
      }

      await expect(
        materializeWorkspace({
          request: { workspaceId, syncVersion: 2, manifest: target },
          transactionId: `transaction-${failure}`,
          control,
          files,
          objects: objectReader({ [target.entries[0]!.sha256]: "server" }),
        }),
      ).rejects.toBeInstanceOf(WorkspaceCoreError);

      expect(text(files.managed.get("file.txt"))).toBe("base");
      expect(control.state.baseSyncVersion).toBe(1);
      expect(control.state.replicaStatus).toBe("materialization_failed");
      expect(control.journal).toBeNull();
    });
  }

  it("recovers an interrupted transaction after reconstructing the ports", async () => {
    const base = manifest({ "file.txt": "base" });
    const priorState = state(base);
    const control = new FakeControl(priorState);
    const files = new FakeMaterializationFiles({ "file.txt": bytes("base") });
    await files.backup("transaction-crash", "file.txt");
    await files.writeFileAtomically("file.txt", bytes("partial"));
    control.journal = {
      schemaVersion: 1,
      transactionId: "transaction-crash",
      workspaceId,
      targetSyncVersion: 2,
      targetManifestHash: manifest({ "file.txt": "server" }).hash,
      phase: "applying",
      priorState,
      operations: [
        {
          path: "file.txt",
          kind: "write",
          previousExisted: true,
          preserveConflict: false,
          applied: false,
        },
      ],
    };

    await expect(
      recoverMaterialization({
        control: control.reopen(),
        files: files.reopen(),
      }),
    ).resolves.toBe(true);
    expect(text(files.managed.get("file.txt"))).toBe("base");
    expect(control.state.baseSyncVersion).toBe(1);
    expect(control.state.replicaStatus).toBe("materialization_failed");
    expect(control.journal).toBeNull();
  });

  it("finishes cleanup instead of rolling back when state was already committed", async () => {
    const base = manifest({ "file.txt": "base" });
    const target = manifest({ "file.txt": "server" });
    const control = new FakeControl(state(base));
    const files = new FakeMaterializationFiles({ "file.txt": bytes("local-change") });
    files.failNext = "finish";

    const result = await materializeWorkspace({
      request: { workspaceId, syncVersion: 2, manifest: target },
      transactionId: "transaction-cleanup",
      control,
      files,
      objects: objectReader({ [target.entries[0]!.sha256]: "server" }),
    });

    expect(result.recoveredInterruptedTransaction).toBe(true);
    expect(result.state.baseSyncVersion).toBe(2);
    expect(text(files.managed.get("file.txt"))).toBe("server");
    expect(result.preservedConflicts).toHaveLength(1);
    expect(control.journal).toBeNull();
  });
});

class FakeControl implements WorkspaceControlPort {
  journal: MaterializationJournal | null = null;
  failNextStateWrite = false;
  private locked = false;

  constructor(public state: LocalWorkspaceState) {}

  acquireLock(): Promise<() => Promise<void>> {
    if (this.locked) {
      throw new WorkspaceCoreError("STATE_BUSY", "locked", true);
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
    if (this.failNextStateWrite) {
      this.failNextStateWrite = false;
      throw new Error("injected state write failure");
    }
    if (expectedRevision !== this.state.revision) {
      throw new WorkspaceCoreError("STATE_CONFLICT", "revision mismatch");
    }
    this.state = { ...structuredClone(next), revision: this.state.revision + 1 };
    return Promise.resolve(structuredClone(this.state));
  }

  readJournal(): Promise<MaterializationJournal | null> {
    return Promise.resolve(structuredClone(this.journal));
  }

  writeJournal(journal: MaterializationJournal): Promise<void> {
    this.journal = structuredClone(journal);
    return Promise.resolve();
  }

  clearJournal(): Promise<void> {
    this.journal = null;
    return Promise.resolve();
  }

  reopen(): FakeControl {
    return this;
  }
}

class FakeMaterializationFiles implements MaterializationFilePort {
  readonly managed = new Map<string, Uint8Array>();
  readonly backups = new Map<string, Uint8Array>();
  failNext: "backup" | "write" | "sync" | "finish" | null = null;

  constructor(files: Record<string, Uint8Array>) {
    for (const [path, content] of Object.entries(files)) {
      this.managed.set(path, content);
    }
  }

  exists(relativePath: string): Promise<boolean> {
    return Promise.resolve(this.managed.has(relativePath));
  }

  readFile(relativePath: string): Promise<Uint8Array> {
    const content = this.managed.get(relativePath);
    if (!content) {
      throw new Error(`missing ${relativePath}`);
    }
    return Promise.resolve(content);
  }

  backup(transactionId: string, relativePath: string): Promise<void> {
    this.inject("backup");
    const content = this.managed.get(relativePath);
    if (content) {
      this.backups.set(key(transactionId, relativePath), content);
      this.managed.delete(relativePath);
    }
    return Promise.resolve();
  }

  writeFileAtomically(relativePath: string, content: Uint8Array): Promise<void> {
    this.inject("write");
    this.managed.set(relativePath, content);
    return Promise.resolve();
  }

  restore(transactionId: string, relativePath: string, previousExisted: boolean): Promise<void> {
    const backup = this.backups.get(key(transactionId, relativePath));
    if (backup) {
      this.managed.set(relativePath, backup);
      this.backups.delete(key(transactionId, relativePath));
    } else if (!previousExisted) {
      this.managed.delete(relativePath);
    }
    return Promise.resolve();
  }

  syncWorkspace(): Promise<void> {
    this.inject("sync");
    return Promise.resolve();
  }

  finishRecovery(
    transactionId: string,
    preservedPaths: readonly string[],
  ): Promise<readonly PreservedConflict[]> {
    this.inject("finish");
    const conflicts: PreservedConflict[] = [];
    for (const [backupKey, content] of [...this.backups]) {
      if (!backupKey.startsWith(`${transactionId}:`)) {
        continue;
      }
      const originalPath = backupKey.slice(transactionId.length + 1);
      if (preservedPaths.includes(originalPath)) {
        const conflictPath = `${originalPath}.ngapd-conflict-${transactionId}`;
        this.managed.set(conflictPath, content);
        conflicts.push({ originalPath, conflictPath });
      }
      this.backups.delete(backupKey);
    }
    return Promise.resolve(conflicts);
  }

  reopen(): FakeMaterializationFiles {
    return this;
  }

  private inject(kind: NonNullable<FakeMaterializationFiles["failNext"]>): void {
    if (this.failNext === kind) {
      this.failNext = null;
      throw new Error(`injected ${kind} failure`);
    }
  }
}

function state(baseManifest: ReturnType<typeof manifest>): LocalWorkspaceState {
  return {
    schemaVersion: 1,
    revision: 1,
    workspaceId,
    connectionId: "20000000-0000-4000-8000-000000000001",
    registeredPath: "workspace",
    baseSyncVersion: 1,
    baseManifest,
    replicaStatus: "clean",
    connectionStatus: "read_only",
    lease: null,
    lastErrorCode: null,
  };
}

function manifest(files: Record<string, string>) {
  return createWorkspaceManifest(
    Object.entries(files).map(([path, content]) => ({
      path,
      kind: "file" as const,
      size: bytes(content).byteLength,
      sha256: sha256(bytes(content)),
    })),
  );
}

function objectReader(objects: Record<string, string>) {
  return {
    readObject(hash: string): Promise<Uint8Array> {
      const value = objects[hash];
      if (!value) {
        throw new Error("missing");
      }
      return Promise.resolve(bytes(value));
    },
  };
}

function bytes(value: string): Uint8Array {
  return Buffer.from(value, "utf8");
}

function text(value: Uint8Array | undefined): string | undefined {
  return value ? Buffer.from(value).toString("utf8") : undefined;
}

function key(transactionId: string, path: string): string {
  return `${transactionId}:${path}`;
}
