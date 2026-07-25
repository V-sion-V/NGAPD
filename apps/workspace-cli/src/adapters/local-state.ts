import { randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

import {
  WorkspaceCoreError,
  createWorkspaceManifest,
  normalizeRegistrationPath,
  normalizeWorkspacePath,
  portablePathKey,
  type LocalWorkspaceState,
  type MaterializationJournal,
  type WorkspaceControlPort,
  type WorkspaceRegistration,
  type WorkspaceRegistry,
  type WorkspaceRegistryPort,
} from "@ngapd/workspace-core";

const REGISTRY_FILE = "registry.json";
const STATE_FILE = "state.json";
const JOURNAL_FILE = "materialization-journal.json";
const LOCK_RETRY_DELAY_MS = 10;
const LOCK_TIMEOUT_MS = 2_000;

export class NodeWorkspaceRegistryAdapter implements WorkspaceRegistryPort {
  private constructor(
    readonly configuredRoot: string,
    private readonly controlRoot: string,
  ) {}

  static async open(configuredRoot: string) {
    const root = await openSafeRoot(configuredRoot);
    const controlRoot = join(root, ".ngapd");
    await ensureControlDirectory(controlRoot);
    return new NodeWorkspaceRegistryAdapter(root, controlRoot);
  }

  async register(registration: WorkspaceRegistration): Promise<WorkspaceRegistry> {
    const release = await acquireFileLock(join(this.controlRoot, "registry.lock"));
    try {
      const current = await this.readRegistryUnlocked();
      const normalized = normalizeRegistration(registration);
      const existing = current.registrations.find(
        (candidate) => candidate.workspaceId === normalized.workspaceId,
      );
      if (existing) {
        if (
          existing.relativePath === normalized.relativePath &&
          existing.alias === normalized.alias
        ) {
          return current;
        }
        throw new WorkspaceCoreError(
          "REGISTRATION_CONFLICT",
          "Workspace ID is already registered to another local path.",
        );
      }
      const pathKey = portablePathKey(normalized.relativePath);
      const aliasKey = normalized.alias?.toLocaleLowerCase("en-US") ?? null;
      if (
        current.registrations.some(
          (candidate) =>
            portablePathKey(candidate.relativePath) === pathKey ||
            (aliasKey !== null && candidate.alias?.toLocaleLowerCase("en-US") === aliasKey),
        )
      ) {
        throw new WorkspaceCoreError(
          "REGISTRATION_CONFLICT",
          "Workspace path or alias is already registered.",
        );
      }
      const next: WorkspaceRegistry = {
        schemaVersion: 1,
        revision: current.revision + 1,
        registrations: [...current.registrations, normalized].sort((left, right) =>
          left.workspaceId.localeCompare(right.workspaceId, "en"),
        ),
      };
      await writeJsonAtomically(join(this.controlRoot, REGISTRY_FILE), next);
      return next;
    } finally {
      await release();
    }
  }

  async unregister(workspaceId: string): Promise<WorkspaceRegistry> {
    const release = await acquireFileLock(join(this.controlRoot, "registry.lock"));
    try {
      const current = await this.readRegistryUnlocked();
      const registrations = current.registrations.filter(
        (registration) => registration.workspaceId !== workspaceId,
      );
      if (registrations.length === current.registrations.length) {
        return current;
      }
      const next: WorkspaceRegistry = {
        schemaVersion: 1,
        revision: current.revision + 1,
        registrations,
      };
      await writeJsonAtomically(join(this.controlRoot, REGISTRY_FILE), next);
      return next;
    } finally {
      await release();
    }
  }

  readRegistry(): Promise<WorkspaceRegistry> {
    return this.readRegistryUnlocked();
  }

  async resolve(workspaceIdOrAlias: string): Promise<WorkspaceRegistration | null> {
    const registry = await this.readRegistryUnlocked();
    const aliasKey = workspaceIdOrAlias.toLocaleLowerCase("en-US");
    return (
      registry.registrations.find(
        (registration) =>
          registration.workspaceId === workspaceIdOrAlias ||
          registration.alias?.toLocaleLowerCase("en-US") === aliasKey,
      ) ?? null
    );
  }

  private async readRegistryUnlocked(): Promise<WorkspaceRegistry> {
    const value = await readJson(join(this.controlRoot, REGISTRY_FILE));
    if (value === null) {
      return { schemaVersion: 1, revision: 0, registrations: [] };
    }
    return parseRegistry(value);
  }
}

export class NodeWorkspaceControlAdapter implements WorkspaceControlPort {
  private constructor(
    readonly workspaceRoot: string,
    private readonly controlRoot: string,
  ) {}

  static async open(workspaceRoot: string) {
    const root = await openSafeRoot(workspaceRoot);
    const controlRoot = join(root, ".ngapd");
    await ensureControlDirectory(controlRoot);
    return new NodeWorkspaceControlAdapter(root, controlRoot);
  }

  acquireLock(): Promise<() => Promise<void>> {
    return acquireFileLock(join(this.controlRoot, "workspace.lock"));
  }

  async readState(): Promise<LocalWorkspaceState | null> {
    const value = await readJson(join(this.controlRoot, STATE_FILE));
    return value === null ? null : parseState(value);
  }

  async writeState(
    next: Omit<LocalWorkspaceState, "revision">,
    expectedRevision: number | null,
  ): Promise<LocalWorkspaceState> {
    assertNoSecretProperties(next);
    const current = await this.readState();
    if (
      (expectedRevision === null && current !== null) ||
      (expectedRevision !== null && current?.revision !== expectedRevision)
    ) {
      throw new WorkspaceCoreError(
        "STATE_CONFLICT",
        "Local Workspace state revision changed; retry.",
        true,
      );
    }
    const state = parseState({
      ...next,
      revision: (current?.revision ?? 0) + 1,
    });
    await writeJsonAtomically(join(this.controlRoot, STATE_FILE), state);
    return state;
  }

  async readJournal(): Promise<MaterializationJournal | null> {
    const value = await readJson(join(this.controlRoot, JOURNAL_FILE));
    return value === null ? null : parseJournal(value);
  }

  async writeJournal(journal: MaterializationJournal): Promise<void> {
    assertNoSecretProperties(journal);
    await writeJsonAtomically(join(this.controlRoot, JOURNAL_FILE), parseJournal(journal));
  }

  async clearJournal(): Promise<void> {
    await safeUnlink(join(this.controlRoot, JOURNAL_FILE));
    await syncDirectory(this.controlRoot);
  }
}

async function openSafeRoot(input: string): Promise<string> {
  if (!isAbsolute(input)) {
    throw new WorkspaceCoreError("ROOT_INVALID", "Local state root must be absolute.");
  }
  const root = resolve(input);
  const metadata = await safeLstat(root);
  if (!metadata?.isDirectory() || metadata.isSymbolicLink()) {
    throw new WorkspaceCoreError(
      "ROOT_INVALID",
      "Local state root must be an existing non-symbolic-link directory.",
    );
  }
  return realpath(root);
}

async function ensureControlDirectory(path: string): Promise<void> {
  const existing = await safeLstat(path);
  if (!existing) {
    await mkdir(path, { mode: 0o700 });
  } else if (!existing.isDirectory() || existing.isSymbolicLink()) {
    throw new WorkspaceCoreError(
      existing.isSymbolicLink() ? "PATH_SYMLINK" : "ROOT_INVALID",
      "The local control directory is unsafe.",
    );
  }
  const resolved = await realpath(path);
  if (resolved !== path) {
    throw new WorkspaceCoreError(
      "PATH_SYMLINK",
      "The local control directory must not traverse symbolic links.",
    );
  }
  await chmod(path, 0o700);
}

async function acquireFileLock(path: string): Promise<() => Promise<void>> {
  const startedAt = Date.now();
  while (true) {
    try {
      const handle = await open(path, "wx", 0o600);
      await handle.writeFile(
        `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`,
      );
      await handle.sync();
      let released = false;
      return async () => {
        if (released) {
          return;
        }
        released = true;
        await handle.close();
        await safeUnlink(path);
        await syncDirectory(dirname(path));
      };
    } catch (error) {
      if (!isAlreadyExists(error)) {
        throw error;
      }
      if (await isStaleLock(path)) {
        await safeUnlink(path);
        continue;
      }
      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        throw new WorkspaceCoreError("STATE_BUSY", "Local Workspace state is busy.", true);
      }
      await delay(LOCK_RETRY_DELAY_MS);
    }
  }
}

