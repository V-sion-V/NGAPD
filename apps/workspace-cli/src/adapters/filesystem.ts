import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, readdir, realpath, rename, rm, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import {
  WorkspaceCoreError,
  normalizeRegistrationPath,
  normalizeWorkspacePath,
  type DirectoryEntry,
  type FileSnapshot,
  type MaterializationFilePort,
  type PreservedConflict,
  type WorkspaceFilePort,
} from "@ngapd/workspace-core";

export class NodeWorkspaceFileAdapter implements WorkspaceFilePort, MaterializationFilePort {
  private constructor(
    readonly configuredRoot: string,
    readonly workspaceRoot: string,
  ) {}

  static async open(configuredRoot: string, registeredPath: string) {
    if (!isAbsolute(configuredRoot)) {
      throw new WorkspaceCoreError("ROOT_INVALID", "The configured NGAPD root must be absolute.");
    }
    const normalizedRegistration = normalizeRegistrationPath(registeredPath);
    const configured = resolve(configuredRoot);
    const configuredMetadata = await safeLstat(configured);
    if (!configuredMetadata?.isDirectory() || configuredMetadata.isSymbolicLink()) {
      throw new WorkspaceCoreError(
        "ROOT_INVALID",
        "The configured NGAPD root must be an existing non-symbolic-link directory.",
      );
    }
    const realConfigured = await realpath(configured);
    await assertNoSymlinkSegments(configured, normalizedRegistration);
    const workspace = resolve(configured, ...normalizedRegistration.split("/"));
    const workspaceMetadata = await safeLstat(workspace);
    if (!workspaceMetadata?.isDirectory() || workspaceMetadata.isSymbolicLink()) {
      throw new WorkspaceCoreError(
        "ROOT_INVALID",
        "The registered Workspace root must be an existing non-symbolic-link directory.",
      );
    }
    const realWorkspace = await realpath(workspace);
    assertContained(realConfigured, realWorkspace);
    return new NodeWorkspaceFileAdapter(realConfigured, realWorkspace);
  }

  async inspect(relativePath: string): Promise<FileSnapshot> {
    const path = this.resolveWorkspacePath(relativePath);
    const metadata = await safeLstat(path);
    if (!metadata) {
      throw new WorkspaceCoreError("SCAN_RETRY", "Workspace entry disappeared; retry.", true);
    }
    const kind = metadata.isSymbolicLink()
      ? "symlink"
      : metadata.isFile()
        ? "file"
        : metadata.isDirectory()
          ? "directory"
          : "other";
    if (kind !== "symlink") {
      assertContained(this.workspaceRoot, await realpath(path), relativePath.length === 0);
    }
    return {
      kind,
      size: metadata.size,
      modifiedAtMs: metadata.mtimeMs,
      changedAtMs: metadata.ctimeMs,
      device: metadata.dev,
      inode: metadata.ino,
    };
  }

  async listDirectory(relativePath: string): Promise<readonly DirectoryEntry[]> {
    const inspected = await this.inspect(relativePath);
    if (inspected.kind !== "directory") {
      throw new WorkspaceCoreError("ROOT_INVALID", "Workspace directory is invalid.");
    }
    const entries = await readdir(this.resolveWorkspacePath(relativePath), {
      withFileTypes: true,
    });
    return entries.map((entry) => ({
      name: entry.name,
      kind: entry.isSymbolicLink()
        ? "symlink"
        : entry.isFile()
          ? "file"
          : entry.isDirectory()
            ? "directory"
            : "other",
    }));
  }

  async hashFile(relativePath: string): Promise<string> {
    const handle = await this.openSafeFile(relativePath);
    try {
      return await new Promise<string>((resolveDigest, rejectDigest) => {
        const hash = createHash("sha256");
        const stream = handle.createReadStream({ autoClose: false });
        stream.on("data", (chunk) => {
          hash.update(chunk);
        });
        stream.on("error", rejectDigest);
        stream.on("end", () => resolveDigest(hash.digest("hex")));
      });
    } finally {
      await handle.close();
    }
  }

