import { createHash } from "node:crypto";

import { WorkspaceCoreError } from "./errors.js";
import { canonicalizeManifestEntries, normalizeWorkspacePath } from "./path-policy.js";
import type {
  FileSnapshot,
  ScannedWorkspaceFile,
  WorkspaceFilePort,
  WorkspaceLimits,
  WorkspaceManifest,
  WorkspaceScanResult,
} from "./types.js";

export const DEFAULT_WORKSPACE_LIMITS = {
  maxFiles: 2_000,
  maxFileBytes: 50 * 1024 * 1024,
  maxWorkspaceBytes: 2 * 1024 * 1024 * 1024,
} as const satisfies WorkspaceLimits;

const CONTROL_ENTRIES = new Set([".ngapd", "TASK.md", "SUMMARY.md"]);

export async function scanWorkspace(
  files: WorkspaceFilePort,
  limits: WorkspaceLimits = DEFAULT_WORKSPACE_LIMITS,
): Promise<WorkspaceScanResult> {
  assertLimits(limits);
  const scanned: ScannedWorkspaceFile[] = [];
  let totalBytes = 0;

  const walk = async (relativeDirectory: string): Promise<void> => {
    const beforeDirectory = await files.inspect(relativeDirectory);
    assertDirectory(beforeDirectory, relativeDirectory);
    const entries = [...(await files.listDirectory(relativeDirectory))].sort((left, right) =>
      left.name.localeCompare(right.name, "en"),
    );

    for (const directoryEntry of entries) {
      if (relativeDirectory.length === 0 && CONTROL_ENTRIES.has(directoryEntry.name)) {
        continue;
      }
      const sourcePath =
        relativeDirectory.length === 0
          ? directoryEntry.name
          : `${relativeDirectory}/${directoryEntry.name}`;
      const canonicalPath = normalizeWorkspacePath(sourcePath);
      const before = await files.inspect(sourcePath);
      if (before.kind === "symlink") {
        throw new WorkspaceCoreError(
          "PATH_SYMLINK",
          `Symbolic links are not allowed in Workspace paths: '${canonicalPath}'.`,
        );
      }
      if (before.kind === "directory") {
        await walk(sourcePath);
        continue;
      }
      if (before.kind !== "file") {
        throw new WorkspaceCoreError(
          "PATH_NOT_PORTABLE",
          `Unsupported filesystem entry: '${canonicalPath}'.`,
        );
      }
      if (scanned.length + 1 > limits.maxFiles) {
        throw new WorkspaceCoreError(
          "FILE_LIMIT_EXCEEDED",
          `Workspace exceeds the ${limits.maxFiles} file soft limit.`,
        );
      }
      if (before.size > limits.maxFileBytes) {
        throw new WorkspaceCoreError(
          "FILE_SIZE_LIMIT_EXCEEDED",
          `File '${canonicalPath}' exceeds the configured soft limit.`,
        );
      }
      if (totalBytes + before.size > limits.maxWorkspaceBytes) {
        throw new WorkspaceCoreError(
          "WORKSPACE_SIZE_LIMIT_EXCEEDED",
          "Workspace exceeds the configured total-size soft limit.",
        );
      }

      const sha256 = await files.hashFile(sourcePath);
      const after = await files.inspect(sourcePath);
      if (!sameSnapshot(before, after)) {
        throw new WorkspaceCoreError(
          "SCAN_RETRY",
          `File '${canonicalPath}' changed during scanning; retry the scan.`,
          true,
        );
      }
      if (!/^[0-9a-f]{64}$/u.test(sha256)) {
        throw new WorkspaceCoreError(
          "STATE_INVALID",
          `File adapter returned an invalid digest for '${canonicalPath}'.`,
        );
      }
      scanned.push({
        canonicalPath,
        sourcePath,
        size: before.size,
        sha256,
      });
      totalBytes += before.size;
    }

    const afterDirectory = await files.inspect(relativeDirectory);
    if (!sameSnapshot(beforeDirectory, afterDirectory)) {
      throw new WorkspaceCoreError(
        "SCAN_RETRY",
        "Workspace directory changed during scanning; retry the scan.",
        true,
      );
    }
  };

  await walk("");
  const canonicalEntries = canonicalizeManifestEntries(
    scanned.map((file) => ({
      path: file.canonicalPath,
      kind: "file" as const,
      size: file.size,
      sha256: file.sha256,
    })),
  );
  const byCanonicalPath = new Map(scanned.map((file) => [file.canonicalPath, file]));
  const canonicalFiles = canonicalEntries.map((entry) => byCanonicalPath.get(entry.path)!);
  return {
    manifest: {
      hash: hashManifestEntries(canonicalEntries),
      entries: canonicalEntries,
    },
    files: canonicalFiles,
    totalBytes,
  };
}

