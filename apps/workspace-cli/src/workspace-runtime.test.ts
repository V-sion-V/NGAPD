import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  WorkspaceRemoteError,
  createWorkspaceManifest,
  sha256,
  type CredentialPort,
  type CredentialReference,
  type RemoteWorkspaceLease,
  type RemoteWorkspaceLeaseGrant,
  type RemoteWorkspaceMetadata,
  type WorkspaceApiPort,
  type WorkspaceRegistration,
} from "@ngapd/workspace-core";
import { afterEach, describe, expect, it } from "vitest";

import { NodeWorkspaceFileAdapter } from "./adapters/filesystem.js";
import {
  NodeWorkspaceControlAdapter,
  NodeWorkspaceRegistryAdapter,
} from "./adapters/local-state.js";
import type { WorkspaceCliCommand } from "./commands.js";
import {
  DefaultWorkspaceCommandRuntime,
  type WorkspaceRuntimeDependencies,
} from "./workspace-runtime.js";

const workspaceId = "10000000-0000-4000-8000-000000000001";
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("DefaultWorkspaceCommandRuntime", () => {
  it("pairs, connects, synchronizes, takes over, and resolves both conflict directions", async () => {
    const server = new FakeWorkspaceApi();
    const first = await createRuntime("first", server);
    const second = await createRuntime("second", server);

    expect((await execute(first.runtime, pair("First Mac"))).status).toBe("success");
    expect((await execute(second.runtime, pair("Second Mac"))).status).toBe("success");
    expect(await execute(first.runtime, connect("first"))).toMatchObject({
      status: "success",
      data: { syncVersion: 0 },
    });
    expect(await execute(first.runtime, lease("acquire"))).toMatchObject({
      status: "success",
      data: { baseSyncVersion: 0 },
    });

    await writeFile(join(first.root, "first", "notes.txt"), "first version", "utf8");
    expect(await execute(first.runtime, sync())).toMatchObject({
      status: "success",
      data: { changed: true, syncVersion: 1 },
    });
    expect(await execute(first.runtime, lease("renew"))).toMatchObject({
      status: "success",
      data: { baseSyncVersion: 1 },
    });

    expect(await execute(second.runtime, connect("second"))).toMatchObject({
      status: "success",
      data: { syncVersion: 1 },
    });
    await expect(execute(second.runtime, lease("acquire"))).rejects.toMatchObject({
      remoteCode: "LEASE_CONFLICT",
    });
    expect(await execute(second.runtime, lease("takeover", true))).toMatchObject({
      status: "success",
      data: { baseSyncVersion: 1 },
    });
    await writeFile(join(first.root, "first", "notes.txt"), "late first edit", "utf8");
    await expect(execute(first.runtime, sync())).rejects.toMatchObject({
      remoteCode: "LEASE_INVALID",
    });
    expect(server.syncVersion).toBe(1);

    await writeFile(join(second.root, "second", "notes.txt"), "server-side version", "utf8");
    expect(await execute(second.runtime, sync())).toMatchObject({
      data: { syncVersion: 2 },
    });

    await writeFile(join(first.root, "first", "notes.txt"), "local conflict choice", "utf8");
    expect(await execute(first.runtime, lease("takeover", true))).toMatchObject({
      data: { baseSyncVersion: 2 },
    });
    expect(await execute(first.runtime, conflict("use_local"))).toMatchObject({
      status: "success",
      data: { syncVersion: 3 },
    });
    expect(server.syncVersion).toBe(3);

    await writeFile(join(second.root, "second", "notes.txt"), "discarded local edit", "utf8");
    expect(await execute(second.runtime, lease("takeover", true))).toMatchObject({
      data: { baseSyncVersion: 3 },
    });
    expect(await execute(second.runtime, conflict("use_server"))).toMatchObject({
      status: "recovered",
      data: { syncVersion: 3 },
    });
    expect(await readFile(join(second.root, "second", "notes.txt"), "utf8")).toBe(
      "local conflict choice",
    );
    expect(
      (await readFile(join(second.root, "second", ".ngapd", "state.json"), "utf8")).toString(),
    ).not.toMatch(/credential|access.?token|lease.?token|password/iu);
    expect(server.syncVersion).toBe(3);
  });

  it("holds with a 20-second renewal interval and releases safely on signal", async () => {
    const server = new FakeWorkspaceApi();
    const fixture = await createRuntime("hold", server, ["delay", "SIGINT"]);
    await execute(fixture.runtime, pair("Hold Mac"));
    await execute(fixture.runtime, connect("hold"));
    await execute(fixture.runtime, lease("acquire"));
    const events: unknown[] = [];

    const held = await fixture.runtime.execute(lease("hold"), (event) => events.push(event));

    expect(fixture.observedWaits).toEqual([20_000, 20_000]);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "lease.hold" }),
        expect.objectContaining({ action: "lease.renew" }),
      ]),
    );
    expect(held).toMatchObject({
      action: "lease.hold",
      status: "success",
      data: { released: true, signal: "SIGINT" },
    });
    expect(server.activeLease).toBeNull();
  });

  it("keeps correlation, access, device, and lease secrets out of emitted results", async () => {
    const server = new FakeWorkspaceApi();
    const fixture = await createRuntime("safe", server);
    const emitted: unknown[] = [];
    const paired = await fixture.runtime.execute(pair("Safe Mac"), (event) => emitted.push(event));
    emitted.push(paired);
    await execute(fixture.runtime, connect("safe"));
    emitted.push(await execute(fixture.runtime, lease("acquire")));
    emitted.push(
      await execute(fixture.runtime, { kind: "workspace-status", workspace: "main", json: true }),
    );

    const output = JSON.stringify(emitted);
    for (const secret of server.secrets) {
      expect(output).not.toContain(secret);
    }
    expect(output).not.toMatch(/"(?:deviceCredential|accessToken|leaseToken|correlationSecret)":/u);
  });
});