  async readFile(relativePath: string): Promise<Uint8Array> {
    const handle = await this.openSafeFile(relativePath);
    try {
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  }

  async exists(relativePath: string): Promise<boolean> {
    const path = this.resolveWorkspacePath(relativePath);
    const metadata = await safeLstat(path);
    if (!metadata) {
      return false;
    }
    if (metadata.isSymbolicLink()) {
      throw new WorkspaceCoreError("PATH_SYMLINK", `Symbolic link '${relativePath}' is unsafe.`);
    }
    if (!metadata.isFile()) {
      throw new WorkspaceCoreError(
        "PATH_NOT_PORTABLE",
        `Managed path '${relativePath}' is not a regular file.`,
      );
    }
    assertContained(this.workspaceRoot, await realpath(path));
    return true;
  }

  async backup(transactionId: string, relativePath: string): Promise<void> {
    assertTransactionId(transactionId);
    const source = await this.assertSafeFilePath(relativePath);
    await this.ensureRecoveryDirectory(transactionId);
    const destination = this.recoveryPath(transactionId, relativePath);
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    await rename(source, destination);
    await syncDirectory(dirname(source));
    await syncDirectory(dirname(destination));
  }

  async writeFileAtomically(relativePath: string, content: Uint8Array): Promise<void> {
    const canonical = normalizeWorkspacePath(relativePath);
    const target = this.resolveWorkspacePath(canonical);
    await this.ensureSafeParent(dirname(canonical));
    if (await safeLstat(target)) {
      throw new WorkspaceCoreError(
        "STATE_CONFLICT",
        `Managed path '${canonical}' changed during materialization.`,
        true,
      );
    }
    const temporary = join(dirname(target), `.${basename(target)}.ngapd-${randomUUID()}.tmp`);
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(content);
        await handle.sync();
      } finally {
        await handle.close();
      }
      if (await safeLstat(target)) {
        throw new WorkspaceCoreError(
          "STATE_CONFLICT",
          `Managed path '${canonical}' changed during materialization.`,
          true,
        );
      }
      await rename(temporary, target);
      await syncDirectory(dirname(target));
    } finally {
      await safeUnlink(temporary);
    }
  }

  async restore(
    transactionId: string,
    relativePath: string,
    previousExisted: boolean,
  ): Promise<void> {
    assertTransactionId(transactionId);
    const target = this.resolveWorkspacePath(relativePath);
    const backup = await this.safeRecoveryBackup(transactionId, relativePath);
    if (backup !== null) {
      await this.ensureSafeParent(dirname(relativePath));
      await safeUnlink(target);
      await rename(backup, target);
      await syncDirectory(dirname(target));
      return;
    }
    if (!previousExisted) {
      await this.ensureSafeParent(dirname(relativePath));
      await safeUnlink(target);
      await syncDirectory(dirname(target));
    }
  }

  async syncWorkspace(): Promise<void> {
    await syncDirectory(this.workspaceRoot);
    const control = join(this.workspaceRoot, ".ngapd");
    if (await safeLstat(control)) {
      await syncDirectory(control);
    }
  }

  async finishRecovery(
    transactionId: string,
    preservedPaths: readonly string[],
  ): Promise<readonly PreservedConflict[]> {
    assertTransactionId(transactionId);
    const conflicts: PreservedConflict[] = [];
    for (const originalPath of preservedPaths) {
      const backup = await this.safeRecoveryBackup(transactionId, originalPath);
      if (backup === null) {
        const existing = await this.findExistingConflict(originalPath, transactionId);
        if (existing) {
          conflicts.push({ originalPath, conflictPath: existing });
        }
        continue;
      }
      const conflictPath = await this.availableConflictPath(originalPath, transactionId);
      const destination = this.resolveWorkspacePath(conflictPath);
      await this.ensureSafeParent(dirname(conflictPath));
      await rename(backup, destination);
      await syncDirectory(dirname(destination));
      conflicts.push({ originalPath, conflictPath });
    }
    const recoveryRoot = await this.safeRecoveryRoot(transactionId);
    if (recoveryRoot !== null) {
      await rm(recoveryRoot, { recursive: true, force: true });
      const parent = dirname(recoveryRoot);
      if (await safeLstat(parent)) {
        await syncDirectory(parent);
      }
    }
    return conflicts;
  }

  private resolveWorkspacePath(relativePath: string): string {
    if (relativePath.length === 0) {
      return this.workspaceRoot;
    }
    const canonical = normalizeWorkspacePath(relativePath);
    const candidate = resolve(this.workspaceRoot, ...canonical.split("/"));
    assertContained(this.workspaceRoot, candidate);
    return candidate;
  }

  private async assertSafeFilePath(relativePath: string): Promise<string> {
    const path = this.resolveWorkspacePath(relativePath);
    await this.ensureSafeParent(dirname(relativePath));
    const metadata = await safeLstat(path);
    if (!metadata?.isFile() || metadata.isSymbolicLink()) {
      throw new WorkspaceCoreError(
        metadata?.isSymbolicLink() ? "PATH_SYMLINK" : "SCAN_RETRY",
        `Managed file '${relativePath}' is unavailable or unsafe.`,
        !metadata,
      );
    }
    assertContained(this.workspaceRoot, await realpath(path));
    return path;
  }

  private async openSafeFile(relativePath: string) {
    const path = await this.assertSafeFilePath(relativePath);
    let handle;
    try {
      handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
      if (errorCode(error) === "ELOOP") {
        throw new WorkspaceCoreError(
          "PATH_SYMLINK",
          `Managed file '${relativePath}' was replaced by a symbolic link.`,
          true,
        );
      }
      throw error;
    }
    try {
      const [opened, current, resolved] = await Promise.all([
        handle.stat(),
        lstat(path),
        realpath(path),
      ]);
      if (
        !opened.isFile() ||
        !current.isFile() ||
        current.isSymbolicLink() ||
        opened.dev !== current.dev ||
        opened.ino !== current.ino
      ) {
        throw new WorkspaceCoreError(
          "SCAN_RETRY",
          `Managed file '${relativePath}' changed before it could be read; retry.`,
          true,
        );
      }
      assertContained(this.workspaceRoot, resolved);
      return handle;
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  private async ensureSafeParent(relativeDirectory: string): Promise<void> {
    if (relativeDirectory === "." || relativeDirectory.length === 0) {
      return;
    }
    const segments = normalizeWorkspacePath(`${relativeDirectory}/placeholder`)
      .split("/")
      .slice(0, -1);
    let current = this.workspaceRoot;
    for (const segment of segments) {
      current = join(current, segment);
      const metadata = await safeLstat(current);
      if (!metadata) {
        await mkdir(current, { mode: 0o700 });
      } else if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new WorkspaceCoreError(
          metadata.isSymbolicLink() ? "PATH_SYMLINK" : "PATH_NOT_PORTABLE",
          `Workspace directory '${relativeDirectory}' is unsafe.`,
        );
      }
      assertContained(this.workspaceRoot, await realpath(current));
    }
  }

  private recoveryRoot(transactionId: string): string {
    return join(this.workspaceRoot, ".ngapd", "recovery", transactionId);
  }

  private recoveryPath(transactionId: string, relativePath: string): string {
    const canonical = normalizeWorkspacePath(relativePath);
    return join(this.recoveryRoot(transactionId), "files", ...canonical.split("/"));
  }

  private async ensureRecoveryDirectory(transactionId: string): Promise<void> {
    let current = this.workspaceRoot;
    for (const segment of [".ngapd", "recovery", transactionId, "files"]) {
      current = join(current, segment);
      const metadata = await safeLstat(current);
      if (!metadata) {
        await mkdir(current, { mode: 0o700 });
      } else if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new WorkspaceCoreError(
          metadata.isSymbolicLink() ? "PATH_SYMLINK" : "ROOT_INVALID",
          "The materialization recovery directory is unsafe.",
        );
      }
      await chmod(current, 0o700);
      assertContained(this.workspaceRoot, await realpath(current));
    }
  }

  private async safeRecoveryRoot(transactionId: string): Promise<string | null> {
    assertTransactionId(transactionId);
    let current = this.workspaceRoot;
    for (const segment of [".ngapd", "recovery", transactionId]) {
      current = join(current, segment);
      const metadata = await safeLstat(current);
      if (!metadata) {
        return null;
      }
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new WorkspaceCoreError(
          metadata.isSymbolicLink() ? "PATH_SYMLINK" : "ROOT_INVALID",
          "The materialization recovery directory is unsafe.",
        );
      }
      assertContained(this.workspaceRoot, await realpath(current));
    }
    return current;
  }

  private async safeRecoveryBackup(
    transactionId: string,
    relativePath: string,
  ): Promise<string | null> {
    const recoveryRoot = await this.safeRecoveryRoot(transactionId);
    if (recoveryRoot === null) {
      return null;
    }
    const segments = normalizeWorkspacePath(relativePath).split("/");
    let current = join(recoveryRoot, "files");
    for (const segment of segments.slice(0, -1)) {
      const metadata = await safeLstat(current);
      if (!metadata) {
        return null;
      }
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new WorkspaceCoreError(
          metadata.isSymbolicLink() ? "PATH_SYMLINK" : "ROOT_INVALID",
          "The materialization recovery directory is unsafe.",
        );
      }
      assertContained(this.workspaceRoot, await realpath(current));
      current = join(current, segment);
    }
    const parentMetadata = await safeLstat(current);
    if (!parentMetadata) {
      return null;
    }
    if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink()) {
      throw new WorkspaceCoreError(
        parentMetadata.isSymbolicLink() ? "PATH_SYMLINK" : "ROOT_INVALID",
        "The materialization recovery directory is unsafe.",
      );
    }
    assertContained(this.workspaceRoot, await realpath(current));
    const backup = join(current, segments.at(-1)!);
    const backupMetadata = await safeLstat(backup);
    if (!backupMetadata) {
      return null;
    }
    if (!backupMetadata.isFile() || backupMetadata.isSymbolicLink()) {
      throw new WorkspaceCoreError(
        backupMetadata.isSymbolicLink() ? "PATH_SYMLINK" : "ROOT_INVALID",
        "The materialization recovery backup is unsafe.",
      );
    }
    assertContained(this.workspaceRoot, await realpath(backup));
    return backup;
  }

  private async availableConflictPath(originalPath: string, transactionId: string) {
    const base = `${normalizeWorkspacePath(originalPath)}.ngapd-conflict-${transactionId}`;
    for (let suffix = 0; suffix < 1_000; suffix += 1) {
      const candidate = suffix === 0 ? base : `${base}-${suffix}`;
      if (!(await safeLstat(this.resolveWorkspacePath(candidate)))) {
        return candidate;
      }
    }
    throw new WorkspaceCoreError(
      "MATERIALIZATION_FAILED",
      `Unable to reserve a conflict-copy name for '${originalPath}'.`,
    );
  }

  private async findExistingConflict(originalPath: string, transactionId: string) {
    const base = `${normalizeWorkspacePath(originalPath)}.ngapd-conflict-${transactionId}`;
    for (let suffix = 0; suffix < 1_000; suffix += 1) {
      const candidate = suffix === 0 ? base : `${base}-${suffix}`;
      if (await this.exists(candidate)) {
        return candidate;
      }
      if (suffix > 0) {
        return null;
      }
    }
    return null;
  }
}

