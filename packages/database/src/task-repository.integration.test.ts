import { createHash } from "node:crypto";

import { sql, type Transaction } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase } from "./client.js";
import { FoundationRepository } from "./foundation-repository.js";
import { migrateToLatest } from "./migrator.js";
import { canonicalDatabaseTarget, resetFormalSchema } from "./schema-profile.js";
import { TaskRepository } from "./task-repository.js";
import type { DatabaseSchema } from "./types.js";

const connectionString = process.env.DATABASE_TEST_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;
const database = connectionString ? createDatabase(connectionString) : null;
const foundation = database ? new FoundationRepository(database) : null;
const repository = database ? new TaskRepository(database) : null;
const EMPTY_MANIFEST_HASH = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";

function requestHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicUuid(value: string): string {
  const hash = requestHash(value);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(
    16,
    20,
  )}-${hash.slice(20, 32)}`;
}

function deterministicDagEdges(nodeCount: number, edgeCount: number, seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state;
  };
  const edges = new Set<string>();
  while (edges.size < edgeCount) {
    const predecessor = next() % (nodeCount - 1);
    const successor = predecessor + 1 + (next() % (nodeCount - predecessor - 1));
    edges.add(`${predecessor}:${successor}`);
  }
  return [...edges].map((edge) => edge.split(":").map(Number) as [number, number]);
}

async function seedProject(key: string) {
  const suffix = key.toLowerCase();
  const owner = await foundation!.createUserWithWorkspace({
    loginName: `owner-${suffix}`,
    normalizedLoginName: `owner-${suffix}`,
    passwordHash: "argon2id$fixture",
  });
  const project = await foundation!.createProjectWithWorkspace({
    key,
    name: `Project ${key}`,
    ownerUserId: owner.user.id,
  });
  return { owner, project };
}

async function addMember(projectId: string, label: string) {
  const user = await foundation!.createUserWithWorkspace({
    loginName: `member-${label}`,
    normalizedLoginName: `member-${label}`,
    passwordHash: "argon2id$fixture",
  });
  const membership = await foundation!.createMembership({
    projectId,
    userId: user.user.id,
    permissionLevel: "member",
  });
  return { user, membership };
}

async function createTask(input: {
  projectId: string;
  actorMembershipId: string;
  label: string;
  parentTaskId?: string | null;
  explicitOwnerMembershipId?: string | null;
}) {
  const result = await repository!.createTask({
    projectId: input.projectId,
    actorMembershipId: input.actorMembershipId,
    idempotencyKey: `create-${input.label}`,
    requestSha256: requestHash(`create-${input.label}`),
    title: `Task ${input.label}`,
    parentTaskId: input.parentTaskId ?? null,
    explicitOwnerMembershipId:
      input.explicitOwnerMembershipId === undefined
        ? input.actorMembershipId
        : input.explicitOwnerMembershipId,
  });
  expect(result).toMatchObject({ ok: true });
  return result.ok ? result.task : neverResult();
}

async function bulkInsertTopLevelTasks(input: {
  projectId: string;
  projectKey: string;
  ownerMembershipId: string;
  count: number;
  seed: string;
}) {
  await database!.transaction().execute(async (transaction) => {
    const scope = await transaction
      .selectFrom("sibling_task_graph_scopes")
      .select("id")
      .where("project_id", "=", input.projectId)
      .where("parent_task_id", "is", null)
      .executeTakeFirstOrThrow();
    await sql`
      insert into tasks (
        id,
        project_id,
        task_sequence,
        task_key,
        title,
        base_status,
        parent_task_id,
        parent_graph_scope_id,
        explicit_owner_membership_id,
        created_by_membership_id
      )
      select
        md5(${input.seed} || ':task:' || value::text)::uuid,
        ${input.projectId}::uuid,
        value,
        ${input.projectKey} || '-' || value::text,
        'Scale task ' || value::text,
        'not_started',
        null,
        ${scope.id}::uuid,
        ${input.ownerMembershipId}::uuid,
        ${input.ownerMembershipId}::uuid
      from generate_series(1, ${input.count}) value
    `.execute(transaction);
    await sql`
      insert into sibling_task_graph_scopes (id, project_id, parent_task_id)
      select
        md5(task.id::text || ':children')::uuid,
        task.project_id,
        task.id
      from tasks task
      where task.project_id = ${input.projectId}::uuid
    `.execute(transaction);
    await sql`
      insert into workspaces (id, scope_type, scope_id)
      select md5(task.id::text || ':workspace')::uuid, 'task', task.id
      from tasks task
      where task.project_id = ${input.projectId}::uuid
    `.execute(transaction);
    await sql`
      insert into workspace_versions (workspace_id, sync_version, manifest_sha256)
      select workspace.id, 0, ${EMPTY_MANIFEST_HASH}
      from workspaces workspace
      join tasks task on workspace.scope_type = 'task' and workspace.scope_id = task.id
      where task.project_id = ${input.projectId}::uuid
    `.execute(transaction);
    await transaction
      .updateTable("projects")
      .set({ task_sequence: String(input.count) })
      .where("id", "=", input.projectId)
      .execute();
  });
  return repository!.listProjectTasks(input.projectId);
}

function neverResult(): never {
  throw new Error("expected successful task creation");
}

async function waitForLockWaiters(expected: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await sql<{ count: string }>`
      select count(*)::text as count
      from pg_stat_activity
      where datname = current_database()
        and wait_event_type = 'Lock'
        and pid <> pg_backend_pid()
    `.execute(database!);
    if (Number(result.rows[0]?.count ?? 0) >= expected) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`expected ${expected} PostgreSQL lock waiters`);
}

async function runLockedInterleaving(input: {
  rootScopeId: string;
  dependency: () => Promise<unknown>;
  move: () => Promise<unknown>;
  first: "dependency" | "move";
}) {
  let release!: () => void;
  let ready!: () => void;
  const releasePromise = new Promise<void>((resolve) => {
    release = resolve;
  });
  const readyPromise = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const holder = database!.transaction().execute(async (transaction) => {
    await lockScope(transaction, input.rootScopeId);
    ready();
    await releasePromise;
  });
  await readyPromise;
  const firstPromise = input.first === "dependency" ? input.dependency() : input.move();
  await waitForLockWaiters(1);
  const secondPromise = input.first === "dependency" ? input.move() : input.dependency();
  await waitForLockWaiters(2);
  release();
  await holder;
  const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);
  return input.first === "dependency"
    ? { dependencyResult: firstResult, moveResult: secondResult }
    : { dependencyResult: secondResult, moveResult: firstResult };
}

async function lockScope(transaction: Transaction<DatabaseSchema>, scopeId: string): Promise<void> {
  await transaction
    .selectFrom("sibling_task_graph_scopes")
    .select("id")
    .where("id", "=", scopeId)
    .forUpdate()
    .executeTakeFirstOrThrow();
}

describeWithDatabase("formal Task and graph PostgreSQL integration", () => {
  beforeAll(async () => {
    const target = canonicalDatabaseTarget(connectionString!);
    await resetFormalSchema({ database: database!, target, confirmation: target });
    await migrateToLatest(database!);
  });

  afterAll(async () => {
    await database?.destroy();
  });

  it("allocates unique monotonic Task Keys and replays one idempotent create", async () => {
    const { project } = await seedProject("KEYS");
    const attempts = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        repository!.createTask({
          projectId: project.project.id,
          actorMembershipId: project.ownerMembership.id,
          idempotencyKey: `parallel-${index}`,
          requestSha256: requestHash(`parallel-${index}`),
          title: `Parallel ${index}`,
          parentTaskId: null,
          explicitOwnerMembershipId: project.ownerMembership.id,
        }),
      ),
    );
    expect(attempts.every((attempt) => attempt.ok)).toBe(true);
    expect(
      attempts
        .filter((attempt) => attempt.ok)
        .map((attempt) => attempt.task.taskKey)
        .sort((left, right) => Number(left.split("-")[1]) - Number(right.split("-")[1])),
    ).toEqual(Array.from({ length: 20 }, (_, index) => `KEYS-${index + 1}`));

    const retryInput = {
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      idempotencyKey: "network-retry",
      requestSha256: requestHash("network-retry"),
      title: "Network retry",
      parentTaskId: null,
      explicitOwnerMembershipId: project.ownerMembership.id,
    };
    const retries = await Promise.all([
      repository!.createTask(retryInput),
      repository!.createTask(retryInput),
      repository!.createTask(retryInput),
    ]);
    expect(retries.map((result) => result.ok && result.task.taskKey)).toEqual([
      "KEYS-21",
      "KEYS-21",
      "KEYS-21",
    ]);
    expect(retries.filter((result) => result.ok && result.idempotentReplay)).toHaveLength(2);
    await expect(
      repository!.createTask({
        ...retryInput,
        requestSha256: requestHash("changed-request"),
      }),
    ).resolves.toEqual({ ok: false, reason: "idempotency_conflict" });

    const stored = await repository!.listProjectTasks(project.project.id);
    expect(stored).toHaveLength(21);
    expect(new Set(stored.map((task) => task.taskKey)).size).toBe(21);
  }, 20_000);

  it("reauthorizes child creation against the parent effective Owner", async () => {
    const { project } = await seedProject("CHILD");
    const parentOwner = await addMember(project.project.id, "child-parent-owner");
    const otherMember = await addMember(project.project.id, "child-other-member");
    const parent = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "child-parent",
      explicitOwnerMembershipId: parentOwner.membership.id,
    });

    await expect(
      repository!.createTask({
        projectId: project.project.id,
        actorMembershipId: otherMember.membership.id,
        actorType: "human",
        adminModeActive: false,
        adminSessionEnteredFromExplicitUserRequest: false,
        idempotencyKey: "child-forbidden-member",
        requestSha256: requestHash("child-forbidden-member"),
        title: "Forbidden child",
        parentTaskId: parent.id,
        explicitOwnerMembershipId: otherMember.membership.id,
      }),
    ).resolves.toEqual({ ok: false, reason: "forbidden" });
    await expect(
      database!
        .selectFrom("projects")
        .select("task_sequence")
        .where("id", "=", project.project.id)
        .executeTakeFirstOrThrow(),
    ).resolves.toEqual({ task_sequence: "1" });

    await expect(
      repository!.createTask({
        projectId: project.project.id,
        actorMembershipId: parentOwner.membership.id,
        actorType: "human",
        adminModeActive: false,
        adminSessionEnteredFromExplicitUserRequest: false,
        idempotencyKey: "child-parent-owner",
        requestSha256: requestHash("child-parent-owner"),
        title: "Owned child",
        parentTaskId: parent.id,
        explicitOwnerMembershipId: null,
      }),
    ).resolves.toMatchObject({ ok: true, task: { taskKey: "CHILD-2" } });

    const adminInput = {
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      actorType: "human" as const,
      adminSessionEnteredFromExplicitUserRequest: false,
      idempotencyKey: "child-admin",
      requestSha256: requestHash("child-admin"),
      title: "Admin child",
      parentTaskId: parent.id,
      explicitOwnerMembershipId: project.ownerMembership.id,
    };
    await expect(
      repository!.createTask({ ...adminInput, adminModeActive: false }),
    ).resolves.toEqual({ ok: false, reason: "forbidden" });
    await expect(
      repository!.createTask({ ...adminInput, adminModeActive: true }),
    ).resolves.toMatchObject({ ok: true, task: { taskKey: "CHILD-3" } });
  });

  it("does not treat moving another Owner's Task to the virtual root as root control", async () => {
    const { project } = await seedProject("ROOT");
    const taskOwner = await addMember(project.project.id, "root-task-owner");
    const parent = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "root-parent",
      explicitOwnerMembershipId: taskOwner.membership.id,
    });
    const child = await createTask({
      projectId: project.project.id,
      actorMembershipId: taskOwner.membership.id,
      label: "root-child",
      parentTaskId: parent.id,
      explicitOwnerMembershipId: taskOwner.membership.id,
    });
    const [sourceScope, targetScope, impact] = await Promise.all([
      database!
        .selectFrom("sibling_task_graph_scopes")
        .select(["id", "graph_version"])
        .where("project_id", "=", project.project.id)
        .where("parent_task_id", "=", parent.id)
        .executeTakeFirstOrThrow(),
      database!
        .selectFrom("sibling_task_graph_scopes")
        .select(["id", "graph_version"])
        .where("project_id", "=", project.project.id)
        .where("parent_task_id", "is", null)
        .executeTakeFirstOrThrow(),
      repository!.previewMoveImpact({ taskId: child.id, targetParentTaskId: null }),
    ]);
    expect(impact).toMatchObject({ ok: true });
    if (!impact.ok) {
      throw new Error("expected move impact");
    }
    const moveInput = {
      taskId: child.id,
      targetParentTaskId: null,
      actorMembershipId: project.ownerMembership.id,
      actorType: "human" as const,
      adminSessionEnteredFromExplicitUserRequest: false,
      expectedTaskVersion: child.version,
      expectedSourceGraphVersion: Number(sourceScope.graph_version),
      expectedTargetGraphVersion: Number(targetScope.graph_version),
      impactConfirmationToken: impact.confirmationToken,
    };
    await expect(
      repository!.moveTask({ ...moveInput, adminModeActive: false }),
    ).resolves.toMatchObject({ ok: false, reason: "forbidden" });
    await expect(
      repository!.moveTask({ ...moveInput, adminModeActive: true }),
    ).resolves.toMatchObject({ ok: true, taskVersion: 2 });
  });

  it("rejects a low-level Follow change by a member who does not own the source Task", async () => {
    const { project } = await seedProject("FOLLA");
    const sourceOwner = await addMember(project.project.id, "follow-source-owner");
    const otherMember = await addMember(project.project.id, "follow-other-member");
    const source = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "follow-source",
      explicitOwnerMembershipId: sourceOwner.membership.id,
    });
    const target = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "follow-target",
      explicitOwnerMembershipId: otherMember.membership.id,
    });

    await expect(
      repository!.changeFollow({
        action: "add",
        sourceTaskId: source.id,
        targetTaskId: target.id,
        actorMembershipId: otherMember.membership.id,
        actorType: "human",
        adminModeActive: false,
        adminSessionEnteredFromExplicitUserRequest: false,
        impactConfirmationToken: "not-confirmed",
        requestId: "follow-forbidden",
      }),
    ).resolves.toEqual({ ok: false, reason: "forbidden" });
  });

  it("requires a current deterministic impact confirmation for a Follow change", async () => {
    const { project } = await seedProject("FOLLB");
    const source = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "follow-impact-source",
    });
    const target = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "follow-impact-target",
    });

    await expect(
      repository!.changeFollow({
        action: "add",
        sourceTaskId: source.id,
        targetTaskId: target.id,
        actorMembershipId: project.ownerMembership.id,
        actorType: "human",
        adminModeActive: false,
        adminSessionEnteredFromExplicitUserRequest: false,
        impactConfirmationToken: "not-confirmed",
        requestId: "follow-impact-stale",
      }),
    ).resolves.toMatchObject({ ok: false, reason: "impact_confirmation_stale" });
  });

  it("rejects a low-level Blocker write by a member who does not own the Task", async () => {
    const { project } = await seedProject("BLOCKA");
    const taskOwner = await addMember(project.project.id, "blocker-task-owner");
    const otherMember = await addMember(project.project.id, "blocker-other-member");
    const task = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "blocker-owned-task",
      explicitOwnerMembershipId: taskOwner.membership.id,
    });

    await expect(
      repository!.addBlocker({
        taskId: task.id,
        actorMembershipId: otherMember.membership.id,
        actorType: "human",
        adminModeActive: false,
        adminSessionEnteredFromExplicitUserRequest: false,
        expectedTaskVersion: task.version,
        requestId: "blocker-forbidden",
        reason: "Not mine to block",
      }),
    ).resolves.toEqual({ ok: false, reason: "forbidden" });
  });

  it("rejects a stale Task version before adding a Blocker", async () => {
    const { project } = await seedProject("BLOCKB");
    const task = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "blocker-stale-task",
    });

    await expect(
      repository!.addBlocker({
        taskId: task.id,
        actorMembershipId: project.ownerMembership.id,
        actorType: "human",
        adminModeActive: false,
        adminSessionEnteredFromExplicitUserRequest: false,
        expectedTaskVersion: task.version + 1,
        requestId: "blocker-stale-version",
        reason: "Stale blocker",
      }),
    ).resolves.toEqual({ ok: false, reason: "task_version_conflict" });
  });

  it("allows Follow maintenance only for the source Owner or an explicit admin session", async () => {
    const { project } = await seedProject("FOLLC");
    const sourceOwner = await addMember(project.project.id, "follow-authorized-source");
    const targetOwner = await addMember(project.project.id, "follow-authorized-target");
    const source = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "follow-authorized-source",
      explicitOwnerMembershipId: sourceOwner.membership.id,
    });
    const target = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "follow-authorized-target",
      explicitOwnerMembershipId: targetOwner.membership.id,
    });
    const impact = await repository!.previewFollowImpact({
      sourceTaskId: source.id,
      targetTaskId: target.id,
    });
    expect(impact).toMatchObject({
      ok: true,
      impact: { operation: "follow_change", affectedTaskIds: [source.id, target.id].sort() },
    });
    if (!impact.ok) {
      throw new Error("expected Follow impact");
    }
    const baseInput = {
      sourceTaskId: source.id,
      targetTaskId: target.id,
      impactConfirmationToken: impact.confirmationToken,
    };

    await expect(
      repository!.changeFollow({
        ...baseInput,
        action: "add",
        actorMembershipId: sourceOwner.membership.id,
        actorType: "human",
        adminModeActive: false,
        adminSessionEnteredFromExplicitUserRequest: false,
        requestId: "follow-owner-add",
      }),
    ).resolves.toEqual({ ok: true });
    await expect(
      repository!.changeFollow({
        ...baseInput,
        action: "remove",
        actorMembershipId: project.ownerMembership.id,
        actorType: "agent",
        adminModeActive: true,
        adminSessionEnteredFromExplicitUserRequest: false,
        requestId: "follow-agent-admin-unconfirmed",
      }),
    ).resolves.toEqual({ ok: false, reason: "forbidden" });
    await expect(
      repository!.changeFollow({
        ...baseInput,
        action: "remove",
        actorMembershipId: project.ownerMembership.id,
        actorType: "agent",
        adminModeActive: true,
        adminSessionEnteredFromExplicitUserRequest: true,
        requestId: "follow-agent-admin-confirmed",
      }),
    ).resolves.toEqual({ ok: true });
    await expect(
      repository!.changeFollow({
        ...baseInput,
        action: "remove",
        actorMembershipId: sourceOwner.membership.id,
        actorType: "human",
        adminModeActive: false,
        adminSessionEnteredFromExplicitUserRequest: false,
        requestId: "follow-missing-remove",
      }),
    ).resolves.toMatchObject({ ok: false, reason: "dependency_not_found" });

    await database!
      .updateTable("memberships")
      .set({ status: "removed", permission_level: "member" })
      .where("id", "=", sourceOwner.membership.id)
      .execute();
    await expect(
      repository!.changeFollow({
        ...baseInput,
        action: "add",
        actorMembershipId: sourceOwner.membership.id,
        actorType: "human",
        adminModeActive: false,
        adminSessionEnteredFromExplicitUserRequest: false,
        requestId: "follow-inactive-owner",
      }),
    ).resolves.toEqual({ ok: false, reason: "forbidden" });
  });

  it("atomically versions an authorized Blocker and requires explicit Agent admin intent", async () => {
    const { project } = await seedProject("BLOCKC");
    const taskOwner = await addMember(project.project.id, "blocker-authorized-owner");
    const task = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "blocker-authorized-task",
      explicitOwnerMembershipId: taskOwner.membership.id,
    });

    const ownerResult = await repository!.addBlocker({
      taskId: task.id,
      actorMembershipId: taskOwner.membership.id,
      actorType: "human",
      adminModeActive: false,
      adminSessionEnteredFromExplicitUserRequest: false,
      expectedTaskVersion: task.version,
      requestId: "blocker-owner-add",
      reason: "Owner-visible blocker",
    });
    expect(ownerResult).toMatchObject({ ok: true, taskVersion: 2 });
    await expect(
      repository!.addBlocker({
        taskId: task.id,
        actorMembershipId: project.ownerMembership.id,
        actorType: "human",
        adminModeActive: false,
        adminSessionEnteredFromExplicitUserRequest: false,
        expectedTaskVersion: 2,
        requestId: "blocker-admin-disabled",
        reason: "Admin mode is required",
      }),
    ).resolves.toEqual({ ok: false, reason: "forbidden" });
    await expect(
      repository!.addBlocker({
        taskId: task.id,
        actorMembershipId: project.ownerMembership.id,
        actorType: "agent",
        adminModeActive: true,
        adminSessionEnteredFromExplicitUserRequest: false,
        expectedTaskVersion: 2,
        requestId: "blocker-agent-admin-unconfirmed",
        reason: "Agent lacks explicit admin request",
      }),
    ).resolves.toEqual({ ok: false, reason: "forbidden" });
    await expect(
      repository!.addBlocker({
        taskId: task.id,
        actorMembershipId: project.ownerMembership.id,
        actorType: "agent",
        adminModeActive: true,
        adminSessionEnteredFromExplicitUserRequest: true,
        expectedTaskVersion: 2,
        requestId: "blocker-agent-admin-confirmed",
        reason: "Explicitly confirmed admin blocker",
      }),
    ).resolves.toMatchObject({ ok: true, taskVersion: 3 });

    const [storedTask, blockers, audit, outbox] = await Promise.all([
      repository!.findTask(task.id),
      database!
        .selectFrom("task_blockers")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("task_id", "=", task.id)
        .executeTakeFirstOrThrow(),
      database!
        .selectFrom("audit_events")
        .select(["result", "task_version_before", "task_version_after"])
        .where("request_id", "=", "blocker-owner-add")
        .executeTakeFirstOrThrow(),
      database!
        .selectFrom("outbox_events")
        .select(["event_type", "payload"])
        .where("request_id", "=", "blocker-owner-add")
        .executeTakeFirstOrThrow(),
    ]);
    expect(storedTask?.version).toBe(3);
    expect(Number(blockers.count)).toBe(2);
    expect(audit).toEqual({
      result: "success",
      task_version_before: "1",
      task_version_after: "2",
    });
    expect(outbox).toMatchObject({
      event_type: "task.blocker.changed",
      payload: { taskId: task.id, taskVersion: 2 },
    });
  });

  it("rejects Blocker writes from inactive Owners and on archived or completed Tasks", async () => {
    const { project } = await seedProject("BLOCKD");
    const inactiveOwner = await addMember(project.project.id, "blocker-inactive-owner");
    const inactiveTask = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "blocker-inactive-task",
      explicitOwnerMembershipId: inactiveOwner.membership.id,
    });
    await database!
      .updateTable("memberships")
      .set({ status: "removed", permission_level: "member" })
      .where("id", "=", inactiveOwner.membership.id)
      .execute();
    await expect(
      repository!.addBlocker({
        taskId: inactiveTask.id,
        actorMembershipId: inactiveOwner.membership.id,
        actorType: "human",
        adminModeActive: false,
        adminSessionEnteredFromExplicitUserRequest: false,
        expectedTaskVersion: inactiveTask.version,
        requestId: "blocker-inactive-owner",
        reason: "Inactive owner",
      }),
    ).resolves.toEqual({ ok: false, reason: "forbidden" });

    const { project: lifecycleProject } = await seedProject("BLOCKE");
    const archivedTask = await createTask({
      projectId: lifecycleProject.project.id,
      actorMembershipId: lifecycleProject.ownerMembership.id,
      label: "blocker-archived-task",
    });
    await database!
      .updateTable("tasks")
      .set({ archived: true, archived_at: new Date("2026-07-29T00:00:00.000Z") })
      .where("id", "=", archivedTask.id)
      .execute();
    await expect(
      repository!.addBlocker({
        taskId: archivedTask.id,
        actorMembershipId: lifecycleProject.ownerMembership.id,
        actorType: "human",
        adminModeActive: false,
        adminSessionEnteredFromExplicitUserRequest: false,
        expectedTaskVersion: archivedTask.version,
        requestId: "blocker-archived-task",
        reason: "Archived task",
      }),
    ).resolves.toEqual({ ok: false, reason: "task_archived" });

    const completedTask = await createTask({
      projectId: lifecycleProject.project.id,
      actorMembershipId: lifecycleProject.ownerMembership.id,
      label: "blocker-completed-task",
    });
    await database!.transaction().execute(async (transaction) => {
      await transaction
        .updateTable("workspaces")
        .set({ lifecycle: "frozen" })
        .where("scope_type", "=", "task")
        .where("scope_id", "=", completedTask.id)
        .execute();
      await transaction
        .updateTable("tasks")
        .set({ base_status: "done", frozen: true })
        .where("id", "=", completedTask.id)
        .execute();
    });
    await expect(
      repository!.addBlocker({
        taskId: completedTask.id,
        actorMembershipId: lifecycleProject.ownerMembership.id,
        actorType: "human",
        adminModeActive: false,
        adminSessionEnteredFromExplicitUserRequest: false,
        expectedTaskVersion: completedTask.version,
        requestId: "blocker-completed-task",
        reason: "Completed task",
      }),
    ).resolves.toEqual({ ok: false, reason: "completed_task_frozen" });
  });

  it("uses a recursive CTE for depth-20 effective Owner and diagnoses inactivity", async () => {
    const { project } = await seedProject("TREE");
    const taskOwner = await addMember(project.project.id, "tree-owner");
    let parentTaskId: string | null = null;
    let deepestTaskId = "";
    for (let depth = 0; depth < 20; depth += 1) {
      const task = await createTask({
        projectId: project.project.id,
        actorMembershipId: taskOwner.membership.id,
        label: `tree-${depth}`,
        parentTaskId,
        explicitOwnerMembershipId: depth === 0 ? taskOwner.membership.id : null,
      });
      parentTaskId = task.id;
      deepestTaskId = task.id;
    }
    await expect(repository!.resolveEffectiveOwner(deepestTaskId)).resolves.toMatchObject({
      ok: true,
      membershipId: taskOwner.membership.id,
    });
    await database!
      .updateTable("memberships")
      .set({ status: "removed", permission_level: "member" })
      .where("id", "=", taskOwner.membership.id)
      .execute();
    await expect(repository!.resolveEffectiveOwner(deepestTaskId)).resolves.toEqual({
      ok: false,
      reason: "owner_inactive",
    });
  });

  it("supports 5,000 formal tasks without a model cap", async () => {
    const { project } = await seedProject("SCALE");
    const startedAt = performance.now();
    const tasks = await bulkInsertTopLevelTasks({
      projectId: project.project.id,
      projectKey: "SCALE",
      ownerMembershipId: project.ownerMembership.id,
      count: 5_000,
      seed: "scale",
    });
    expect(tasks).toHaveLength(5_000);
    expect(tasks[0]?.taskKey).toBe("SCALE-1");
    expect(tasks.at(-1)?.taskKey).toBe("SCALE-5000");
    await expect(repository!.resolveEffectiveOwner(tasks.at(-1)!.id)).resolves.toMatchObject({
      ok: true,
      membershipId: project.ownerMembership.id,
    });
    expect(performance.now() - startedAt).toBeLessThan(10_000);
  }, 20_000);

  it("validates a 200-sibling DAG and rejects the closing cycle without version drift", async () => {
    const { project } = await seedProject("GRAPH");
    const tasks = await bulkInsertTopLevelTasks({
      projectId: project.project.id,
      projectKey: "GRAPH",
      ownerMembershipId: project.ownerMembership.id,
      count: 200,
      seed: "graph",
    });
    for (let index = 0; index < tasks.length - 1; index += 1) {
      const result = await repository!.changeDependency({
        action: "add",
        predecessorTaskId: tasks[index]!.id,
        successorTaskId: tasks[index + 1]!.id,
        actorMembershipId: project.ownerMembership.id,
        adminModeActive: false,
        expectedGraphVersion: index,
        requestId: `graph-edge-${index}`,
        expiresAt: new Date("2026-07-28T00:00:00.000Z"),
      });
      expect(result).toMatchObject({
        ok: true,
        mode: "direct",
        graphVersion: index + 1,
      });
    }
    await expect(
      repository!.changeDependency({
        action: "add",
        predecessorTaskId: tasks.at(-1)!.id,
        successorTaskId: tasks[0]!.id,
        actorMembershipId: project.ownerMembership.id,
        adminModeActive: false,
        expectedGraphVersion: 199,
        requestId: "graph-closing-cycle",
        expiresAt: new Date("2026-07-28T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ ok: false, reason: "dependency_cycle" });
    const scope = await database!
      .selectFrom("sibling_task_graph_scopes")
      .select(["id", "graph_version"])
      .where("project_id", "=", project.project.id)
      .where("parent_task_id", "is", null)
      .executeTakeFirstOrThrow();
    expect(Number(scope.graph_version)).toBe(199);

    const samples: number[] = [];
    for (let sample = 0; sample < 40; sample += 1) {
      const startedAt = performance.now();
      const [nodes, edges] = await Promise.all([
        database!
          .selectFrom("tasks")
          .select(["id", "task_key", "base_status"])
          .where("project_id", "=", project.project.id)
          .where("parent_graph_scope_id", "=", scope.id)
          .orderBy("task_sequence")
          .execute(),
        database!
          .selectFrom("task_dependencies")
          .select(["predecessor_task_id", "successor_task_id"])
          .where("graph_scope_id", "=", scope.id)
          .where("enabled", "=", true)
          .orderBy("predecessor_task_id")
          .orderBy("successor_task_id")
          .execute(),
      ]);
      samples.push(performance.now() - startedAt);
      expect(nodes).toHaveLength(200);
      expect(edges).toHaveLength(199);
    }
    samples.sort((left, right) => left - right);
    const p95Milliseconds = samples[Math.ceil(samples.length * 0.95) - 1]!;
    if (process.env.M0_REPORT_PERFORMANCE === "1") {
      process.stdout.write(
        `M0_PERFORMANCE ${JSON.stringify({
          operation: "read-200-node-local-dag",
          samples: samples.length,
          p95Milliseconds: Number(p95Milliseconds.toFixed(3)),
        })}\n`,
      );
    }
    expect(p95Milliseconds).toBeLessThan(800);
  }, 90_000);

  it("preserves acyclicity across additional deterministic random DAG seeds", async () => {
    for (const [seedIndex, seed] of [17, 2_027, 65_537].entries()) {
      const projectKey = `RND${String.fromCharCode(65 + seedIndex)}`;
      const { project } = await seedProject(projectKey);
      const tasks = await bulkInsertTopLevelTasks({
        projectId: project.project.id,
        projectKey,
        ownerMembershipId: project.ownerMembership.id,
        count: 96,
        seed: `random-${seed}`,
      });
      const scope = await database!
        .selectFrom("sibling_task_graph_scopes")
        .select("id")
        .where("project_id", "=", project.project.id)
        .where("parent_task_id", "is", null)
        .executeTakeFirstOrThrow();
      const edges = deterministicDagEdges(tasks.length, 160, seed);
      await database!
        .insertInto("task_dependencies")
        .values(
          edges.map(([predecessor, successor], edgeIndex) => ({
            id: deterministicUuid(`random-${seed}-edge-${edgeIndex}`),
            project_id: project.project.id,
            graph_scope_id: scope.id,
            predecessor_task_id: tasks[predecessor]!.id,
            successor_task_id: tasks[successor]!.id,
            enabled: true,
            request_id: `random-${seed}-edge-${edgeIndex}`,
          })),
        )
        .execute();

      const storedEdges = await database!
        .selectFrom("task_dependencies")
        .select(["predecessor_task_id", "successor_task_id"])
        .where("graph_scope_id", "=", scope.id)
        .where("enabled", "=", true)
        .execute();
      expect(storedEdges).toHaveLength(160);
      const [existingPredecessor, existingSuccessor] = edges[0]!;
      await expect(
        repository!.changeDependency({
          action: "add",
          predecessorTaskId: tasks[existingSuccessor]!.id,
          successorTaskId: tasks[existingPredecessor]!.id,
          actorMembershipId: project.ownerMembership.id,
          adminModeActive: false,
          expectedGraphVersion: 160,
          requestId: `random-${seed}-closing-cycle`,
          expiresAt: new Date("2026-07-28T00:00:00.000Z"),
        }),
      ).resolves.toEqual({ ok: false, reason: "dependency_cycle" });
    }
  }, 30_000);

  it("makes dependency requests stale when graph facts change", async () => {
    const { project } = await seedProject("REQ");
    const memberA = await addMember(project.project.id, "request-a");
    const memberB = await addMember(project.project.id, "request-b");
    const first = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "request-first",
      explicitOwnerMembershipId: memberA.membership.id,
    });
    const second = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "request-second",
      explicitOwnerMembershipId: memberB.membership.id,
    });
    const third = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "request-third",
      explicitOwnerMembershipId: project.ownerMembership.id,
    });
    const requested = await repository!.changeDependency({
      action: "add",
      predecessorTaskId: first.id,
      successorTaskId: second.id,
      actorMembershipId: memberA.membership.id,
      adminModeActive: false,
      expectedGraphVersion: 0,
      requestId: "request-create",
      changeRequestId: "00000000-0000-4000-8000-000000000901",
      expiresAt: new Date("2026-07-28T00:00:00.000Z"),
    });
    expect(requested).toMatchObject({
      ok: true,
      mode: "request_required",
      graphVersion: 0,
    });
    await expect(
      repository!.changeDependency({
        action: "add",
        predecessorTaskId: first.id,
        successorTaskId: third.id,
        actorMembershipId: project.ownerMembership.id,
        adminModeActive: false,
        expectedGraphVersion: 0,
        requestId: "request-version-change",
        expiresAt: new Date("2026-07-28T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({ ok: true, mode: "direct", graphVersion: 1 });
    await expect(
      repository!.acceptDependencyRequest({
        requestId: "00000000-0000-4000-8000-000000000901",
        acceptingMembershipId: memberB.membership.id,
        expectedGraphVersion: 0,
        now: new Date("2026-07-27T02:00:00.000Z"),
      }),
    ).resolves.toEqual({ ok: false, reason: "request_stale" });
  });

  it("serializes dependency and move operations in both explicit lock-queue orders", async () => {
    for (const firstOperation of ["dependency", "move"] as const) {
      const key = firstOperation === "dependency" ? "MOVE" : "MOVER";
      const { project } = await seedProject(key);
      const targetParent = await createTask({
        projectId: project.project.id,
        actorMembershipId: project.ownerMembership.id,
        label: `${key}-parent`,
      });
      const moving = await createTask({
        projectId: project.project.id,
        actorMembershipId: project.ownerMembership.id,
        label: `${key}-moving`,
      });
      const peer = await createTask({
        projectId: project.project.id,
        actorMembershipId: project.ownerMembership.id,
        label: `${key}-peer`,
      });
      const rootScope = await database!
        .selectFrom("sibling_task_graph_scopes")
        .select(["id", "graph_version"])
        .where("project_id", "=", project.project.id)
        .where("parent_task_id", "is", null)
        .executeTakeFirstOrThrow();
      const targetScope = await database!
        .selectFrom("sibling_task_graph_scopes")
        .select(["id", "graph_version"])
        .where("parent_task_id", "=", targetParent.id)
        .executeTakeFirstOrThrow();
      const impact = await repository!.previewMoveImpact({
        taskId: moving.id,
        targetParentTaskId: targetParent.id,
      });
      expect(impact.ok).toBe(true);
      const interleaving = await runLockedInterleaving({
        rootScopeId: rootScope.id,
        first: firstOperation,
        dependency: () =>
          repository!.changeDependency({
            action: "add",
            predecessorTaskId: moving.id,
            successorTaskId: peer.id,
            actorMembershipId: project.ownerMembership.id,
            adminModeActive: false,
            expectedGraphVersion: Number(rootScope.graph_version),
            requestId: `${key}-dependency`,
            expiresAt: new Date("2026-07-28T00:00:00.000Z"),
          }),
        move: () =>
          repository!.moveTask({
            taskId: moving.id,
            targetParentTaskId: targetParent.id,
            actorMembershipId: project.ownerMembership.id,
            actorType: "human",
            adminModeActive: false,
            adminSessionEnteredFromExplicitUserRequest: false,
            expectedTaskVersion: moving.version,
            expectedSourceGraphVersion: Number(rootScope.graph_version),
            expectedTargetGraphVersion: Number(targetScope.graph_version),
            impactConfirmationToken: impact.ok ? impact.confirmationToken : "",
          }),
      });
      const storedMoving = await repository!.findTask(moving.id);
      const dependencyCount = await database!
        .selectFrom("task_dependencies")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("project_id", "=", project.project.id)
        .executeTakeFirstOrThrow();
      if (firstOperation === "dependency") {
        expect(interleaving.dependencyResult).toMatchObject({ ok: true, mode: "direct" });
        expect(interleaving.moveResult).toMatchObject({
          ok: false,
          reason: "graph_version_conflict",
        });
        expect(storedMoving?.parentTaskId).toBeNull();
        expect(Number(dependencyCount.count)).toBe(1);
      } else {
        expect(interleaving.moveResult).toMatchObject({ ok: true });
        expect(interleaving.dependencyResult).toMatchObject({
          ok: false,
          reason: "graph_version_conflict",
        });
        expect(storedMoving?.parentTaskId).toBe(targetParent.id);
        expect(Number(dependencyCount.count)).toBe(0);
      }
    }
  }, 20_000);

  it("archives a complete top-level subtree while preserving Task and Workspace history", async () => {
    const { project } = await seedProject("ARCH");
    const root = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "archive-root",
    });
    const child = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "archive-child",
      parentTaskId: root.id,
      explicitOwnerMembershipId: null,
    });
    const preview = await repository!.previewDestructiveImpact({
      taskId: root.id,
      operation: "archive",
    });
    expect(preview).toMatchObject({
      ok: true,
      impact: { affectedTaskIds: expect.arrayContaining([root.id, child.id]) },
      confirmationToken: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
    if (!preview.ok) {
      return;
    }
    const result = await repository!.archiveTask({
      taskId: root.id,
      actorMembershipId: project.ownerMembership.id,
      actorType: "human",
      adminModeActive: false,
      adminSessionEnteredFromExplicitUserRequest: false,
      expectedTaskVersion: root.version,
      expectedGraphVersion: 0,
      impactConfirmationToken: preview.confirmationToken,
      requestId: "archive-subtree",
      now: new Date("2026-07-30T00:00:00.000Z"),
    });
    expect(result).toEqual({
      ok: true,
      taskId: root.id,
      affectedTaskIds: preview.impact.affectedTaskIds,
    });
    const tasks = await database!
      .selectFrom("tasks")
      .select(["id", "archived", "archived_at"])
      .where("id", "in", [root.id, child.id])
      .execute();
    expect(tasks).toHaveLength(2);
    expect(tasks.every((task) => task.archived && task.archived_at !== null)).toBe(true);
    const workspaces = await database!
      .selectFrom("workspaces")
      .select("lifecycle")
      .where("scope_type", "=", "task")
      .where("scope_id", "in", [root.id, child.id])
      .execute();
    expect(workspaces).toEqual([{ lifecycle: "archived" }, { lifecycle: "archived" }]);
  });

  it("deletes only an unfinished non-top-level subtree and retains every Task Key tombstone", async () => {
    const { project } = await seedProject("DELT");
    const root = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "delete-root",
    });
    const child = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "delete-child",
      parentTaskId: root.id,
      explicitOwnerMembershipId: null,
    });
    const grandchild = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "delete-grandchild",
      parentTaskId: child.id,
      explicitOwnerMembershipId: null,
    });
    const preview = await repository!.previewDestructiveImpact({
      taskId: child.id,
      operation: "delete",
    });
    expect(preview).toMatchObject({
      ok: true,
      impact: { affectedTaskIds: expect.arrayContaining([child.id, grandchild.id]) },
      confirmationToken: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
    if (!preview.ok) {
      return;
    }
    const result = await repository!.deleteTask({
      taskId: child.id,
      confirmTaskKey: child.taskKey,
      actorMembershipId: project.ownerMembership.id,
      actorType: "human",
      adminModeActive: false,
      adminSessionEnteredFromExplicitUserRequest: false,
      expectedTaskVersion: child.version,
      expectedGraphVersion: 0,
      impactConfirmationToken: preview.confirmationToken,
      requestId: "delete-subtree",
      now: new Date("2026-07-30T00:00:00.000Z"),
    });
    expect(result).toEqual({
      ok: true,
      taskId: child.id,
      affectedTaskIds: preview.impact.affectedTaskIds,
    });
    await expect(repository!.findTask(root.id)).resolves.toBeDefined();
    await expect(repository!.findTask(child.id)).resolves.toBeUndefined();
    await expect(repository!.findTask(grandchild.id)).resolves.toBeUndefined();
    const tombstones = await database!
      .selectFrom("task_key_tombstones")
      .select(["task_key", "deleted_task_id"])
      .where("deleted_task_id", "in", [child.id, grandchild.id])
      .orderBy("task_key")
      .execute();
    expect(tombstones).toEqual([
      { task_key: child.taskKey, deleted_task_id: child.id },
      { task_key: grandchild.taskKey, deleted_task_id: grandchild.id },
    ]);
  });

  it("rejects low-level Project/Task Key mutation", async () => {
    const { project } = await seedProject("LOCK");
    const task = await createTask({
      projectId: project.project.id,
      actorMembershipId: project.ownerMembership.id,
      label: "immutable",
    });
    await expect(
      sql`update projects set project_key = 'OTHER' where id = ${project.project.id}`.execute(
        database!,
      ),
    ).rejects.toThrow("PROJECT_KEY_IMMUTABLE");
    await expect(
      sql`update tasks set task_key = 'LOCK-999' where id = ${task.id}`.execute(database!),
    ).rejects.toThrow("TASK_KEY_IMMUTABLE");
  });
});
