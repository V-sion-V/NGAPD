import { createHash, randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase } from "./client.js";
import { FoundationRepository } from "./foundation-repository.js";
import { migrateToLatest } from "./migrator.js";
import { OutboxRepository } from "./outbox-repository.js";
import { canonicalDatabaseTarget, resetFormalSchema } from "./schema-profile.js";
import { TaskProjectionRepository } from "./task-projection-repository.js";
import { TaskRepository } from "./task-repository.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const database = connectionString ? createDatabase(connectionString) : null;

describeWithDatabase("Task projection PostgreSQL integration", () => {
  const now = new Date("2026-07-30T08:00:00.000Z");
  let projectId: string;
  let ownerUserId: string;
  let ownerMembershipId: string;
  let taskId: string;

  beforeAll(async () => {
    const target = canonicalDatabaseTarget(connectionString!);
    await resetFormalSchema({ database: database!, target, confirmation: target });
    await migrateToLatest(database!);
    const foundation = new FoundationRepository(database!);
    const owner = await foundation.createUserWithWorkspace({
      loginName: "projection-owner",
      normalizedLoginName: "projection-owner",
      passwordHash: "argon2id$fixture",
    });
    const project = await foundation.createProjectWithWorkspace({
      key: "PROJ",
      name: "Projection project",
      ownerUserId: owner.user.id,
    });
    projectId = project.project.id;
    ownerUserId = owner.user.id;
    ownerMembershipId = project.ownerMembership.id;
    const task = await new TaskRepository(database!).createTask({
      projectId,
      actorMembershipId: ownerMembershipId,
      requestId: "projection-create",
      idempotencyKey: "projection-create",
      requestSha256: sha256("projection-create"),
      title: "Projection task",
      dueAt: "2026-07-30T09:00:00.000Z",
      parentTaskId: null,
      explicitOwnerMembershipId: ownerMembershipId,
    });
    if (!task.ok) {
      throw new Error(`Task fixture failed: ${task.reason}`);
    }
    taskId = task.task.id;
    const blocker = await new TaskRepository(database!).addBlocker({
      taskId,
      actorMembershipId: ownerMembershipId,
      actorType: "human",
      adminModeActive: false,
      adminSessionEnteredFromExplicitUserRequest: false,
      expectedTaskVersion: 1,
      requestId: "projection-blocker",
      reason: "Projection fixture blocker",
    });
    if (!blocker.ok) {
      throw new Error(`Blocker fixture failed: ${blocker.reason}`);
    }
    await dispatchAll();
  }, 30_000);

  afterAll(async () => {
    await database?.destroy();
  });

  it("restores missing Activity and Notification rows without duplicating retained projections", async () => {
    const before = await projectionCounts();
    expect(before).toMatchObject({
      blockerActivity: 1,
      blockerNotifications: 1,
    });

    await database!
      .deleteFrom("task_activity_projection")
      .where("task_id", "=", taskId)
      .where("event_type", "=", "task.blocker.changed")
      .execute();
    await database!
      .deleteFrom("task_notifications")
      .where("task_id", "=", taskId)
      .where("event_type", "=", "task.blocker.changed")
      .execute();

    await new TaskProjectionRepository(database!).rebuildProject(projectId, now);
    const rebuilt = await projectionCounts();
    expect(rebuilt).toEqual(before);

    await new TaskProjectionRepository(database!).rebuildProject(projectId, now);
    expect(await projectionCounts()).toEqual(before);
  });

  it("enqueues and projects each due-time reminder occurrence once", async () => {
    const projections = new TaskProjectionRepository(database!);
    await expect(
      projections.enqueueDueReminders({
        now,
        through: new Date("2026-07-30T10:00:00.000Z"),
      }),
    ).resolves.toBe(1);
    await expect(
      projections.enqueueDueReminders({
        now,
        through: new Date("2026-07-30T10:00:00.000Z"),
      }),
    ).resolves.toBe(0);
    await dispatchAll();

    const reminders = await database!
      .selectFrom("task_notifications")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("recipient_user_id", "=", ownerUserId)
      .where("task_id", "=", taskId)
      .where("event_type", "=", "task.due.reminder")
      .executeTakeFirstOrThrow();
    expect(Number(reminders.count)).toBe(1);
  });

  it("returns navigation keys only while the recipient membership is active", async () => {
    const foundation = new FoundationRepository(database!);
    const recipient = await foundation.createUserWithWorkspace({
      loginName: "projection-recipient",
      normalizedLoginName: "projection-recipient",
      passwordHash: "argon2id$fixture",
    });
    const membership = await foundation.createMembership({
      projectId,
      userId: recipient.user.id,
      permissionLevel: "member",
    });
    const notificationId = randomUUID();
    await database!
      .insertInto("task_notifications")
      .values({
        id: notificationId,
        project_id: projectId,
        recipient_user_id: recipient.user.id,
        recipient_membership_id: membership.id,
        task_id: taskId,
        event_type: "task.comment.created",
        occurrence_key: `navigation:${notificationId}`,
        critical: false,
        resource_refs: {},
        source_outbox_event_id: null,
      })
      .execute();
    const projections = new TaskProjectionRepository(database!);
    await expect(projections.listNotifications({ userId: recipient.user.id })).resolves.toEqual([
      expect.objectContaining({
        id: notificationId,
        projectKey: "PROJ",
        taskKey: "PROJ-1",
      }),
    ]);
    await expect(
      projections.markNotificationRead({
        userId: recipient.user.id,
        notificationId,
        expectedVersion: 1,
        read: true,
        now,
        requestId: `navigation-read:${notificationId}`,
      }),
    ).resolves.toMatchObject({
      ok: true,
      notification: {
        id: notificationId,
        projectKey: "PROJ",
        taskKey: "PROJ-1",
        read: true,
        version: 2,
      },
    });

    await database!
      .updateTable("memberships")
      .set({ status: "removed", permission_level: "member" })
      .where("id", "=", membership.id)
      .execute();
    await expect(projections.listNotifications({ userId: recipient.user.id })).resolves.toEqual([
      expect.objectContaining({
        id: notificationId,
        projectKey: null,
        taskKey: null,
      }),
    ]);
  });

  it("retains notification meaning but drops the Task navigation key after deletion", async () => {
    const projections = new TaskProjectionRepository(database!);
    expect(
      (await projections.listNotifications({ userId: ownerUserId })).some(
        (notification) =>
          notification.taskId === taskId &&
          notification.projectKey === "PROJ" &&
          notification.taskKey === "PROJ-1",
      ),
    ).toBe(true);
    await database!.transaction().execute(async (transaction) => {
      await transaction
        .updateTable("workspaces")
        .set({ lifecycle: "deleted" })
        .where("scope_type", "=", "task")
        .where("scope_id", "=", taskId)
        .execute();
      await transaction.deleteFrom("task_blockers").where("task_id", "=", taskId).execute();
      await transaction.deleteFrom("tasks").where("id", "=", taskId).execute();
    });
    const retained = await projections.listNotifications({ userId: ownerUserId });
    expect(
      retained
        .filter((notification) => notification.taskId === taskId)
        .every(
          (notification) => notification.projectKey === "PROJ" && notification.taskKey === null,
        ),
    ).toBe(true);
  });

  async function dispatchAll() {
    const outbox = new OutboxRepository(database!);
    for (let index = 0; index < 100; index += 1) {
      const result = await outbox.dispatchNext({
        now: new Date("9999-01-01T00:00:00.000Z"),
      });
      if (result.status === "empty") {
        return;
      }
    }
    throw new Error("Projection fixture outbox did not drain");
  }

  async function projectionCounts() {
    const [activity, notifications, allActivity, allNotifications] = await Promise.all([
      database!
        .selectFrom("task_activity_projection")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("task_id", "=", taskId)
        .where("event_type", "=", "task.blocker.changed")
        .executeTakeFirstOrThrow(),
      database!
        .selectFrom("task_notifications")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("task_id", "=", taskId)
        .where("event_type", "=", "task.blocker.changed")
        .executeTakeFirstOrThrow(),
      database!
        .selectFrom("task_activity_projection")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("project_id", "=", projectId)
        .executeTakeFirstOrThrow(),
      database!
        .selectFrom("task_notifications")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("project_id", "=", projectId)
        .executeTakeFirstOrThrow(),
    ]);
    return {
      blockerActivity: Number(activity.count),
      blockerNotifications: Number(notifications.count),
      allActivity: Number(allActivity.count),
      allNotifications: Number(allNotifications.count),
    };
  }
});

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
