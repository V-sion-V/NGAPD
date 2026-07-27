import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createWorkspaceManifest } from "@ngapd/workspace-core";
import { afterEach, describe, expect, it } from "vitest";

import {
  ConsistencyCheckpointError,
  LocalConsistencyCheckpointStore,
} from "./consistency-checkpoint.js";
import { LocalObjectStore } from "./local-object-store.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("LocalConsistencyCheckpointStore", () => {
  it("verifies every object and atomically publishes an immutable idempotent checkpoint", async () => {
    const fixture = await createFixture();
    const contentA = Buffer.from("checkpoint-a");
    const contentB = Buffer.from("checkpoint-b");
    const hashA = digest(contentA);
    const hashB = digest(contentB);
    await fixture.objects.putVerified(hashA, contentA);
    await fixture.objects.putVerified(hashB, contentB);
    const manifest = createWorkspaceManifest([
      { path: "a.txt", kind: "file", size: contentA.length, sha256: hashA },
      { path: "nested/b.txt", kind: "file", size: contentB.length, sha256: hashB },
    ]);

    const first = await fixture.checkpoints.publish(manifest);
    const second = await new LocalConsistencyCheckpointStore(
      fixture.checkpointRoot,
      fixture.objects,
    ).publish(manifest);
    expect(first).toMatchObject({
      manifestHash: manifest.hash,
      objectCount: 2,
      totalBytes: contentA.length + contentB.length,
      idempotentReplay: false,
    });
    expect(second).toEqual({ ...first, idempotentReplay: true });
    await expect(fixture.checkpoints.read(manifest.hash)).resolves.toEqual({
      schemaVersion: 1,
      manifest,
    });
    await expect(readdir(join(fixture.checkpointRoot, manifest.hash.slice(0, 2)))).resolves.toEqual(
      [`${manifest.hash}.checkpoint.json`],
    );
  });

  it("does not publish when an object is missing or corrupt", async () => {
    const fixture = await createFixture();
    const content = Buffer.from("required-object");
    const hash = digest(content);
    const manifest = createWorkspaceManifest([
      { path: "required.txt", kind: "file", size: content.length, sha256: hash },
    ]);
    await expect(fixture.checkpoints.publish(manifest)).rejects.toMatchObject({
      code: "CHECKPOINT_OBJECT_MISSING_OR_CORRUPT",
    });

    await fixture.objects.putVerified(hash, content);
    const objectPath = join(fixture.objectRoot, hash.slice(0, 2), hash);
    await writeFile(objectPath, "corrupt");
    await expect(fixture.checkpoints.publish(manifest)).rejects.toMatchObject({
      code: "CHECKPOINT_OBJECT_MISSING_OR_CORRUPT",
    });
    await expect(readdir(fixture.checkpointRoot)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps publication invisible before the atomic boundary and valid after it", async () => {
    const fixture = await createFixture();
    const content = Buffer.from("crash-boundary");
    const hash = digest(content);
    await fixture.objects.putVerified(hash, content);
    const manifest = createWorkspaceManifest([
      { path: "crash.txt", kind: "file", size: content.length, sha256: hash },
    ]);

    await expect(
      fixture.checkpoints.publish(manifest, {
        afterTemporarySync: () => {
          throw new Error("CRASH_BEFORE_PUBLISH");
        },
      }),
    ).rejects.toThrow("CRASH_BEFORE_PUBLISH");
    await expect(fixture.checkpoints.read(manifest.hash)).rejects.toBeInstanceOf(
      ConsistencyCheckpointError,
    );

    await expect(
      fixture.checkpoints.publish(manifest, {
        afterAtomicPublish: () => {
          throw new Error("CRASH_AFTER_PUBLISH");
        },
      }),
    ).rejects.toThrow("CRASH_AFTER_PUBLISH");
    await expect(fixture.checkpoints.read(manifest.hash)).resolves.toMatchObject({
      manifest: { hash: manifest.hash },
    });
    await expect(fixture.checkpoints.publish(manifest)).resolves.toMatchObject({
      idempotentReplay: true,
    });
  });

  it("rejects a non-canonical manifest without touching the checkpoint root", async () => {
    const fixture = await createFixture();
    const content = Buffer.from("canonical");
    const hash = digest(content);
    await fixture.objects.putVerified(hash, content);
    const manifest = createWorkspaceManifest([
      { path: "canonical.txt", kind: "file", size: content.length, sha256: hash },
    ]);
    await expect(
      fixture.checkpoints.publish({ ...manifest, hash: "0".repeat(64) }),
    ).rejects.toMatchObject({ code: "CHECKPOINT_MANIFEST_INVALID" });
    await expect(readdir(fixture.checkpointRoot)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "ngapd-consistency-checkpoint-"));
  roots.push(root);
  const objectRoot = join(root, "objects");
  const checkpointRoot = join(root, "checkpoints");
  await mkdir(objectRoot, { recursive: true });
  const objects = new LocalObjectStore(objectRoot);
  return {
    objectRoot,
    checkpointRoot,
    objects,
    checkpoints: new LocalConsistencyCheckpointStore(checkpointRoot, objects),
  };
}

function digest(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}
