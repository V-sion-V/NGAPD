import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { WorkspaceManifest } from "@ngapd/contracts";
import {
  createDatabase,
  FoundationRepository,
  migrateToLatest,
  type Database,
} from "@ngapd/database";
import { canonicalizeManifest, hashManifest } from "@ngapd/domain";
import { LocalObjectStore } from "@ngapd/object-store";
import { createWorkspaceSyncFixture } from "@ngapd/test-fixtures";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { hashSecret } from "./modules/identity/security.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;

describeWithDatabase("workspace sync API integration", () => {
  let database: Database;
  let app: FastifyInstance;
  let objectRoot: string | null = null;
  let currentTime = new Date("2026-07-25T05:00:00.000Z");

  beforeAll(async () => {
    database = createDatabase(connectionString!);
    await database.schema.dropSchema("public").ifExists().cascade().execute();
    await database.schema.createSchema("public").execute();
    await migrateToLatest(database);
    objectRoot = await mkdtemp(join(tmpdir(), "ngapd-workspace-sync-p002-objects-api-"));
    app = await buildApp({
      database,
      databaseCheck: async () => true,
      now: () => currentTime,
      objectStore: new LocalObjectStore(objectRoot),
      publicOrigin: "https://ngapd.local",
    });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await database?.destroy();
    if (objectRoot !== null) {
      await rm(objectRoot, { recursive: true, force: true });
    }
  });

  it("publishes authenticated, schema-backed workspace routes", async () => {
    const openapi = app.swagger() as { paths: Record<string, unknown> };
    expect(openapi.paths).toHaveProperty("/api/v1/workspaces/{workspaceId}");
    expect(openapi.paths).toHaveProperty("/api/v1/workspaces/{workspaceId}/lease/takeover");
    expect(openapi.paths).toHaveProperty("/api/v1/workspaces/{workspaceId}/commits");
    expect(openapi.paths).toHaveProperty("/api/v1/workspaces/{workspaceId}/conflicts/resolve");
    expect(Object.keys(openapi.paths)).not.toContain("/api/v1/workspace-fixtures");

    const anonymous = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${randomUUID()}`,
      headers: { "x-request-id": "anonymous-workspace" },
    });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json()).toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
      requestId: "anonymous-workspace",
    });
  });

  it("repeats SYNC-001 through SYNC-007 with authoritative recovery semantics", async () => {
    const first = await runScenarios(1);
    const second = await runScenarios(2);

    expect(first.finalVersion).toBe(3);
    expect(second.finalVersion).toBe(3);
    expect(first.actions).toEqual(expect.arrayContaining(expectedAuditActions));
    expect(second.actions).toEqual(expect.arrayContaining(expectedAuditActions));

    await app.close();
    app = await buildApp({
      database,
      databaseCheck: async () => true,
      now: () => currentTime,
      objectStore: new LocalObjectStore(objectRoot),
      publicOrigin: "https://ngapd.local",
    });
    await app.ready();

    const recovered = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${first.workspaceId}`,
      headers: bearer(first.ownerToken, "restart-read"),
    });
    expect(recovered.statusCode).toBe(200);
    expect(recovered.json()).toMatchObject({
      workspace: { syncVersion: 3, lifecycle: "archived" },
      currentVersion: { syncVersion: 3 },
    });
    const object = first.fixture.objects[0]!;
    const downloaded = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${first.workspaceId}/objects/${object.entry.sha256}`,
      headers: bearer(first.ownerToken, "restart-object"),
    });
    expect(downloaded.statusCode).toBe(200);
    expect(downloaded.rawPayload).toEqual(object.content);
  }, 30_000);

  async function runScenarios(run: number) {
    const seeded = await seedScenario(run);
    const { workspaceId, ownerToken, secondToken, nextOwnerToken, fixture } = seeded;
    const firstConnection = randomUUID();
    const secondConnection = randomUUID();

    const metadata = await request("GET", `/api/v1/workspaces/${workspaceId}`, ownerToken);
    expect(metadata.statusCode).toBe(200);
    expect(metadata.json()).toMatchObject({
      workspace: { syncVersion: 0, lifecycle: "active" },
      currentVersion: { syncVersion: 0, manifest: { entries: [] } },
    });
    const outsider = await request(
      "GET",
      `/api/v1/workspaces/${workspaceId}`,
      seeded.outsiderToken,
    );
    expect(outsider.statusCode).toBe(403);

    const firstGrant = await acquire(workspaceId, ownerToken, firstConnection, 0);
    const contention = await acquireResponse(
      workspaceId,
      secondToken,
      secondConnection,
      0,
      `sync-${run}-002-contention`,
    );
    expect(contention.statusCode).toBe(409);
    expect(contention.json()).toMatchObject({
      code: "LEASE_CONFLICT",
      currentVersion: 0,
    });
    const takeover = await request(
      "POST",
      `/api/v1/workspaces/${workspaceId}/lease/takeover`,
      secondToken,
      { connectionId: secondConnection, confirmed: true },
      `sync-${run}-002-takeover`,
    );
    expect(takeover.statusCode).toBe(201);
    const activeGrant = takeover.json() as LeaseGrant;
    const lateFirst = await commit(
      workspaceId,
      ownerToken,
      firstGrant,
      emptyManifest,
      0,
      `sync-${run}-old-holder`,
      `sync-${run}-002-late`,
    );
    expect(lateFirst.statusCode).toBe(409);
    expect(lateFirst.json()).toMatchObject({ code: "LEASE_INVALID", currentVersion: 0 });

    for (const object of fixture.objects) {
      const uploaded = await upload(
        workspaceId,
        secondToken,
        activeGrant,
        object.entry.sha256,
        object.content,
        `sync-${run}-001-upload`,
      );
      expect(uploaded.statusCode).toBe(200);
      expect(uploaded.json()).toEqual({
        sha256: object.entry.sha256,
        size: object.content.byteLength,
      });
    }
    const wrongHash = await upload(
      workspaceId,
      secondToken,
      activeGrant,
      "0".repeat(64),
      Buffer.from("wrong"),
      `sync-${run}-008-wrong-hash`,
    );
    expect(wrongHash.statusCode).toBe(422);
    expect(wrongHash.json()).toMatchObject({ code: "OBJECT_HASH_MISMATCH" });

    const committed = await commit(
      workspaceId,
      secondToken,
      activeGrant,
      fixture.manifest,
      0,
      `sync-${run}-commit-0001`,
      `sync-${run}-001-commit`,
    );
    expect(committed.statusCode).toBe(201);
    expect(committed.json()).toMatchObject({
      syncVersion: 1,
      idempotentReplay: false,
    });
    const replay = await commit(
      workspaceId,
      secondToken,
      activeGrant,
      fixture.manifest,
      0,
      `sync-${run}-commit-0001`,
      `sync-${run}-001-replay`,
    );
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toMatchObject({ syncVersion: 1, idempotentReplay: true });

    const renamedAtOne = renameManifest(fixture.manifest, `run-${run}/renamed-one.md`);
    const reusedKey = await commit(
      workspaceId,
      secondToken,
      activeGrant,
      renamedAtOne,
      0,
      `sync-${run}-commit-0001`,
      `sync-${run}-idem-conflict`,
    );
    expect(reusedKey.statusCode).toBe(409);
    expect(reusedKey.json()).toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
      currentVersion: 1,
    });
    const missingManifest = {
      hash: hashManifest([{ path: "missing.bin", kind: "file", size: 12, sha256: "f".repeat(64) }]),
      entries: [{ path: "missing.bin", kind: "file" as const, size: 12, sha256: "f".repeat(64) }],
    };
    const missing = await commit(
      workspaceId,
      secondToken,
      activeGrant,
      missingManifest,
      1,
      `sync-${run}-missing-0001`,
      `sync-${run}-missing-object`,
    );
    expect(missing.statusCode).toBe(422);
    expect(missing.json()).toMatchObject({ code: "OBJECT_NOT_FOUND", currentVersion: 1 });

    const renewed = await request(
      "POST",
      `/api/v1/workspaces/${workspaceId}/lease/renew`,
      secondToken,
      leaseBody(activeGrant),
      `sync-${run}-001-renew`,
    );
    expect(renewed.statusCode).toBe(200);
    expect(renewed.json()).toMatchObject({ state: "active", baseSyncVersion: 1 });
    const released = await request(
      "POST",
      `/api/v1/workspaces/${workspaceId}/lease/release`,
      secondToken,
      leaseBody(activeGrant),
      `sync-${run}-001-release`,
    );
    expect(released.statusCode).toBe(200);
    expect(released.json()).toMatchObject({ state: "released" });

    const expiring = await acquire(workspaceId, ownerToken, randomUUID(), 1);
    currentTime = new Date(currentTime.getTime() + 61_000);
    const lateCommit = await commit(
      workspaceId,
      ownerToken,
      expiring,
      fixture.manifest,
      1,
      `sync-${run}-expired-0001`,
      `sync-${run}-003-expired`,
    );
    expect(lateCommit.statusCode).toBe(409);
    expect(lateCommit.json()).toMatchObject({ code: "LEASE_EXPIRED", currentVersion: 1 });

    const current = await acquire(workspaceId, ownerToken, randomUUID(), 1);
    const versionTwo = await commit(
      workspaceId,
      ownerToken,
      current,
      renamedAtOne,
      1,
      `sync-${run}-version-two`,
      `sync-${run}-004-advance`,
    );
    expect(versionTwo.statusCode).toBe(201);
    expect(versionTwo.json()).toMatchObject({ syncVersion: 2 });
    const stale = await commit(
      workspaceId,
      ownerToken,
      current,
      fixture.manifest,
      1,
      `sync-${run}-stale-base`,
      `sync-${run}-004-stale`,
    );
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ code: "BASE_VERSION_CONFLICT", currentVersion: 2 });

    const localChoiceManifest = renameManifest(fixture.manifest, `run-${run}/use-local.md`);
    const authoritativeLocalManifest = {
      ...localChoiceManifest,
      entries: canonicalizeManifest(localChoiceManifest.entries),
    };
    const useLocal = await request(
      "POST",
      `/api/v1/workspaces/${workspaceId}/conflicts/resolve`,
      ownerToken,
      {
        choice: "use_local",
        ...leaseBody(current),
        baseSyncVersion: 2,
        idempotencyKey: `sync-${run}-use-local`,
        manifest: localChoiceManifest,
      },
      `sync-${run}-005-use-local`,
    );
    expect(useLocal.statusCode).toBe(200);
    expect(useLocal.json()).toMatchObject({
      choice: "use_local",
      authoritativeVersion: { syncVersion: 3, manifest: authoritativeLocalManifest },
    });
    const useServer = await request(
      "POST",
      `/api/v1/workspaces/${workspaceId}/conflicts/resolve`,
      ownerToken,
      { choice: "use_server", ...leaseBody(current) },
      `sync-${run}-006-use-server`,
    );
    expect(useServer.statusCode).toBe(200);
    expect(useServer.json()).toMatchObject({
      choice: "use_server",
      authoritativeVersion: { syncVersion: 3, manifest: authoritativeLocalManifest },
    });

    await database
      .updateTable("workspaces")
      .set({ work_cycle: 2 })
      .where("id", "=", workspaceId)
      .execute();
    const oldCycle = await request(
      "POST",
      `/api/v1/workspaces/${workspaceId}/lease/renew`,
      ownerToken,
      leaseBody(current),
      `sync-${run}-cycle-changed`,
    );
    expect(oldCycle.statusCode).toBe(409);
    expect(oldCycle.json()).toMatchObject({ code: "WORK_CYCLE_CHANGED", currentVersion: 3 });

    await database
      .updateTable("tasks")
      .set({ explicit_owner_membership_id: seeded.nextOwnerMembershipId })
      .where("id", "=", seeded.taskId)
      .execute();
    const formerOwner = await request(
      "POST",
      `/api/v1/workspaces/${workspaceId}/lease/renew`,
      ownerToken,
      leaseBody(current),
      `sync-${run}-007-former-owner`,
    );
    expect(formerOwner.statusCode).toBe(403);
    expect(formerOwner.json()).toMatchObject({ code: "FORBIDDEN", currentVersion: 3 });

    const nextOwner = await acquire(workspaceId, nextOwnerToken, randomUUID(), 3);
    const nextOwnerChoice = await request(
      "POST",
      `/api/v1/workspaces/${workspaceId}/conflicts/resolve`,
      nextOwnerToken,
      { choice: "use_server", ...leaseBody(nextOwner) },
      `sync-${run}-007-next-owner`,
    );
    expect(nextOwnerChoice.statusCode).toBe(200);
    expect(nextOwnerChoice.json()).toMatchObject({
      choice: "use_server",
      authoritativeVersion: { syncVersion: 3 },
    });

    await database
      .updateTable("devices")
      .set({ revoked_at: currentTime })
      .where("id", "=", seeded.nextOwnerDeviceId)
      .execute();
    const revokedDevice = await request(
      "POST",
      `/api/v1/workspaces/${workspaceId}/lease/renew`,
      nextOwnerToken,
      leaseBody(nextOwner),
      `sync-${run}-revoked-device`,
    );
    expect(revokedDevice.statusCode).toBe(403);
    expect(revokedDevice.json()).toMatchObject({ code: "DEVICE_REVOKED" });

    await database
      .updateTable("workspaces")
      .set({ lifecycle: "archived" })
      .where("id", "=", workspaceId)
      .execute();
    const archivedWrite = await acquireResponse(
      workspaceId,
      ownerToken,
      randomUUID(),
      3,
      `sync-${run}-archived`,
    );
    expect(archivedWrite.statusCode).toBe(409);
    expect(archivedWrite.json()).toMatchObject({
      code: "WORKSPACE_NOT_ACTIVE",
      currentVersion: 3,
    });

    const authoritative = await database
      .selectFrom("workspaces")
      .select(["sync_version", "lifecycle"])
      .where("id", "=", workspaceId)
      .executeTakeFirstOrThrow();
    expect(authoritative).toEqual({ sync_version: "3", lifecycle: "archived" });
    const versionCount = await database
      .selectFrom("workspace_versions")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("workspace_id", "=", workspaceId)
      .executeTakeFirstOrThrow();
    expect(Number(versionCount.count)).toBe(4);

    const audits = await database
      .selectFrom("audit_events")
      .select(["action", "result", "reason_code", "metadata"])
      .where("workspace_id", "=", workspaceId)
      .orderBy("created_at")
      .execute();
    const serializedAudit = JSON.stringify(audits);
    for (const secret of [
      ownerToken,
      secondToken,
      nextOwnerToken,
      firstGrant.leaseToken,
      activeGrant.leaseToken,
      current.leaseToken,
    ]) {
      expect(serializedAudit).not.toContain(secret);
    }
    for (const object of fixture.objects) {
      expect(serializedAudit).not.toContain(Buffer.from(object.content).toString("utf8"));
    }

    return {
      workspaceId,
      ownerToken,
      fixture,
      finalVersion: Number(authoritative.sync_version),
      actions: audits.map((audit) => audit.action),
    };
  }

  async function seedScenario(run: number) {
    const fixture = createWorkspaceSyncFixture();
    const foundation = new FoundationRepository(database);
    const owner = await foundation.createUserWithWorkspace({
      loginName: `sync-owner-${run}`,
      normalizedLoginName: `sync-owner-${run}`,
      passwordHash: "argon2id$fixture",
    });
    const nextOwner = await foundation.createUserWithWorkspace({
      loginName: `sync-next-${run}`,
      normalizedLoginName: `sync-next-${run}`,
      passwordHash: "argon2id$fixture",
    });
    const outsider = await foundation.createUserWithWorkspace({
      loginName: `sync-outsider-${run}`,
      normalizedLoginName: `sync-outsider-${run}`,
      passwordHash: "argon2id$fixture",
    });
    const project = await foundation.createProjectWithWorkspace({
      key: run === 1 ? "SYNCA" : "SYNCB",
      name: `Sync run ${run}`,
      ownerUserId: owner.user.id,
    });
    const nextOwnerMembership = await foundation.createMembership({
      projectId: project.project.id,
      userId: nextOwner.user.id,
      permissionLevel: "member",
    });
    const task = await foundation.createTaskWithWorkspace({
      projectId: project.project.id,
      key: `SYNC-${run}`,
      title: `Scenario run ${run}`,
      parentTaskId: null,
      explicitOwnerMembershipId: project.ownerMembership.id,
    });
    const ownerDeviceId = randomUUID();
    const secondDeviceId = randomUUID();
    const nextOwnerDeviceId = randomUUID();
    const outsiderDeviceId = randomUUID();
    const ownerToken = `owner-${run}-${randomUUID()}`;
    const secondToken = `second-${run}-${randomUUID()}`;
    const nextOwnerToken = `next-${run}-${randomUUID()}`;
    const outsiderToken = `outsider-${run}-${randomUUID()}`;
    await database
      .insertInto("devices")
      .values([
        {
          id: ownerDeviceId,
          user_id: owner.user.id,
          name: "owner",
          platform: "macos",
        },
        {
          id: secondDeviceId,
          user_id: owner.user.id,
          name: "second",
          platform: "windows",
        },
        {
          id: nextOwnerDeviceId,
          user_id: nextOwner.user.id,
          name: "next-owner",
          platform: "macos",
        },
        {
          id: outsiderDeviceId,
          user_id: outsider.user.id,
          name: "outsider",
          platform: "macos",
        },
      ])
      .execute();
    await database
      .insertInto("device_access_tokens")
      .values(
        [
          [ownerDeviceId, owner.user.id, ownerToken],
          [secondDeviceId, owner.user.id, secondToken],
          [nextOwnerDeviceId, nextOwner.user.id, nextOwnerToken],
          [outsiderDeviceId, outsider.user.id, outsiderToken],
        ].map(([deviceId, userId, token]) => ({
          id: randomUUID(),
          device_id: deviceId!,
          user_id: userId!,
          token_hash: hashSecret(token!),
          expires_at: new Date("2099-01-01T00:00:00.000Z"),
          revoked_at: null,
        })),
      )
      .execute();
    return {
      fixture,
      workspaceId: task.workspace.id,
      taskId: task.task.id,
      nextOwnerMembershipId: nextOwnerMembership.id,
      nextOwnerDeviceId,
      ownerToken,
      secondToken,
      nextOwnerToken,
      outsiderToken,
    };
  }

  function request(
    method: "GET" | "POST",
    url: string,
    token: string,
    payload?: unknown,
    requestId = randomUUID(),
  ) {
    return app.inject({
      method,
      url,
      headers: bearer(token, requestId),
      ...(payload === undefined ? {} : { payload }),
    });
  }

  async function acquire(
    workspaceId: string,
    token: string,
    connectionId: string,
    baseSyncVersion: number,
  ): Promise<LeaseGrant> {
    const response = await acquireResponse(
      workspaceId,
      token,
      connectionId,
      baseSyncVersion,
      randomUUID(),
    );
    expect(response.statusCode).toBe(201);
    return response.json() as LeaseGrant;
  }

  function acquireResponse(
    workspaceId: string,
    token: string,
    connectionId: string,
    baseSyncVersion: number,
    requestId: string,
  ) {
    return request(
      "POST",
      `/api/v1/workspaces/${workspaceId}/lease/acquire`,
      token,
      { connectionId, baseSyncVersion },
      requestId,
    );
  }

  function upload(
    workspaceId: string,
    token: string,
    grant: LeaseGrant,
    sha256: string,
    content: Uint8Array,
    requestId: string,
  ) {
    return app.inject({
      method: "PUT",
      url: `/api/v1/workspaces/${workspaceId}/objects/${sha256}`,
      headers: {
        ...bearer(token, requestId),
        "content-type": "application/octet-stream",
        "x-ngapd-lease-id": grant.lease.id,
        "x-ngapd-connection-id": grant.lease.connectionId,
        "x-ngapd-lease-token": grant.leaseToken,
      },
      payload: Buffer.from(content),
    });
  }

  function commit(
    workspaceId: string,
    token: string,
    grant: LeaseGrant,
    manifest: WorkspaceManifest,
    baseSyncVersion: number,
    idempotencyKey: string,
    requestId: string,
  ) {
    return request(
      "POST",
      `/api/v1/workspaces/${workspaceId}/commits`,
      token,
      {
        ...leaseBody(grant),
        baseSyncVersion,
        idempotencyKey,
        manifest,
      },
      requestId,
    );
  }
});

interface LeaseGrant {
  lease: {
    id: string;
    connectionId: string;
    baseSyncVersion: number;
  };
  leaseToken: string;
}

const emptyManifest: WorkspaceManifest = {
  hash: createHash("sha256").update("[]").digest("hex"),
  entries: [],
};

const expectedAuditActions = [
  "workspace.lease.acquire",
  "workspace.lease.takeover",
  "workspace.commit",
  "workspace.lease.renew",
  "workspace.lease.release",
  "workspace.conflict.use_local",
  "workspace.conflict.use_server",
];

function bearer(token: string, requestId: string) {
  return {
    authorization: `Bearer ${token}`,
    "x-request-id": requestId,
  };
}

function leaseBody(grant: LeaseGrant) {
  return {
    leaseId: grant.lease.id,
    connectionId: grant.lease.connectionId,
    leaseToken: grant.leaseToken,
  };
}

function renameManifest(manifest: WorkspaceManifest, path: string): WorkspaceManifest {
  const entries = manifest.entries.map((entry, index) =>
    index === 0 ? { ...entry, path } : entry,
  );
  return { hash: hashManifest(entries), entries };
}
