import { createHash } from "node:crypto";

import {
  EventRepository,
  FoundationRepository,
  IdentityRepository,
  OutboxRepository,
  canonicalDatabaseTarget,
  createDatabase,
  migrateToLatest,
  resetFormalSchema,
} from "@ngapd/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const database = connectionString ? createDatabase(connectionString) : null;
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

const ownerId = "41000000-0000-4000-8000-000000000001";
const projectId = "42000000-0000-4000-8000-000000000001";
const otherOwnerId = "41000000-0000-4000-8000-000000000002";
const otherProjectId = "42000000-0000-4000-8000-000000000002";
const ownerToken = "owner-event-session-token";
const otherToken = "other-event-session-token";

describeWithDatabase("authenticated SSE invalidation integration", () => {
  beforeAll(async () => {
    const target = canonicalDatabaseTarget(connectionString!);
    await resetFormalSchema({ database: database!, target, confirmation: target });
    await migrateToLatest(database!);
    const foundation = new FoundationRepository(database!);
    await seedProject(foundation, {
      ownerId,
      projectId,
      membershipId: "43000000-0000-4000-8000-000000000001",
      userWorkspaceId: "44000000-0000-4000-8000-000000000001",
      projectWorkspaceId: "45000000-0000-4000-8000-000000000001",
      login: "event-owner",
      key: "EVTA",
    });
    await seedProject(foundation, {
      ownerId: otherOwnerId,
      projectId: otherProjectId,
      membershipId: "43000000-0000-4000-8000-000000000002",
      userWorkspaceId: "44000000-0000-4000-8000-000000000002",
      projectWorkspaceId: "45000000-0000-4000-8000-000000000002",
      login: "other-event-owner",
      key: "EVTB",
    });

    const identity = new IdentityRepository(database!);
    await identity.createSession({
      id: "46000000-0000-4000-8000-000000000001",
      tokenHash: hash(ownerToken),
      userId: ownerId,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });
    await identity.createSession({
      id: "46000000-0000-4000-8000-000000000002",
      tokenHash: hash(otherToken),
      userId: otherOwnerId,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });

    await database!
      .insertInto("outbox_events")
      .values([
        {
          id: "47000000-0000-4000-8000-000000000001",
          project_id: projectId,
          aggregate_type: "task",
          aggregate_id: "48000000-0000-4000-8000-000000000001",
          event_type: "task.updated",
          request_id: "owner-event-request",
          payload: { title: "must not leave the server", credential: "fixture-secret" },
        },
        {
          id: "47000000-0000-4000-8000-000000000002",
          project_id: otherProjectId,
          aggregate_type: "task",
          aggregate_id: "48000000-0000-4000-8000-000000000002",
          event_type: "task.updated",
          request_id: "other-event-request",
          payload: { title: "other tenant title" },
        },
      ])
      .execute();
    const outbox = new OutboxRepository(database!);
    await outbox.dispatchNext({ now: new Date("2099-01-01T00:00:00.000Z") });
    await outbox.dispatchNext({ now: new Date("2099-01-01T00:00:00.000Z") });

    apps.push(
      await buildApp({
        database: database!,
        databaseCheck: async () => true,
        eventStreamDurationMs: 0,
        now: () => new Date("2026-07-27T00:00:00.000Z"),
      }),
    );
  });

  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close()));
    await database?.destroy();
  });

  it("requires authentication and exposes the additive SSE route in OpenAPI", async () => {
    const unauthorized = await apps[0]!.inject({ method: "GET", url: "/api/v1/events" });
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.json()).toMatchObject({ code: "AUTHENTICATION_REQUIRED" });

    const openapi = apps[0]!.swagger();
    expect(openapi.openapi).toBe("3.1.0");
    expect(openapi.paths).toHaveProperty("/api/v1/events");
    expect(
      Object.keys(openapi.paths ?? {}).filter((path) => path.startsWith("/api/v1/tasks")),
    ).toEqual([]);
  });

  it("filters by server membership and emits only invalidation metadata", async () => {
    const response = await apps[0]!.inject({
      method: "GET",
      url: "/api/v1/events",
      headers: { cookie: `ngapd_session=${ownerToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.body).toContain("event: resource-invalidated");
    expect(response.body).toContain(`"projectId":"${projectId}"`);
    expect(response.body).not.toContain(otherProjectId);
    expect(response.body).not.toMatch(
      /must not leave|credential|fixture-secret|other tenant title/u,
    );

    const cursor = /^id: ([0-9]+)$/mu.exec(response.body)?.[1];
    expect(cursor).toBeDefined();
    const replay = await apps[0]!.inject({
      method: "GET",
      url: "/api/v1/events",
      headers: {
        cookie: `ngapd_session=${ownerToken}`,
        "last-event-id": cursor!,
      },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.body).toBe("");
  });

  it("reports expired cursors before opening the stream", async () => {
    const visible = await new EventRepository(database!).readAuthorized({
      userId: ownerId,
      afterCursor: "0",
    });
    const cursor = visible.at(-1)!.cursor;
    await new EventRepository(database!).pruneThrough(cursor);

    const response = await apps[0]!.inject({
      method: "GET",
      url: "/api/v1/events?cursor=0",
      headers: { cookie: `ngapd_session=${ownerToken}` },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: "EVENT_CURSOR_EXPIRED",
      recovery: expect.stringContaining("重新获取"),
    });
  });
});

async function seedProject(
  foundation: FoundationRepository,
  input: {
    ownerId: string;
    projectId: string;
    membershipId: string;
    userWorkspaceId: string;
    projectWorkspaceId: string;
    login: string;
    key: string;
  },
) {
  await foundation.createUserWithWorkspace({
    id: input.ownerId,
    workspaceId: input.userWorkspaceId,
    loginName: input.login,
    normalizedLoginName: input.login,
    passwordHash: "argon2id$fixture",
  });
  await foundation.createProjectWithWorkspace({
    id: input.projectId,
    ownerMembershipId: input.membershipId,
    workspaceId: input.projectWorkspaceId,
    key: input.key,
    name: `${input.key} project`,
    ownerUserId: input.ownerId,
  });
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
