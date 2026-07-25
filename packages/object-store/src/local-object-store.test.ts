import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  LocalObjectStore,
  ObjectHashMismatchError,
  ObjectMissingError,
} from "./local-object-store.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createStore() {
  const root = await mkdtemp(join(tmpdir(), "ngapd-object-store-"));
  roots.push(root);
  return { root, store: new LocalObjectStore(root) };
}

describe("LocalObjectStore", () => {
  it("stores verified content by hash and survives a new adapter instance", async () => {
    const { root, store } = await createStore();
    const content = Buffer.from("workspace object");
    const sha256 = createHash("sha256").update(content).digest("hex");

    await expect(store.putVerified(sha256, content)).resolves.toEqual({
      sha256,
      size: content.length,
      storageKey: `${sha256.slice(0, 2)}/${sha256}`,
    });
    await expect(store.putVerified(sha256, content)).resolves.toMatchObject({ sha256 });
    await expect(new LocalObjectStore(root).readVerified(sha256)).resolves.toEqual(content);
  });

  it("rejects wrong hashes without leaving a visible object", async () => {
    const { root, store } = await createStore();
    const wrongHash = "0".repeat(64);

    await expect(store.putVerified(wrongHash, Buffer.from("different"))).rejects.toBeInstanceOf(
      ObjectHashMismatchError,
    );
    await expect(store.hasVerified(wrongHash)).resolves.toBe(false);
    await expect(readdir(root)).resolves.toEqual([]);
  });

  it("reports missing objects and rejects relative roots", async () => {
    const { store } = await createStore();
    await expect(store.readVerified("a".repeat(64))).rejects.toBeInstanceOf(ObjectMissingError);
    expect(() => new LocalObjectStore("relative")).toThrow("OBJECT_STORE_ROOT_MUST_BE_ABSOLUTE");
  });
});
