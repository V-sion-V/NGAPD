import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, stat, unlink } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";

const SHA_256_PATTERN = /^[0-9a-f]{64}$/;

export interface StoredObject {
  sha256: string;
  size: number;
  storageKey: string;
}

export interface ObjectStore {
  putVerified(expectedSha256: string, content: Uint8Array): Promise<StoredObject>;
  hasVerified(sha256: string, expectedSize?: number): Promise<boolean>;
  readVerified(sha256: string): Promise<Uint8Array>;
}

export class ObjectHashMismatchError extends Error {
  constructor() {
    super("OBJECT_HASH_MISMATCH");
    this.name = "ObjectHashMismatchError";
  }
}

export class ObjectMissingError extends Error {
  constructor() {
    super("OBJECT_NOT_FOUND");
    this.name = "ObjectMissingError";
  }
}

export class LocalObjectStore implements ObjectStore {
  readonly root: string;

  constructor(root: string) {
    if (!isAbsolute(root)) {
      throw new Error("OBJECT_STORE_ROOT_MUST_BE_ABSOLUTE");
    }
    this.root = resolve(root);
  }

  async putVerified(expectedSha256: string, content: Uint8Array): Promise<StoredObject> {
    assertSha256(expectedSha256);
    const actual = digest(content);
    if (actual !== expectedSha256) {
      throw new ObjectHashMismatchError();
    }

    const storageKey = storageKeyFor(expectedSha256);
    const destination = this.resolveKey(storageKey);
    const directory = join(this.root, expectedSha256.slice(0, 2));
    await mkdir(directory, { recursive: true, mode: 0o700 });

    if (await this.hasVerified(expectedSha256, content.byteLength)) {
      return { sha256: expectedSha256, size: content.byteLength, storageKey };
    }

    const temporary = join(directory, `.${expectedSha256}.${randomUUID()}.tmp`);
    try {
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(content);
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        await rename(temporary, destination);
      } catch (error) {
        if (!(await this.hasVerified(expectedSha256, content.byteLength))) {
          throw error;
        }
        await safeUnlink(temporary);
      }
    } catch (error) {
      await safeUnlink(temporary);
      throw error;
    }

    if (!(await this.hasVerified(expectedSha256, content.byteLength))) {
      throw new ObjectHashMismatchError();
    }
    return { sha256: expectedSha256, size: content.byteLength, storageKey };
  }

  async hasVerified(sha256: string, expectedSize?: number): Promise<boolean> {
    assertSha256(sha256);
    const path = this.resolveKey(storageKeyFor(sha256));
    try {
      const metadata = await stat(path);
      if (!metadata.isFile() || (expectedSize !== undefined && metadata.size !== expectedSize)) {
        return false;
      }
      const content = await readFile(path);
      return digest(content) === sha256;
    } catch (error) {
      if (isMissing(error)) {
        return false;
      }
      throw error;
    }
  }

  async readVerified(sha256: string): Promise<Uint8Array> {
    assertSha256(sha256);
    try {
      const content = await readFile(this.resolveKey(storageKeyFor(sha256)));
      if (digest(content) !== sha256) {
        throw new ObjectHashMismatchError();
      }
      return content;
    } catch (error) {
      if (isMissing(error)) {
        throw new ObjectMissingError();
      }
      throw error;
    }
  }

  private resolveKey(storageKey: string): string {
    const candidate = resolve(this.root, storageKey);
    if (!candidate.startsWith(`${this.root}${sep}`)) {
      throw new Error("OBJECT_STORE_PATH_ESCAPE");
    }
    return candidate;
  }
}

function storageKeyFor(sha256: string): string {
  return `${sha256.slice(0, 2)}/${sha256}`;
}

function assertSha256(sha256: string): void {
  if (!SHA_256_PATTERN.test(sha256)) {
    throw new ObjectHashMismatchError();
  }
}

function digest(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
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