async function createRuntime(
  registrationPath: string,
  api: FakeWorkspaceApi,
  lifecycleEvents: Array<"delay" | "SIGINT" | "SIGTERM"> = [],
) {
  const root = await mkdtemp("/private/tmp/ngapd-workspace-sync-p003-runtime-");
  roots.push(root);
  await mkdir(join(root, registrationPath));
  const credentials = new MemoryCredentials();
  const registry = await NodeWorkspaceRegistryAdapter.open(root);
  const observedWaits: number[] = [];
  const dependencies: WorkspaceRuntimeDependencies = {
    apiOrigin: "https://workspace.example.test",
    configuredRoot: root,
    api,
    credentials,
    registry,
    clock: { now: () => new Date("2026-07-25T00:00:00.000Z") },
    platform: "macos",
    pairPollMs: 1,
    pairTimeoutMs: 10,
    lifecycle: {
      waitForSignalOrDelay(milliseconds) {
        observedWaits.push(milliseconds);
        return Promise.resolve(lifecycleEvents.shift() ?? "SIGTERM");
      },
    },
    async openWorkspace(registration: WorkspaceRegistration) {
      const files = await NodeWorkspaceFileAdapter.open(root, registration.relativePath);
      return {
        files,
        control: await NodeWorkspaceControlAdapter.open(files.workspaceRoot),
      };
    },
    randomId: randomUUID,
    randomSecret: () => api.correlationSecret,
  };
  return {
    root,
    credentials,
    observedWaits,
    runtime: new DefaultWorkspaceCommandRuntime(dependencies),
  };
}

async function execute(runtime: DefaultWorkspaceCommandRuntime, command: WorkspaceCliCommand) {
  return runtime.execute(command, () => undefined);
}

function pair(deviceName: string): WorkspaceCliCommand {
  return { kind: "pair", deviceName, json: true };
}

function connect(registeredPath: string): WorkspaceCliCommand {
  return {
    kind: "connect",
    workspace: workspaceId,
    registeredPath,
    alias: "main",
    json: true,
  };
}

function lease(
  action: "acquire" | "renew" | "hold" | "release" | "takeover",
  confirmed = false,
): WorkspaceCliCommand {
  return { kind: "lease", action, workspace: "main", confirmed, json: true };
}

function sync(): WorkspaceCliCommand {
  return { kind: "sync", workspace: "main", json: true };
}

function conflict(choice: "use_local" | "use_server"): WorkspaceCliCommand {
  return { kind: "conflict", choice, workspace: "main", confirmed: true, json: true };
}

class MemoryCredentials implements CredentialPort {
  private readonly values = new Map<string, string>();

  put(reference: CredentialReference, value: string): Promise<void> {
    this.values.set(key(reference), value);
    return Promise.resolve();
  }

