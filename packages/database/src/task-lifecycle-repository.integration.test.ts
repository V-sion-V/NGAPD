import { createHash, randomUUID } from "node:crypto";

import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase } from "./client.js";
import { FoundationRepository } from "./foundation-repository.js";
import { migrateToLatest } from "./migrator.js";
import { canonicalDatabaseTarget, resetFormalSchema } from "./schema-profile.js";
import {
  TaskLifecycleRepository,
  type TaskLifecycleFailurePoint,
} from "./task-lifecycle-repository.js";
import { TaskRepository } from "./task-repository.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const database = connectionString ? createDatabase(connectionString) : null;
const foundation = database ? new FoundationRepository(database) : null;
const taskRepository = database ? new TaskRepository(database) : null;
const lifecycle = database ? new TaskLifecycleRepository(database) : null;

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function seedTask(projectKey: string, label: string) {
  const login = `lifecycle-${label}`;
  const owner = await foundation!.createUserWithWorkspace({
    loginName: login,
    normalizedLoginName: login,
    passwordHash: "argon2id$fixture",
  });
  const project = await foundation!.createProjectWithWorkspace({
    key: projectKey,
    name: `Lifecycle ${label}`,
    ownerUserId: owner.user.id,
  });
  const created = await taskRepository!.createTask({
    projectId: project.project.id,
    actorMembershipId: project.ownerMembership.id,
    idempotencyKey: `create-${label}`,
    requestSha256: hash(`create-${label}`),
    title: `Task ${label}`,
    parentTaskId: null,
    explicitOwnerMembershipId: project.ownerMembership.id,
  });
  expect(created).toMatchObject({ ok: true });
  if (!created.ok) {
    throw new Error("expected task creation");
  }
  return { owner, project, task: created.task, workspaceId: created.workspaceId };
}

async function addMember(projectId: string, label: string) {
  const login = `lifecycle-member-${label}`;
  const user = await foundation!.createUserWithWorkspace({
    loginName: login,
    normalizedLoginName: login,
    passwordHash: "argon2id$fixture",
  });
  const membership = await foundation!.createMembership({
    projectId,
    userId: user.user.id,
    role: "member",
  });
  return { user, membership };
}

async function addLease(input: { workspaceId: string; userId: string; label: string }) {
  const deviceId = randomUUID();
  const leaseId = randomUUID();
  await database!
    .insertInto("devices")
    .values({
      id: deviceId,
      user_id: input.userId,
      name: `Device ${input.label}`,
      platform: "windows",
    })
    .execute();
  await database!
    .insertInto("workspace_leases")
    .values({
      id: leaseId,
      workspace_id: input.workspaceId,
      work_cycle: 1,
      user_id: input.userId,
      device_id: deviceId,
      connection_id: randomUUID(),
      token_hash: hash(`lease-${input.label}`),
      base_sync_version: "0",
      issued_at: new Date("2026-07-27T02:00:00.000Z"),
      renewed_at: new Date("2026-07-27T02:00:00.000Z"),
      expires_at: new Date("2026-07-27T03:00:00.000Z"),
      revoked_at: null,
      revoke_reason: null,
    })
    .execute();
  return leaseId;
}

function completionInput(seeded: Awaited<ReturnType<typeof seedTask>>, label: string) {
  return {
    taskId: seeded.task.id,
    actorMembershipId: seeded.project.ownerMembership.id,
    actorType: "human" as const,
    adminModeActive: false,
    adminSessionEnteredFromExplicitUserRequest: false,
    expectedTaskVersion: seeded.task.version,
    expectedGraphVersion: 0,
    expectedWorkspaceSyncVersion: 0,
    finalServerVersionReceived: true,
    hasUncommittedClientVersion: false,
    requestId: `complete-${label}`,
    idempotencyKey: `complete-${label}`,
    requestSha256: hash(`complete-${label}`),
    now: new Date("2026-07-27T02:10:00.000Z"),
  };
}