async function assertNoSymlinkSegments(root: string, relativePath: string): Promise<void> {
  let current = root;
  for (const segment of relativePath.split("/")) {
    current = join(current, segment);
    const metadata = await safeLstat(current);
    if (!metadata) {
      throw new WorkspaceCoreError("ROOT_INVALID", "Registered Workspace path is missing.");
    }
    if (metadata.isSymbolicLink()) {
      throw new WorkspaceCoreError(
        "PATH_SYMLINK",
        "Registered Workspace path must not contain symbolic links.",
      );
    }
  }
}

function assertContained(root: string, candidate: string, allowEqual = false): void {
  const relation = relative(root, candidate);
  const contained =
    (allowEqual && relation.length === 0) ||
    (relation.length > 0 &&
      relation !== ".." &&
      !relation.startsWith(`..${sep}`) &&
      !isAbsolute(relation));
  if (!contained) {
    throw new WorkspaceCoreError(
      "PATH_OUTSIDE_ROOT",
      "Workspace path escapes the configured root.",
    );
  }
}

function assertTransactionId(value: string): void {
  if (!/^[A-Za-z0-9._-]{1,128}$/u.test(value)) {
    throw new WorkspaceCoreError("STATE_INVALID", "Materialization transaction ID is invalid.");
  }
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function safeLstat(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (isMissing(error)) {
      return null;
    }
    throw error;
  }
}

async function safeUnlink(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (!isMissing(error)) {
      throw error;
    }
  }
}

function isMissing(error: unknown): boolean {
  return errorCode(error) === "ENOENT";
}

function errorCode(error: unknown): unknown {
  return typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;
}
