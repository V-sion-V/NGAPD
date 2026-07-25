import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKSPACE_LIMITS,
  WorkspaceCoreError,
  assertNoPortablePathCollisions,
  createWorkspaceManifest,
  diffWorkspaceManifests,
  normalizeWorkspacePath,
  scanWorkspace,
  type DirectoryEntry,
  type FileSnapshot,
  type WorkspaceFilePort,
} from "./index.js";

describe("portable Workspace path policy", () => {
  it("normalizes NFC and rejects protected, unsafe, and non-portable names", () => {
    expect(normalizeWorkspacePath("notes/e\u0301.txt")).toBe("notes/é.txt");

    for (const path of [
      ".ngapd/state.json",
      "TASK.md",
      "summary.md",
      "../outside.txt",
      "/absolute.txt",
      "C:/absolute.txt",
      "nested\\file.txt",
      "folder/CON",
      "folder/aux.txt",
      "folder/trailing.",
      "folder/trailing ",
      "folder/illegal?.txt",
    ]) {
      expect(() => normalizeWorkspacePath(path), path).toThrow(WorkspaceCoreError);
    }
  });

  it("detects case-folded and normalization collisions deterministically", () => {
    expect(() => assertNoPortablePathCollisions(["Readme.md", "README.md"])).toThrowError(
      expect.objectContaining({ code: "PATH_COLLISION" }),
    );
    expect(() => assertNoPortablePathCollisions(["é.txt", "e\u0301.txt"])).toThrowError(
      expect.objectContaining({ code: "PATH_COLLISION" }),
    );
    expect(() => assertNoPortablePathCollisions(["same.txt", "same.txt"])).toThrowError(
      expect.objectContaining({ code: "PATH_COLLISION" }),
    );
  });
});

describe("Workspace manifest scanning and diff", () => {
  it("scans text and binary files with stable ordering while omitting control and empty dirs", async () => {
    const port = new FakeFilePort({
      ".ngapd": directory(),
      ".ngapd/state.json": file("control"),
      "TASK.md": file("projection"),
      empty: directory(),
      "z.bin": file(new Uint8Array([0, 255, 1, 128])),
      notes: directory(),
      "notes/e\u0301.txt": file("hello"),
    });

    const first = await scanWorkspace(port);
    const second = await scanWorkspace(port);

    expect(first).toEqual(second);
    expect(first.manifest.entries.map((entry) => entry.path)).toEqual(["notes/é.txt", "z.bin"]);
    expect(first.manifest.hash).toBe(createWorkspaceManifest(first.manifest.entries).hash);
    expect(first.totalBytes).toBe(9);
  });

  it("returns a stable retry result when a file or directory changes during scanning", async () => {
    const port = new FakeFilePort({ "changing.txt": file("before") });
    port.changeAfterHash = "changing.txt";

    await expect(scanWorkspace(port)).rejects.toMatchObject({
      code: "SCAN_RETRY",
      retryable: true,
    });
  });

  it("classifies add, modify, delete, rename, and unchanged paths", () => {
    const hashA = digest("a");
    const hashB = digest("b");
    const hashC = digest("c");
    const base = createWorkspaceManifest([
      entry("delete.txt", hashA),
      entry("modify.txt", hashA),
      entry("old-name.txt", hashB),
      entry("same.txt", hashA),
    ]);
    const current = createWorkspaceManifest([
      entry("add.txt", hashC),
      entry("modify.txt", hashB),
      entry("new-name.txt", hashB),
      entry("same.txt", hashA),
    ]);

    expect(diffWorkspaceManifests(base, current)).toEqual({
      added: ["add.txt"],
      modified: ["modify.txt"],
      deleted: ["delete.txt"],
      renamed: [{ from: "old-name.txt", to: "new-name.txt" }],
      unchanged: ["same.txt"],
    });
  });

  it("accepts exact soft-limit boundaries and rejects the first excess deterministically", async () => {
    const exactFile = new FakeFilePort({
      "large.bin": sizedFile(DEFAULT_WORKSPACE_LIMITS.maxFileBytes),
    });
    await expect(scanWorkspace(exactFile)).resolves.toMatchObject({
      totalBytes: DEFAULT_WORKSPACE_LIMITS.maxFileBytes,
    });
    const oversizedFile = new FakeFilePort({
      "large.bin": sizedFile(DEFAULT_WORKSPACE_LIMITS.maxFileBytes + 1),
    });
    await expect(scanWorkspace(oversizedFile)).rejects.toMatchObject({
      code: "FILE_SIZE_LIMIT_EXCEEDED",
    });

    const twoThousand = new FakeFilePort(
      Object.fromEntries(
        Array.from({ length: 2_000 }, (_, index) => [
          `files/file-${String(index).padStart(4, "0")}.txt`,
          sizedFile(1),
        ]).concat([["files", directory()]]),
      ),
    );
    const boundaryScan = await scanWorkspace(twoThousand);
    expect(boundaryScan.manifest.entries).toHaveLength(2_000);
    twoThousand.nodes.set("files/overflow.txt", sizedFile(1));
    await expect(scanWorkspace(twoThousand)).rejects.toMatchObject({
      code: "FILE_LIMIT_EXCEEDED",
    });

    const oneHundredMiB = 100 * 1024 * 1024;
    const baseFileSize = Math.floor(oneHundredMiB / 500);
    const remainder = oneHundredMiB - baseFileSize * 500;
    const representativeWorkspace = new FakeFilePort(
      Object.fromEntries(
        Array.from({ length: 500 }, (_, index) => [
          `representative/file-${String(index).padStart(3, "0")}.txt`,
          sizedFile(baseFileSize + (index < remainder ? 1 : 0)),
        ]).concat([["representative", directory()]]),
      ),
    );
    const representativeScan = await scanWorkspace(representativeWorkspace);
    expect(representativeScan.totalBytes).toBe(oneHundredMiB);
    expect(representativeScan.manifest.entries).toHaveLength(500);

    const oneGiB = 1024 * 1024 * 1024;
    const exactWorkspace = new FakeFilePort({
      "a.bin": sizedFile(oneGiB),
      "b.bin": sizedFile(oneGiB),
    });
    const largeLimits = {
      maxFiles: 3,
      maxFileBytes: oneGiB,
      maxWorkspaceBytes: 2 * oneGiB,
    };
    await expect(scanWorkspace(exactWorkspace, largeLimits)).resolves.toMatchObject({
      totalBytes: 2 * oneGiB,
    });
    exactWorkspace.nodes.set("c.bin", sizedFile(1));
    await expect(scanWorkspace(exactWorkspace, largeLimits)).rejects.toMatchObject({
      code: "WORKSPACE_SIZE_LIMIT_EXCEEDED",
    });
  });
});

