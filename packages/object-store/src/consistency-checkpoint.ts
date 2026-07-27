import { randomUUID } from "node:crypto";
import { link, mkdir, open, readFile, unlink } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";

import {
  createWorkspaceManifest,
  type WorkspaceManifest,
  type WorkspaceManifestEntry,
} from "@ngapd/workspace-core";

import type { ObjectStore } from "./local-object-store.js";

export interface ConsistencyCheckpoint {
  schemaVersion: 1;
  manifest: {
    hash: string;
    entries: readonly WorkspaceManifestEntry[];
  };
}

export interface PublishedConsistencyCheckpoint {
  manifestHash: string;
  storageKey: string;
  objectCount: number;
  totalBytes: number;
  idempotentReplay: boolean;
}

export class ConsistencyCheckpointError extends Error {
  constructor(
    public readonly code:
      | "CHECKPOINT_MANIFEST_INVALID"
      | "CHECKPOINT_OBJECT_MISSING_OR_CORRUPT"
      | "CHECKPOINT_IMMUTABILITY_VIOLATION",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ConsistencyCheckpointError";
  }
}

export class LocalConsistencyCheckpointStore {
  readonly root: string;

  constructor(
    root: string,
    private readonly objects: ObjectStore,
  ) {
    if (!isAbsolute(root)) {
      throw new Error("CHECKPOINT_ROOT_MUST_BE_ABSOLUTE");
    }
    this.root = resolve(root);
  }

  async publish(
    manifest: WorkspaceManifest,
    hooks: {
      afterTemporarySync?: () => Promise<void> | void;
      afterAtomicPublish?: () => Promise<void> | void;
    } = {},
  ): Promise<PublishedConsistencyCheckpoint> {
    const canonical = canonicalManifest(manifest);
    await this.verifyObjects(canonical);

    const checkpoint: ConsistencyCheckpoint = {
      schemaVersion: 1,
      manifest: canonical,
    };
    const content = Buffer.from(`${JSON.stringify(checkpoint)}\n`, "utf8");
    const storageKey = checkpointStorageKey(canonical.hash);
    const destination = this.resolveKey(storageKey);
    const existing = await this.readExisting(destination, content);
    if (existing) {
      return published(canonical, storageKey, true);
    }

    const directory = join(this.root, canonical.hash.slice(0, 2));
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = join(directory, `.${canonical.hash}.${randomUUID()}.tmp`);
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(content);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await hooks.afterTemporarySync?.();

      try {
        await link(temporary, destination);
      } catch (error) {
        if (!isAlreadyExists(error) || !(await this.readExisting(destination, content))) {
          throw error;
        }
      }
      await hooks.afterAtomicPublish?.();
    } finally {
      await safeUnlink(temporary);
    }

    await this.readExisting(destination, content, true);
    return published(canonical, storageKey, false);
  }

  async read(manifestHash: string): Promise<ConsistencyCheckpoint> {
    assertSha256(manifestHash);
    const destination = this.resolveKey(checkpointStorageKey(manifestHash));
    let content: Uint8Array;
    try {
      content = await readFile(destination);
    } catch (error) {
      throw new ConsistencyCheckpointError(
        "CHECKPOINT_MANIFEST_INVALID",
        `Checkpoint '${manifestHash}' is unavailable.`,
        { cause: error },
      );
    }
    return parseCheckpoint(content, manifestHash);
  }

  private async verifyObjects(manifest: WorkspaceManifest): Promise<void> {
    const verified = new Set<string>();
    for (const entry of manifest.entries) {
      if (verified.has(entry.sha256)) {
        continue;
      }
      let valid = false;
      try {
        valid = await this.objects.hasVerified(entry.sha256, entry.size);
      } catch {
        valid = false;
      }
      if (!valid) {
        throw new ConsistencyCheckpointError(
          "CHECKPOINT_OBJECT_MISSING_OR_CORRUPT",
          `Object '${entry.sha256}' is missing or corrupt; checkpoint was not published.`,
        );
      }
      verified.add(entry.sha256);
    }
  }

  private async readExisting(
    destination: string,
    expected: Uint8Array,
    required = false,
  ): Promise<boolean> {
    try {
      const content = await readFile(destination);
      if (!Buffer.from(content).equals(expected)) {
        throw new ConsistencyCheckpointError(
          "CHECKPOINT_IMMUTABILITY_VIOLATION",
          "An existing content-addressed checkpoint has different bytes.",
        );
      }
      return true;
    } catch (error) {
      if (isMissing(error) && !required) {
        return false;
      }
      throw error;
    }
  }

  private resolveKey(storageKey: string): string {
    const candidate = resolve(this.root, storageKey);
    if (!candidate.startsWith(`${this.root}${sep}`)) {
      throw new Error("CHECKPOINT_PATH_ESCAPE");
    }
    return candidate;
  }
}

function canonicalManifest(manifest: WorkspaceManifest): WorkspaceManifest {
  const canonical = createWorkspaceManifest(manifest.entries);
  if (canonical.hash !== manifest.hash) {
    throw new ConsistencyCheckpointError(
      "CHECKPOINT_MANIFEST_INVALID",
      "Checkpoint manifest hash is not canonical.",
    );
  }
  return canonical;
}

function parseCheckpoint(content: Uint8Array, expectedHash: string): ConsistencyCheckpoint {
  let candidate: unknown;
  try {
    candidate = JSON.parse(Buffer.from(content).toString("utf8"));
  } catch (error) {
    throw new ConsistencyCheckpointError(
      "CHECKPOINT_MANIFEST_INVALID",
      "Checkpoint is not valid JSON.",
      { cause: error },
    );
  }
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !("schemaVersion" in candidate) ||
    candidate.schemaVersion !== 1 ||
    !("manifest" in candidate)
  ) {
    throw new ConsistencyCheckpointError(
      "CHECKPOINT_MANIFEST_INVALID",
      "Checkpoint shape is invalid.",
    );
  }
  const manifest = candidate.manifest as WorkspaceManifest;
  const canonical = canonicalManifest(manifest);
  if (canonical.hash !== expectedHash) {
    throw new ConsistencyCheckpointError(
      "CHECKPOINT_MANIFEST_INVALID",
      "Checkpoint path and manifest hash do not match.",
    );
  }
  return { schemaVersion: 1, manifest: canonical };
}

function published(
  manifest: WorkspaceManifest,
  storageKey: string,
  idempotentReplay: boolean,
): PublishedConsistencyCheckpoint {
  return {
    manifestHash: manifest.hash,
    storageKey,
    objectCount: new Set(manifest.entries.map((entry) => entry.sha256)).size,
    totalBytes: manifest.entries.reduce((total, entry) => total + entry.size, 0),
    idempotentReplay,
  };
}

function checkpointStorageKey(manifestHash: string): string {
  assertSha256(manifestHash);
  return `${manifestHash.slice(0, 2)}/${manifestHash}.checkpoint.json`;
}

function assertSha256(value: string): void {
  if (!/^[0-9a-f]{64}$/u.test(value)) {
    throw new ConsistencyCheckpointError(
      "CHECKPOINT_MANIFEST_INVALID",
      "Checkpoint manifest hash is invalid.",
    );
  }
}

function isMissing(error: unknown): boolean {
  return errorCode(error) === "ENOENT";
}

function isAlreadyExists(error: unknown): boolean {
  return errorCode(error) === "EEXIST";
}

function errorCode(error: unknown): unknown {
  return typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
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
