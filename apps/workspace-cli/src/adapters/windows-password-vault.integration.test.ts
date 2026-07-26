import { randomUUID } from "node:crypto";

import type { CredentialReference } from "@ngapd/workspace-core";
import { describe, expect, it } from "vitest";

import { WindowsPasswordVaultCredentialAdapter } from "./windows-password-vault.js";

const describeOnWindows = process.platform === "win32" ? describe : describe.skip;
const namespace = "com.ngapd.workspace.p004.t001.aed6cbb";
const deviceReference: CredentialReference = {
  origin: "https://workspace.example.test",
  account: "current-device",
  kind: "device",
  workspaceId: null,
};
const leaseReference: CredentialReference = {
  origin: "https://workspace.example.test",
  account: "20000000-0000-4000-8000-000000000001",
  kind: "lease",
  workspaceId: "10000000-0000-4000-8000-000000000001",
};

describeOnWindows("WindowsPasswordVaultCredentialAdapter", () => {
  it("puts, gets, reopens, and deletes only its exact synthetic credentials", async () => {
    const adapter = WindowsPasswordVaultCredentialAdapter.forCurrentUser(namespace);
    const deviceCredential = `device-${randomUUID()}`;
    const leaseToken = `lease-${randomUUID()}`;
    let wroteDevice = false;
    let wroteLease = false;

    expect(await adapter.get(deviceReference)).toBeNull();
    expect(await adapter.get(leaseReference)).toBeNull();

    try {
      await adapter.put(deviceReference, deviceCredential);
      wroteDevice = true;
      await adapter.put(leaseReference, leaseToken);
      wroteLease = true;
      expect(await adapter.get(deviceReference)).toBe(deviceCredential);
      expect(await adapter.get(leaseReference)).toBe(leaseToken);

      const reopened = adapter.reopen();
      expect(await reopened.get(deviceReference)).toBe(deviceCredential);
      expect(await reopened.get(leaseReference)).toBe(leaseToken);

      await reopened.delete(deviceReference);
      wroteDevice = false;
      await reopened.delete(leaseReference);
      wroteLease = false;
      expect(await reopened.get(deviceReference)).toBeNull();
      expect(await reopened.get(leaseReference)).toBeNull();
    } finally {
      if (wroteDevice) {
        await adapter.delete(deviceReference);
      }
      if (wroteLease) {
        await adapter.delete(leaseReference);
      }
    }

    expect(await adapter.get(deviceReference)).toBeNull();
    expect(await adapter.get(leaseReference)).toBeNull();
    const observableConfiguration = JSON.stringify({
      namespace,
      argv: process.argv,
      environment: {
        vaultNamespace: process.env.NGAPD_WORKSPACE_VAULT_NAMESPACE,
      },
    });
    expect(observableConfiguration).not.toContain(deviceCredential);
    expect(observableConfiguration).not.toContain(leaseToken);
  }, 30_000);

  it("rejects invalid inputs without reflecting credential material", async () => {
    const adapter = WindowsPasswordVaultCredentialAdapter.forCurrentUser(namespace);
    const secret = `must-not-appear-${randomUUID()}`;
    let observed: unknown;
    try {
      await adapter.put({ ...deviceReference, origin: "not-an-origin" }, secret);
    } catch (error) {
      observed = error;
    }
    expect(observed).toMatchObject({ code: "CREDENTIAL_INVALID" });
    expect(String(observed)).not.toContain(secret);

    observed = undefined;
    try {
      await adapter.put(deviceReference, `${secret}\0`);
    } catch (error) {
      observed = error;
    }
    expect(observed).toMatchObject({ code: "CREDENTIAL_INVALID" });
    expect(String(observed)).not.toContain(secret);
  });
});
