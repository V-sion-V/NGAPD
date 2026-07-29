import { randomUUID } from "node:crypto";

import { createDatabase, migrateToLatest, OutboxRepository, type Database } from "@ngapd/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const publicOrigin = "https://ngapd.local";
const now = new Date("2026-07-30T00:00:00.000Z");

describeWithDatabase("M2 public Task API and projections", () => {
  let database: Database;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookie: string;
  let projectId: string;
  let ownerMembershipId: string;

  beforeAll(async () => {
    database = createDatabase(connectionString!);
    await database.schema.dropSchema("public").ifExists().cascade().execute();
    await database.schema.createSchema("public").execute();
    await migrateToLatest(database);
    app = await buildApp({
      database,
      databaseCheck: async () => true,
      publicOrigin,
      now: () => now,
      eventStreamDurationMs: 0,
    });
    const registered = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { origin: publicOrigin, "x-request-id": "m2-register" },
      payload: { loginName: "m2-owner", password: "correct horse battery" },
    });
    expect(registered.statusCode).toBe(201);
    cookie = registered.headers["set-cookie"]!.split(";")[0]!;
    const project = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: {
        cookie,
        origin: publicOrigin,
        "x-request-id": "m2-project",
      },
      payload: {
        key: "MTPR",
        name: "M2 Project",
        idempotencyKey: randomUUID(),
      },
    });
    expect(project.statusCode).toBe(201);
    ownerMembershipId = project.json<{
      project: { id: string; ownerMembershipId: string };
    }>().project.ownerMembershipId;
    projectId = project.json<{ project: { id: string } }>().project.id;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    await database?.destroy();
  });

  it("publishes every M2 route without a public Agent or admin trust input", async () => {
    const openapi = app.swagger();
    for (const path of [
      "/api/v1/projects/{projectKey}/tasks",
      "/api/v1/projects/{projectKey}/tasks/{taskKey}",
      "/api/v1/projects/{projectKey}/task-dependencies",
      "/api/v1/projects/{projectKey}/task-dependency-requests",
      "/api/v1/projects/{projectKey}/tasks/{taskKey}/reopen/impact",
      "/api/v1/projects/{projectKey}/tasks/{taskKey}/comments",
      "/api/v1/projects/{projectKey}/tasks/{taskKey}/activity",
      "/api/v1/notifications",
    ]) {
      expect(openapi.paths?.[path]).toBeDefined();
    }
    const anonymous = await app.inject({
      method: "GET",
      url: "/api/v1/projects/MTPR/tasks",
    });
    expect(anonymous.statusCode).toBe(401);

    const injected = await app.inject({
      method: "POST",
      url: "/api/v1/projects/MTPR/tasks",
      headers: mutationHeaders("m2-task-injected"),
      payload: {
        parentTaskKey: null,
        explicitOwnerMembershipId: ownerMembershipId,
        title: "Rejected",
        actorType: "agent",
        adminModeActive: true,
        projectId: randomUUID(),
      },
    });
    expect(injected.statusCode).toBe(400);
    expect(injected.json()).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("creates, updates, blocks, comments and projects one complete public flow", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/projects/MTPR/tasks",
      headers: mutationHeaders("m2-task-create"),
      payload: {
        parentTaskKey: null,
        explicitOwnerMembershipId: ownerMembershipId,
        title: "Public M2 Task",
        content: "Initial **Markdown**",
        labels: ["m2"],
        displayType: "milestone",
      },
    });
    expect(created.statusCode).toBe(201);
    const createdTask = created.json<{
      task: { id: string; key: string; version: number; actions: string[] };
    }>().task;
    expect(createdTask).toMatchObject({
      key: "MTPR-1",
      version: 1,
      actions: expect.arrayContaining(["read", "update", "complete", "write_workspace"]),
    });

    const replay = await app.inject({
      method: "POST",
      url: "/api/v1/projects/MTPR/tasks",
      headers: mutationHeaders("m2-task-create-replay", "m2-task-create-idempotency"),
      payload: {
        parentTaskKey: null,
        explicitOwnerMembershipId: ownerMembershipId,
        title: "Public M2 Task",
        content: "Initial **Markdown**",
        labels: ["m2"],
        displayType: "milestone",
      },
    });
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toMatchObject({
      task: { id: createdTask.id },
      idempotentReplay: true,
    });

    const updated = await app.inject({
      method: "PATCH",
      url: "/api/v1/projects/MTPR/tasks/MTPR-1",
      headers: mutationHeaders("m2-task-update"),
      payload: {
        expectedTaskVersion: 1,
        title: "Updated M2 Task",
        content: "Updated Markdown",
        dueAt: "2026-07-31T12:00:00.000Z",
        labels: ["m2", "api"],
        displayType: "sprint",
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      task: {
        version: 2,
        title: "Updated M2 Task",
        labels: ["m2", "api"],
        displayType: "sprint",
      },
    });

    const blocked = await app.inject({
      method: "POST",
      url: "/api/v1/projects/MTPR/tasks/MTPR-1/blockers",
      headers: mutationHeaders("m2-blocker-add"),
      payload: { expectedTaskVersion: 2, reason: "Waiting for art" },
    });
    expect(blocked.statusCode).toBe(200);
    expect(blocked.json()).toMatchObject({
      task: { version: 3, effectiveStatus: "blocked" },
    });
    const blockerId = await database
      .selectFrom("task_blockers")
      .select("id")
      .where("task_id", "=", createdTask.id)
      .executeTakeFirstOrThrow()
      .then((row) => row.id);

    const resolved = await app.inject({
      method: "POST",
      url: `/api/v1/projects/MTPR/tasks/MTPR-1/blockers/${blockerId}/resolve`,
      headers: mutationHeaders("m2-blocker-resolve"),
      payload: { expectedTaskVersion: 3 },
    });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json()).toMatchObject({
      task: { version: 4, effectiveStatus: "not_started" },
    });

    const inProgress = await app.inject({
      method: "POST",
      url: "/api/v1/projects/MTPR/tasks/MTPR-1/status",
      headers: mutationHeaders("m2-status"),
      payload: { expectedTaskVersion: 4, status: "in_progress" },
    });
    expect(inProgress.statusCode).toBe(200);
    expect(inProgress.json()).toMatchObject({
      task: { version: 5, baseStatus: "in_progress" },
    });

    const commented = await app.inject({
      method: "POST",
      url: "/api/v1/projects/MTPR/tasks/MTPR-1/comments",
      headers: mutationHeaders("m2-comment"),
      payload: {
        expectedTaskVersion: 5,
        body: "A public **comment**",
        attachments: [],
      },
    });
    expect(commented.statusCode).toBe(201);
    const originalComment = commented.json<{
      comment: { id: string; version: number; body: string; actions: string[] };
    }>().comment;
    expect(originalComment).toMatchObject({
      version: 1,
      body: "A public **comment**",
    });
    expect(originalComment.actions).toEqual(expect.arrayContaining(["edit", "delete"]));

    const outbox = new OutboxRepository(database);
    for (let index = 0; index < 100; index += 1) {
      const dispatched = await outbox.dispatchNext({ now: new Date("9999-01-01T00:00:00Z") });
      if (dispatched.status === "empty") {
        break;
      }
    }

    const activity = await app.inject({
      method: "GET",
      url: "/api/v1/projects/MTPR/tasks/MTPR-1/activity",
      headers: { cookie },
    });
    expect(activity.statusCode).toBe(200);
    expect(
      activity
        .json<{ activities: Array<{ eventType: string }> }>()
        .activities.map((entry) => entry.eventType),
    ).toEqual(
      expect.arrayContaining([
        "task.created",
        "task.updated",
        "task.blocker.changed",
        "task.status.changed",
        "task.comment.created",
      ]),
    );

    const notifications = await app.inject({
      method: "GET",
      url: "/api/v1/notifications",
      headers: { cookie },
    });
    expect(notifications.statusCode).toBe(200);
    expect(
      notifications
        .json<{ notifications: Array<{ eventType: string }> }>()
        .notifications.map((entry) => entry.eventType),
    ).toEqual(expect.arrayContaining(["task.blocker.changed", "task.comment.created"]));

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/projects/MTPR/tasks?parentTaskKey=root",
      headers: { cookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      tasks: [{ id: createdTask.id, key: "MTPR-1" }],
      graph: { graphVersion: 0 },
    });

    const detail = await app.inject({
      method: "GET",
      url: "/api/v1/projects/MTPR/tasks/MTPR-1",
      headers: { cookie },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      id: createdTask.id,
      follows: [],
      blockers: [
        {
          id: blockerId,
          reason: "Waiting for art",
          resolvedAt: expect.any(String),
        },
      ],
    });

    const dependencyRequests = await app.inject({
      method: "GET",
      url: "/api/v1/projects/MTPR/task-dependency-requests",
      headers: { cookie },
    });
    expect(dependencyRequests.statusCode).toBe(200);
    expect(dependencyRequests.json()).toEqual({ requests: [] });

    const completed = await app.inject({
      method: "POST",
      url: "/api/v1/projects/MTPR/tasks/MTPR-1/complete",
      headers: mutationHeaders("m2-complete"),
      payload: {
        expectedTaskVersion: 5,
        expectedGraphVersion: 0,
        expectedWorkspaceSyncVersion: 0,
        finalServerVersionReceived: true,
        hasUncommittedClientVersion: false,
      },
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json()).toMatchObject({
      task: { version: 6, baseStatus: "done", workspace: { lifecycle: "frozen" } },
    });

    const immutableEdit = await app.inject({
      method: "PATCH",
      url: `/api/v1/projects/MTPR/tasks/MTPR-1/comments/${originalComment.id}`,
      headers: mutationHeaders("m2-comment-immutable-edit"),
      payload: {
        expectedTaskVersion: 6,
        expectedCommentVersion: originalComment.version,
        body: "Must not replace history",
        attachments: [],
      },
    });
    expect(immutableEdit.statusCode).toBe(409);
    expect(immutableEdit.json()).toMatchObject({ code: "TASK_COMMENT_IMMUTABLE" });

    const appended = await app.inject({
      method: "POST",
      url: "/api/v1/projects/MTPR/tasks/MTPR-1/comments",
      headers: mutationHeaders("m2-comment-after-completion"),
      payload: {
        expectedTaskVersion: 6,
        body: "Append-only after completion",
        attachments: [],
      },
    });
    expect(appended.statusCode).toBe(201);
    const appendedComment = appended.json<{ comment: { id: string; version: number } }>().comment;
    const immutableDelete = await app.inject({
      method: "DELETE",
      url: `/api/v1/projects/MTPR/tasks/MTPR-1/comments/${appendedComment.id}`,
      headers: mutationHeaders("m2-comment-immutable-delete"),
      payload: {
        expectedTaskVersion: 6,
        expectedCommentVersion: appendedComment.version,
      },
    });
    expect(immutableDelete.statusCode).toBe(409);
    expect(immutableDelete.json()).toMatchObject({ code: "TASK_COMMENT_IMMUTABLE" });

    const membershipVersion = await database
      .selectFrom("memberships")
      .select("version")
      .where("id", "=", ownerMembershipId)
      .executeTakeFirstOrThrow();
    const openedAdminMode = await app.inject({
      method: "POST",
      url: "/api/v1/admin-mode/sessions",
      headers: mutationHeaders("m2-admin-mode-open"),
      payload: {
        projectId,
        expectedMembershipVersion: Number(membershipVersion.version),
        idempotencyKey: randomUUID(),
      },
    });
    expect(openedAdminMode.statusCode).toBe(201);
    const adminModeId = openedAdminMode.json<{ adminMode: { id: string } }>().adminMode.id;
    const hidden = await app.inject({
      method: "POST",
      url: `/api/v1/projects/MTPR/tasks/MTPR-1/comments/${originalComment.id}/hide`,
      headers: mutationHeaders("m2-comment-hide", undefined, adminModeId),
      payload: {
        expectedCommentVersion: originalComment.version,
        reason: "Moderation fixture",
      },
    });
    expect(hidden.statusCode).toBe(200);
    expect(hidden.json()).toMatchObject({
      comment: { id: originalComment.id, body: null, hidden: true },
    });
    const preservedOriginal = await database
      .selectFrom("task_comments")
      .select(["body", "hidden_reason"])
      .where("id", "=", originalComment.id)
      .executeTakeFirstOrThrow();
    expect(preservedOriginal).toEqual({
      body: "A public **comment**",
      hidden_reason: "Moderation fixture",
    });
  }, 60_000);

  function mutationHeaders(
    requestId: string,
    idempotencyKey = `${requestId}-idempotency`,
    adminModeId?: string,
  ) {
    return {
      cookie,
      origin: publicOrigin,
      "x-request-id": requestId,
      "idempotency-key": idempotencyKey,
      ...(adminModeId ? { "x-ngapd-admin-mode-id": adminModeId } : {}),
    };
  }
});
