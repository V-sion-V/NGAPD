import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  WorkspaceCoreError,
  createWorkspaceManifest,
  materializeWorkspace,
  recoverMaterialization,
  scanWorkspace,
  sha256,
  type LocalWorkspaceState,
  type MaterializationFilePort,
  type WorkspaceFilePort,
} from "@ngapd/workspace-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { NodeWorkspaceFileAdapter } from "./filesystem.js";
import { NodeWorkspaceControlAdapter, NodeWorkspaceRegistryAdapter } from "./local-state.js";

const taskRoot = join(tmpdir(), "ngapd-workspace-sync-p003-local-t002");
let ownsTaskRoot = false;
const describeOnMacOs = process.platform === "darwin" ? describe : describe.skip;

describeOnMacOs("Node/APFS Workspace adapters", () => {
  beforeAll(async () => {
    await mkdir(taskRoot, { recursive: true, mode: 0o700 });
    ownsTaskRoot = true;
  });

  afterAll(async () => {
    if (ownsTaskRoot) {
      await rm(taskRoot, { recursive: true, force: true });
    }
  });

  it("scans real text/binary files and rejects links, reserved names, and scan races", async () => {
    const fixture = await createWorkspaceFixture();
    await mkdir(join(fixture.workspace, "notes"));
    await mkdir(join(fixture.workspace, "empty"));
    await writeFile(join(fixture.workspace, "notes", "e\u0301.txt"), "hello", "utf8");
    await writeFile(join(fixture.workspace, "binary.bin"), new Uint8Array([0, 255, 1, 128]));
    await mkdir(join(fixture.workspace, ".ngapd"), { mode: 0o700 });
    await writeFile(join(fixture.workspace, ".ngapd", "state.json"), "control", "utf8");

    const adapter = await NodeWorkspaceFileAdapter.open(fixture.configuredRoot, "workspace");
    await expect(
      NodeWorkspaceFileAdapter.open(fixture.configuredRoot, "../outside"),
    ).rejects.toMatchObject({ code: "PATH_TRAVERSAL" });
    const scan = await scanWorkspace(adapter);
    expect(scan.manifest.entries.map((entry) => entry.path)).toEqual(["binary.bin", "notes/é.txt"]);

    await writeFile(join(fixture.outside, "outside.txt"), "outside", "utf8");
    await symlink(join(fixture.outside, "outside.txt"), join(fixture.workspace, "link.txt"));
    await expect(scanWorkspace(adapter)).rejects.toMatchObject({ code: "PATH_SYMLINK" });
    await unlink(join(fixture.workspace, "link.txt"));

    await writeFile(join(fixture.workspace, "CON"), "reserved", "utf8");
    await expect(scanWorkspace(adapter)).rejects.toMatchObject({ code: "PATH_NOT_PORTABLE" });
    await unlink(join(fixture.workspace, "CON"));

    await writeFile(join(fixture.workspace, "race.txt"), "before", "utf8");
    let changed = false;
    const racing: WorkspaceFilePort = {
      inspect: (path) => adapter.inspect(path),
      listDirectory: (path) => adapter.listDirectory(path),
      readFile: (path) => adapter.readFile(path),
      hashFile: async (path) => {
        const digest = await adapter.hashFile(path);
        if (path === "race.txt" && !changed) {
          changed = true;
          await appendFile(join(fixture.workspace, "race.txt"), "-changed", "utf8");
        }
        return digest;
      },
    };
    await expect(scanWorkspace(racing)).rejects.toMatchObject({
      code: "SCAN_RETRY",
      retryable: true,
    });

    await symlink(fixture.workspace, join(fixture.configuredRoot, "workspace-link"));
    await expect(
      NodeWorkspaceFileAdapter.open(fixture.configuredRoot, "workspace-link"),
    ).rejects.toMatchObject({ code: "PATH_SYMLINK" });

    await mkdir(join(fixture.workspace, ".ngapd", "recovery"), { recursive: true });
    await symlink(fixture.outside, join(fixture.workspace, ".ngapd", "recovery", "unsafe"));
    await expect(adapter.restore("unsafe", "binary.bin", true)).rejects.toMatchObject({
      code: "PATH_SYMLINK",
    });
  });

  it("coordinates registry/state writers and never serializes secret-shaped fields", async () => {
    const fixture = await createWorkspaceFixture();
    const first = await NodeWorkspaceRegistryAdapter.open(fixture.configuredRoot);
    const second = await NodeWorkspaceRegistryAdapter.open(fixture.configuredRoot);
    const registrations = await Promise.allSettled([
      first.register({
        workspaceId: "10000000-0000-4000-8000-000000000001",
        alias: "shared",
        relativePath: "workspace",
      }),
      second.register({
        workspaceId: "10000000-0000-4000-8000-000000000002",
        alias: "other",
        relativePath: "workspace",
      }),
    ]);
    expect(registrations.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = registrations.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      reason: expect.objectContaining({ code: "REGISTRATION_CONFLICT" }),
    });
    expect((await first.readRegistry()).registrations).toHaveLength(1);

    const control = await NodeWorkspaceControlAdapter.open(fixture.workspace);
    const secondControl = await NodeWorkspaceControlAdapter.open(fixture.workspace);
    const firstStateLock = await control.acquireLock();
    const waitingStateLock = secondControl.acquireLock();
    await firstStateLock();
    const secondStateLock = await waitingStateLock;
    await secondStateLock();
    const initial = localState(createWorkspaceManifest([]));
    const release = await control.acquireLock();
    const stored = await control.writeState(withoutRevision(initial), null);
    await release();
    expect(stored.revision).toBe(1);
    await expect(
      secondControl.writeState(withoutRevision({ ...stored, replicaStatus: "clean" }), 0),
    ).rejects.toMatchObject({ code: "STATE_CONFLICT" });
    await expect(
      control.writeState(
        {
          ...withoutRevision(stored),
          deviceCredential: "must-never-be-persisted",
        } as unknown as Omit<LocalWorkspaceState, "revision">,
        stored.revision,
      ),
    ).rejects.toMatchObject({ code: "STATE_INVALID" });

    const controlMode = (await stat(join(fixture.workspace, ".ngapd"))).mode & 0o777;
    const stateMode = (await stat(join(fixture.workspace, ".ngapd", "state.json"))).mode & 0o777;
    expect(controlMode).toBe(0o700);
    expect(stateMode).toBe(0o600);
    expect(await readFile(join(fixture.workspace, ".ngapd", "state.json"), "utf8")).not.toContain(
      "must-never-be-persisted",
    );
    await writeFile(
      join(fixture.workspace, ".ngapd", "state.json"),
      JSON.stringify({ ...stored, replicaStatus: "invented-status" }),
      "utf8",
    );
    await expect(control.readState()).rejects.toMatchObject({ code: "STATE_INVALID" });
  });

  it("materializes atomically and recovers an interrupted APFS journal after reopening", async () => {
    const fixture = await createWorkspaceFixture();
    await writeFile(join(fixture.workspace, "file.txt"), "local-change", "utf8");
    await writeFile(join(fixture.workspace, "old.txt"), "obsolete", "utf8");
    const files = await NodeWorkspaceFileAdapter.open(fixture.configuredRoot, "workspace");
    const control = await NodeWorkspaceControlAdapter.open(fixture.workspace);
    const base = manifest({ "file.txt": "base", "old.txt": "obsolete" });
    const release = await control.acquireLock();
    await control.writeState(withoutRevision(localState(base)), null);
    await release();
    const target = manifest({ "file.txt": "server", "new.txt": "new" });

    const result = await materializeWorkspace({
      request: {
        workspaceId: localState(base).workspaceId,
        syncVersion: 2,
        manifest: target,
      },
      transactionId: "apfs-success",
      control,
      files,
      objects: objectReader(target, { "file.txt": "server", "new.txt": "new" }),
    });
    expect(result.state.baseSyncVersion).toBe(2);
    expect(await readFile(join(fixture.workspace, "file.txt"), "utf8")).toBe("server");
    expect(await readFile(join(fixture.workspace, "new.txt"), "utf8")).toBe("new");
    await expect(readFile(join(fixture.workspace, "old.txt"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(result.preservedConflicts).toEqual([
      {
        originalPath: "file.txt",
        conflictPath: "file.txt.ngapd-conflict-apfs-success",
      },
    ]);
    expect(
      await readFile(join(fixture.workspace, "file.txt.ngapd-conflict-apfs-success"), "utf8"),
    ).toBe("local-change");

    await files.backup("apfs-crash", "file.txt");
    await files.writeFileAtomically("file.txt", Buffer.from("partial", "utf8"));
    const committedState = await control.readState();
    expect(committedState).not.toBeNull();
    const crashJournal = {
      schemaVersion: 1 as const,
      transactionId: "apfs-crash",
      workspaceId: committedState!.workspaceId,
      targetSyncVersion: 3,
      targetManifestHash: manifest({ "file.txt": "future" }).hash,
      phase: "applying" as const,
      priorState: committedState!,
      operations: [
        {
          path: "file.txt",
          kind: "write" as const,
          previousExisted: true,
          preserveConflict: false,
          applied: false,
        },
      ],
    };
    const journalRelease = await control.acquireLock();
    await control.writeJournal(crashJournal);
    await journalRelease();

    const reopenedFiles = await NodeWorkspaceFileAdapter.open(fixture.configuredRoot, "workspace");
    const reopenedControl = await NodeWorkspaceControlAdapter.open(fixture.workspace);
    await expect(
      recoverMaterialization({ control: reopenedControl, files: reopenedFiles }),
    ).resolves.toBe(true);
    expect(await readFile(join(fixture.workspace, "file.txt"), "utf8")).toBe("server");
    expect((await reopenedControl.readState())?.baseSyncVersion).toBe(2);
    expect((await reopenedControl.readState())?.replicaStatus).toBe("materialization_failed");
    expect(await reopenedControl.readJournal()).toBeNull();
  });

  it("rolls a real file replacement back when a post-write filesystem sync fails", async () => {
    const fixture = await createWorkspaceFixture();
    await writeFile(join(fixture.workspace, "file.txt"), "base", "utf8");
    const files = await NodeWorkspaceFileAdapter.open(fixture.configuredRoot, "workspace");
    const control = await NodeWorkspaceControlAdapter.open(fixture.workspace);
    const base = manifest({ "file.txt": "base" });
    const release = await control.acquireLock();
    await control.writeState(withoutRevision(localState(base)), null);
    await release();
    let failSync = true;
    const failingFiles: MaterializationFilePort = {
      exists: (path) => files.exists(path),
      readFile: (path) => files.readFile(path),
      backup: (transactionId, path) => files.backup(transactionId, path),
      writeFileAtomically: (path, content) => files.writeFileAtomically(path, content),
      restore: (transactionId, path, existed) => files.restore(transactionId, path, existed),
      finishRecovery: (transactionId, paths) => files.finishRecovery(transactionId, paths),
      syncWorkspace: async () => {
        if (failSync) {
          failSync = false;
          throw new Error("injected fsync failure");
        }
        await files.syncWorkspace();
      },
    };
    const target = manifest({ "file.txt": "server" });

    await expect(
      materializeWorkspace({
        request: {
          workspaceId: localState(base).workspaceId,
          syncVersion: 2,
          manifest: target,
        },
        transactionId: "apfs-fsync-failure",
        control,
        files: failingFiles,
        objects: objectReader(target, { "file.txt": "server" }),
      }),
    ).rejects.toBeInstanceOf(WorkspaceCoreError);
    expect(await readFile(join(fixture.workspace, "file.txt"), "utf8")).toBe("base");
    expect((await control.readState())?.baseSyncVersion).toBe(1);
    expect((await control.readState())?.replicaStatus).toBe("materialization_failed");
  });
});

async function createWorkspaceFixture() {
  const root = await mkdtemp(join(taskRoot, "case-"));
  const configuredRoot = join(root, "root");
  const workspace = join(configuredRoot, "workspace");
  const outside = join(root, "outside");
  await mkdir(workspace, { recursive: true, mode: 0o700 });
  await mkdir(outside, { mode: 0o700 });
  return { root, configuredRoot, workspace, outside };
}

function localState(baseManifest: ReturnType<typeof manifest>): LocalWorkspaceState {
  return {
    schemaVersion: 1,
    revision: 0,
    workspaceId: "10000000-0000-4000-8000-000000000010",
    connectionId: "20000000-0000-4000-8000-000000000010",
    registeredPath: "workspace",
    baseSyncVersion: 1,
    baseManifest,
    replicaStatus: "clean",
    connectionStatus: "read_only",
    lease: null,
    lastErrorCode: null,
  };
}

function withoutRevision(state: LocalWorkspaceState): Omit<LocalWorkspaceState, "revision"> {
  return {
    schemaVersion: state.schemaVersion,
    workspaceId: state.workspaceId,
    connectionId: state.connectionId,
    registeredPath: state.registeredPath,
    baseSyncVersion: state.baseSyncVersion,
    baseManifest: state.baseManifest,
    replicaStatus: state.replicaStatus,
    connectionStatus: state.connectionStatus,
    lease: state.lease,
    lastErrorCode: state.lastErrorCode,
  };
}

function manifest(files: Record<string, string>) {
  return createWorkspaceManifest(
    Object.entries(files).map(([path, content]) => ({
      path,
      kind: "file" as const,
      size: Buffer.byteLength(content),
      sha256: sha256(Buffer.from(content)),
    })),
  );
}

function objectReader(target: ReturnType<typeof manifest>, files: Record<string, string>) {
  const contentByHash = new Map(
    target.entries.map((entry) => [entry.sha256, Buffer.from(files[entry.path]!, "utf8")]),
  );
  return {
    readObject(hash: string): Promise<Uint8Array> {
      const content = contentByHash.get(hash);
      if (!content) {
        throw new Error("missing test object");
      }
      return Promise.resolve(content);
    },
  };
}
