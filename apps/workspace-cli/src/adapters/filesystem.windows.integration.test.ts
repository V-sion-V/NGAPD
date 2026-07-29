import { spawn } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  createWorkspaceManifest,
  materializeWorkspace,
  recoverMaterialization,
  scanWorkspace,
  sha256,
  type LocalWorkspaceState,
} from "@ngapd/workspace-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { NodeWorkspaceFileAdapter } from "./filesystem.js";
import { NodeWorkspaceControlAdapter, NodeWorkspaceRegistryAdapter } from "./local-state.js";

const taskRoot = join(process.cwd(), ".tmp", "ngapd-workspace-sync-p004-t001");
const describeOnWindows = process.platform === "win32" ? describe : describe.skip;
let ownsTaskRoot = false;

describeOnWindows("Node/NTFS Workspace adapters", () => {
  beforeAll(async () => {
    await expect(lstat(taskRoot)).rejects.toMatchObject({ code: "ENOENT" });
    await mkdir(taskRoot, { recursive: true });
    ownsTaskRoot = true;
  });

  afterAll(async () => {
    if (ownsTaskRoot) {
      await rm(taskRoot, { recursive: true, force: true });
    }
  });

  it("scans stable long NTFS paths and rejects portable names, junctions, and links", async () => {
    const fixture = await createWorkspaceFixture();
    await mkdir(join(fixture.workspace, "notes"));
    await writeFile(join(fixture.workspace, "notes", "é.txt"), "unicode", "utf8");
    const longSegments = ["a".repeat(58), "b".repeat(58), "c".repeat(58), "d".repeat(58)];
    const longDirectory = join(fixture.workspace, ...longSegments);
    await mkdir(longDirectory, { recursive: true });
    await writeFile(join(longDirectory, "long-path.txt"), "long", "utf8");

    const adapter = await NodeWorkspaceFileAdapter.open(fixture.configuredRoot, "workspace");
    const first = await scanWorkspace(adapter);
    const second = await scanWorkspace(adapter);
    expect(second.manifest).toEqual(first.manifest);
    expect(first.manifest.entries.map((entry) => entry.path)).toContain("notes/é.txt");
    expect(first.manifest.entries.map((entry) => entry.path)).toContain(
      `${longSegments.join("/")}/long-path.txt`,
    );

    await writeFile(join(fixture.workspace, "notes", "e\u0301-unsafe.txt"), "unicode", "utf8");
    await expect(scanWorkspace(adapter)).rejects.toMatchObject({ code: "PATH_NOT_PORTABLE" });
    await rm(join(fixture.workspace, "notes", "e\u0301-unsafe.txt"));

    await expect(
      adapter.writeFileAtomically("TASK.md", Buffer.from("protected")),
    ).rejects.toMatchObject({ code: "PATH_PROTECTED" });
    await expect(adapter.writeFileAtomically("CON", Buffer.from("reserved"))).rejects.toMatchObject(
      {
        code: "PATH_NOT_PORTABLE",
      },
    );
    await expect(
      adapter.writeFileAtomically("trailing-space ", Buffer.from("reserved")),
    ).rejects.toMatchObject({ code: "PATH_NOT_PORTABLE" });
    expect(() =>
      createWorkspaceManifest([fileEntry("Case.txt", "first"), fileEntry("case.txt", "second")]),
    ).toThrow(expect.objectContaining({ code: "PATH_COLLISION" }));

    const junctionPath = join(fixture.workspace, "outside-junction");
    await symlink(fixture.outside, junctionPath, "junction");
    await expect(scanWorkspace(adapter)).rejects.toMatchObject({ code: "PATH_SYMLINK" });
    await rm(junctionPath, { recursive: true, force: true });

    const rootJunction = join(fixture.root, "root-junction");
    await symlink(fixture.configuredRoot, rootJunction, "junction");
    await expect(NodeWorkspaceFileAdapter.open(rootJunction, "workspace")).rejects.toMatchObject({
      code: "ROOT_INVALID",
    });
    await rm(rootJunction, { recursive: true, force: true });

    let fileSymlinkCreated = false;
    const outsideFile = join(fixture.outside, "outside.txt");
    const fileLink = join(fixture.workspace, "outside-file-link.txt");
    await writeFile(outsideFile, "outside", "utf8");
    try {
      await symlink(outsideFile, fileLink, "file");
      fileSymlinkCreated = true;
      await expect(scanWorkspace(adapter)).rejects.toMatchObject({ code: "PATH_SYMLINK" });
    } catch (error) {
      if (!isPrivilegeUnavailable(error)) {
        throw error;
      }
    } finally {
      if (fileSymlinkCreated) {
        await rm(fileLink, { force: true });
      }
    }
  });

  it("coordinates NTFS registry/state writers and preserves the old state when replacement is locked", async () => {
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
    expect(registrations.find((result) => result.status === "rejected")).toMatchObject({
      reason: expect.objectContaining({ code: "REGISTRATION_CONFLICT" }),
    });
    expect((await first.readRegistry()).registrations).toHaveLength(1);

    const control = await NodeWorkspaceControlAdapter.open(fixture.workspace);
    const competing = await NodeWorkspaceControlAdapter.open(fixture.workspace);
    const releaseFirst = await control.acquireLock();
    const waiting = competing.acquireLock();
    await releaseFirst();
    const releaseSecond = await waiting;
    await releaseSecond();

    const initial = localState(manifest({ "file.txt": "base" }));
    const release = await control.acquireLock();
    const stored = await control.writeState(withoutRevision(initial), null);
    await release();
    const statePath = join(fixture.workspace, ".ngapd", "state.json");
    const unlockState = await holdFileAgainstReplacement(statePath);
    try {
      await expect(
        competing.writeState(
          withoutRevision({ ...stored, replicaStatus: "dirty_with_lease" }),
          stored.revision,
        ),
      ).rejects.toMatchObject({ code: "STATE_BUSY", retryable: true });
    } finally {
      await unlockState();
    }

    expect(await control.readState()).toEqual(stored);
    expect(
      (await readdir(join(fixture.workspace, ".ngapd"))).filter((name) => name.endsWith(".tmp")),
    ).toEqual([]);
    await expect(
      competing.writeState(withoutRevision({ ...stored, replicaStatus: "clean" }), 0),
    ).rejects.toMatchObject({ code: "STATE_CONFLICT" });
  }, 30_000);

  it("rolls back a locked NTFS file without advancing the baseline and succeeds after release", async () => {
    const fixture = await createWorkspaceFixture();
    await writeFile(join(fixture.workspace, "file.txt"), "base", "utf8");
    const files = await NodeWorkspaceFileAdapter.open(fixture.configuredRoot, "workspace");
    const control = await NodeWorkspaceControlAdapter.open(fixture.workspace);
    const base = manifest({ "file.txt": "base" });
    const release = await control.acquireLock();
    await control.writeState(withoutRevision(localState(base)), null);
    await release();
    const target = manifest({ "file.txt": "server" });
    const unlockFile = await holdFileAgainstReplacement(join(fixture.workspace, "file.txt"));
    try {
      await expect(
        materializeWorkspace({
          request: {
            workspaceId: localState(base).workspaceId,
            syncVersion: 2,
            manifest: target,
          },
          transactionId: "ntfs-locked",
          control,
          files,
          objects: objectReader(target, { "file.txt": "server" }),
        }),
      ).rejects.toMatchObject({ code: "SCAN_RETRY", retryable: true });
    } finally {
      await unlockFile();
    }

    expect(await readFile(join(fixture.workspace, "file.txt"), "utf8")).toBe("base");
    expect(await control.readState()).toMatchObject({
      baseSyncVersion: 1,
      replicaStatus: "clean",
    });
    expect(await control.readJournal()).toBeNull();

    const recovered = await materializeWorkspace({
      request: {
        workspaceId: localState(base).workspaceId,
        syncVersion: 2,
        manifest: target,
      },
      transactionId: "ntfs-retry",
      control,
      files,
      objects: objectReader(target, { "file.txt": "server" }),
    });
    expect(recovered.state).toMatchObject({
      baseSyncVersion: 2,
      replicaStatus: "clean",
    });
    expect(await readFile(join(fixture.workspace, "file.txt"), "utf8")).toBe("server");
    expect(await control.readJournal()).toBeNull();

    await files.backup("ntfs-crash", "file.txt");
    await files.writeFileAtomically("file.txt", Buffer.from("partial", "utf8"));
    const committedState = await control.readState();
    expect(committedState).not.toBeNull();
    const journalRelease = await control.acquireLock();
    await control.writeJournal({
      schemaVersion: 1,
      transactionId: "ntfs-crash",
      workspaceId: committedState!.workspaceId,
      targetSyncVersion: 3,
      targetManifestHash: manifest({ "file.txt": "future" }).hash,
      phase: "applying",
      priorState: committedState!,
      operations: [
        {
          path: "file.txt",
          kind: "write",
          previousExisted: true,
          preserveConflict: false,
          applied: false,
        },
      ],
    });
    await journalRelease();

    const reopenedFiles = await NodeWorkspaceFileAdapter.open(fixture.configuredRoot, "workspace");
    const reopenedControl = await NodeWorkspaceControlAdapter.open(fixture.workspace);
    await expect(
      recoverMaterialization({ control: reopenedControl, files: reopenedFiles }),
    ).resolves.toBe(true);
    expect(await readFile(join(fixture.workspace, "file.txt"), "utf8")).toBe("server");
    expect(await reopenedControl.readState()).toMatchObject({
      baseSyncVersion: 2,
      replicaStatus: "materialization_failed",
    });
    expect(await reopenedControl.readJournal()).toBeNull();
  }, 30_000);
});