async function isStaleLock(path: string): Promise<boolean> {
  try {
    const raw = await readFile(path, "utf8");
    const value = JSON.parse(raw) as { pid?: unknown };
    if (typeof value.pid !== "number" || !Number.isSafeInteger(value.pid)) {
      const metadata = await stat(path);
      return Date.now() - metadata.mtimeMs > LOCK_TIMEOUT_MS;
    }
    try {
      process.kill(value.pid, 0);
      return false;
    } catch (error) {
      return isNoSuchProcess(error);
    }
  } catch (error) {
    return isMissing(error);
  }
}

async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  assertNoSecretProperties(value);
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(value)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, path);
    await syncDirectory(dirname(path));
  } finally {
    await safeUnlink(temporary);
  }
}

async function readJson(path: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    if (isMissing(error)) {
      return null;
    }
    if (error instanceof SyntaxError) {
      throw new WorkspaceCoreError("STATE_INVALID", "Local control state is invalid JSON.");
    }
    throw error;
  }
}

function parseRegistry(value: unknown): WorkspaceRegistry {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRevision(value.revision)) {
    throw new WorkspaceCoreError("STATE_INVALID", "Workspace registry metadata is invalid.");
  }
  if (!Array.isArray(value.registrations)) {
    throw new WorkspaceCoreError("STATE_INVALID", "Workspace registry entries are invalid.");
  }
  const registrations = value.registrations.map(parseRegistration);
  const pathKeys = new Set<string>();
  const workspaceIds = new Set<string>();
  const aliases = new Set<string>();
  for (const registration of registrations) {
    const pathKey = portablePathKey(registration.relativePath);
    const aliasKey = registration.alias?.toLocaleLowerCase("en-US") ?? null;
    if (
      workspaceIds.has(registration.workspaceId) ||
      pathKeys.has(pathKey) ||
      (aliasKey !== null && aliases.has(aliasKey))
    ) {
      throw new WorkspaceCoreError("STATE_INVALID", "Workspace registry contains collisions.");
    }
    workspaceIds.add(registration.workspaceId);
    pathKeys.add(pathKey);
    if (aliasKey !== null) {
      aliases.add(aliasKey);
    }
  }
  return {
    schemaVersion: 1,
    revision: value.revision,
    registrations,
  };
}