interface FakeNode {
  kind: "file" | "directory";
  content: Uint8Array;
  size: number;
  version: number;
}

class FakeFilePort implements WorkspaceFilePort {
  readonly nodes = new Map<string, FakeNode>();
  changeAfterHash: string | null = null;

  constructor(nodes: Record<string, FakeNode>) {
    this.nodes.set("", directory());
    for (const [path, node] of Object.entries(nodes)) {
      this.nodes.set(path, node);
      const segments = path.split("/");
      for (let index = 1; index < segments.length; index += 1) {
        const parent = segments.slice(0, index).join("/");
        if (!this.nodes.has(parent)) {
          this.nodes.set(parent, directory());
        }
      }
    }
  }

  inspect(relativePath: string): Promise<FileSnapshot> {
    const node = this.require(relativePath);
    return Promise.resolve({
      kind: node.kind,
      size: node.size,
      modifiedAtMs: node.version,
      changedAtMs: node.version,
      device: 1,
      inode: hashNumber(relativePath),
    });
  }

  listDirectory(relativePath: string): Promise<readonly DirectoryEntry[]> {
    this.require(relativePath);
    const prefix = relativePath.length === 0 ? "" : `${relativePath}/`;
    const children = new Map<string, DirectoryEntry>();
    for (const [path, node] of this.nodes) {
      if (path.length === 0 || !path.startsWith(prefix)) {
        continue;
      }
      const suffix = path.slice(prefix.length);
      if (suffix.includes("/")) {
        continue;
      }
      children.set(suffix, { name: suffix, kind: node.kind });
    }
    return Promise.resolve([...children.values()]);
  }

  hashFile(relativePath: string): Promise<string> {
    const node = this.require(relativePath);
    const result =
      node.content.byteLength === node.size
        ? createHash("sha256").update(node.content).digest("hex")
        : createHash("sha256").update(`fake:${relativePath}:${node.size}`).digest("hex");
    if (this.changeAfterHash === relativePath) {
      node.version += 1;
    }
    return Promise.resolve(result);
  }

  readFile(relativePath: string): Promise<Uint8Array> {
    return Promise.resolve(this.require(relativePath).content);
  }

  private require(path: string): FakeNode {
    const node = this.nodes.get(path);
    if (!node) {
      throw new Error(`missing fake path: ${path}`);
    }
    return node;
  }
}

function file(content: string | Uint8Array): FakeNode {
  const bytes = typeof content === "string" ? Buffer.from(content) : content;
  return { kind: "file", content: bytes, size: bytes.byteLength, version: 1 };
}

function sizedFile(size: number): FakeNode {
  return { kind: "file", content: new Uint8Array(), size, version: 1 };
}

function directory(): FakeNode {
  return { kind: "directory", content: new Uint8Array(), size: 0, version: 1 };
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function entry(path: string, sha256: string) {
  return { path, kind: "file" as const, size: 1, sha256 };
}

function hashNumber(value: string): number {
  return Number.parseInt(createHash("sha256").update(value).digest("hex").slice(0, 8), 16);
}