  get(reference: CredentialReference): Promise<string | null> {
    return Promise.resolve(this.values.get(key(reference)) ?? null);
  }

  delete(reference: CredentialReference): Promise<void> {
    this.values.delete(key(reference));
    return Promise.resolve();
  }
}

class FakeWorkspaceApi implements WorkspaceApiPort {
  readonly correlationSecret = `correlation-${randomUUID()}`;
  readonly secrets = new Set<string>([this.correlationSecret]);
  readonly objects = new Map<string, Uint8Array>();
  currentManifest = createWorkspaceManifest([]);
  syncVersion = 0;
  activeLease: (RemoteWorkspaceLease & { token: string }) | null = null;
  private deviceSequence = 0;
  private pairingSequence = 0;
  private readonly pairings = new Map<string, { deviceId: string; credential: string }>();
  private readonly devices = new Map<string, string>();

  createPairing(): Promise<{
    pairingId: string;
    code: string;
    verificationPath: string;
    expiresAt: string;
  }> {
    this.pairingSequence += 1;
    const pairingId = `pairing-${this.pairingSequence}`;
    const deviceId = `20000000-0000-4000-8000-${String(this.pairingSequence).padStart(12, "0")}`;
    const credential = `device-${randomUUID()}`;
    this.pairings.set(pairingId, { deviceId, credential });
    this.secrets.add(credential);
    return Promise.resolve({
      pairingId,
      code: `PAIR-${this.pairingSequence}`,
      verificationPath: `/pair/${this.pairingSequence}`,
      expiresAt: "2026-07-25T00:10:00.000Z",
    });
  }

  pairingStatus(): Promise<{
    pairingId: string;
    status: "approved";
    expiresAt: string;
  }> {
    return Promise.resolve({
      pairingId: `pairing-${this.pairingSequence}`,
      status: "approved",
      expiresAt: "2026-07-25T00:10:00.000Z",
    });
  }

  consumePairing(input: { pairingId: string }): Promise<{
    deviceId: string;
    accessToken: string;
    deviceCredential: string;
    accessTokenExpiresAt: string;
  }> {
    const pairing = this.pairings.get(input.pairingId)!;
    this.devices.set(pairing.deviceId, pairing.credential);
    const accessToken = `access-${randomUUID()}`;
    this.secrets.add(accessToken);
    return Promise.resolve({
      deviceId: pairing.deviceId,
      accessToken,
      deviceCredential: pairing.credential,
      accessTokenExpiresAt: "2026-07-25T00:15:00.000Z",
    });
  }

  issueDeviceAccessToken(input: {
    deviceId: string;
    deviceCredential: string;
  }): Promise<{ deviceId: string; accessToken: string; accessTokenExpiresAt: string }> {
    if (this.devices.get(input.deviceId) !== input.deviceCredential) {
      return Promise.reject(remote("DEVICE_REVOKED"));
    }
    const accessToken = `access-${input.deviceId}-${++this.deviceSequence}`;
    this.secrets.add(accessToken);
    return Promise.resolve({
      deviceId: input.deviceId,
      accessToken,
      accessTokenExpiresAt: "2026-07-25T00:15:00.000Z",
    });
  }

  revokeCurrentDevice(): Promise<void> {
    return Promise.resolve();
  }

  getMetadata(): Promise<RemoteWorkspaceMetadata> {
    return Promise.resolve({
      workspace: {
        id: workspaceId,
        scopeType: "user",
        scopeId: "30000000-0000-4000-8000-000000000001",
        lifecycle: "active",
        workCycle: 1,
        syncVersion: this.syncVersion,
      },
      currentVersion: {
        workspaceId,
        syncVersion: this.syncVersion,
        manifest: this.currentManifest,
        createdAt: "2026-07-25T00:00:00.000Z",
      },
    });
  }

  readObject(_workspaceId: string, objectHash: string): Promise<Uint8Array> {
    const content = this.objects.get(objectHash);
    return content === undefined
      ? Promise.reject(remote("OBJECT_NOT_FOUND"))
      : Promise.resolve(content);
  }

  uploadObject(input: Parameters<WorkspaceApiPort["uploadObject"]>[0]): Promise<void> {
    this.assertLease(input.leaseId, input.connectionId, input.leaseToken);
    if (sha256(input.content) !== input.sha256) {
      return Promise.reject(remote("OBJECT_HASH_MISMATCH"));
    }
    this.objects.set(input.sha256, input.content);
    return Promise.resolve();
  }