async function lifecycleCounts(taskId: string, requestId: string) {
  const [task, workspace, snapshot, audit, outbox, activeLease] = await Promise.all([
    database!
      .selectFrom("tasks")
      .select(["base_status", "frozen", "version", "explicit_owner_membership_id"])
      .where("id", "=", taskId)
      .executeTakeFirstOrThrow(),
    database!
      .selectFrom("workspaces")
      .select(["id", "lifecycle", "work_cycle", "sync_version"])
      .where("scope_type", "=", "task")
      .where("scope_id", "=", taskId)
      .executeTakeFirstOrThrow(),
    database!
      .selectFrom("task_completion_snapshots")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("task_id", "=", taskId)
      .executeTakeFirstOrThrow(),
    database!
      .selectFrom("audit_events")
      .select(["result", "reason_code"])
      .where("request_id", "=", requestId)
      .orderBy("created_at")
      .execute(),
    database!
      .selectFrom("outbox_events")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("request_id", "=", requestId)
      .executeTakeFirstOrThrow(),
    database!
      .selectFrom("workspace_leases")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("revoked_at", "is", null)
      .where(
        "workspace_id",
        "=",
        database!
          .selectFrom("workspaces")
          .select("id")
          .where("scope_type", "=", "task")
          .where("scope_id", "=", taskId),
      )
      .executeTakeFirstOrThrow(),
  ]);
  return {
    task,
    workspace,
    snapshotCount: Number(snapshot.count),
    audit,
    outboxCount: Number(outbox.count),
    activeLeaseCount: Number(activeLease.count),
  };
}