export async function readStableScannedFile(
  files: WorkspaceFilePort,
  scanned: ScannedWorkspaceFile,
): Promise<Uint8Array> {
  const before = await files.inspect(scanned.sourcePath);
  if (before.kind !== "file" || before.size !== scanned.size) {
    throw new WorkspaceCoreError(
      "SCAN_RETRY",
      `File '${scanned.canonicalPath}' changed after scanning; retry.`,
      true,
    );
  }
  const content = await files.readFile(scanned.sourcePath);
  const after = await files.inspect(scanned.sourcePath);
  const digest = createHash("sha256").update(content).digest("hex");
  if (
    !sameSnapshot(before, after) ||
    content.byteLength !== scanned.size ||
    digest !== scanned.sha256
  ) {
    throw new WorkspaceCoreError(
      "SCAN_RETRY",
      `File '${scanned.canonicalPath}' changed after scanning; retry.`,
      true,
    );
  }
  return content;
}

export function createWorkspaceManifest(
  entries: readonly {
    path: string;
    kind: "file";
    size: number;
    sha256: string;
  }[],
): WorkspaceManifest {
  const canonical = canonicalizeManifestEntries(entries);
  return { hash: hashManifestEntries(canonical), entries: canonical };
}

export function hashManifestEntries(
  entries: readonly {
    path: string;
    kind: "file";
    size: number;
    sha256: string;
  }[],
): string {
  return createHash("sha256").update(JSON.stringify(entries), "utf8").digest("hex");
}

export function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function sameSnapshot(left: FileSnapshot, right: FileSnapshot): boolean {
  return (
    left.kind === right.kind &&
    left.size === right.size &&
    left.modifiedAtMs === right.modifiedAtMs &&
    left.changedAtMs === right.changedAtMs &&
    left.device === right.device &&
    left.inode === right.inode
  );
}

function assertDirectory(snapshot: FileSnapshot, relativePath: string): void {
  if (snapshot.kind === "symlink") {
    throw new WorkspaceCoreError(
      "PATH_SYMLINK",
      relativePath.length === 0
        ? "Workspace root must not be a symbolic link."
        : `Workspace directory '${relativePath}' must not be a symbolic link.`,
    );
  }
  if (snapshot.kind !== "directory") {
    throw new WorkspaceCoreError(
      "ROOT_INVALID",
      relativePath.length === 0
        ? "Workspace root must be a directory."
        : `Workspace path '${relativePath}' must be a directory.`,
    );
  }
}

function assertLimits(limits: WorkspaceLimits): void {
  if (
    !Number.isSafeInteger(limits.maxFiles) ||
    !Number.isSafeInteger(limits.maxFileBytes) ||
    !Number.isSafeInteger(limits.maxWorkspaceBytes) ||
    limits.maxFiles < 1 ||
    limits.maxFileBytes < 1 ||
    limits.maxWorkspaceBytes < 1
  ) {
    throw new WorkspaceCoreError("STATE_INVALID", "Workspace limits are invalid.");
  }
}
