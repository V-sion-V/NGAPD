import { Migrator, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase } from "./client.js";
import { FoundationRepository } from "./foundation-repository.js";
import { IdentityRepository, MAX_PAIRING_ASSOCIATION_ATTEMPTS } from "./identity-repository.js";
import { StaticMigrationProvider } from "./migrations.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const database = connectionString ? createDatabase(connectionString) : null;

describeWithDatabase("workspace foundation PostgreSQL integration", () => {
  const repository = new FoundationRepository(database!);
  const identity = new IdentityRepository(database!);

  beforeAll(async () => {
    await sql`drop schema if exists public cascade`.execute(database!);
    await sql`create schema public`.execute(database!);

    const migrator = new Migrator({
      db: database!,
      provider: new StaticMigrationProvider(),
    });
    const initial = await migrator.migrateTo("0001-system-metadata");
    expect(initial.error).toBeUndefined();
    await database!
      .insertInto("system_metadata")
      .values({ key: "prototype", value: "preserved" })
      .execute();
    const latest = await migrator.migrateToLatest();
    expect(latest.error).toBeUndefined();
  });

  afterAll(async () => {
    await database?.destroy();
  });

  it("preserves system metadata and treats repeated migration as a no-op", async () => {
    const metadata = await database!
      .selectFrom("system_metadata")
      .select(["value"])
      .where("key", "=", "prototype")
      .executeTakeFirstOrThrow();
    expect(metadata.value).toBe("preserved");

    const repeated = await new Migrator({
      db: database!,
      provider: new StaticMigrationProvider(),
    }).migrateToLatest();
    expect(repeated.error).toBeUndefined();
    expect(repeated.results).toEqual([]);
  });

  it("creates one workspace in the same transaction as each scope", async () => {
    const owner = await repository.createUserWithWorkspace({
      id: "00000000-0000-4000-8000-000000000001",
      workspaceId: "10000000-0000-4000-8000-000000000001",
      loginName: "owner",
      normalizedLoginName: "owner",
      passwordHash: "argon2id$fixture",
    });
    const project = await repository.createProjectWithWorkspace({
      id: "20000000-0000-4000-8000-000000000001",
      ownerMembershipId: "30000000-0000-4000-8000-000000000001",
      workspaceId: "40000000-0000-4000-8000-000000000001",
      key: "SYNC",
      name: "Workspace sync",
      ownerUserId: owner.user.id,
    });
    const task = await repository.createTaskWithWorkspace({
      id: "50000000-0000-4000-8000-000000000001",
      workspaceId: "60000000-0000-4000-8000-000000000001",
      projectId: project.project.id,
      key: "SYNC-1",
      title: "Foundation",
      parentTaskId: null,
      explicitOwnerMembershipId: project.ownerMembership.id,
    });

    await expect(repository.findWorkspaceByScope("user", owner.user.id)).resolves.toMatchObject({
      id: owner.workspace.id,
    });
    await expect(
      repository.findWorkspaceByScope("project", project.project.id),
    ).resolves.toMatchObject({ id: project.workspace.id });
    await expect(repository.findWorkspaceByScope("task", task.task.id)).resolves.toMatchObject({
      id: task.workspace.id,
    });
  });

  it("rolls back duplicate and invalid scope creation without orphan workspaces", async () => {
    const attempts = await Promise.allSettled([
      repository.createProjectWithWorkspace({
        id: "20000000-0000-4000-8000-000000000010",
        ownerMembershipId: "30000000-0000-4000-8000-000000000010",
        workspaceId: "40000000-0000-4000-8000-000000000010",
        key: "RACE",
        name: "First",
        ownerUserId: "00000000-0000-4000-8000-000000000001",
      }),
      repository.createProjectWithWorkspace({
        id: "20000000-0000-4000-8000-000000000011",
        ownerMembershipId: "30000000-0000-4000-8000-000000000011",
        workspaceId: "40000000-0000-4000-8000-000000000011",
        key: "RACE",
        name: "Second",
        ownerUserId: "00000000-0000-4000-8000-000000000001",
      }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);

    const orphan = await database!
      .selectFrom("workspaces")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("id", "in", [
        "40000000-0000-4000-8000-000000000010",
        "40000000-0000-4000-8000-000000000011",
      ])
      .executeTakeFirstOrThrow();
    expect(Number(orphan.count)).toBe(1);

    await expect(
      repository.createTaskWithWorkspace({
        id: "50000000-0000-4000-8000-000000000099",
        workspaceId: "60000000-0000-4000-8000-000000000099",
        projectId: "20000000-0000-4000-8000-000000000001",
        key: "SYNC-99",
        title: "Missing owner",
        parentTaskId: null,
        explicitOwnerMembershipId: null,
      }),
    ).rejects.toThrow("TOP_LEVEL_TASK_OWNER_REQUIRED");
    await expect(
      repository.findWorkspaceByScope("task", "50000000-0000-4000-8000-000000000099"),
    ).resolves.toBeUndefined();
  });

  it("makes pairing consumption single-use and revocation transitive", async () => {
    const now = new Date("2026-07-25T03:00:00.000Z");
    const pairing = await identity.createPairingRequest({
      id: "70000000-0000-4000-8000-000000000001",
      codeHash: "code-hash",
      correlationHash: "correlation-hash",
      deviceName: "MacBook",
      platform: "macos",
      expiresAt: new Date("2026-07-25T03:10:00.000Z"),
    });
    await expect(
      identity.decidePairing({
        codeHash: "code-hash",
        userId: "00000000-0000-4000-8000-000000000001",
        decision: "approved",
        requestId: "request-approve",
        now,
      }),
    ).resolves.toMatchObject({ ok: true });

    const consumeInput = {
      pairingId: pairing.id,
      correlationHash: "correlation-hash",
      deviceId: "80000000-0000-4000-8000-000000000001",
      credentialId: "90000000-0000-4000-8000-000000000001",
      credentialHash: "credential-hash",
      accessTokenId: "a0000000-0000-4000-8000-000000000001",
      accessTokenHash: "access-hash",
      accessTokenExpiresAt: new Date("2026-07-25T03:15:00.000Z"),
      requestId: "request-consume",
      now,
    };
    await expect(identity.consumePairing(consumeInput)).resolves.toMatchObject({
      ok: true,
      deviceId: consumeInput.deviceId,
    });
    await expect(identity.consumePairing(consumeInput)).resolves.toEqual({
      ok: false,
      reason: "consumed",
    });
    await expect(
      identity.issueDeviceAccessToken({
        deviceId: consumeInput.deviceId,
        credentialHash: consumeInput.credentialHash,
        accessTokenId: "a0000000-0000-4000-8000-000000000002",
        accessTokenHash: "refreshed-access-hash",
        accessTokenExpiresAt: new Date("2026-07-25T03:16:00.000Z"),
        requestId: "request-access-token",
        now: new Date("2026-07-25T03:01:00.000Z"),
      }),
    ).resolves.toMatchObject({
      ok: true,
      deviceId: consumeInput.deviceId,
    });
    await expect(
      identity.resolveAccessToken("refreshed-access-hash", new Date("2026-07-25T03:02:00.000Z")),
    ).resolves.toMatchObject({ device_id: consumeInput.deviceId });
    await expect(
      identity.revokeDevice({
        deviceId: consumeInput.deviceId,
        userId: "00000000-0000-4000-8000-000000000001",
        requestId: "request-revoke",
        now: new Date("2026-07-25T03:01:00.000Z"),
      }),
    ).resolves.toBe(true);

    const credential = await database!
      .selectFrom("device_credentials")
      .select("revoked_at")
      .where("device_id", "=", consumeInput.deviceId)
      .executeTakeFirstOrThrow();
    const access = await database!
      .selectFrom("device_access_tokens")
      .select("revoked_at")
      .where("device_id", "=", consumeInput.deviceId)
      .executeTakeFirstOrThrow();
    expect(credential.revoked_at).toBeInstanceOf(Date);
    expect(access.revoked_at).toBeInstanceOf(Date);
    await expect(
      identity.issueDeviceAccessToken({
        deviceId: consumeInput.deviceId,
        credentialHash: consumeInput.credentialHash,
        accessTokenHash: "access-after-revoke",
        accessTokenExpiresAt: new Date("2026-07-25T03:20:00.000Z"),
        requestId: "request-access-after-revoke",
        now: new Date("2026-07-25T03:02:00.000Z"),
      }),
    ).resolves.toEqual({ ok: false, reason: "device_revoked" });
    await expect(
      identity.resolveAccessToken("refreshed-access-hash", new Date("2026-07-25T03:02:00.000Z")),
    ).resolves.toBeUndefined();
  });

  it("caps pairing association attempts transactionally", async () => {
    const now = new Date("2026-07-25T03:30:00.000Z");
    const pairing = await identity.createPairingRequest({
      id: "70000000-0000-4000-8000-000000000002",
      codeHash: "attempt-code-hash",
      correlationHash: "expected-correlation-hash",
      deviceName: "Attempt limited MacBook",
      platform: "macos",
      expiresAt: new Date("2026-07-25T03:40:00.000Z"),
    });

    for (let attempt = 1; attempt < MAX_PAIRING_ASSOCIATION_ATTEMPTS; attempt += 1) {
      await expect(
        identity.inspectPairing({
          pairingId: pairing.id,
          correlationHash: `wrong-correlation-hash-${attempt}`,
          requestId: `request-attempt-${attempt}`,
          now,
        }),
      ).resolves.toEqual({ ok: false, reason: "association_mismatch" });
    }
    await expect(
      identity.inspectPairing({
        pairingId: pairing.id,
        correlationHash: "last-wrong-correlation-hash",
        requestId: "request-attempt-limit",
        now,
      }),
    ).resolves.toEqual({ ok: false, reason: "attempts_exceeded" });
    await expect(
      identity.inspectPairing({
        pairingId: pairing.id,
        correlationHash: "expected-correlation-hash",
        requestId: "request-after-attempt-limit",
        now,
      }),
    ).resolves.toEqual({ ok: false, reason: "attempts_exceeded" });
    await expect(
      identity.decidePairing({
        codeHash: "attempt-code-hash",
        userId: "00000000-0000-4000-8000-000000000001",
        decision: "approved",
        requestId: "request-approve-after-limit",
        now,
      }),
    ).resolves.toEqual({ ok: false, reason: "attempts_exceeded" });

    const locked = await database!
      .selectFrom("pairing_requests")
      .select(["status", "attempts"])
      .where("id", "=", pairing.id)
      .executeTakeFirstOrThrow();
    expect(locked).toEqual({
      status: "revoked",
      attempts: MAX_PAIRING_ASSOCIATION_ATTEMPTS,
    });
  });
});