describeWithDatabase("Task and Workspace lifecycle PostgreSQL integration", () => {
  beforeAll(async () => {
    const target = canonicalDatabaseTarget(connectionString!);
    await resetFormalSchema({ database: database!, target, confirmation: target });
    await migrateToLatest(database!);
  });

  afterAll(async () => {
    await database?.destroy();
  });

  it("atomically completes, snapshots, freezes, revokes, audits and replays", async () => {
    const seeded = await seedTask("DONE", "complete-success");
    const leaseId = await addLease({
      workspaceId: seeded.workspaceId,
      userId: seeded.owner.user.id,
      label: "complete-success",
    });
    const input = completionInput(seeded, "success");
    const completed = await lifecycle!.completeTask(input);
    expect(completed).toMatchObject({
      ok: true,
      taskVersion: 2,
      workspaceSyncVersion: 0,
      idempotentReplay: false,
    });
    await expect(lifecycle!.completeTask(input)).resolves.toMatchObject({
      ok: true,
      taskVersion: 2,
      idempotentReplay: true,
    });

    const facts = await lifecycleCounts(seeded.task.id, input.requestId);
    expect(facts.task).toMatchObject({ base_status: "done", frozen: true, version: "2" });
    expect(facts.workspace).toMatchObject({
      lifecycle: "frozen",
      work_cycle: 1,
      sync_version: "0",
    });
    expect(facts.snapshotCount).toBe(1);
    expect(facts.audit).toEqual([{ result: "success", reason_code: "completed" }]);
    expect(facts.outboxCount).toBe(1);
    expect(facts.activeLeaseCount).toBe(0);
    await expect(
      database!
        .selectFrom("workspace_leases")
        .select("revoke_reason")
        .where("id", "=", leaseId)
        .executeTakeFirstOrThrow(),
    ).resolves.toMatchObject({ revoke_reason: "task_completed" });

    await expect(
      database!
        .updateTable("tasks")
        .set({ title: "low-level bypass" })
        .where("id", "=", seeded.task.id)
        .execute(),
    ).rejects.toThrow("COMPLETED_TASK_FROZEN");
    await expect(
      database!
        .insertInto("workspace_versions")
        .values({
          workspace_id: seeded.workspaceId,
          sync_version: "1",
          manifest_sha256: "a".repeat(64),
          created_by_user_id: null,
          device_id: null,
          lease_id: null,
        })
        .execute(),
    ).rejects.toThrow("TASK_WORKSPACE_FROZEN");
    await expect(
      sql`update task_completion_snapshots set task_snapshot = '{}'::jsonb
        where task_id = ${seeded.task.id}`.execute(database!),
    ).rejects.toThrow("IMMUTABLE_RECORD");
    await expect(
      sql`update audit_events set reason_code = 'changed'
        where request_id = ${input.requestId}`.execute(database!),
    ).rejects.toThrow("IMMUTABLE_RECORD");
  });

  it("rolls back every injected transaction boundary and writes one failure audit", async () => {
    const points: TaskLifecycleFailurePoint[] = [
      "after_validation",
      "after_task",
      "after_snapshot",
      "after_workspace",
      "after_lease",
      "after_audit",
      "after_outbox",
    ];
    const keys = ["FA", "FB", "FC", "FD", "FE", "FF", "FG"];
    for (const [index, point] of points.entries()) {
      const seeded = await seedTask(keys[index]!, `failure-${point}`);
      await addLease({
        workspaceId: seeded.workspaceId,
        userId: seeded.owner.user.id,
        label: `failure-${point}`,
      });
      const input = completionInput(seeded, `failure-${point}`);
      const failing = new TaskLifecycleRepository(database!, (observed) => {
        if (observed === point) {
          throw new Error(`INJECTED_${point}`);
        }
      });
      await expect(failing.completeTask(input)).rejects.toThrow(`INJECTED_${point}`);
      await expect(failing.completeTask(input)).rejects.toThrow(`INJECTED_${point}`);
      const facts = await lifecycleCounts(seeded.task.id, input.requestId);
      expect(facts.task).toMatchObject({
        base_status: "not_started",
        frozen: false,
        version: "1",
      });
      expect(facts.workspace).toMatchObject({ lifecycle: "active", work_cycle: 1 });
      expect(facts.snapshotCount).toBe(0);
      expect(facts.outboxCount).toBe(0);
      expect(facts.activeLeaseCount).toBe(1);
      expect(facts.audit).toEqual([{ result: "failure", reason_code: "transaction_failed" }]);
    }
  }, 30_000);

  it("reopens into a new work cycle while preserving the completion snapshot", async () => {
    const seeded = await seedTask("OPEN", "reopen");
    const completed = await lifecycle!.completeTask(completionInput(seeded, "reopen-complete"));
    expect(completed).toMatchObject({ ok: true, taskVersion: 2 });
    const reopened = await lifecycle!.reopenTask({
      taskId: seeded.task.id,
      policy: "deny",
      expectedTaskVersions: { [seeded.task.id]: 2 },
      expectedOwnerMembershipIds: {
        [seeded.task.id]: seeded.project.ownerMembership.id,
      },
      confirmedTaskIds: [seeded.task.id],
      actorMembershipId: seeded.project.ownerMembership.id,
      actorType: "human",
      adminModeActive: false,
      adminSessionEnteredFromExplicitUserRequest: false,
      requestId: "reopen-success",
      idempotencyKey: "reopen-success",
      requestSha256: hash("reopen-success"),
      now: new Date("2026-07-27T02:20:00.000Z"),
    });
    expect(reopened).toEqual({
      ok: true,
      taskIds: [seeded.task.id],
      idempotentReplay: false,
    });
    const task = await database!
      .selectFrom("tasks")
      .select(["base_status", "frozen", "version"])
      .where("id", "=", seeded.task.id)
      .executeTakeFirstOrThrow();
    const workspace = await database!
      .selectFrom("workspaces")
      .select(["lifecycle", "work_cycle", "sync_version"])
      .where("id", "=", seeded.workspaceId)
      .executeTakeFirstOrThrow();
    expect(task).toEqual({ base_status: "in_progress", frozen: false, version: "3" });
    expect(workspace).toEqual({ lifecycle: "active", work_cycle: 2, sync_version: "0" });
    const snapshots = await database!
      .selectFrom("task_completion_snapshots")
      .select(["task_version", "workspace_sync_version", "work_cycle"])
      .where("task_id", "=", seeded.task.id)
      .execute();
    expect(snapshots).toEqual([{ task_version: "2", workspace_sync_version: "0", work_cycle: 1 }]);
    await expect(
      database!
        .selectFrom("task_workspace_transition_snapshots")
        .select(["transition_type", "task_version", "work_cycle"])
        .where("task_id", "=", seeded.task.id)
        .executeTakeFirstOrThrow(),
    ).resolves.toEqual({
      transition_type: "reopen",
      task_version: "3",
      work_cycle: 1,
    });
  });

  it("enforces deny/cascade successor semantics", async () => {
    const seeded = await seedTask("CASE", "cascade");
    const successor = await taskRepository!.createTask({
      projectId: seeded.project.project.id,
      actorMembershipId: seeded.project.ownerMembership.id,
      idempotencyKey: "cascade-successor",
      requestSha256: hash("cascade-successor"),
      title: "Successor",
      parentTaskId: null,
      explicitOwnerMembershipId: seeded.project.ownerMembership.id,
    });
    expect(successor).toMatchObject({ ok: true });
    if (!successor.ok) {
      throw new Error("expected successor");
    }
    await expect(
      taskRepository!.changeDependency({
        action: "add",
        predecessorTaskId: seeded.task.id,
        successorTaskId: successor.task.id,
        actorMembershipId: seeded.project.ownerMembership.id,
        adminModeActive: false,
        expectedGraphVersion: 0,
        requestId: "cascade-edge",
        expiresAt: new Date("2026-07-28T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({ ok: true, mode: "direct", graphVersion: 1 });
    const firstComplete = {
      ...completionInput(seeded, "cascade-first"),
      expectedGraphVersion: 1,
    };
    await expect(lifecycle!.completeTask(firstComplete)).resolves.toMatchObject({ ok: true });
    const successorSeed = {
      ...seeded,
      task: successor.task,
      workspaceId: successor.workspaceId,
    };
    const secondComplete = {
      ...completionInput(successorSeed, "cascade-second"),
      expectedGraphVersion: 1,
    };
    await expect(lifecycle!.completeTask(secondComplete)).resolves.toMatchObject({ ok: true });
    const versions = {
      [seeded.task.id]: 2,
      [successor.task.id]: 2,
    };
    const owners = {
      [seeded.task.id]: seeded.project.ownerMembership.id,
      [successor.task.id]: seeded.project.ownerMembership.id,
    };
    const baseInput = {
      taskId: seeded.task.id,
      expectedTaskVersions: versions,
      expectedOwnerMembershipIds: owners,
      actorMembershipId: seeded.project.ownerMembership.id,
      actorType: "human" as const,
      adminModeActive: false,
      adminSessionEnteredFromExplicitUserRequest: false,
      requestId: "cascade-reopen",
      idempotencyKey: "cascade-reopen",
      requestSha256: hash("cascade-reopen"),
      now: new Date("2026-07-27T02:30:00.000Z"),
    };
    await expect(
      lifecycle!.reopenTask({
        ...baseInput,
        policy: "deny",
        confirmedTaskIds: [seeded.task.id],
      }),
    ).resolves.toEqual({
      ok: false,
      reason: "completed_successor_exists",
      taskIds: [successor.task.id],
    });
    await expect(
      lifecycle!.reopenTask({
        ...baseInput,
        policy: "cascade",
        confirmedTaskIds: [seeded.task.id, successor.task.id],
      }),
    ).resolves.toEqual({
      ok: true,
      taskIds: [seeded.task.id, successor.task.id].sort(),
      idempotentReplay: false,
    });
    const reopened = await database!
      .selectFrom("tasks")
      .select(["id", "base_status", "frozen"])
      .where("id", "in", [seeded.task.id, successor.task.id])
      .orderBy("id")
      .execute();
    expect(reopened.every((task) => task.base_status === "in_progress" && !task.frozen)).toBe(true);
  });

  it("changes Owner with a snapshot and lease revoke but no work-cycle reset", async () => {
    const seeded = await seedTask("OWN", "owner-change");
    const nextOwner = await addMember(seeded.project.project.id, "owner-change");
    await addLease({
      workspaceId: seeded.workspaceId,
      userId: seeded.owner.user.id,
      label: "owner-change",
    });
    await expect(
      lifecycle!.changeOwner({
        taskId: seeded.task.id,
        nextOwnerMembershipId: nextOwner.membership.id,
        expectedTaskVersion: 1,
        expectedWorkspaceSyncVersion: 0,
        hasUncommittedClientVersion: false,
        impactConfirmed: true,
        confirmedTaskIds: [seeded.task.id],
        expectedAffectedTaskVersions: { [seeded.task.id]: 1 },
        expectedAffectedWorkspaceSyncVersions: { [seeded.task.id]: 0 },
        uncommittedWorkspaceTaskIds: [],
        actorMembershipId: seeded.project.ownerMembership.id,
        actorType: "human",
        adminModeActive: false,
        adminSessionEnteredFromExplicitUserRequest: false,
        requestId: "owner-change-success",
        idempotencyKey: "owner-change-success",
        requestSha256: hash("owner-change-success"),
        now: new Date("2026-07-27T02:40:00.000Z"),
      }),
    ).resolves.toMatchObject({
      ok: true,
      taskVersion: 2,
      ownerMembershipId: nextOwner.membership.id,
    });
    const task = await database!
      .selectFrom("tasks")
      .select(["explicit_owner_membership_id", "version"])
      .where("id", "=", seeded.task.id)
      .executeTakeFirstOrThrow();
    const workspace = await database!
      .selectFrom("workspaces")
      .select(["lifecycle", "work_cycle"])
      .where("id", "=", seeded.workspaceId)
      .executeTakeFirstOrThrow();
    expect(task).toEqual({
      explicit_owner_membership_id: nextOwner.membership.id,
      version: "2",
    });
    expect(workspace).toEqual({ lifecycle: "active", work_cycle: 1 });
    await expect(
      database!
        .selectFrom("task_workspace_transition_snapshots")
        .select(["transition_type", "owner_membership_id", "task_version"])
        .where("task_id", "=", seeded.task.id)
        .executeTakeFirstOrThrow(),
    ).resolves.toEqual({
      transition_type: "owner_change",
      owner_membership_id: nextOwner.membership.id,
      task_version: "2",
    });
    const activeLease = await database!
      .selectFrom("workspace_leases")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("workspace_id", "=", seeded.workspaceId)
      .where("revoked_at", "is", null)
      .executeTakeFirstOrThrow();
    expect(Number(activeLease.count)).toBe(0);
  });

  it("atomically coordinates inherited descendant Workspaces on Owner change", async () => {
    const seeded = await seedTask("TROWN", "owner-change-tree");
    const nextOwner = await addMember(seeded.project.project.id, "owner-change-tree-next");
    const isolatedOwner = await addMember(seeded.project.project.id, "owner-change-tree-isolated");
    const inherited = await taskRepository!.createTask({
      projectId: seeded.project.project.id,
      actorMembershipId: seeded.project.ownerMembership.id,
      actorType: "human",
      adminModeActive: false,
      adminSessionEnteredFromExplicitUserRequest: false,
      idempotencyKey: "owner-change-tree-inherited",
      requestSha256: hash("owner-change-tree-inherited"),
      title: "Inherited descendant",
      parentTaskId: seeded.task.id,
      explicitOwnerMembershipId: null,
    });
    const isolated = await taskRepository!.createTask({
      projectId: seeded.project.project.id,
      actorMembershipId: seeded.project.ownerMembership.id,
      actorType: "human",
      adminModeActive: false,
      adminSessionEnteredFromExplicitUserRequest: false,
      idempotencyKey: "owner-change-tree-isolated",
      requestSha256: hash("owner-change-tree-isolated"),
      title: "Explicit-owner descendant",
      parentTaskId: seeded.task.id,
      explicitOwnerMembershipId: isolatedOwner.membership.id,
    });
    expect(inherited).toMatchObject({ ok: true });
    expect(isolated).toMatchObject({ ok: true });
    if (!inherited.ok || !isolated.ok) {
      throw new Error("expected descendant creation");
    }
    await Promise.all([
      addLease({
        workspaceId: seeded.workspaceId,
        userId: seeded.owner.user.id,
        label: "owner-change-tree-target",
      }),
      addLease({
        workspaceId: inherited.workspaceId,
        userId: seeded.owner.user.id,
        label: "owner-change-tree-inherited",
      }),
      addLease({
        workspaceId: isolated.workspaceId,
        userId: isolatedOwner.user.user.id,
        label: "owner-change-tree-isolated",
      }),
    ]);

    const affectedTaskIds = [seeded.task.id, inherited.task.id];
    const confirmedTaskIds = [...affectedTaskIds, isolated.task.id].sort();
    const baseInput = {
      taskId: seeded.task.id,
      nextOwnerMembershipId: nextOwner.membership.id,
      expectedTaskVersion: 1,
      expectedWorkspaceSyncVersion: 0,
      hasUncommittedClientVersion: false,
      impactConfirmed: true,
      confirmedTaskIds,
      expectedAffectedTaskVersions: Object.fromEntries(
        affectedTaskIds.map((taskId) => [taskId, 1]),
      ),
      expectedAffectedWorkspaceSyncVersions: Object.fromEntries(
        affectedTaskIds.map((taskId) => [taskId, 0]),
      ),
      actorMembershipId: seeded.project.ownerMembership.id,
      actorType: "human" as const,
      adminModeActive: false,
      adminSessionEnteredFromExplicitUserRequest: false,
      requestSha256: hash("owner-change-tree"),
      now: new Date("2026-07-27T02:50:00.000Z"),
    };
    await expect(
      lifecycle!.changeOwner({
        ...baseInput,
        uncommittedWorkspaceTaskIds: [inherited.task.id],
        requestId: "owner-change-tree-unsynced",
        idempotencyKey: "owner-change-tree-unsynced",
      }),
    ).resolves.toEqual({ ok: false, reason: "workspace_has_uncommitted_client_version" });
    await expect(
      lifecycle!.changeOwner({
        ...baseInput,
        expectedAffectedWorkspaceSyncVersions: {
          ...baseInput.expectedAffectedWorkspaceSyncVersions,
          [inherited.task.id]: 1,
        },
        uncommittedWorkspaceTaskIds: [],
        requestId: "owner-change-tree-stale",
        idempotencyKey: "owner-change-tree-stale",
      }),
    ).resolves.toEqual({ ok: false, reason: "workspace_version_conflict" });
    const failing = new TaskLifecycleRepository(database!, (point) => {
      if (point === "after_lease") {
        throw new Error("injected owner-change rollback");
      }
    });
    await expect(
      failing.changeOwner({
        ...baseInput,
        uncommittedWorkspaceTaskIds: [],
        requestId: "owner-change-tree-rollback",
        idempotencyKey: "owner-change-tree-rollback",
      }),
    ).rejects.toThrow("injected owner-change rollback");
    const rollbackTasks = await database!
      .selectFrom("tasks")
      .select(["id", "explicit_owner_membership_id", "version"])
      .where("id", "in", [seeded.task.id, inherited.task.id])
      .orderBy("id")
      .execute();
    expect(rollbackTasks).toEqual(
      [
        {
          id: seeded.task.id,
          explicit_owner_membership_id: seeded.project.ownerMembership.id,
          version: "1",
        },
        {
          id: inherited.task.id,
          explicit_owner_membership_id: null,
          version: "1",
        },
      ].sort((left, right) => left.id.localeCompare(right.id)),
    );
    await expect(
      database!
        .selectFrom("task_workspace_transition_snapshots")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("task_id", "in", [seeded.task.id, inherited.task.id])
        .executeTakeFirstOrThrow(),
    ).resolves.toEqual({ count: "0" });
    await expect(
      database!
        .selectFrom("workspace_leases")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("workspace_id", "in", [seeded.workspaceId, inherited.workspaceId])
        .where("revoked_at", "is", null)
        .executeTakeFirstOrThrow(),
    ).resolves.toEqual({ count: "2" });
    await expect(
      lifecycle!.changeOwner({
        ...baseInput,
        uncommittedWorkspaceTaskIds: [],
        requestId: "owner-change-tree-success",
        idempotencyKey: "owner-change-tree-success",
      }),
    ).resolves.toMatchObject({
      ok: true,
      taskVersion: 2,
      ownerMembershipId: nextOwner.membership.id,
    });

    await expect(taskRepository!.resolveEffectiveOwner(inherited.task.id)).resolves.toMatchObject({
      ok: true,
      membershipId: nextOwner.membership.id,
    });
    const taskRows = await database!
      .selectFrom("tasks")
      .select(["id", "explicit_owner_membership_id", "version"])
      .where("id", "in", [seeded.task.id, inherited.task.id, isolated.task.id])
      .orderBy("id")
      .execute();
    expect(taskRows).toEqual(
      [
        {
          id: seeded.task.id,
          explicit_owner_membership_id: nextOwner.membership.id,
          version: "2",
        },
        {
          id: inherited.task.id,
          explicit_owner_membership_id: null,
          version: "2",
        },
        {
          id: isolated.task.id,
          explicit_owner_membership_id: isolatedOwner.membership.id,
          version: "1",
        },
      ].sort((left, right) => left.id.localeCompare(right.id)),
    );
    const snapshots = await database!
      .selectFrom("task_workspace_transition_snapshots")
      .select(["task_id", "task_version", "owner_membership_id"])
      .where("transition_type", "=", "owner_change")
      .where("task_id", "in", [seeded.task.id, inherited.task.id, isolated.task.id])
      .orderBy("task_id")
      .execute();
    expect(snapshots).toEqual(
      affectedTaskIds
        .map((taskId) => ({
          task_id: taskId,
          task_version: "2",
          owner_membership_id: nextOwner.membership.id,
        }))
        .sort((left, right) => left.task_id.localeCompare(right.task_id)),
    );
    const activeLeases = await database!
      .selectFrom("workspace_leases")
      .innerJoin("workspaces", "workspaces.id", "workspace_leases.workspace_id")
      .select(["workspaces.scope_id"])
      .where("workspaces.scope_type", "=", "task")
      .where("workspaces.scope_id", "in", [seeded.task.id, inherited.task.id, isolated.task.id])
      .where("workspace_leases.revoked_at", "is", null)
      .execute();
    expect(activeLeases).toEqual([{ scope_id: isolated.task.id }]);
  });
});
