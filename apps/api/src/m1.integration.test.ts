import { randomUUID } from "node:crypto";

import { createDatabase, migrateToLatest, OutboxRepository, type Database } from "@ngapd/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const publicOrigin = "https://ngapd.local";
const now = new Date("2026-07-28T16:00:00.000Z");
const projectionCutoff = new Date("9999-12-31T23:59:59.999Z");

describeWithDatabase("M1 public API, OpenAPI and SSE integration", () => {
  let database: Database;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let ownerCookie: string;
  let memberCookie: string;
  let removableCookie: string;

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
    ownerCookie = await register("api-owner", "register-api-owner");
    memberCookie = await register("api-member", "register-api-member");
    removableCookie = await register("api-removable", "register-api-removable");
  });

  afterAll(async () => {
    await app?.close();
    await database?.destroy();
  });

  it("publishes the complete OpenAPI 3.1 inventory and rejects missing trust inputs", async () => {
    const openapi = app.swagger();
    expect(openapi.openapi).toBe("3.1.0");
    const expectedMethods: Record<string, string[]> = {
      "/api/v1/users/me/profile": ["get", "patch"],
      "/api/v1/projects": ["get", "post"],
      "/api/v1/projects/{projectKey}": ["get"],
      "/api/v1/projects/{projectKey}/join-target": ["get"],
      "/api/v1/projects/{projectKey}/lifecycle": ["post"],
      "/api/v1/membership-join-requests": ["post"],
      "/api/v1/projects/{projectKey}/join-requests": ["get"],
      "/api/v1/projects/{projectKey}/join-requests/{requestId}/decision": ["post"],
      "/api/v1/projects/{projectKey}/members": ["get"],
      "/api/v1/projects/{projectKey}/members/{membershipId}/profile": ["patch"],
      "/api/v1/projects/{projectKey}/members/{membershipId}/permission": ["post"],
      "/api/v1/projects/{projectKey}/members/{membershipId}/removal-preview": ["get"],
      "/api/v1/projects/{projectKey}/members/{membershipId}/remove": ["post"],
      "/api/v1/projects/{projectKey}/ownership-transfers": ["get", "post"],
      "/api/v1/projects/{projectKey}/ownership-transfers/{transferId}/resolve": ["post"],
      "/api/v1/admin-mode/sessions": ["post"],
      "/api/v1/admin-mode/sessions/{adminModeId}": ["get"],
      "/api/v1/admin-mode/sessions/{adminModeId}/close": ["post"],
      "/api/v1/system/logical-role-templates": ["get"],
      "/api/v1/projects/{projectKey}/roles": ["get", "post"],
      "/api/v1/projects/{projectKey}/roles/{roleId}": ["get", "patch"],
      "/api/v1/projects/{projectKey}/roles/{roleId}/copy": ["post"],
      "/api/v1/projects/{projectKey}/roles/{roleId}/archive": ["post"],
    };
    for (const [path, methods] of Object.entries(expectedMethods)) {
      expect(Object.keys(openapi.paths?.[path] ?? {}).sort()).toEqual(methods.sort());
    }
    expect(
      Object.keys(openapi.paths ?? {}).filter((path) => path.startsWith("/api/v1/tasks")),
    ).toEqual([]);

    const unauthenticated = await app.inject({ method: "GET", url: "/api/v1/projects" });
    expect(unauthenticated.statusCode).toBe(401);
    expect(unauthenticated.json()).toMatchObject({ code: "AUTHENTICATION_REQUIRED" });

    const badOrigin = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: { cookie: ownerCookie, origin: "https://untrusted.example" },
      payload: {
        key: "BADX",
        name: "Rejected origin",
        idempotencyKey: randomUUID(),
      },
    });
    expect(badOrigin.statusCode).toBe(403);
    expect(badOrigin.json()).toMatchObject({ code: "ORIGIN_NOT_ALLOWED" });

    const unknownField = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: mutationHeaders(ownerCookie),
      payload: {
        key: "BADY",
        name: "Rejected unknown field",
        idempotencyKey: randomUUID(),
        clientGrantedAdmin: true,
      },
    });
    expect(unknownField.statusCode).toBe(400);
    expect(unknownField.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(
      await database
        .selectFrom("projects")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("project_key", "in", ["BADX", "BADY"])
        .executeTakeFirstOrThrow()
        .then((row) => Number(row.count)),
    ).toBe(0);
  });

  it("completes every M1 public resource flow without a Web client", async () => {
    const templatesResponse = await request("GET", "/api/v1/system/logical-role-templates", {
      cookie: ownerCookie,
    });
    expect(templatesResponse.statusCode).toBe(200);
    const templates = templatesResponse.json<{ templates: Array<{ id: string }> }>().templates;
    expect(templates).toHaveLength(74);

    const profile = await request(
      "PATCH",
      "/api/v1/users/me/profile",
      mutationHeaders(ownerCookie),
      {
        displayName: "API Owner",
        defaultIntroduction: "Owner defaults",
        defaultRoleTemplateIds: [templates[0]!.id],
        expectedVersion: 1,
      },
    );
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toMatchObject({
      displayName: "API Owner",
      defaultRoleTemplateIds: [templates[0]!.id],
      actions: ["update"],
    });

    const projectIdempotencyKey = randomUUID();
    const created = await request(
      "POST",
      "/api/v1/projects",
      mutationHeaders(ownerCookie, "api-project-create"),
      {
        key: "APIE",
        name: "API End to End",
        description: "No Web required",
        idempotencyKey: projectIdempotencyKey,
      },
    );
    expect(created.statusCode).toBe(201);
    const project = created.json<{
      project: { id: string; version: number; ownerMembershipId: string };
    }>().project;
    const replay = await request(
      "POST",
      "/api/v1/projects",
      mutationHeaders(ownerCookie, "api-project-create-replay"),
      {
        key: "APIE",
        name: "API End to End",
        description: "No Web required",
        idempotencyKey: projectIdempotencyKey,
      },
    );
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toMatchObject({
      project: { id: project.id },
      idempotentReplay: true,
    });

    const ownerList = await request("GET", "/api/v1/projects", { cookie: ownerCookie });
    expect(ownerList.statusCode).toBe(200);
    expect(ownerList.json()).toMatchObject({ projects: [{ id: project.id, key: "APIE" }] });

    const memberJoin = await createJoin(memberCookie, "api-member-join");
    const removableJoin = await createJoin(removableCookie, "api-removable-join");
    const ownerJoinList = await request("GET", "/api/v1/projects/APIE/join-requests", {
      cookie: ownerCookie,
    });
    expect(ownerJoinList.statusCode).toBe(200);
    expect(ownerJoinList.json<{ requests: unknown[] }>().requests).toHaveLength(2);

    const memberApproved = await approve(memberJoin, "api-member-approve");
    const removableApproved = await approve(removableJoin, "api-removable-approve");
    const selfUpdated = await request(
      "PATCH",
      `/api/v1/projects/APIE/members/${memberApproved.membership.id}/profile`,
      mutationHeaders(memberCookie),
      {
        introduction: "Member self-service",
        roleIds: memberApproved.membership.roleIds,
        expectedVersion: memberApproved.membership.version,
      },
    );
    expect(selfUpdated.statusCode).toBe(200);
    const selfMembership = selfUpdated.json<{
      membership: { id: string; version: number; roleIds: string[] };
    }>().membership;

    const ownerDetail = await request("GET", "/api/v1/projects/APIE", {
      cookie: ownerCookie,
    });
    const currentOwner = ownerDetail.json<{
      currentMembership: { version: number };
    }>().currentMembership;
    const openedMode = await request(
      "POST",
      "/api/v1/admin-mode/sessions",
      mutationHeaders(ownerCookie),
      {
        projectId: project.id,
        expectedMembershipVersion: currentOwner.version,
        idempotencyKey: randomUUID(),
      },
    );
    expect(openedMode.statusCode).toBe(201);
    const adminMode = openedMode.json<{ adminMode: { id: string } }>().adminMode;

    const ownerEdited = await request(
      "PATCH",
      `/api/v1/projects/APIE/members/${selfMembership.id}/profile`,
      mutationHeaders(ownerCookie, undefined, adminMode.id),
      {
        introduction: "Admin Mode update",
        roleIds: selfMembership.roleIds,
        expectedVersion: selfMembership.version,
      },
    );
    expect(ownerEdited.statusCode).toBe(200);
    const managedMember = ownerEdited.json<{
      membership: { id: string; version: number };
    }>().membership;

    const createdRole = await request(
      "POST",
      "/api/v1/projects/APIE/roles",
      mutationHeaders(ownerCookie, undefined, adminMode.id),
      {
        name: "API custom role",
        capability: "Descriptive only; owner=true is not authorization",
        idempotencyKey: randomUUID(),
      },
    );
    expect(createdRole.statusCode).toBe(201);
    let role = createdRole.json<{ role: { id: string; version: number } }>().role;
    expect(
      (
        await request("GET", `/api/v1/projects/APIE/roles/${role.id}`, {
          cookie: ownerCookie,
        })
      ).statusCode,
    ).toBe(200);
    const updatedRole = await request(
      "PATCH",
      `/api/v1/projects/APIE/roles/${role.id}`,
      mutationHeaders(ownerCookie, undefined, adminMode.id),
      {
        name: "API custom role updated",
        capability: "Still descriptive",
        expectedVersion: role.version,
      },
    );
    expect(updatedRole.statusCode).toBe(200);
    role = updatedRole.json<{ role: { id: string; version: number } }>().role;
    const copiedRole = await request(
      "POST",
      `/api/v1/projects/APIE/roles/${role.id}/copy`,
      mutationHeaders(ownerCookie, undefined, adminMode.id),
      {
        name: "API copied role",
        expectedSourceVersion: role.version,
        idempotencyKey: randomUUID(),
      },
    );
    expect(copiedRole.statusCode).toBe(201);
    const copy = copiedRole.json<{ role: { id: string; version: number } }>().role;
    expect(
      (
        await request(
          "POST",
          `/api/v1/projects/APIE/roles/${copy.id}/archive`,
          mutationHeaders(ownerCookie, undefined, adminMode.id),
          { expectedVersion: copy.version },
        )
      ).statusCode,
    ).toBe(200);

    const adminState = await request("GET", `/api/v1/admin-mode/sessions/${adminMode.id}`, {
      cookie: ownerCookie,
    });
    const currentMode = adminState.json<{ adminMode: { version: number } }>().adminMode;
    expect(
      (
        await request(
          "POST",
          `/api/v1/admin-mode/sessions/${adminMode.id}/close`,
          mutationHeaders(ownerCookie),
          { expectedVersion: currentMode.version },
        )
      ).statusCode,
    ).toBe(200);

    const permission = await request(
      "POST",
      `/api/v1/projects/APIE/members/${managedMember.id}/permission`,
      mutationHeaders(ownerCookie),
      {
        permissionLevel: "admin",
        expectedProjectVersion: project.version,
        expectedMembershipVersion: managedMember.version,
        idempotencyKey: randomUUID(),
      },
    );
    expect(permission.statusCode).toBe(200);
    const promoted = permission.json<{
      membership: { id: string; version: number };
    }>().membership;

    const removalPreview = await request(
      "GET",
      `/api/v1/projects/APIE/members/${removableApproved.membership.id}/removal-preview`,
      { cookie: ownerCookie },
    );
    expect(removalPreview.statusCode).toBe(200);
    const preview = removalPreview.json<{
      projectVersion: number;
      membershipVersion: number;
      blockingTasks: string[];
    }>();
    expect(preview.blockingTasks).toEqual([]);
    const removed = await request(
      "POST",
      `/api/v1/projects/APIE/members/${removableApproved.membership.id}/remove`,
      mutationHeaders(ownerCookie),
      {
        expectedProjectVersion: preview.projectVersion,
        expectedMembershipVersion: preview.membershipVersion,
        confirmedBlockingTaskIds: [],
        idempotencyKey: randomUUID(),
      },
    );
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toMatchObject({ membership: { status: "removed" } });

    const transferCreated = await request(
      "POST",
      "/api/v1/projects/APIE/ownership-transfers",
      mutationHeaders(ownerCookie),
      {
        targetMembershipId: promoted.id,
        expectedProjectVersion: project.version,
        expectedTargetMembershipVersion: promoted.version,
        idempotencyKey: randomUUID(),
      },
    );
    expect(transferCreated.statusCode).toBe(201);
    const transfer = transferCreated.json<{
      transfer: { id: string; version: number };
    }>().transfer;
    expect(
      (
        await request("GET", "/api/v1/projects/APIE/ownership-transfers", {
          cookie: memberCookie,
        })
      ).statusCode,
    ).toBe(200);
    const accepted = await request(
      "POST",
      `/api/v1/projects/APIE/ownership-transfers/${transfer.id}/resolve`,
      mutationHeaders(memberCookie),
      {
        action: "accept",
        expectedProjectVersion: project.version,
        expectedTransferVersion: transfer.version,
        idempotencyKey: randomUUID(),
      },
    );
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({ transfer: { status: "accepted" } });

    const transferred = await request("GET", "/api/v1/projects/APIE", {
      cookie: memberCookie,
    });
    const transferredProject = transferred.json<{ project: { version: number } }>().project;
    const archived = await request(
      "POST",
      "/api/v1/projects/APIE/lifecycle",
      mutationHeaders(memberCookie),
      {
        expectedVersion: transferredProject.version,
        lifecycle: "archived",
        idempotencyKey: randomUUID(),
      },
    );
    expect(archived.statusCode).toBe(200);
    const archivedProject = archived.json<{ project: { version: number } }>().project;
    const unarchived = await request(
      "POST",
      "/api/v1/projects/APIE/lifecycle",
      mutationHeaders(memberCookie),
      {
        expectedVersion: archivedProject.version,
        lifecycle: "active",
        idempotencyKey: randomUUID(),
      },
    );
    expect(unarchived.statusCode).toBe(200);

    const listStarted = performance.now();
    const memberList = await request("GET", "/api/v1/projects/APIE/members", {
      cookie: memberCookie,
    });
    expect(memberList.statusCode).toBe(200);
    expect(memberList.json<{ members: unknown[] }>().members).toHaveLength(3);
    expect(performance.now() - listStarted).toBeLessThan(5_000);
  });

  it("keeps join disclosure and event projection tenant-scoped with stable failure audit", async () => {
    const exactTarget = await request("GET", "/api/v1/projects/APIE/join-target", {
      cookie: removableCookie,
    });
    expect(exactTarget.statusCode).toBe(200);
    expect(Object.keys(exactTarget.json()).sort()).toEqual(["acceptsJoinRequests", "key", "name"]);

    const outsiderCookie = await register("api-outsider", "register-api-outsider");
    const outsiderProject = await request(
      "POST",
      "/api/v1/projects",
      mutationHeaders(outsiderCookie),
      {
        key: "APIF",
        name: "Other tenant",
        idempotencyKey: randomUUID(),
      },
    );
    expect(outsiderProject.statusCode).toBe(201);
    const other = outsiderProject.json<{
      project: { id: string; ownerMembershipId: string };
    }>().project;

    const idorRequestId = "api-idor-membership";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await request(
        "POST",
        `/api/v1/projects/APIE/members/${other.ownerMembershipId}/permission`,
        mutationHeaders(memberCookie, idorRequestId),
        {
          permissionLevel: "admin",
          expectedProjectVersion: 3,
          expectedMembershipVersion: 1,
          idempotencyKey: randomUUID(),
        },
      );
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: "MEMBERSHIP_NOT_FOUND" });
    }
    const failureAudit = await database
      .selectFrom("audit_events")
      .select(["result", "reason_code"])
      .where("request_id", "=", idorRequestId)
      .execute();
    expect(failureAudit).toEqual([{ result: "failure", reason_code: "MEMBERSHIP_NOT_FOUND" }]);

    const outbox = new OutboxRepository(database);
    while ((await outbox.dispatchNext({ now: projectionCutoff })).status === "processed") {
      // Drain through the same projection function used by the Graphile Worker task.
    }
    const ownerEvents = await request("GET", "/api/v1/events?cursor=0", {
      cookie: memberCookie,
    });
    expect(ownerEvents.statusCode).toBe(200);
    expect(ownerEvents.body).toContain('"eventType":"project.created"');
    expect(ownerEvents.body).toContain('"resourceType":"project"');
    expect(ownerEvents.body).not.toContain(other.id);

    const outsiderEvents = await request("GET", "/api/v1/events?cursor=0", {
      cookie: outsiderCookie,
    });
    expect(outsiderEvents.statusCode).toBe(200);
    expect(outsiderEvents.body).toContain(other.id);
    expect(outsiderEvents.body).not.toContain(
      '"resourceId":"' + projectIdFromEvents(ownerEvents.body),
    );
  });

  async function register(loginName: string, requestId: string): Promise<string> {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { origin: publicOrigin, "x-request-id": requestId },
      payload: { loginName, password: "correct horse battery" },
    });
    expect(response.statusCode).toBe(201);
    return response.headers["set-cookie"]!.split(";")[0]!;
  }

  async function createJoin(cookie: string, requestId: string) {
    const response = await request(
      "POST",
      "/api/v1/membership-join-requests",
      mutationHeaders(cookie, requestId),
      { projectKey: "APIE", idempotencyKey: randomUUID() },
    );
    expect(response.statusCode).toBe(201);
    return response.json<{
      request: { id: string; version: number };
      membership: { id: string; version: number };
    }>();
  }

  async function approve(
    joined: {
      request: { id: string; version: number };
      membership: { id: string; version: number };
    },
    requestId: string,
  ) {
    const response = await request(
      "POST",
      `/api/v1/projects/APIE/join-requests/${joined.request.id}/decision`,
      mutationHeaders(ownerCookie, requestId),
      {
        decision: "approve",
        expectedProjectVersion: 1,
        expectedMembershipVersion: joined.membership.version,
        expectedRequestVersion: joined.request.version,
        idempotencyKey: randomUUID(),
      },
    );
    expect(response.statusCode).toBe(200);
    return response.json<{
      membership: { id: string; version: number; roleIds: string[] };
    }>();
  }

  function request(
    method: "GET" | "PATCH" | "POST",
    url: string,
    headers: Record<string, string>,
    payload?: unknown,
  ) {
    return app.inject({
      method,
      url,
      headers,
      ...(payload === undefined ? {} : { payload }),
    });
  }
});

function mutationHeaders(cookie: string, requestId = randomUUID(), adminModeId?: string) {
  return {
    cookie,
    origin: publicOrigin,
    "x-request-id": requestId,
    ...(adminModeId ? { "x-ngapd-admin-mode-id": adminModeId } : {}),
  };
}

function projectIdFromEvents(body: string): string {
  return /"projectId":"([^"]+)"/u.exec(body)?.[1] ?? "missing-project";
}