function parseRegistration(value: unknown): WorkspaceRegistration {
  if (
    !isRecord(value) ||
    typeof value.workspaceId !== "string" ||
    !("alias" in value) ||
    (value.alias !== null && typeof value.alias !== "string") ||
    typeof value.relativePath !== "string"
  ) {
    throw new WorkspaceCoreError("STATE_INVALID", "Workspace registration is invalid.");
  }
  return normalizeRegistration({
    workspaceId: value.workspaceId,
    alias: value.alias,
    relativePath: value.relativePath,
  });
}

function normalizeRegistration(registration: WorkspaceRegistration): WorkspaceRegistration {
  if (
    registration.workspaceId.length === 0 ||
    (registration.alias !== null &&
      (registration.alias.length === 0 ||
        registration.alias.length > 128 ||
        /[/\\]/u.test(registration.alias) ||
        [...registration.alias].some((character) => character.codePointAt(0)! <= 0x1f)))
  ) {
    throw new WorkspaceCoreError("STATE_INVALID", "Workspace registration identity is invalid.");
  }
  return {
    workspaceId: registration.workspaceId,
    alias: registration.alias?.normalize("NFC") ?? null,
    relativePath: normalizeRegistrationPath(registration.relativePath),
  };
}

function parseState(value: unknown): LocalWorkspaceState {
  assertNoSecretProperties(value);
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isRevision(value.revision) ||
    typeof value.workspaceId !== "string" ||
    typeof value.connectionId !== "string" ||
    typeof value.registeredPath !== "string" ||
    !isRevision(value.baseSyncVersion) ||
    !isReplicaStatus(value.replicaStatus) ||
    !isConnectionStatus(value.connectionStatus) ||
    !("lease" in value) ||
    !("lastErrorCode" in value) ||
    (value.lastErrorCode !== null &&
      (typeof value.lastErrorCode !== "string" ||
        !/^[A-Z][A-Z0-9_]{0,127}$/u.test(value.lastErrorCode)))
  ) {
    throw new WorkspaceCoreError("STATE_INVALID", "Local Workspace state is invalid.");
  }
  if (value.workspaceId.length === 0 || value.connectionId.length === 0) {
    throw new WorkspaceCoreError("STATE_INVALID", "Local Workspace identity is invalid.");
  }
  const baseManifest = parseManifest(value.baseManifest);
  const registeredPath = normalizeRegistrationPath(value.registeredPath);
  const lease = value.lease === null ? null : parseLease(value.lease);
  if (
    (value.connectionStatus === "lease_active") !== (lease !== null) ||
    (lease !== null &&
      (lease.connectionId !== value.connectionId || lease.baseSyncVersion < value.baseSyncVersion))
  ) {
    throw new WorkspaceCoreError("STATE_INVALID", "Local Workspace lease summary is inconsistent.");
  }
  return {
    schemaVersion: 1,
    revision: value.revision,
    workspaceId: value.workspaceId,
    connectionId: value.connectionId,
    registeredPath,
    baseSyncVersion: value.baseSyncVersion,
    baseManifest,
    replicaStatus: value.replicaStatus,
    connectionStatus: value.connectionStatus,
    lease,
    lastErrorCode: value.lastErrorCode,
  };
}