async function createWorkspaceFixture() {
  const root = await mkdtemp(join(taskRoot, "case-"));
  const configuredRoot = join(root, "root");
  const workspace = join(configuredRoot, "workspace");
  const outside = join(root, "outside");
  await mkdir(workspace, { recursive: true });
  await mkdir(outside);
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
    Object.entries(files).map(([path, content]) => fileEntry(path, content)),
  );
}

function fileEntry(path: string, content: string) {
  return {
    path,
    kind: "file" as const,
    size: Buffer.byteLength(content),
    sha256: sha256(Buffer.from(content)),
  };
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

async function holdFileAgainstReplacement(path: string): Promise<() => Promise<void>> {
  const powershell = join(
    process.env.SystemRoot ?? String.raw`C:\Windows`,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const child = spawn(
    powershell,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      String.raw`
$request = [Console]::In.ReadLine() | ConvertFrom-Json
$stream = [System.IO.FileStream]::new(
  $request.path,
  [System.IO.FileMode]::Open,
  [System.IO.FileAccess]::Read,
  [System.IO.FileShare]::None
)
[Console]::Out.WriteLine("READY")
$null = [Console]::In.ReadLine()
$stream.Dispose()
`,
    ],
    { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  child.stdin.write(`${JSON.stringify({ path })}\n`);
  await waitForReady(child);
  let released = false;
  return async () => {
    if (released) {
      return;
    }
    released = true;
    child.stdin.end("\n");
    await waitForExit(child);
  };
}

function waitForReady(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolveReady, rejectReady) => {
    let output = "";
    const timeout = setTimeout(() => {
      cleanup();
      child.kill();
      rejectReady(new Error("Timed out waiting for the NTFS lock helper."));
    }, 5_000);
    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      child.off("error", onError);
      child.off("exit", onEarlyExit);
    };
    const onData = (chunk: Buffer | string) => {
      output += chunk.toString();
      if (output.includes("READY")) {
        cleanup();
        resolveReady();
      }
    };
    const onError = (error: Error) => {
      cleanup();
      rejectReady(error);
    };
    const onEarlyExit = (code: number | null) => {
      cleanup();
      rejectReady(new Error(`NTFS lock helper exited before readiness (${String(code)}).`));
    };
    child.stdout.on("data", onData);
    child.once("error", onError);
    child.once("exit", onEarlyExit);
  });
}

function waitForExit(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolveExit, rejectExit) => {
    if (child.exitCode !== null) {
      resolveExit();
      return;
    }
    child.once("error", rejectExit);
    child.once("exit", () => resolveExit());
  });
}

function isPrivilegeUnavailable(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    new Set(["EACCES", "EPERM"]).has(String((error as { code?: unknown }).code))
  );
}