  acquireLease(
    input: Parameters<WorkspaceApiPort["acquireLease"]>[0],
  ): Promise<RemoteWorkspaceLeaseGrant> {
    if (input.baseSyncVersion !== this.syncVersion) {
      return Promise.reject(remote("BASE_VERSION_CONFLICT"));
    }
    if (this.activeLease !== null) {
      return Promise.reject(remote("LEASE_CONFLICT"));
    }
    return Promise.resolve(this.grant(input.connectionId));
  }

  renewLease(input: Parameters<WorkspaceApiPort["renewLease"]>[0]): Promise<RemoteWorkspaceLease> {
    this.assertLease(input.leaseId, input.connectionId, input.leaseToken);
    this.activeLease = {
      ...this.activeLease!,
      baseSyncVersion: this.syncVersion,
      expiresAt: "2026-07-25T00:01:40.000Z",
    };
    return Promise.resolve(this.activeLease);
  }

  releaseLease(
    input: Parameters<WorkspaceApiPort["releaseLease"]>[0],
  ): Promise<RemoteWorkspaceLease> {
    this.assertLease(input.leaseId, input.connectionId, input.leaseToken);
    const released = { ...this.activeLease!, state: "released" as const };
    this.activeLease = null;
    return Promise.resolve(released);
  }

  takeoverLease(
    input: Parameters<WorkspaceApiPort["takeoverLease"]>[0],
  ): Promise<RemoteWorkspaceLeaseGrant> {
    this.activeLease = null;
    return Promise.resolve(this.grant(input.connectionId));
  }

  commit(input: Parameters<WorkspaceApiPort["commit"]>[0]) {
    this.assertLease(input.leaseId, input.connectionId, input.leaseToken);
    if (input.baseSyncVersion !== this.syncVersion) {
      return Promise.reject(remote("BASE_VERSION_CONFLICT"));
    }
    this.syncVersion += 1;
    this.currentManifest = input.manifest;
    this.activeLease = {
      ...this.activeLease!,
      baseSyncVersion: this.syncVersion,
    };
    return Promise.resolve({
      workspaceId,
      syncVersion: this.syncVersion,
      manifestHash: input.manifest.hash,
      idempotentReplay: false,
    });
  }

  resolveConflict(input: Parameters<WorkspaceApiPort["resolveConflict"]>[0]) {
    this.assertLease(input.leaseId, input.connectionId, input.leaseToken);
    if (input.choice === "use_local") {
      if (input.baseSyncVersion !== this.syncVersion) {
        return Promise.reject(remote("BASE_VERSION_CONFLICT"));
      }
      this.syncVersion += 1;
      this.currentManifest = input.manifest;
      this.activeLease = {
        ...this.activeLease!,
        baseSyncVersion: this.syncVersion,
      };
    }
    return Promise.resolve({
      choice: input.choice,
      authoritativeVersion: {
        workspaceId,
        syncVersion: this.syncVersion,
        manifest: this.currentManifest,
        createdAt: "2026-07-25T00:00:00.000Z",
      },
      idempotentReplay: false,
    });
  }

  private grant(connectionId: string): RemoteWorkspaceLeaseGrant {
    const token = `lease-${randomUUID()}`;
    this.secrets.add(token);
    this.activeLease = {
      id: randomUUID(),
      workspaceId,
      workCycle: 1,
      userId: "30000000-0000-4000-8000-000000000001",
      deviceId: randomUUID(),
      connectionId,
      baseSyncVersion: this.syncVersion,
      issuedAt: "2026-07-25T00:00:00.000Z",
      expiresAt: "2026-07-25T00:01:00.000Z",
      state: "active",
      token,
    };
    return { lease: this.activeLease, leaseToken: token };
  }

  private assertLease(leaseId: string, connectionId: string, token: string): void {
    if (
      this.activeLease === null ||
      this.activeLease.id !== leaseId ||
      this.activeLease.connectionId !== connectionId ||
      this.activeLease.token !== token
    ) {
      throw remote("LEASE_INVALID");
    }
  }
}

function remote(code: string): WorkspaceRemoteError {
  return new WorkspaceRemoteError(code, code, randomUUID(), null, "Recover explicitly.");
}

function key(reference: CredentialReference): string {
  return JSON.stringify(reference);
}
