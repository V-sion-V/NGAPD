import { createHash } from "node:crypto";

import { Migrator, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase } from "./client.js";
import { FoundationRepository } from "./foundation-repository.js";
import { StaticMigrationProvider } from "./migrations.js";
import { WorkspaceRepository } from "./workspace-repository.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const database = connectionString ? createDatabase(connectionString) : null;
const EMPTY_MANIFEST_HASH = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";

describeWithDatabase("workspace sync PostgreSQL integration", () => {
  const foundation = new FoundationRepository(database!);
  const repository = new WorkspaceRepository(database!);

  beforeAll(async () => {
    await sql`drop schema if exists public cascade`.execute(database!);
    await sql`create schema public`.execute(database!);

    const migrator = new Migrator({
      db: database!,
      provider: new StaticMigrationProvider(),
    });
    const p1 = await migrator.migrateTo("0002-workspace-foundation");
    expect(p1.error).toBeUndefined();
    await database!
      .insertInto("system_metadata")
      .values({ key: "p002-upgrade", value: "preserved" })
      .execute();
    await database!
      .insertInto("users")
      .values({
        id: "01000000-0000-4000-8000-000000000001",
        login_name: "upgrade",
        normalized_login_name: "upgrade",
        password_hash: "argon2id$upgrade",
      })
      .execute();
    await database!
      .insertInto("workspaces")
      .values({
        id: "11000000-0000-4000-8000-000000000001",
        scope_type: "user",
        scope_id: "01000000-0000-4000-8000-000000000001",
      })
      .execute();

    const latest = await migrator.migrateToLatest();
    expect(latest.error).toBeUndefined();
  });

  afterAll(async () => {
    await database?.destroy();
  });

  it("upgrades P-001 data with one empty version and remains a migration no-op", async () => {
    const metadata = await database!
      .selectFrom("system_metadata")
      .select("value")
      .where("key", "=", "p002-upgrade")
      .executeTakeFirstOrThrow();
    expect(metadata.value).toBe("preserved");

    await expect(
      repository.getVersion("11000000-0000-4000-8000-000000000001"),
    ).resolves.toMatchObject({
      syncVersion: 0,
      manifestSha256: EMPTY_MANIFEST_HASH,
      entries: [],
    });

    const repeated = await new Migrator({
      db: database!,
      provider: new StaticMigrationProvider(),
    }).migrateToLatest();
    expect(repeated.error).toBeUndefined();
    expect(repeated.results).toEqual([]);

    const created = await foundation.createUserWithWorkspace({
      id: "01000000-0000-4000-8000-000000000002",
      workspaceId: "11000000-0000-4000-8000-000000000002",
      loginName: "created-after-upgrade",
      normalizedLoginName: "created-after-upgrade",
      passwordHash: "argon2id$created",
    });
    await expect(repository.getVersion(created.workspace.id)).resolves.toMatchObject({
      syncVersion: 0,
      manifestSha256: EMPTY_MANIFEST_HASH,
    });
  });

  it("serializes lease acquisition, takeover and late holder rejection", async () => {
    const userId = "01000000-0000-4000-8000-000000000010";
    const workspaceId = "11000000-0000-4000-8000-000000000010";
    await foundation.createUserWithWorkspace({
      id: userId,
      workspaceId,
      loginName: "lease-owner",
      normalizedLoginName: "lease-owner",
      passwordHash: "argon2id$lease",
    });
    await database!
      .insertInto("devices")
      .values([
        {
          id: "21000000-0000-4000-8000-000000000010",
          user_id: userId,
          name: "first",
          platform: "macos",
        },
        {
          id: "21000000-0000-4000-8000-000000000011",
          user_id: userId,
          name: "second",
          platform: "windows",
        },
      ])
      .execute();
    const now = new Date("2026-07-25T04:00:00.000Z");
    const attempts = await Promise.all([
      repository.withLockedWorkspace(workspaceId, userId, (unit) =>
        unit.acquireLease({
          id: "31000000-0000-4000-8000-000000000010",
          userId,
          deviceId: "21000000-0000-4000-8000-000000000010",
          connectionId: "41000000-0000-4000-8000-000000000010",
          tokenHash: "token-first",
          baseSyncVersion: 0,
          now,
          expiresAt: new Date("2026-07-25T04:01:00.000Z"),
          requestId: "request-acquire-first",
        }),
      ),
      repository.withLockedWorkspace(workspaceId, userId, (unit) =>
        unit.acquireLease({
          id: "31000000-0000-4000-8000-000000000011",
          userId,
          deviceId: "21000000-0000-4000-8000-000000000011",
          connectionId: "41000000-0000-4000-8000-000000000011",
          tokenHash: "token-second",
          baseSyncVersion: 0,
          now,
          expiresAt: new Date("2026-07-25T04:01:00.000Z"),
          requestId: "request-acquire-second",
        }),
      ),
    ]);
    expect(attempts.filter((result) => result?.ok)).toHaveLength(1);
    expect(attempts.filter((result) => result && !result.ok)).toEqual([
      { ok: false, reason: "lease_conflict" },
    ]);

    const takeover = await repository.withLockedWorkspace(workspaceId, userId, (unit) =>
      unit.takeoverLease({
        id: "31000000-0000-4000-8000-000000000012",
        userId,
        deviceId: "21000000-0000-4000-8000-000000000011",
        connectionId: "41000000-0000-4000-8000-000000000011",
        tokenHash: "token-takeover",
        now: new Date("2026-07-25T04:00:10.000Z"),
        expiresAt: new Date("2026-07-25T04:01:10.000Z"),
        requestId: "request-takeover",
      }),
    );
    expect(takeover?.previousLeaseId).not.toBeNull();

    const late = await repository.withLockedWorkspace(workspaceId, userId, (unit) =>
      unit.releaseLease({
        leaseId: takeover!.previousLeaseId!,
        userId,
        deviceId: "21000000-0000-4000-8000-000000000010",
        connectionId: "41000000-0000-4000-8000-000000000010",
        tokenHash: "token-first",
        now: new Date("2026-07-25T04:00:20.000Z"),
        requestId: "request-late-release",
      }),
    );
    expect(late).toEqual({ ok: false, reason: "lease_revoked" });

    const activeCount = await database!
      .selectFrom("workspace_leases")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("workspace_id", "=", workspaceId)
      .where("revoked_at", "is", null)
      .executeTakeFirstOrThrow();
    expect(Number(activeCount.count)).toBe(1);
  });

  it("commits one immutable version and makes retries safe", async () => {
    const userId = "01000000-0000-4000-8000-000000000020";
    const workspaceId = "11000000-0000-4000-8000-000000000020";
    const deviceId = "21000000-0000-4000-8000-000000000020";
    const connectionId = "41000000-0000-4000-8000-000000000020";
    await foundation.createUserWithWorkspace({
      id: userId,
      workspaceId,
      loginName: "commit-owner",
      normalizedLoginName: "commit-owner",
      passwordHash: "argon2id$commit",
    });
    await database!
      .insertInto("devices")
      .values({ id: deviceId, user_id: userId, name: "commit", platform: "macos" })
      .execute();
    const content = Buffer.from("workspace object");
    const sha256 = createHash("sha256").update(content).digest("hex");
    await repository.registerVerifiedObject({
      sha256,
      size: content.length,
      storageKey: `${sha256.slice(0, 2)}/${sha256}`,
      verifiedAt: new Date("2026-07-25T04:10:00.000Z"),
    });
    const lease = await repository.withLockedWorkspace(workspaceId, userId, (unit) =>
      unit.acquireLease({
        id: "31000000-0000-4000-8000-000000000020",
        userId,
        deviceId,
        connectionId,
        tokenHash: "commit-token",
        baseSyncVersion: 0,
        now: new Date("2026-07-25T04:10:00.000Z"),
        expiresAt: new Date("2026-07-25T04:11:00.000Z"),
        requestId: "request-acquire-commit",
      }),
    );
    expect(lease?.ok).toBe(true);

    const entries = [
      { path: "notes/sync.txt", kind: "file" as const, size: content.length, sha256 },
    ];
    const manifestSha256 = createHash("sha256").update(JSON.stringify(entries)).digest("hex");
    const commitInput = {
      operation: "commit" as const,
      idempotencyKey: "commit-key-0001",
      requestSha256: createHash("sha256").update("request-one").digest("hex"),
      manifestSha256,
      entries,
      leaseId: "31000000-0000-4000-8000-000000000020",
      userId,
      deviceId,
      connectionId,
      tokenHash: "commit-token",
      baseSyncVersion: 0,
      now: new Date("2026-07-25T04:10:10.000Z"),
      requestId: "request-commit",
      auditAction: "workspace.commit" as const,
    };
    const committed = await repository.withLockedWorkspace(workspaceId, userId, (unit) =>
      unit.commit(commitInput),
    );
    expect(committed).toEqual({
      ok: true,
      syncVersion: 1,
      manifestSha256,
      idempotentReplay: false,
    });
    const replayed = await repository.withLockedWorkspace(workspaceId, userId, (unit) =>
      unit.commit({ ...commitInput, now: new Date("2026-07-25T04:12:00.000Z") }),
    );
    expect(replayed).toEqual({
      ok: true,
      syncVersion: 1,
      manifestSha256,
      idempotentReplay: true,
    });
    const changedKey = await repository.withLockedWorkspace(workspaceId, userId, (unit) =>
      unit.commit({
        ...commitInput,
        requestSha256: createHash("sha256").update("different").digest("hex"),
      }),
    );
    expect(changedKey).toEqual({ ok: false, reason: "idempotency_conflict" });

    const versionCount = await database!
      .selectFrom("workspace_versions")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("workspace_id", "=", workspaceId)
      .executeTakeFirstOrThrow();
    expect(Number(versionCount.count)).toBe(2);
    await expect(new WorkspaceRepository(database!).getVersion(workspaceId)).resolves.toMatchObject(
      {
        syncVersion: 1,
        manifestSha256,
        entries,
      },
    );
  });

  it("does not expose a half-version for missing or mismatched objects", async () => {
    const userId = "01000000-0000-4000-8000-000000000030";
    const workspaceId = "11000000-0000-4000-8000-000000000030";
    const deviceId = "21000000-0000-4000-8000-000000000030";
    const connectionId = "41000000-0000-4000-8000-000000000030";
    await foundation.createUserWithWorkspace({
      id: userId,
      workspaceId,
      loginName: "rollback-owner",
      normalizedLoginName: "rollback-owner",
      passwordHash: "argon2id$rollback",
    });
    await database!
      .insertInto("devices")
      .values({ id: deviceId, user_id: userId, name: "rollback", platform: "macos" })
      .execute();
    await repository.withLockedWorkspace(workspaceId, userId, (unit) =>
      unit.acquireLease({
        id: "31000000-0000-4000-8000-000000000030",
        userId,
        deviceId,
        connectionId,
        tokenHash: "rollback-token",
        baseSyncVersion: 0,
        now: new Date("2026-07-25T04:20:00.000Z"),
        expiresAt: new Date("2026-07-25T04:21:00.000Z"),
        requestId: "request-acquire-rollback",
      }),
    );
    const rollbackHash = "a".repeat(64);
    await repository.registerVerifiedObject({
      sha256: rollbackHash,
      size: 12,
      storageKey: `aa/${rollbackHash}`,
      verifiedAt: new Date("2026-07-25T04:20:05.000Z"),
    });
    await expect(
      repository.withLockedWorkspace(workspaceId, userId, (unit) =>
        unit.commit({
          operation: "commit",
          idempotencyKey: "rollback-key-0001",
          requestSha256: "b".repeat(64),
          manifestSha256: "c".repeat(64),
          entries: [{ path: "rollback.bin", kind: "file", size: 12, sha256: rollbackHash }],
          leaseId: "31000000-0000-4000-8000-000000000030",
          userId,
          deviceId,
          connectionId,
          tokenHash: "rollback-token",
          baseSyncVersion: 0,
          now: new Date("2026-07-25T04:20:06.000Z"),
          requestId: "r".repeat(129),
          auditAction: "workspace.commit",
        }),
      ),
    ).rejects.toBeDefined();
    await expect(repository.getVersion(workspaceId)).resolves.toMatchObject({
      syncVersion: 0,
      manifestSha256: EMPTY_MANIFEST_HASH,
    });

    const missingHash = "f".repeat(64);
    const result = await repository.withLockedWorkspace(workspaceId, userId, (unit) =>
      unit.commit({
        operation: "commit",
        idempotencyKey: "missing-key-0001",
        requestSha256: "e".repeat(64),
        manifestSha256: "d".repeat(64),
        entries: [{ path: "missing.bin", kind: "file", size: 12, sha256: missingHash }],
        leaseId: "31000000-0000-4000-8000-000000000030",
        userId,
        deviceId,
        connectionId,
        tokenHash: "rollback-token",
        baseSyncVersion: 0,
        now: new Date("2026-07-25T04:20:10.000Z"),
        requestId: "request-missing",
        auditAction: "workspace.commit",
      }),
    );
    expect(result).toEqual({ ok: false, reason: "object_not_found" });
    await expect(repository.getVersion(workspaceId)).resolves.toMatchObject({
      syncVersion: 0,
      manifestSha256: EMPTY_MANIFEST_HASH,
    });
  });
});
