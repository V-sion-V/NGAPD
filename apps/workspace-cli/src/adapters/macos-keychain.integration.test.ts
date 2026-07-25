import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type { CredentialReference } from "@ngapd/workspace-core";
import { describe, expect, it } from "vitest";

import { MacOsKeychainCredentialAdapter } from "./macos-keychain.js";

const execFileAsync = promisify(execFile);
const describeOnMacOs = process.platform === "darwin" ? describe : describe.skip;

describeOnMacOs("MacOsKeychainCredentialAdapter", () => {
  it("puts, gets, reopens, and deletes isolated credentials without changing the search list", async () => {
    const temporaryRoot = await mkdtemp("/private/tmp/ngapd-workspace-sync-p003-keychain-");
    const keychainPath = join(temporaryRoot, "credentials.keychain-db");
    const keychainPassword = `test-${randomUUID()}`;
    const deviceCredential = `device-${randomUUID()}`;
    const leaseToken = `lease-${randomUUID()}`;
    const namespace = `com.ngapd.workspace.test.${randomUUID()}`;
    const beforeSearchList = await searchList();
    let adapter: MacOsKeychainCredentialAdapter | null = null;
    const deviceReference: CredentialReference = {
      origin: "https://workspace.example.test",
      account: "10000000-0000-4000-8000-000000000001",
      kind: "device",
      workspaceId: null,
    };
    const leaseReference: CredentialReference = {
      origin: "https://workspace.example.test",
      account: "10000000-0000-4000-8000-000000000001",
      kind: "lease",
      workspaceId: "20000000-0000-4000-8000-000000000001",
    };

    try {
      adapter = await MacOsKeychainCredentialAdapter.createIsolated(
        keychainPath,
        keychainPassword,
        namespace,
      );
      expect(await searchList()).toEqual(beforeSearchList);

      await adapter.put(deviceReference, deviceCredential);
      await adapter.put(leaseReference, leaseToken);
      expect(await adapter.get(deviceReference)).toBe(deviceCredential);
      expect(await adapter.get(leaseReference)).toBe(leaseToken);

      const reopened = await adapter.reopen();
      expect(await reopened.get(deviceReference)).toBe(deviceCredential);
      expect(await reopened.get(leaseReference)).toBe(leaseToken);

      await reopened.delete(deviceReference);
      expect(await reopened.get(deviceReference)).toBeNull();
      await reopened.delete(leaseReference);
      expect(await reopened.get(leaseReference)).toBeNull();

      const deletedAdapter = adapter;
      await deletedAdapter.deleteIsolatedKeychain();
      adapter = null;
      let observed: unknown;
      try {
        await deletedAdapter.get(deviceReference);
      } catch (error) {
        observed = error;
      }
      expect(observed).toMatchObject({ code: "CREDENTIAL_UNAVAILABLE" });
      expect(String(observed)).not.toContain(deviceCredential);
      expect(String(observed)).not.toContain(leaseToken);
      expect(String(observed)).not.toContain(keychainPassword);
    } finally {
      await adapter?.deleteIsolatedKeychain();
      await rm(temporaryRoot, { recursive: true, force: true });
    }

    expect(await searchList()).toEqual(beforeSearchList);
    expect(JSON.stringify({ keychainPath, namespace })).not.toContain(deviceCredential);
    expect(JSON.stringify({ keychainPath, namespace })).not.toContain(leaseToken);
    expect(JSON.stringify({ keychainPath, namespace })).not.toContain(keychainPassword);
  });
});

async function searchList(): Promise<string[]> {
  const { stdout } = await execFileAsync("/usr/bin/security", ["list-keychains", "-d", "user"]);
  return [...stdout.matchAll(/"([^"]+)"/gu)].map((match) => match[1]!);
}