function parseJournal(value: unknown): MaterializationJournal {
  assertNoSecretProperties(value);
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.transactionId !== "string" ||
    !/^[A-Za-z0-9._-]{1,128}$/u.test(value.transactionId) ||
    typeof value.workspaceId !== "string" ||
    value.workspaceId.length === 0 ||
    !isRevision(value.targetSyncVersion) ||
    typeof value.targetManifestHash !== "string" ||
    !/^[0-9a-f]{64}$/u.test(value.targetManifestHash) ||
    (value.phase !== "prepared" && value.phase !== "applying") ||
    !Array.isArray(value.operations) ||
    !isRecord(value.priorState)
  ) {
    throw new WorkspaceCoreError("STATE_INVALID", "Materialization journal is invalid.");
  }
  const priorState = parseState(value.priorState);
  if (priorState.workspaceId !== value.workspaceId) {
    throw new WorkspaceCoreError("STATE_INVALID", "Materialization journal identity is invalid.");
  }
  const operations = value.operations.map(parseOperation);
  if (new Set(operations.map((operation) => operation.path)).size !== operations.length) {
    throw new WorkspaceCoreError(
      "STATE_INVALID",
      "Materialization journal contains duplicate paths.",
    );
  }
  return {
    schemaVersion: 1,
    transactionId: value.transactionId,
    workspaceId: value.workspaceId,
    targetSyncVersion: value.targetSyncVersion,
    targetManifestHash: value.targetManifestHash,
    phase: value.phase,
    priorState,
    operations,
  };
}

function parseManifest(value: unknown): LocalWorkspaceState["baseManifest"] {
  if (!isRecord(value) || typeof value.hash !== "string" || !Array.isArray(value.entries)) {
    throw new WorkspaceCoreError("STATE_INVALID", "Local Workspace manifest is invalid.");
  }
  const entries = value.entries.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.path !== "string" ||
      entry.kind !== "file" ||
      !isRevision(entry.size) ||
      typeof entry.sha256 !== "string"
    ) {
      throw new WorkspaceCoreError("STATE_INVALID", "Local Workspace manifest entry is invalid.");
    }
    return {
      path: entry.path,
      kind: "file" as const,
      size: entry.size,
      sha256: entry.sha256,
    };
  });
  const manifest = createWorkspaceManifest(entries);
  if (manifest.hash !== value.hash) {
    throw new WorkspaceCoreError("STATE_INVALID", "Local Workspace manifest hash is invalid.");
  }
  return manifest;
}

function parseLease(value: unknown): NonNullable<LocalWorkspaceState["lease"]> {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.connectionId !== "string" ||
    value.connectionId.length === 0 ||
    !isRevision(value.baseSyncVersion) ||
    typeof value.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(value.expiresAt))
  ) {
    throw new WorkspaceCoreError("STATE_INVALID", "Local Workspace lease summary is invalid.");
  }
  return {
    id: value.id,
    connectionId: value.connectionId,
    baseSyncVersion: value.baseSyncVersion,
    expiresAt: value.expiresAt,
  };
}

function parseOperation(value: unknown): MaterializationJournal["operations"][number] {
  if (
    !isRecord(value) ||
    typeof value.path !== "string" ||
    (value.kind !== "write" && value.kind !== "delete") ||
    typeof value.previousExisted !== "boolean" ||
    typeof value.preserveConflict !== "boolean" ||
    typeof value.applied !== "boolean"
  ) {
    throw new WorkspaceCoreError("STATE_INVALID", "Materialization journal operation is invalid.");
  }
  return {
    path: normalizeWorkspacePath(value.path),
    kind: value.kind,
    previousExisted: value.previousExisted,
    preserveConflict: value.preserveConflict,
    applied: value.applied,
  };
}

function isReplicaStatus(value: unknown): value is LocalWorkspaceState["replicaStatus"] {
  return (
    value === "unmaterialized" ||
    value === "clean" ||
    value === "dirty_with_lease" ||
    value === "lease_or_base_invalid" ||
    value === "conflict" ||
    value === "materialization_failed"
  );
}

function isConnectionStatus(value: unknown): value is LocalWorkspaceState["connectionStatus"] {
  return value === "disconnected" || value === "read_only" || value === "lease_active";
}

function assertNoSecretProperties(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoSecretProperties(item);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (/(?:password|secret|credential|access.?token|lease.?token)$/iu.test(key)) {
      throw new WorkspaceCoreError(
        "STATE_INVALID",
        "Secrets are not allowed in local control state.",
      );
    }
    assertNoSecretProperties(nested);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
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

function isAlreadyExists(error: unknown): boolean {
  return errorCode(error) === "EEXIST";
}

function isNoSuchProcess(error: unknown): boolean {
  return errorCode(error) === "ESRCH";
}

function errorCode(error: unknown): unknown {
  return typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;
}
