import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createDatabase,
  migrateToLatest,
  WorkspaceRepository,
  type Database,
} from "@ngapd/database";
import { LocalObjectStore } from "@ngapd/object-store";
import { createWorkspaceManifest } from "@ngapd/workspace-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const publicOrigin = "https://ngapd.local";
const now = new Date("2026-07-31T00:00:00.000Z");
const EMPTY_MANIFEST_HASH = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";

describeWithDatabase("M3 Task read API", () => {
  let database: Database;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookie: string;
  let ownerMembershipId: string;
  let targetTaskId: string;
  let targetWorkspaceId: string;
  let objectRoot: string;
  let objectStore: LocalObjectStore;
  const depthKeys: string[] = [];

  beforeAll(async () => {
    database = createDatabase(connectionString!);
    await database.schema.dropSchema("public").ifExists().cascade().execute();
    await database.schema.createSchema("public").execute();
    await migrateToLatest(database);
    objectRoot = await mkdtemp(join(tmpdir(), "ngapd-m3-read-objects-"));
    objectStore = new LocalObjectStore(objectRoot);
    app = await buildApp({
      database,
      databaseCheck: async () => true,
      publicOrigin,
      now: () => now,
      objectStore,
      eventStreamDurationMs: 0,
    });
    const registered = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { origin: publicOrigin, "x-request-id": "m3-read-register" },
      payload: { loginName: "m3-reader", password: "correct horse battery" },
    });
    expect(registered.statusCode).toBe(201);
    cookie = registered.headers["set-cookie"]!.split(";")[0]!;
    const project = await createProject("MTHR", "M3 hierarchy");
    ownerMembershipId = project.ownerMembershipId;

    let parentTaskKey: string | null = null;
    for (let index = 1; index <= 20; index += 1) {
      const created = await app.inject({
        method: "POST",
        url: "/api/v1/projects/MTHR/tasks",
        headers: mutationHeaders(`m3-depth-${index}`),
        payload: {
          parentTaskKey,
          explicitOwnerMembershipId: index === 1 ? ownerMembershipId : null,
          title: index === 20 ? "Deep Search Target" : `Search branch ${index}`,
        },
      });
      expect(created.statusCode).toBe(201);
      const task = created.json<{
        task: { id: string; key: string; workspace: { id: string } };
      }>().task;
      parentTaskKey = task.key;
      depthKeys.push(parentTaskKey);
      if (index === 20) {
        targetTaskId = task.id;
        targetWorkspaceId = task.workspace.id;
      }
    }
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    await database?.destroy();
    if (objectRoot) {
      await rm(objectRoot, { recursive: true, force: true });
    }
  });

  it("publishes schema-backed search and ancestor routes", () => {
    const openapi = app.swagger();
    expect(openapi.paths?.["/api/v1/projects/{projectKey}/tasks/search"]).toBeDefined();
    expect(
      openapi.paths?.["/api/v1/projects/{projectKey}/tasks/{taskKey}/ancestors"],
    ).toBeDefined();
    expect(
      openapi.paths?.["/api/v1/projects/{projectKey}/tasks/{taskKey}/workspace/files"],
    ).toBeDefined();
    expect(
      openapi.paths?.["/api/v1/projects/{projectKey}/tasks/{taskKey}/workspace/files/content"],
    ).toBeDefined();
  });

  it("searches by case-insensitive title and returns a complete depth-20 location", async () => {
    const searched = await app.inject({
      method: "GET",
      url: "/api/v1/projects/MTHR/tasks/search?query=deep%20search&lifecycle=active",
      headers: { cookie, "x-request-id": "m3-search-title" },
    });
    expect(searched.statusCode).toBe(200);
    expect(searched.json()).toMatchObject({
      results: [
        {
          task: {
            key: depthKeys.at(-1),
            parentTaskKey: depthKeys.at(-2),
            title: "Deep Search Target",
            archiveLifecycle: "active",
          },
        },
      ],
      nextCursor: null,
    });
    expect(
      searched.json<{ results: Array<{ ancestors: Array<{ key: string }> }> }>().results[0]!
        .ancestors,
    ).toEqual(depthKeys.slice(0, -1).map((key) => expect.objectContaining({ key })));

    const location = await app.inject({
      method: "GET",
      url: `/api/v1/projects/MTHR/tasks/${depthKeys.at(-1)}/ancestors`,
      headers: { cookie, "x-request-id": "m3-read-ancestors" },
    });
    expect(location.statusCode).toBe(200);
    expect(location.json()).toMatchObject({
      task: { key: depthKeys.at(-1), parentTaskKey: depthKeys.at(-2) },
    });
    expect(location.json<{ ancestors: unknown[] }>().ancestors).toHaveLength(19);
  });

  it("prioritizes exact and prefix Task Keys with a stable cursor", async () => {
    const first = await app.inject({
      method: "GET",
      url: "/api/v1/projects/MTHR/tasks/search?query=mthr-&limit=7",
      headers: { cookie, "x-request-id": "m3-search-page-1" },
    });
    expect(first.statusCode).toBe(200);
    const firstPage = first.json<{
      results: Array<{ task: { key: string } }>;
      nextCursor: string | null;
    }>();
    expect(firstPage.results.map((result) => result.task.key)).toEqual(depthKeys.slice(0, 7));
    expect(firstPage.nextCursor).toBe(depthKeys[6]);

    const second = await app.inject({
      method: "GET",
      url: `/api/v1/projects/MTHR/tasks/search?query=mthr-&limit=7&cursor=${firstPage.nextCursor}`,
      headers: { cookie, "x-request-id": "m3-search-page-2" },
    });
    expect(second.statusCode).toBe(200);
    expect(
      second
        .json<{ results: Array<{ task: { key: string } }> }>()
        .results.map((result) => result.task.key),
    ).toEqual(depthKeys.slice(7, 14));

    const exact = await app.inject({
      method: "GET",
      url: `/api/v1/projects/MTHR/tasks/search?query=${depthKeys[10]}`,
      headers: { cookie, "x-request-id": "m3-search-exact" },
    });
    expect(exact.statusCode).toBe(200);
    expect(exact.json()).toMatchObject({ results: [{ task: { key: depthKeys[10] } }] });
  });

  it("does not disclose Task locations to anonymous or non-member sessions", async () => {
    const anonymous = await app.inject({
      method: "GET",
      url: "/api/v1/projects/MTHR/tasks/search?query=search",
    });
    expect(anonymous.statusCode).toBe(401);

    const outsiderRegistration = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { origin: publicOrigin, "x-request-id": "m3-outsider-register" },
      payload: { loginName: "m3-outsider", password: "correct horse battery" },
    });
    const outsiderCookie = outsiderRegistration.headers["set-cookie"]!.split(";")[0]!;
    const denied = await app.inject({
      method: "GET",
      url: `/api/v1/projects/MTHR/tasks/${depthKeys.at(-1)}/ancestors`,
      headers: { cookie: outsiderCookie, "x-request-id": "m3-outsider-location" },
    });
    expect({
      statusCode: denied.statusCode,
      body: denied.json(),
    }).toEqual({
      statusCode: 403,
      body: expect.objectContaining({ code: "MEMBERSHIP_NOT_FOUND" }),
    });
    expect(JSON.stringify(denied.json())).not.toContain("Deep Search Target");
  });

  it("reads only the current authorized Task Workspace manifest and object", async () => {
    const content = Buffer.from("M3 authorized attachment\n", "utf8");
    const sha256 = createHash("sha256").update(content).digest("hex");
    const path = "notes/设计 说明.md";
    const manifest = createWorkspaceManifest([
      { path, kind: "file", size: content.length, sha256 },
    ]);
    const stored = await objectStore.putVerified(sha256, content);
    const workspaces = new WorkspaceRepository(database);
    await workspaces.registerVerifiedObject({
      ...stored,
      verifiedAt: now,
    });
    await database
      .insertInto("workspace_versions")
      .values({
        workspace_id: targetWorkspaceId,
        sync_version: "1",
        manifest_sha256: manifest.hash,
      })
      .execute();
    await database
      .insertInto("workspace_manifest_entries")
      .values({
        workspace_id: targetWorkspaceId,
        sync_version: "1",
        path,
        kind: "file",
        size: String(content.length),
        sha256,
      })
      .execute();
    await database
      .updateTable("workspaces")
      .set({ sync_version: "1" })
      .where("id", "=", targetWorkspaceId)
      .execute();

    const listed = await app.inject({
      method: "GET",
      url: `/api/v1/projects/MTHR/tasks/${depthKeys.at(-1)}/workspace/files`,
      headers: { cookie, "x-request-id": "m3-workspace-files" },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual({
      workspaceId: targetWorkspaceId,
      syncVersion: 1,
      manifestSha256: manifest.hash,
      files: [{ path, size: content.length, sha256 }],
    });
    expect(JSON.stringify(listed.json())).not.toMatch(/token|lease|storageKey|connection/i);

    const downloaded = await app.inject({
      method: "GET",
      url: `/api/v1/projects/MTHR/tasks/${depthKeys.at(-1)}/workspace/files/content?path=${encodeURIComponent(path)}&sha256=${sha256}`,
      headers: { cookie, "x-request-id": "m3-workspace-file-content" },
    });
    expect(downloaded.statusCode).toBe(200);
    expect(downloaded.rawPayload).toEqual(content);
    expect(downloaded.headers["content-type"]).toContain("application/octet-stream");
    expect(downloaded.headers["cache-control"]).toBe("private, no-store");
    expect(downloaded.headers["x-content-type-options"]).toBe("nosniff");

    for (const deniedUrl of [
      `/api/v1/projects/MTHR/tasks/${depthKeys.at(-1)}/workspace/files/content?path=${encodeURIComponent("../secret")}`,
      `/api/v1/projects/MTHR/tasks/${depthKeys.at(-1)}/workspace/files/content?path=${encodeURIComponent(path)}&sha256=${"f".repeat(64)}`,
      `/api/v1/projects/MTHR/tasks/${depthKeys[0]}/workspace/files/content?path=${encodeURIComponent(path)}`,
    ]) {
      const denied = await app.inject({
        method: "GET",
        url: deniedUrl,
        headers: { cookie, "x-request-id": randomUUID() },
      });
      expect(denied.statusCode).toBe(403);
      expect(JSON.stringify(denied.json())).not.toContain(objectRoot);
    }

    const updatedContent = Buffer.from("M3 attachment version two\n", "utf8");
    const updatedSha256 = createHash("sha256").update(updatedContent).digest("hex");
    const updatedManifest = createWorkspaceManifest([
      { path, kind: "file", size: updatedContent.length, sha256: updatedSha256 },
    ]);
    const updatedStored = await objectStore.putVerified(updatedSha256, updatedContent);
    await workspaces.registerVerifiedObject({ ...updatedStored, verifiedAt: now });
    await database
      .insertInto("workspace_versions")
      .values({
        workspace_id: targetWorkspaceId,
        sync_version: "2",
        manifest_sha256: updatedManifest.hash,
      })
      .execute();
    await database
      .insertInto("workspace_manifest_entries")
      .values({
        workspace_id: targetWorkspaceId,
        sync_version: "2",
        path,
        kind: "file",
        size: String(updatedContent.length),
        sha256: updatedSha256,
      })
      .execute();
    await database
      .updateTable("workspaces")
      .set({ sync_version: "2" })
      .where("id", "=", targetWorkspaceId)
      .execute();
    const staleHash = await app.inject({
      method: "GET",
      url: `/api/v1/projects/MTHR/tasks/${depthKeys.at(-1)}/workspace/files/content?path=${encodeURIComponent(path)}&sha256=${sha256}`,
      headers: { cookie, "x-request-id": "m3-workspace-stale-hash" },
    });
    expect(staleHash.statusCode).toBe(403);
    const currentContent = await app.inject({
      method: "GET",
      url: `/api/v1/projects/MTHR/tasks/${depthKeys.at(-1)}/workspace/files/content?path=${encodeURIComponent(path)}&sha256=${updatedSha256}`,
      headers: { cookie, "x-request-id": "m3-workspace-current-hash" },
    });
    expect(currentContent.statusCode).toBe(200);
    expect(currentContent.rawPayload).toEqual(updatedContent);

    const withoutObjectStore = await buildApp({
      database,
      databaseCheck: async () => true,
      publicOrigin,
      now: () => now,
      eventStreamDurationMs: 0,
    });
    const unavailable = await withoutObjectStore.inject({
      method: "GET",
      url: `/api/v1/projects/MTHR/tasks/${depthKeys.at(-1)}/workspace/files/content?path=${encodeURIComponent(path)}`,
      headers: { cookie, "x-request-id": "m3-workspace-object-store-unavailable" },
    });
    expect(unavailable.statusCode).toBe(409);
    await withoutObjectStore.close();

    expect(targetTaskId).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it("keeps search correct for 5,000 active Tasks without returning project bodies", async () => {
    const scale = await createProject("MSCL", "M3 scale");
    await bulkInsertTopLevelTasks(scale.id, scale.ownerMembershipId, 5_000);
    const startedAt = performance.now();
    const searched = await app.inject({
      method: "GET",
      url: "/api/v1/projects/MSCL/tasks/search?query=scale%20task%204999&limit=5",
      headers: { cookie, "x-request-id": "m3-search-scale" },
    });
    const elapsedMs = performance.now() - startedAt;
    expect(searched.statusCode).toBe(200);
    expect(searched.json()).toMatchObject({
      results: [{ task: { key: "MSCL-4999", title: "Scale task 4999" }, ancestors: [] }],
    });
    expect(JSON.stringify(searched.json())).not.toContain("content");
    expect(elapsedMs).toBeLessThan(5_000);
  }, 20_000);

  async function createProject(key: string, name: string) {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: {
        cookie,
        origin: publicOrigin,
        "x-request-id": `m3-project-${key.toLowerCase()}`,
      },
      payload: { key, name, idempotencyKey: randomUUID() },
    });
    expect(response.statusCode).toBe(201);
    return response.json<{
      project: { id: string; ownerMembershipId: string };
    }>().project;
  }

  async function bulkInsertTopLevelTasks(
    scaleProjectId: string,
    scaleOwnerMembershipId: string,
    count: number,
  ) {
    await database.transaction().execute(async (transaction) => {
      const scope = await transaction
        .selectFrom("sibling_task_graph_scopes")
        .select("id")
        .where("project_id", "=", scaleProjectId)
        .where("parent_task_id", "is", null)
        .executeTakeFirstOrThrow();
      const tasks = Array.from({ length: count }, (_, index) => {
        const sequence = index + 1;
        const id = deterministicUuid(`m3-scale-task:${sequence}`);
        return {
          id,
          project_id: scaleProjectId,
          task_sequence: String(sequence),
          task_key: `MSCL-${sequence}`,
          title: `Scale task ${sequence}`,
          content: `private body ${sequence}`,
          base_status: "not_started" as const,
          parent_task_id: null,
          parent_graph_scope_id: scope.id,
          explicit_owner_membership_id: scaleOwnerMembershipId,
          created_by_membership_id: scaleOwnerMembershipId,
        };
      });
      for (const batch of chunk(tasks, 400)) {
        await transaction.insertInto("tasks").values(batch).execute();
      }
      const workspaces = tasks.map((task) => ({
        id: deterministicUuid(`${task.id}:workspace`),
        scope_type: "task" as const,
        scope_id: task.id,
      }));
      for (const batch of chunk(tasks, 500)) {
        await transaction
          .insertInto("sibling_task_graph_scopes")
          .values(
            batch.map((task) => ({
              id: deterministicUuid(`${task.id}:children`),
              project_id: scaleProjectId,
              parent_task_id: task.id,
            })),
          )
          .execute();
      }
      for (const batch of chunk(workspaces, 500)) {
        await transaction.insertInto("workspaces").values(batch).execute();
        await transaction
          .insertInto("workspace_versions")
          .values(
            batch.map((workspace) => ({
              workspace_id: workspace.id,
              sync_version: "0",
              manifest_sha256: EMPTY_MANIFEST_HASH,
            })),
          )
          .execute();
      }
      await transaction
        .updateTable("projects")
        .set({ task_sequence: String(count) })
        .where("id", "=", scaleProjectId)
        .execute();
    });
  }

  function mutationHeaders(requestId: string) {
    return {
      cookie,
      origin: publicOrigin,
      "x-request-id": requestId,
      "idempotency-key": randomUUID(),
    };
  }

  function deterministicUuid(value: string): string {
    const hash = createHash("sha256").update(value).digest("hex");
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(
      17,
      20,
    )}-${hash.slice(20, 32)}`;
  }

  function chunk<T>(items: readonly T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }
});
