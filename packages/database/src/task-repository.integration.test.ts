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
    role: "member",
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
        explicit_owner_membership_id
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

  it("uses a recursive CTE for depth-20 effective Owner and diagnoses inactivity", async () => {
    const { project } = await seedProject("TREE");
    let parentTaskId: string | null = null;
    let deepestTaskId = "";
    for (let depth = 0; depth < 20; depth += 1) {
      const task = await createTask({
        projectId: project.project.id,
        actorMembershipId: project.ownerMembership.id,
        label: `tree-${depth}`,
        parentTaskId,
        explicitOwnerMembershipId: depth === 0 ? project.ownerMembership.id : null,
      });
      parentTaskId = task.id;
      deepestTaskId = task.id;
    }
    await expect(repository!.resolveEffectiveOwner(deepestTaskId)).resolves.toMatchObject({
      ok: true,
      membershipId: project.ownerMembership.id,
    });
    await database!
      .updateTable("memberships")
      .set({ active: false })
      .where("id", "=", project.ownerMembership.id)
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
  }, 30_000);

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
