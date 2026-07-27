import {
  createDatabase,
  FoundationRepository,
  migrateToLatest,
  type Database,
} from "@ngapd/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApplicationError } from "../../application-errors.js";
import { TaskApplicationService, type TaskApplicationContext } from "./service.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const requestSha256 = "a".repeat(64);

describeWithDatabase("Task application service PostgreSQL integration", () => {
  let database: Database;
  let foundation: FoundationRepository;
  let service: TaskApplicationService;

  beforeAll(async () => {
    database = createDatabase(connectionString!);
    await database.schema.dropSchema("public").ifExists().cascade().execute();
    await database.schema.createSchema("public").execute();
    await migrateToLatest(database);
    foundation = new FoundationRepository(database);
    service = new TaskApplicationService(database);
  });

  afterAll(async () => {
    await database?.destroy();
  });

  it("resolves the server actor and atomically emits success audit/outbox with replay", async () => {
    const seeded = await seed("APPA");
    const context = taskContext("request-task-create", "task-create");
    const first = await service.createTask(
      {
        projectId: seeded.project.project.id,
        title: "Application task",
        parentTaskId: null,
        explicitOwnerMembershipId: seeded.project.ownerMembership.id,
      },
      { userId: seeded.owner.user.id, actorType: "human" },
      context,
    );
    const replay = await service.createTask(
      {
        projectId: seeded.project.project.id,
        title: "Application task",
        parentTaskId: null,
        explicitOwnerMembershipId: seeded.project.ownerMembership.id,
      },
      { userId: seeded.owner.user.id, actorType: "human" },
      context,
    );

    expect(first.task.taskKey).toBe("APPA-1");
    expect(replay).toMatchObject({ idempotentReplay: true, task: { id: first.task.id } });
    const audits = await database
      .selectFrom("audit_events")
      .select(["action", "result", "actor_type", "project_id", "target_id"])
      .where("request_id", "=", context.requestId)
      .execute();
    const outbox = await database
      .selectFrom("outbox_events")
      .select(["event_type", "aggregate_id"])
      .where("request_id", "=", context.requestId)
      .execute();
    expect(audits).toEqual([
      {
        action: "task.create",
        result: "success",
        actor_type: "human",
        project_id: seeded.project.project.id,
        target_id: first.task.id,
      },
    ]);
    expect(outbox).toEqual([{ event_type: "task.created", aggregate_id: first.task.id }]);
  });

  it("rejects a cross-tenant actor and records one idempotent failure audit", async () => {
    const seeded = await seed("APPB");
    const outsider = await foundation.createUserWithWorkspace({
      loginName: "outsider",
      normalizedLoginName: `outsider-${seeded.project.project.id}`,
      passwordHash: "argon2id$fixture",
    });
    const context = taskContext("request-cross-tenant", "cross-tenant");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        service.listProjectTasks(
          seeded.project.project.id,
          { userId: outsider.user.id, actorType: "agent" },
          context,
        ),
      ).rejects.toMatchObject<ApplicationError>({
        statusCode: 403,
        code: "FORBIDDEN",
      });
    }
    const audits = await database
      .selectFrom("audit_events")
      .select(["result", "reason_code", "actor_type"])
      .where("request_id", "=", context.requestId)
      .execute();
    expect(audits).toEqual([{ result: "failure", reason_code: "FORBIDDEN", actor_type: "agent" }]);
  });

  it("composes lifecycle completion without exposing a public Task route", async () => {
    const seeded = await seed("APPC");
    const created = await service.createTask(
      {
        projectId: seeded.project.project.id,
        title: "Complete through application",
        parentTaskId: null,
        explicitOwnerMembershipId: seeded.project.ownerMembership.id,
      },
      { userId: seeded.owner.user.id, actorType: "human" },
      taskContext("request-complete-create", "complete-create"),
    );
    const completed = await service.completeTask(
      {
        taskId: created.task.id,
        expectedTaskVersion: 1,
        expectedGraphVersion: 0,
        expectedWorkspaceSyncVersion: 0,
        finalServerVersionReceived: true,
        hasUncommittedClientVersion: false,
      },
      { userId: seeded.owner.user.id, actorType: "human" },
      taskContext("request-app-complete", "app-complete"),
    );
    expect(completed).toMatchObject({
      ok: true,
      taskId: created.task.id,
      taskVersion: 2,
      workspaceSyncVersion: 0,
    });
    const facts = await database
      .selectFrom("tasks as task")
      .innerJoin("workspaces as workspace", (join) =>
        join.onRef("workspace.scope_id", "=", "task.id").on("workspace.scope_type", "=", "task"),
      )
      .select(["task.frozen", "task.base_status", "workspace.lifecycle"])
      .where("task.id", "=", created.task.id)
      .executeTakeFirstOrThrow();
    expect(facts).toEqual({ frozen: true, base_status: "done", lifecycle: "frozen" });
  });

  it("maps missing resources to a stable error instead of INTERNAL_ERROR", async () => {
    const seeded = await seed("APPD");
    await expect(
      service.completeTask(
        {
          taskId: "10000000-0000-4000-8000-000000000999",
          expectedTaskVersion: 1,
          expectedGraphVersion: 0,
          expectedWorkspaceSyncVersion: 0,
          finalServerVersionReceived: true,
          hasUncommittedClientVersion: false,
        },
        { userId: seeded.owner.user.id, actorType: "human" },
        taskContext("request-missing-task", "missing-task"),
      ),
    ).rejects.toMatchObject<ApplicationError>({
      statusCode: 404,
      code: "TASK_NOT_FOUND",
    });
    const audit = await database
      .selectFrom("audit_events")
      .select(["result", "reason_code", "target_id"])
      .where("request_id", "=", "request-missing-task")
      .executeTakeFirstOrThrow();
    expect(audit).toEqual({
      result: "failure",
      reason_code: "TASK_NOT_FOUND",
      target_id: "10000000-0000-4000-8000-000000000999",
    });
  });

  async function seed(projectKey: string) {
    const owner = await foundation.createUserWithWorkspace({
      loginName: `${projectKey.toLowerCase()}-owner`,
      normalizedLoginName: `${projectKey.toLowerCase()}-owner`,
      passwordHash: "argon2id$fixture",
    });
    const project = await foundation.createProjectWithWorkspace({
      key: projectKey,
      name: `${projectKey} project`,
      ownerUserId: owner.user.id,
    });
    return { owner, project };
  }
});

function taskContext(requestId: string, idempotencyKey: string): TaskApplicationContext {
  return {
    requestId,
    idempotencyKey,
    requestSha256,
    actorType: "human",
    adminModeActive: false,
    adminSessionEnteredFromExplicitUserRequest: false,
    now: new Date("2026-07-27T03:00:00.000Z"),
  };
}
