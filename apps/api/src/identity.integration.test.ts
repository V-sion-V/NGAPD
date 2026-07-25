import { randomUUID } from "node:crypto";

import { createDatabase, MAX_PAIRING_ASSOCIATION_ATTEMPTS, migrateToLatest } from "@ngapd/database";
import type { ObjectStore } from "@ngapd/object-store";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const database = connectionString ? createDatabase(connectionString) : null;
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
const publicOrigin = "https://ngapd.local";
let now = new Date("2026-07-25T04:00:00.000Z");
const runId = randomUUID().slice(0, 8);
const login = (label: string) => `api-${runId}-${label}`;
const unusedObjectStore: ObjectStore = {
  putVerified: () => Promise.reject(new Error("UNUSED_OBJECT_STORE")),
  hasVerified: () => Promise.resolve(false),
  readVerified: () => Promise.reject(new Error("UNUSED_OBJECT_STORE")),
};

describeWithDatabase("identity and pairing API", () => {
  beforeAll(async () => {
    await migrateToLatest(database!);
  });

  beforeEach(() => {
    now = new Date("2026-07-25T04:00:00.000Z");
  });

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  afterAll(async () => {
    await database?.destroy();
  });

  it("registers with Argon2id, an atomic user workspace and a secure cookie", async () => {
    const app = await createApp();
    const rejected = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { origin: "https://untrusted.example", "x-request-id": "request-origin" },
      payload: { loginName: "alice", password: "correct horse battery" },
    });
    expect(rejected.statusCode).toBe(403);
    expect(rejected.json()).toMatchObject({
      code: "ORIGIN_NOT_ALLOWED",
      requestId: "request-origin",
    });

    const loginName = login("alice");
    const response = await register(app, loginName, "correct horse battery", "request-register");
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ loginName });
    expect(response.headers["set-cookie"]).toEqual(
      expect.stringMatching(/HttpOnly; Secure; SameSite=Strict/),
    );

    const user = await database!
      .selectFrom("users")
      .select(["id", "password_hash"])
      .where("normalized_login_name", "=", loginName)
      .executeTakeFirstOrThrow();
    expect(user.password_hash).toMatch(/^argon2id\$v=19\$/);
    expect(user.password_hash).not.toContain("correct horse battery");
    const workspace = await database!
      .selectFrom("workspaces")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("scope_type", "=", "user")
      .where("scope_id", "=", user.id)
      .executeTakeFirstOrThrow();
    expect(Number(workspace.count)).toBe(1);

    const duplicate = await register(
      app,
      loginName.toUpperCase(),
      "another correct password",
      "request-duplicate",
    );
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({
      code: "LOGIN_NAME_TAKEN",
      requestId: "request-duplicate",
    });
  });

  it("uses revocable sessions and generic authentication failures", async () => {
    const app = await createApp();
    const loginName = login("bob");
    await register(app, loginName, "correct horse battery", "request-bob-register");

    const wrong = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin: publicOrigin },
      payload: { loginName, password: "totally wrong password" },
    });
    const missing = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin: publicOrigin },
      payload: { loginName: login("missing"), password: "totally wrong password" },
    });
    expect(wrong.statusCode).toBe(401);
    expect(missing.statusCode).toBe(401);
    expect(wrong.json().message).toBe(missing.json().message);

    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin: publicOrigin },
      payload: { loginName, password: "correct horse battery" },
    });
    const cookie = sessionCookie(loginResponse);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/auth/session",
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/logout",
          headers: { cookie, origin: publicOrigin },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/auth/session",
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(401);
  });

  it("pairs once, rejects wrong association, revokes the device and keeps secrets out of audit", async () => {
    const app = await createApp();
    const registration = await register(
      app,
      login("carol"),
      "correct horse battery",
      "request-carol-register",
    );
    const cookie = sessionCookie(registration);
    const correlationSecret = "correlation-secret-that-stays-with-cli";
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/pairing/requests",
      headers: { "x-request-id": "request-pairing-create" },
      payload: {
        deviceName: "Carol MacBook",
        platform: "macos",
        correlationSecret,
      },
    });
    expect(created.statusCode).toBe(201);
    const pairing = created.json<{ pairingId: string; code: string }>();

    const pending = await app.inject({
      method: "POST",
      url: `/api/v1/pairing/requests/${pairing.pairingId}/status`,
      headers: { "x-request-id": "request-pairing-status-pending" },
      payload: { correlationSecret },
    });
    expect(pending.statusCode).toBe(200);
    expect(pending.json()).toMatchObject({ pairingId: pairing.pairingId, status: "pending" });

    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/pairing/requests/${pairing.code}`,
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/v1/pairing/requests/${pairing.code}/decision`,
          headers: { cookie, origin: "https://untrusted.example" },
          payload: { decision: "approve" },
        })
      ).statusCode,
    ).toBe(403);
    const approved = await app.inject({
      method: "POST",
      url: `/api/v1/pairing/requests/${pairing.code}/decision`,
      headers: { cookie, origin: publicOrigin, "x-request-id": "request-pairing-approve" },
      payload: { decision: "approve" },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({ status: "approved" });
    const approvedStatus = await app.inject({
      method: "POST",
      url: `/api/v1/pairing/requests/${pairing.pairingId}/status`,
      payload: { correlationSecret },
    });
    expect(approvedStatus.statusCode).toBe(200);
    expect(approvedStatus.json()).toMatchObject({ status: "approved" });

    const mismatch = await app.inject({
      method: "POST",
      url: `/api/v1/pairing/requests/${pairing.pairingId}/consume`,
      payload: { correlationSecret: "wrong-correlation-secret-value-0000" },
    });
    expect(mismatch.statusCode).toBe(403);
    expect(mismatch.json()).toMatchObject({ code: "PAIRING_ASSOCIATION_MISMATCH" });

    const consumed = await app.inject({
      method: "POST",
      url: `/api/v1/pairing/requests/${pairing.pairingId}/consume`,
      headers: { "x-request-id": "request-pairing-consume" },
      payload: { correlationSecret },
    });
    expect(consumed.statusCode).toBe(200);
    const credential = consumed.json<{
      deviceId: string;
      accessToken: string;
      deviceCredential: string;
    }>();
    expect(credential.accessToken).not.toBe(credential.deviceCredential);
    const refreshed = await app.inject({
      method: "POST",
      url: "/api/v1/device-access-tokens",
      headers: { "x-request-id": "request-device-access-token" },
      payload: {
        deviceId: credential.deviceId,
        deviceCredential: credential.deviceCredential,
      },
    });
    expect(refreshed.statusCode).toBe(201);
    const refreshedAccess = refreshed.json<{
      deviceId: string;
      accessToken: string;
      accessTokenExpiresAt: string;
    }>();
    expect(refreshedAccess).toMatchObject({ deviceId: credential.deviceId });
    expect(refreshedAccess.accessToken).not.toBe(credential.accessToken);
    expect(new Date(refreshedAccess.accessTokenExpiresAt).getTime() - now.getTime()).toBe(
      15 * 60 * 1_000,
    );
    const invalidCredential = await app.inject({
      method: "POST",
      url: "/api/v1/device-access-tokens",
      headers: { "x-request-id": "request-invalid-device-credential" },
      payload: {
        deviceId: credential.deviceId,
        deviceCredential: "invalid-device-credential-value-000000",
      },
    });
    expect(invalidCredential.statusCode).toBe(401);
    expect(invalidCredential.json()).toMatchObject({
      code: "DEVICE_CREDENTIAL_INVALID",
      requestId: "request-invalid-device-credential",
    });
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/v1/pairing/requests/${pairing.pairingId}/consume`,
          payload: { correlationSecret },
        })
      ).statusCode,
    ).toBe(409);

    const devices = await app.inject({
      method: "GET",
      url: "/api/v1/devices",
      headers: { cookie },
    });
    expect(devices.json()).toMatchObject({
      devices: [{ id: credential.deviceId, revokedAt: null }],
    });
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/v1/devices/${credential.deviceId}/revoke`,
          headers: { cookie, origin: publicOrigin, "x-request-id": "request-device-revoke" },
        })
      ).statusCode,
    ).toBe(200);
    const revokedExchange = await app.inject({
      method: "POST",
      url: "/api/v1/device-access-tokens",
      payload: {
        deviceId: credential.deviceId,
        deviceCredential: credential.deviceCredential,
      },
    });
    expect(revokedExchange.statusCode).toBe(403);
    expect(revokedExchange.json()).toMatchObject({ code: "DEVICE_REVOKED" });

    const audit = await database!
      .selectFrom("audit_events")
      .select(["action", "metadata"])
      .orderBy("created_at")
      .execute();
    const serializedAudit = JSON.stringify(audit);
    expect(serializedAudit).not.toContain(correlationSecret);
    expect(serializedAudit).not.toContain(credential.accessToken);
    expect(serializedAudit).not.toContain(credential.deviceCredential);
    expect(serializedAudit).not.toContain(refreshedAccess.accessToken);
    expect(audit.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "pairing.decision",
        "pairing.consume",
        "device.access_token.issue",
        "device.revoke",
      ]),
    );
  });

  it("refreshes after access-token expiry and revokes the current device with Bearer auth", async () => {
    const app = await createApp();
    const registration = await register(
      app,
      login("erin"),
      "correct horse battery",
      "request-erin-register",
    );
    const credential = await pairDevice(app, sessionCookie(registration), "Erin MacBook", "erin");

    now = new Date("2026-07-25T04:16:00.000Z");
    const expiredBearer = await app.inject({
      method: "POST",
      url: "/api/v1/devices/current/revoke",
      headers: { authorization: `Bearer ${credential.accessToken}` },
    });
    expect(expiredBearer.statusCode).toBe(401);

    const refreshed = await app.inject({
      method: "POST",
      url: "/api/v1/device-access-tokens",
      payload: {
        deviceId: credential.deviceId,
        deviceCredential: credential.deviceCredential,
      },
    });
    expect(refreshed.statusCode).toBe(201);
    const refreshedAccessToken = refreshed.json<{ accessToken: string }>().accessToken;
    const owner = await database!
      .selectFrom("devices")
      .select("user_id")
      .where("id", "=", credential.deviceId)
      .executeTakeFirstOrThrow();
    const workspace = await database!
      .selectFrom("workspaces")
      .select("id")
      .where("scope_type", "=", "user")
      .where("scope_id", "=", owner.user_id)
      .executeTakeFirstOrThrow();
    const connectionId = randomUUID();
    const acquired = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspace.id}/lease/acquire`,
      headers: { authorization: `Bearer ${refreshedAccessToken}` },
      payload: { connectionId, baseSyncVersion: 0 },
    });
    expect(acquired.statusCode).toBe(201);
    const grant = acquired.json<{ lease: { id: string }; leaseToken: string }>();

    const revoked = await app.inject({
      method: "POST",
      url: "/api/v1/devices/current/revoke",
      headers: {
        authorization: `Bearer ${refreshedAccessToken}`,
        "x-request-id": "request-current-device-revoke",
      },
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json()).toEqual({ ok: true });

    const rejectedRefresh = await app.inject({
      method: "POST",
      url: "/api/v1/device-access-tokens",
      payload: {
        deviceId: credential.deviceId,
        deviceCredential: credential.deviceCredential,
      },
    });
    expect(rejectedRefresh.statusCode).toBe(403);
    expect(rejectedRefresh.json()).toMatchObject({ code: "DEVICE_REVOKED" });
    const revokedToken = await app.inject({
      method: "POST",
      url: "/api/v1/devices/current/revoke",
      headers: { authorization: `Bearer ${refreshedAccessToken}` },
    });
    expect(revokedToken.statusCode).toBe(401);
    const revokedLease = {
      leaseId: grant.lease.id,
      connectionId,
      leaseToken: grant.leaseToken,
    };
    const [rejectedRenew, rejectedCommit] = await Promise.all([
      app.inject({
        method: "POST",
        url: `/api/v1/workspaces/${workspace.id}/lease/renew`,
        headers: { authorization: `Bearer ${refreshedAccessToken}` },
        payload: revokedLease,
      }),
      app.inject({
        method: "POST",
        url: `/api/v1/workspaces/${workspace.id}/commits`,
        headers: { authorization: `Bearer ${refreshedAccessToken}` },
        payload: {
          ...revokedLease,
          baseSyncVersion: 0,
          idempotencyKey: "revoked-device-commit",
          manifest: { hash: "0".repeat(64), entries: [] },
        },
      }),
    ]);
    expect(rejectedRenew.statusCode).toBe(401);
    expect(rejectedCommit.statusCode).toBe(401);
  });

  it("serializes pairing consumption and locks requests after the association limit", async () => {
    const app = await createApp();
    const registration = await register(
      app,
      login("frank"),
      "correct horse battery",
      "request-frank-register",
    );
    const cookie = sessionCookie(registration);

    const concurrentSecret = "concurrent-correlation-secret-value";
    const concurrent = await createPairing(app, "Concurrent Mac", concurrentSecret);
    await approvePairing(app, cookie, concurrent.code, "request-concurrent-approve");
    const consumeResponses = await Promise.all([
      app.inject({
        method: "POST",
        url: `/api/v1/pairing/requests/${concurrent.pairingId}/consume`,
        payload: { correlationSecret: concurrentSecret },
      }),
      app.inject({
        method: "POST",
        url: `/api/v1/pairing/requests/${concurrent.pairingId}/consume`,
        payload: { correlationSecret: concurrentSecret },
      }),
    ]);
    expect(consumeResponses.map((response) => response.statusCode).sort()).toEqual([200, 409]);

    const lockedSecret = "locked-correlation-secret-value-000";
    const locked = await createPairing(app, "Locked Mac", lockedSecret);
    for (let attempt = 1; attempt < MAX_PAIRING_ASSOCIATION_ATTEMPTS; attempt += 1) {
      const mismatch = await app.inject({
        method: "POST",
        url: `/api/v1/pairing/requests/${locked.pairingId}/status`,
        headers: { "x-request-id": `request-association-${attempt}` },
        payload: { correlationSecret: `wrong-correlation-secret-value-${attempt}` },
      });
      expect(mismatch.statusCode).toBe(403);
      expect(mismatch.json()).toMatchObject({ code: "PAIRING_ASSOCIATION_MISMATCH" });
    }
    const exceeded = await app.inject({
      method: "POST",
      url: `/api/v1/pairing/requests/${locked.pairingId}/status`,
      headers: { "x-request-id": "request-association-limit" },
      payload: { correlationSecret: "last-wrong-correlation-secret-value" },
    });
    expect(exceeded.statusCode).toBe(429);
    expect(exceeded.json()).toMatchObject({
      code: "PAIRING_ATTEMPTS_EXCEEDED",
      requestId: "request-association-limit",
    });
    const correctAfterLimit = await app.inject({
      method: "POST",
      url: `/api/v1/pairing/requests/${locked.pairingId}/status`,
      payload: { correlationSecret: lockedSecret },
    });
    expect(correctAfterLimit.statusCode).toBe(429);
    const approvalAfterLimit = await approvePairing(
      app,
      cookie,
      locked.code,
      "request-approve-after-limit",
    );
    expect(approvalAfterLimit.statusCode).toBe(429);
    expect(approvalAfterLimit.json()).toMatchObject({
      code: "PAIRING_ATTEMPTS_EXCEEDED",
    });
  });

  it("expires requests by server time and publishes the identity routes in OpenAPI", async () => {
    const app = await createApp();
    const registration = await register(
      app,
      login("dora"),
      "correct horse battery",
      "request-dora-register",
    );
    const cookie = sessionCookie(registration);
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/pairing/requests",
      payload: {
        deviceName: "Expiring Mac",
        platform: "macos",
        correlationSecret: "correlation-secret-for-expiry-test",
      },
    });
    const pairing = created.json<{ pairingId: string; code: string }>();
    now = new Date("2026-07-25T04:11:00.000Z");
    const cliStatus = await app.inject({
      method: "POST",
      url: `/api/v1/pairing/requests/${pairing.pairingId}/status`,
      payload: { correlationSecret: "correlation-secret-for-expiry-test" },
    });
    expect(cliStatus.statusCode).toBe(200);
    expect(cliStatus.json()).toMatchObject({ status: "expired" });
    const expired = await app.inject({
      method: "POST",
      url: `/api/v1/pairing/requests/${pairing.code}/decision`,
      headers: { cookie, origin: publicOrigin, "x-request-id": "request-expired" },
      payload: { decision: "approve" },
    });
    expect(expired.statusCode).toBe(410);
    expect(expired.json()).toMatchObject({
      code: "PAIRING_EXPIRED",
      requestId: "request-expired",
    });

    const openapi = app.swagger() as { paths: Record<string, unknown> };
    expect(openapi.paths).toHaveProperty("/api/v1/auth/register");
    expect(openapi.paths).toHaveProperty("/api/v1/pairing/requests/{code}/decision");
    expect(openapi.paths).toHaveProperty("/api/v1/pairing/requests/{pairingId}/status");
    expect(openapi.paths).toHaveProperty("/api/v1/device-access-tokens");
    expect(openapi.paths).toHaveProperty("/api/v1/devices/{deviceId}/revoke");
    expect(openapi.paths).toHaveProperty("/api/v1/devices/current/revoke");
  });
});

async function createApp() {
  const app = await buildApp({
    database: database!,
    databaseCheck: async () => true,
    publicOrigin,
    now: () => now,
    objectStore: unusedObjectStore,
  });
  apps.push(app);
  return app;
}

async function createPairing(
  app: Awaited<ReturnType<typeof buildApp>>,
  deviceName: string,
  correlationSecret: string,
) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/pairing/requests",
    payload: {
      deviceName,
      platform: "macos",
      correlationSecret,
    },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ pairingId: string; code: string }>();
}

function approvePairing(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookie: string,
  code: string,
  requestId: string,
) {
  return app.inject({
    method: "POST",
    url: `/api/v1/pairing/requests/${code}/decision`,
    headers: { cookie, origin: publicOrigin, "x-request-id": requestId },
    payload: { decision: "approve" },
  });
}

async function pairDevice(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookie: string,
  deviceName: string,
  label: string,
) {
  const correlationSecret = `pair-device-correlation-secret-${label}-000000`;
  const pairing = await createPairing(app, deviceName, correlationSecret);
  const approved = await approvePairing(app, cookie, pairing.code, `request-${label}-approve`);
  expect(approved.statusCode).toBe(200);
  const consumed = await app.inject({
    method: "POST",
    url: `/api/v1/pairing/requests/${pairing.pairingId}/consume`,
    payload: { correlationSecret },
  });
  expect(consumed.statusCode).toBe(200);
  return consumed.json<{
    deviceId: string;
    accessToken: string;
    deviceCredential: string;
  }>();
}

function register(
  app: Awaited<ReturnType<typeof buildApp>>,
  loginName: string,
  password: string,
  requestId: string,
) {
  return app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    headers: { origin: publicOrigin, "x-request-id": requestId },
    payload: { loginName, password },
  });
}

function sessionCookie(response: Awaited<ReturnType<typeof register>>): string {
  const setCookie = response.headers["set-cookie"];
  if (typeof setCookie !== "string") {
    throw new Error("Missing session cookie");
  }
  return setCookie.split(";", 1)[0]!;
}
