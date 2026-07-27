import { randomUUID } from "node:crypto";

import {
  computeTaskImpactSet,
  createTaskKey,
  evaluateDependencyChange,
  evaluateDependencyRequestAcceptance,
  evaluateTaskParentChange,
  resolveEffectiveTaskOwner,
  resolveTaskOperationAuthorization,
  validateTaskFollow,
  validateTaskOwnership,
  type DependencyAction,
  type OwnershipMembership,
  type TaskDependencyEdge,
  type TaskGraphNode,
  type TaskGraphFailureReason,
  type TaskImpactDecision,
  type TaskImpactDependency,
  type TaskImpactNode,
  type TaskOwnershipNode,
  type TaskTreeNode,
  type TaskTreeFailureReason,
} from "@ngapd/domain";
import { sql, type Kysely, type Transaction } from "kysely";

import { writeAudit } from "./foundation-repository.js";
import type { DatabaseSchema } from "./types.js";

const EMPTY_MANIFEST_HASH = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";

type DatabaseExecutor = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>;

interface ProjectTaskRow {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  parent_graph_scope_id: string;
  explicit_owner_membership_id: string | null;
  base_status: "not_started" | "in_progress" | "done";
  archived: boolean;
  version: string;
  frozen: boolean;
}

interface ProjectFacts {
  project: {
    id: string;
    projectKey: string;
    ownerMembershipId: string;
    taskSequence: number;
  };
  tasks: ProjectTaskRow[];
  memberships: Array<{
    id: string;
    projectId: string;
    userId: string;
    role: "admin" | "member";
    active: boolean;
    userActive: boolean;
  }>;
}

export interface FormalTaskRecord {
  id: string;
  projectId: string;
  taskSequence: number;
  taskKey: string;
  title: string;
  baseStatus: "not_started" | "in_progress" | "done";
  archived: boolean;
  parentTaskId: string | null;
  parentGraphScopeId: string;
  explicitOwnerMembershipId: string | null;
  version: number;
  frozen: boolean;
}

export interface TaskApplicationActor {
  userId: string;
  userActive: boolean;
  projectId: string;
  projectOwnerMembershipId: string;
  membershipId: string | null;
  membershipRole: "admin" | "member" | null;
  membershipActive: boolean;
}

export type CreateFormalTaskResult =
  | { ok: true; task: FormalTaskRecord; workspaceId: string; idempotentReplay: boolean }
  | {
      ok: false;
      reason:
        | "forbidden"
        | "idempotency_conflict"
        | "project_not_found"
        | "task_key_invalid"
        | "task_ownership_invalid";
    };

export type DependencyMutationResult =
  | {
      ok: true;
      mode: "direct";
      action: DependencyAction;
      graphVersion: number;
    }
  | {
      ok: true;
      mode: "request_required";
      requestId: string;
      graphVersion: number;
    }
  | {
      ok: false;
      reason: TaskGraphFailureReason | "graph_scope_not_found";
    };

export type MoveTaskResult =
  | {
      ok: true;
      taskId: string;
      sourceGraphVersion: number;
      targetGraphVersion: number;
      taskVersion: number;
    }
  | {
      ok: false;
      reason:
        | TaskTreeFailureReason
        | "same_parent"
        | "task_has_active_dependencies"
        | "target_parent_done"
        | "completed_task_frozen"
        | "task_version_conflict"
        | "graph_version_conflict"
        | "impact_confirmation_stale"
        | "forbidden";
      impact?: Extract<TaskImpactDecision, { ok: true }>;
    };

export type FollowImpactResult =
  | Extract<TaskImpactDecision, { ok: true }>
  | {
      ok: false;
      reason: TaskGraphFailureReason | "task_archived" | "invalid_task_tree";
    };

export type FollowMutationResult =
  | { ok: true }
  | {
      ok: false;
      reason: TaskGraphFailureReason | "task_archived" | "impact_confirmation_stale";
      impact?: Extract<TaskImpactDecision, { ok: true }>;
    };

export type AddTaskBlockerResult =
  | { ok: true; blockerId: string; taskVersion: number }
  | {
      ok: false;
      reason:
        | "task_not_found"
        | "task_archived"
        | "completed_task_frozen"
        | "task_version_conflict"
        | "forbidden";
    };

export class TaskRepository {
  constructor(private readonly database: Kysely<DatabaseSchema>) {}

  async createTask(input: {
    id?: string;
    workspaceId?: string;
    childGraphScopeId?: string;
    projectId: string;
    actorMembershipId: string;
    actorType?: "human" | "agent";
    adminModeActive?: boolean;
    adminSessionEnteredFromExplicitUserRequest?: boolean;
    requestId?: string;
    idempotencyKey: string;
    requestSha256: string;
    title: string;
    parentTaskId: string | null;
    explicitOwnerMembershipId: string | null;
  }): Promise<CreateFormalTaskResult> {
    return this.database.transaction().execute(async (transaction) => {
      const project = await transaction
        .selectFrom("projects")
        .select(["id", "project_key", "task_sequence"])
        .where("id", "=", input.projectId)
        .forUpdate()
        .executeTakeFirst();
      if (!project) {
        return { ok: false, reason: "project_not_found" };
      }
      const actor = await transaction
        .selectFrom("memberships")
        .select(["id", "project_id", "active"])
        .where("id", "=", input.actorMembershipId)
        .executeTakeFirst();
      if (!actor || !actor.active || actor.project_id !== input.projectId) {
        return { ok: false, reason: "forbidden" };
      }

      const replay = await transaction
        .selectFrom("task_operation_idempotency")
        .select(["request_sha256", "response", "response_task_id"])
        .where("project_id", "=", input.projectId)
        .where("actor_membership_id", "=", input.actorMembershipId)
        .where("operation", "=", "create_task")
        .where("idempotency_key", "=", input.idempotencyKey)
        .executeTakeFirst();
      if (replay) {
        if (replay.request_sha256 !== input.requestSha256 || !replay.response_task_id) {
          return { ok: false, reason: "idempotency_conflict" };
        }
        const task = await this.findTaskWithExecutor(transaction, replay.response_task_id);
        const workspaceId =
          typeof replay.response.workspaceId === "string"
            ? replay.response.workspaceId
            : await findTaskWorkspaceId(transaction, replay.response_task_id);
        if (!task || !workspaceId) {
          throw new Error("TASK_IDEMPOTENCY_RESPONSE_MISSING");
        }
        return { ok: true, task, workspaceId, idempotentReplay: true };
      }

      const taskId = input.id ?? randomUUID();
      const workspaceId = input.workspaceId ?? randomUUID();
      const nextSequence = Number(project.task_sequence) + 1;
      const taskKey = createTaskKey(project.project_key, nextSequence);
      if (!taskKey.ok) {
        return { ok: false, reason: "task_key_invalid" };
      }

      const facts = await loadProjectFacts(transaction, input.projectId);
      const ownership = validateTaskOwnership(
        [
          ...facts.tasks.map(mapOwnershipNode),
          {
            id: taskId,
            projectId: input.projectId,
            parentTaskId: input.parentTaskId,
            explicitOwnerMembershipId: input.explicitOwnerMembershipId,
          },
        ],
        facts.memberships.map(mapOwnershipMembership),
      );
      if (!ownership.ok) {
        return { ok: false, reason: "task_ownership_invalid" };
      }
      if (input.parentTaskId !== null) {
        const owners = resolveProjectOwners(facts);
        const actorMembership = facts.memberships.find(
          (membership) => membership.id === input.actorMembershipId,
        );
        const parentOwner = owners.ok ? owners.ownerByTaskId.get(input.parentTaskId) : undefined;
        if (!actorMembership || !parentOwner) {
          return { ok: false, reason: "forbidden" };
        }
        const authorization = resolveTaskOperationAuthorization(
          {
            serverProjectId: input.projectId,
            targetProjectIds: [input.projectId],
            affectedOwnerMembershipIds: [parentOwner],
            projectOwnerMembershipId: facts.project.ownerMembershipId,
            projectRootOperation: false,
            adminSessionActive: input.adminModeActive ?? false,
            actorType: input.actorType ?? "human",
            adminSessionEnteredFromExplicitUserRequest:
              input.adminSessionEnteredFromExplicitUserRequest ?? false,
            impactConfirmationRequired: false,
            impactConfirmed: true,
          },
          {
            userId: actorMembership.userId,
            active: actorMembership.userActive,
            membership: {
              id: actorMembership.id,
              userId: actorMembership.userId,
              projectId: actorMembership.projectId,
              role: actorMembership.role,
              active: actorMembership.active,
            },
          },
        );
        if (!authorization.allowed) {
          return { ok: false, reason: "forbidden" };
        }
      }

      const parentScope = await findGraphScope(transaction, input.projectId, input.parentTaskId);
      if (!parentScope) {
        return { ok: false, reason: "task_ownership_invalid" };
      }
      await transaction
        .updateTable("projects")
        .set({ task_sequence: String(nextSequence), updated_at: sql`now()` })
        .where("id", "=", input.projectId)
        .executeTakeFirstOrThrow();
      const inserted = await transaction
        .insertInto("tasks")
        .values({
          id: taskId,
          project_id: input.projectId,
          task_sequence: String(nextSequence),
          task_key: taskKey.value,
          title: input.title,
          base_status: "not_started",
          parent_task_id: input.parentTaskId,
          parent_graph_scope_id: parentScope.id,
          explicit_owner_membership_id: input.explicitOwnerMembershipId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto("sibling_task_graph_scopes")
        .values({
          id: input.childGraphScopeId ?? randomUUID(),
          project_id: input.projectId,
          parent_task_id: taskId,
        })
        .execute();
      await insertTaskWorkspace(transaction, workspaceId, taskId);

      const task = mapTask(inserted);
      await transaction
        .insertInto("task_operation_idempotency")
        .values({
          id: randomUUID(),
          project_id: input.projectId,
          actor_membership_id: input.actorMembershipId,
          operation: "create_task",
          idempotency_key: input.idempotencyKey,
          request_sha256: input.requestSha256,
          response: { taskId, taskKey: task.taskKey, workspaceId },
          response_task_id: taskId,
        })
        .execute();
      await writeTaskSuccessRecords(transaction, {
        projectId: input.projectId,
        actorMembershipId: input.actorMembershipId,
        actorType: input.actorType ?? "human",
        targetId: taskId,
        requestId: input.requestId ?? input.idempotencyKey.slice(0, 128),
        action: "task.create",
        reasonCode: "TASK_CREATED",
        taskVersionBefore: null,
        taskVersionAfter: task.version,
        eventType: "task.created",
        payload: { taskId, taskKey: task.taskKey },
      });
      return { ok: true, task, workspaceId, idempotentReplay: false };
    });
  }

  async findTask(taskId: string): Promise<FormalTaskRecord | undefined> {
    return this.findTaskWithExecutor(this.database, taskId);
  }

  async listProjectTasks(projectId: string): Promise<FormalTaskRecord[]> {
    const tasks = await this.database
      .selectFrom("tasks")
      .selectAll()
      .where("project_id", "=", projectId)
      .orderBy("task_sequence")
      .execute();
    return tasks.map(mapTask);
  }

  async resolveApplicationActor(
    projectId: string,
    userId: string,
  ): Promise<TaskApplicationActor | undefined> {
    const project = await this.database
      .selectFrom("projects")
      .select(["id", "owner_membership_id"])
      .where("id", "=", projectId)
      .executeTakeFirst();
    if (!project) {
      return undefined;
    }
    const user = await this.database
      .selectFrom("users")
      .select(["id", "active"])
      .where("id", "=", userId)
      .executeTakeFirst();
    if (!user) {
      return undefined;
    }
    const membership = await this.database
      .selectFrom("memberships")
      .select(["id", "role", "active"])
      .where("project_id", "=", projectId)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return {
      userId: user.id,
      userActive: user.active,
      projectId: project.id,
      projectOwnerMembershipId: project.owner_membership_id,
      membershipId: membership?.id ?? null,
      membershipRole: membership?.role ?? null,
      membershipActive: membership?.active ?? false,
    };
  }

  async resolveEffectiveOwner(taskId: string) {
    const chain = await sql<{
      id: string;
      project_id: string;
      parent_task_id: string | null;
      explicit_owner_membership_id: string | null;
      cycle: boolean;
    }>`
      with recursive ancestry as (
        select
          task.id,
          task.project_id,
          task.parent_task_id,
          task.explicit_owner_membership_id,
          array[task.id]::uuid[] as path,
          false as cycle,
          0 as depth
        from tasks task
        where task.id = ${taskId}
        union all
        select
          parent.id,
          parent.project_id,
          parent.parent_task_id,
          parent.explicit_owner_membership_id,
          ancestry.path || parent.id,
          parent.id = any(ancestry.path),
          ancestry.depth + 1
        from ancestry
        join tasks parent on parent.id = ancestry.parent_task_id
        where not ancestry.cycle and ancestry.depth < 1000
      )
      select id, project_id, parent_task_id, explicit_owner_membership_id, cycle
      from ancestry
      order by array_length(path, 1)
    `.execute(this.database);
    if (chain.rows.length === 0) {
      return { ok: false as const, reason: "task_not_found" as const };
    }
    const uniqueTasks = new Map<string, TaskOwnershipNode>();
    for (const row of chain.rows) {
      uniqueTasks.set(row.id, {
        id: row.id,
        projectId: row.project_id,
        parentTaskId: row.parent_task_id,
        explicitOwnerMembershipId: row.explicit_owner_membership_id,
      });
    }
    const projectId = chain.rows[0]!.project_id;
    const memberships = await this.database
      .selectFrom("memberships")
      .select(["id", "project_id", "active"])
      .where("project_id", "=", projectId)
      .execute();
    return resolveEffectiveTaskOwner(
      taskId,
      [...uniqueTasks.values()],
      memberships.map(mapOwnershipMembership),
    );
  }

  async changeDependency(input: {
    action: DependencyAction;
    predecessorTaskId: string;
    successorTaskId: string;
    actorMembershipId: string;
    actorType?: "human" | "agent";
    adminModeActive: boolean;
    expectedGraphVersion: number;
    requestId: string;
    changeRequestId?: string;
    dependencyId?: string;
    expiresAt: Date;
  }): Promise<DependencyMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const endpoints = await transaction
        .selectFrom("tasks")
        .select(["id", "project_id", "parent_graph_scope_id"])
        .where("id", "in", [input.predecessorTaskId, input.successorTaskId])
        .execute();
      if (endpoints.length !== 2) {
        return { ok: false, reason: "task_not_found" };
      }
      if (endpoints[0]!.project_id !== endpoints[1]!.project_id) {
        return { ok: false, reason: "cross_project_dependency" };
      }
      if (endpoints[0]!.parent_graph_scope_id !== endpoints[1]!.parent_graph_scope_id) {
        return { ok: false, reason: "cross_parent_dependency" };
      }
      const projectId = endpoints[0]!.project_id;
      const scopeId = endpoints[0]!.parent_graph_scope_id;
      const scope = await lockGraphScope(transaction, scopeId);
      if (!scope) {
        return { ok: false, reason: "graph_scope_not_found" };
      }
      const facts = await loadProjectFacts(transaction, projectId);
      const actor = facts.memberships.find(
        (membership) => membership.id === input.actorMembershipId,
      );
      if (!actor?.active) {
        return { ok: false, reason: "forbidden" };
      }
      const snapshot = await loadGraphDomainSnapshot(transaction, facts, scopeId);
      if (!snapshot.ok) {
        return snapshot;
      }
      const decision = evaluateDependencyChange({
        action: input.action,
        predecessorTaskId: input.predecessorTaskId,
        successorTaskId: input.successorTaskId,
        actorMembershipId: input.actorMembershipId,
        projectOwnerMembershipId: facts.project.ownerMembershipId,
        adminModeActive: input.adminModeActive,
        expectedGraphVersion: input.expectedGraphVersion,
        currentGraphVersion: Number(scope.graph_version),
        tasks: snapshot.tasks,
        dependencies: snapshot.dependencies,
      });
      if (!decision.ok) {
        return { ok: false, reason: decision.reason };
      }
      if (decision.mode === "request_required") {
        const requestId = input.changeRequestId ?? randomUUID();
        await transaction
          .insertInto("task_dependency_change_requests")
          .values({
            id: requestId,
            project_id: projectId,
            graph_scope_id: scopeId,
            action: decision.request.action,
            predecessor_task_id: decision.request.predecessorTaskId,
            successor_task_id: decision.request.successorTaskId,
            expected_graph_version: String(decision.request.graphVersion),
            predecessor_owner_membership_id: decision.request.predecessorOwnerMembershipId,
            successor_owner_membership_id: decision.request.successorOwnerMembershipId,
            requested_by_membership_id: input.actorMembershipId,
            required_acceptance_by_membership_id: decision.request.requiredAcceptanceByMembershipId,
            expires_at: input.expiresAt,
            request_id: input.requestId,
          })
          .execute();
        await writeTaskSuccessRecords(transaction, {
          projectId,
          actorMembershipId: input.actorMembershipId,
          actorType: input.actorType ?? "human",
          targetId: input.predecessorTaskId,
          requestId: input.requestId,
          action: "task.dependency.request",
          reasonCode: "TASK_DEPENDENCY_REQUESTED",
          taskVersionBefore: null,
          taskVersionAfter: null,
          eventType: "task.dependency.requested",
          payload: {
            requestId,
            predecessorTaskId: input.predecessorTaskId,
            successorTaskId: input.successorTaskId,
          },
        });
        return {
          ok: true,
          mode: "request_required",
          requestId,
          graphVersion: Number(scope.graph_version),
        };
      }
      await applyDependencyMutation(transaction, {
        action: input.action,
        id: input.dependencyId ?? randomUUID(),
        projectId,
        scopeId,
        predecessorTaskId: input.predecessorTaskId,
        successorTaskId: input.successorTaskId,
        actorMembershipId: input.actorMembershipId,
        requestId: input.requestId,
      });
      const graphVersion = await readGraphVersion(transaction, scopeId);
      await writeTaskSuccessRecords(transaction, {
        projectId,
        actorMembershipId: input.actorMembershipId,
        actorType: input.actorType ?? "human",
        targetId: input.predecessorTaskId,
        requestId: input.requestId,
        action: "task.dependency.change",
        reasonCode: "TASK_DEPENDENCY_CHANGED",
        taskVersionBefore: null,
        taskVersionAfter: null,
        eventType: "task.dependency.changed",
        payload: {
          action: input.action,
          predecessorTaskId: input.predecessorTaskId,
          successorTaskId: input.successorTaskId,
          graphVersion,
        },
      });
      return { ok: true, mode: "direct", action: input.action, graphVersion };
    });
  }

  async acceptDependencyRequest(input: {
    requestId: string;
    acceptingMembershipId: string;
    actorType?: "human" | "agent";
    now: Date;
  }): Promise<DependencyMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const request = await transaction
        .selectFrom("task_dependency_change_requests")
        .selectAll()
        .where("id", "=", input.requestId)
        .forUpdate()
        .executeTakeFirst();
      if (!request || request.status !== "pending") {
        return { ok: false, reason: "request_stale" };
      }
      if (request.expires_at <= input.now) {
        await transaction
          .updateTable("task_dependency_change_requests")
          .set({ status: "expired", resolved_at: input.now, updated_at: input.now })
          .where("id", "=", request.id)
          .execute();
        return { ok: false, reason: "request_stale" };
      }
      const scope = await lockGraphScope(transaction, request.graph_scope_id);
      if (!scope) {
        return { ok: false, reason: "graph_scope_not_found" };
      }
      const facts = await loadProjectFacts(transaction, request.project_id);
      const snapshot = await loadGraphDomainSnapshot(transaction, facts, request.graph_scope_id);
      if (!snapshot.ok) {
        return snapshot;
      }
      const decision = evaluateDependencyRequestAcceptance({
        request: {
          action: request.action,
          predecessorTaskId: request.predecessor_task_id,
          successorTaskId: request.successor_task_id,
          parentTaskId: scope.parent_task_id,
          graphVersion: Number(request.expected_graph_version),
          predecessorOwnerMembershipId: request.predecessor_owner_membership_id,
          successorOwnerMembershipId: request.successor_owner_membership_id,
          requiredAcceptanceByMembershipId: request.required_acceptance_by_membership_id,
        },
        acceptingMembershipId: input.acceptingMembershipId,
        currentGraphVersion: Number(scope.graph_version),
        tasks: snapshot.tasks,
        dependencies: snapshot.dependencies,
      });
      if (!decision.ok) {
        if (decision.reason !== "forbidden") {
          await transaction
            .updateTable("task_dependency_change_requests")
            .set({ status: "stale", resolved_at: input.now, updated_at: input.now })
            .where("id", "=", request.id)
            .execute();
        }
        return { ok: false, reason: decision.reason };
      }
      await applyDependencyMutation(transaction, {
        action: request.action,
        id: randomUUID(),
        projectId: request.project_id,
        scopeId: request.graph_scope_id,
        predecessorTaskId: request.predecessor_task_id,
        successorTaskId: request.successor_task_id,
        actorMembershipId: input.acceptingMembershipId,
        requestId: request.request_id,
      });
      await transaction
        .updateTable("task_dependency_change_requests")
        .set({ status: "accepted", resolved_at: input.now, updated_at: input.now })
        .where("id", "=", request.id)
        .execute();
      const graphVersion = await readGraphVersion(transaction, request.graph_scope_id);
      await writeTaskSuccessRecords(transaction, {
        projectId: request.project_id,
        actorMembershipId: input.acceptingMembershipId,
        actorType: input.actorType ?? "human",
        targetId: request.predecessor_task_id,
        requestId: request.request_id,
        action: "task.dependency.accept",
        reasonCode: "TASK_DEPENDENCY_ACCEPTED",
        taskVersionBefore: null,
        taskVersionAfter: null,
        eventType: "task.dependency.changed",
        payload: {
          action: request.action,
          predecessorTaskId: request.predecessor_task_id,
          successorTaskId: request.successor_task_id,
          graphVersion,
        },
      });
      return { ok: true, mode: "direct", action: request.action, graphVersion };
    });
  }

  async previewMoveImpact(input: {
    taskId: string;
    targetParentTaskId: string | null;
  }): Promise<TaskImpactDecision> {
    const task = await this.database
      .selectFrom("tasks")
      .select("project_id")
      .where("id", "=", input.taskId)
      .executeTakeFirst();
    if (!task) {
      return { ok: false, reason: "task_not_found", taskId: input.taskId };
    }
    return loadImpactDecision(this.database, task.project_id, "move", input.taskId, {
      targetParentTaskId: input.targetParentTaskId,
    });
  }

  async moveTask(input: {
    taskId: string;
    targetParentTaskId: string | null;
    actorMembershipId: string;
    actorType: "human" | "agent";
    adminModeActive: boolean;
    adminSessionEnteredFromExplicitUserRequest: boolean;
    expectedTaskVersion: number;
    expectedSourceGraphVersion: number;
    expectedTargetGraphVersion: number;
    impactConfirmationToken: string;
    requestId?: string;
  }): Promise<MoveTaskResult> {
    return this.database.transaction().execute(async (transaction) => {
      const initialTask = await transaction
        .selectFrom("tasks")
        .select(["id", "project_id", "parent_task_id", "parent_graph_scope_id"])
        .where("id", "=", input.taskId)
        .executeTakeFirst();
      if (!initialTask) {
        return { ok: false, reason: "task_not_found" };
      }
      const targetScope = await findGraphScope(
        transaction,
        initialTask.project_id,
        input.targetParentTaskId,
      );
      if (!targetScope) {
        return { ok: false, reason: "parent_not_found" };
      }
      if (targetScope.id === initialTask.parent_graph_scope_id) {
        return { ok: false, reason: "same_parent" };
      }
      const lockedScopes = new Map<string, { graph_version: string }>();
      for (const scopeId of [
        ...new Set([initialTask.parent_graph_scope_id, targetScope.id]),
      ].sort()) {
        const scope = await lockGraphScope(transaction, scopeId);
        if (!scope) {
          return { ok: false, reason: "graph_version_conflict" };
        }
        lockedScopes.set(scopeId, scope);
      }
      const task = await transaction
        .selectFrom("tasks")
        .selectAll()
        .where("id", "=", input.taskId)
        .forUpdate()
        .executeTakeFirst();
      if (!task || task.parent_graph_scope_id !== initialTask.parent_graph_scope_id) {
        return { ok: false, reason: "graph_version_conflict" };
      }
      if (task.frozen || task.base_status === "done") {
        return { ok: false, reason: "completed_task_frozen" };
      }
      if (Number(task.version) !== input.expectedTaskVersion) {
        return { ok: false, reason: "task_version_conflict" };
      }
      if (
        Number(lockedScopes.get(task.parent_graph_scope_id)?.graph_version) !==
          input.expectedSourceGraphVersion ||
        Number(lockedScopes.get(targetScope.id)?.graph_version) !== input.expectedTargetGraphVersion
      ) {
        return { ok: false, reason: "graph_version_conflict" };
      }
      const incident = await transaction
        .selectFrom("task_dependencies")
        .select("id")
        .where((expression) =>
          expression.or([
            expression("predecessor_task_id", "=", input.taskId),
            expression("successor_task_id", "=", input.taskId),
          ]),
        )
        .where("enabled", "=", true)
        .executeTakeFirst();
      if (incident) {
        return { ok: false, reason: "task_has_active_dependencies" };
      }
      if (input.targetParentTaskId !== null) {
        const parent = await transaction
          .selectFrom("tasks")
          .select(["base_status", "archived"])
          .where("id", "=", input.targetParentTaskId)
          .executeTakeFirst();
        if (!parent) {
          return { ok: false, reason: "parent_not_found" };
        }
        if (parent.base_status === "done" || parent.archived) {
          return { ok: false, reason: "target_parent_done" };
        }
      }

      const facts = await loadProjectFacts(transaction, task.project_id);
      const treeDecision = evaluateTaskParentChange({
        taskId: task.id,
        targetParentTaskId: input.targetParentTaskId,
        tasks: facts.tasks.map(mapTreeNode),
      });
      if (!treeDecision.ok) {
        return { ok: false, reason: treeDecision.reason };
      }
      const impact = await loadImpactDecision(transaction, task.project_id, "move", task.id, {
        targetParentTaskId: input.targetParentTaskId,
      });
      if (!impact.ok || impact.confirmationToken !== input.impactConfirmationToken) {
        return {
          ok: false,
          reason: "impact_confirmation_stale",
          ...(impact.ok ? { impact } : {}),
        };
      }
      const actorMembership = facts.memberships.find(
        (membership) => membership.id === input.actorMembershipId,
      );
      if (!actorMembership) {
        return { ok: false, reason: "forbidden", impact };
      }
      const owners = resolveProjectOwners(facts);
      if (!owners.ok) {
        return { ok: false, reason: "forbidden", impact };
      }
      const authorization = resolveTaskOperationAuthorization(
        {
          serverProjectId: task.project_id,
          targetProjectIds: impact.impact.affectedTaskIds.map(() => task.project_id),
          affectedOwnerMembershipIds: impact.impact.affectedTaskIds.map((taskId) =>
            owners.ownerByTaskId.get(taskId)!,
          ),
          projectOwnerMembershipId: facts.project.ownerMembershipId,
          projectRootOperation: false,
          adminSessionActive: input.adminModeActive,
          actorType: input.actorType,
          adminSessionEnteredFromExplicitUserRequest:
            input.adminSessionEnteredFromExplicitUserRequest,
          impactConfirmationRequired: true,
          impactConfirmed: true,
        },
        {
          userId: actorMembership.userId,
          active: actorMembership.userActive,
          membership: {
            id: actorMembership.id,
            userId: actorMembership.userId,
            projectId: actorMembership.projectId,
            role: actorMembership.role,
            active: actorMembership.active,
          },
        },
      );
      if (!authorization.allowed) {
        return { ok: false, reason: "forbidden", impact };
      }

      const updated = await transaction
        .updateTable("tasks")
        .set({
          parent_task_id: input.targetParentTaskId,
          parent_graph_scope_id: targetScope.id,
          version: sql`version + 1`,
          updated_at: sql`now()`,
        })
        .where("id", "=", task.id)
        .returning("version")
        .executeTakeFirstOrThrow();
      const taskVersion = Number(updated.version);
      await writeTaskSuccessRecords(transaction, {
        projectId: task.project_id,
        actorMembershipId: input.actorMembershipId,
        actorType: input.actorType,
        targetId: task.id,
        requestId: input.requestId ?? `task-move-${task.id}-${taskVersion}`,
        action: "task.move",
        reasonCode: "TASK_MOVED",
        taskVersionBefore: Number(task.version),
        taskVersionAfter: taskVersion,
        eventType: "task.moved",
        payload: {
          taskId: task.id,
          parentTaskId: input.targetParentTaskId,
          taskVersion,
        },
      });
      return {
        ok: true,
        taskId: task.id,
        sourceGraphVersion: await readGraphVersion(transaction, initialTask.parent_graph_scope_id),
        targetGraphVersion: await readGraphVersion(transaction, targetScope.id),
        taskVersion,
      };
    });
  }

  async previewFollowImpact(input: {
    sourceTaskId: string;
    targetTaskId: string;
  }): Promise<FollowImpactResult> {
    const tasks = await this.database
      .selectFrom("tasks")
      .select(["id", "project_id", "base_status", "archived", "frozen"])
      .where("id", "in", [...new Set([input.sourceTaskId, input.targetTaskId])])
      .execute();
    const source = tasks.find((task) => task.id === input.sourceTaskId);
    const target = tasks.find((task) => task.id === input.targetTaskId);
    if (!source || !target) {
      return { ok: false, reason: "task_not_found" };
    }
    if (source.id === target.id) {
      return { ok: false, reason: "self_dependency" };
    }
    if (source.project_id !== target.project_id) {
      return { ok: false, reason: "cross_project_dependency" };
    }
    if (source.frozen || source.base_status === "done") {
      return { ok: false, reason: "completed_task_frozen" };
    }
    if (source.archived) {
      return { ok: false, reason: "task_archived" };
    }
    return loadImpactDecision(this.database, source.project_id, "follow_change", source.id, {
      relatedTaskIds: [target.id],
    });
  }

  async changeFollow(input: {
    action: "add" | "remove";
    sourceTaskId: string;
    targetTaskId: string;
    actorMembershipId: string;
    actorType: "human" | "agent";
    adminModeActive: boolean;
    adminSessionEnteredFromExplicitUserRequest: boolean;
    impactConfirmationToken: string;
    requestId?: string;
  }): Promise<FollowMutationResult> {
    return this.database.transaction().execute(async (transaction) => {
      const lockedTasks = await transaction
        .selectFrom("tasks")
        .select(["id", "project_id", "base_status", "archived", "frozen"])
        .where("id", "in", [...new Set([input.sourceTaskId, input.targetTaskId])].sort())
        .orderBy("id")
        .forUpdate()
        .execute();
      const source = lockedTasks.find((task) => task.id === input.sourceTaskId);
      const target = lockedTasks.find((task) => task.id === input.targetTaskId);
      if (!source || !target) {
        return { ok: false, reason: "task_not_found" };
      }
      if (source.project_id !== target.project_id) {
        return { ok: false, reason: "cross_project_dependency" };
      }
      if (source.frozen || source.base_status === "done") {
        return { ok: false, reason: "completed_task_frozen" };
      }
      if (source.archived) {
        return { ok: false, reason: "task_archived" };
      }
      const facts = await loadProjectFacts(transaction, source.project_id);
      const graphNodes = await mapGraphNodes(facts);
      if (graphNodes.length !== facts.tasks.length) {
        return { ok: false, reason: "forbidden" };
      }
      const follows = await transaction
        .selectFrom("task_follows")
        .select(["source_task_id", "target_task_id"])
        .where("project_id", "=", source.project_id)
        .execute();
      const followEdges = follows.map((follow) => ({
        sourceTaskId: follow.source_task_id,
        targetTaskId: follow.target_task_id,
      }));
      const validation = validateTaskFollow({
        sourceTaskId: input.sourceTaskId,
        targetTaskId: input.targetTaskId,
        tasks: graphNodes,
        follows: input.action === "add" ? followEdges : [],
      });
      if (!validation.ok) {
        return { ok: false, reason: validation.reason };
      }
      const owners = resolveProjectOwners(facts);
      const actorMembership = facts.memberships.find(
        (membership) => membership.id === input.actorMembershipId,
      );
      const sourceOwner = owners.ok ? owners.ownerByTaskId.get(source.id) : undefined;
      if (!actorMembership || !sourceOwner) {
        return { ok: false, reason: "forbidden" };
      }
      const authorization = resolveTaskOperationAuthorization(
        {
          serverProjectId: source.project_id,
          targetProjectIds: [source.project_id, target.project_id],
          affectedOwnerMembershipIds: [sourceOwner],
          projectOwnerMembershipId: facts.project.ownerMembershipId,
          projectRootOperation: false,
          adminSessionActive: input.adminModeActive,
          actorType: input.actorType,
          adminSessionEnteredFromExplicitUserRequest:
            input.adminSessionEnteredFromExplicitUserRequest,
          impactConfirmationRequired: false,
          impactConfirmed: true,
        },
        {
          userId: actorMembership.userId,
          active: actorMembership.userActive,
          membership: {
            id: actorMembership.id,
            userId: actorMembership.userId,
            projectId: actorMembership.projectId,
            role: actorMembership.role,
            active: actorMembership.active,
          },
        },
      );
      if (!authorization.allowed) {
        return { ok: false, reason: "forbidden" };
      }
      const impact = await loadImpactDecision(
        transaction,
        source.project_id,
        "follow_change",
        source.id,
        {
          relatedTaskIds: [target.id],
        },
      );
      if (!impact.ok || impact.confirmationToken !== input.impactConfirmationToken) {
        return {
          ok: false,
          reason: "impact_confirmation_stale",
          ...(impact.ok ? { impact } : {}),
        };
      }
      const existing = followEdges.some(
        (follow) =>
          follow.sourceTaskId === input.sourceTaskId && follow.targetTaskId === input.targetTaskId,
      );
      if (input.action === "add") {
        await transaction
          .insertInto("task_follows")
          .values({
            id: randomUUID(),
            project_id: source.project_id,
            source_task_id: input.sourceTaskId,
            target_task_id: input.targetTaskId,
            created_by_membership_id: input.actorMembershipId,
          })
          .execute();
      } else {
        if (!existing) {
          return { ok: false, reason: "dependency_not_found", impact };
        }
        await transaction
          .deleteFrom("task_follows")
          .where("source_task_id", "=", input.sourceTaskId)
          .where("target_task_id", "=", input.targetTaskId)
          .execute();
      }
      await writeTaskSuccessRecords(transaction, {
        projectId: source.project_id,
        actorMembershipId: input.actorMembershipId,
        actorType: input.actorType,
        targetId: input.sourceTaskId,
        requestId: input.requestId ?? randomUUID(),
        action: "task.follow.change",
        reasonCode: "TASK_FOLLOW_CHANGED",
        taskVersionBefore: null,
        taskVersionAfter: null,
        eventType: "task.follow.changed",
        payload: {
          action: input.action,
          sourceTaskId: input.sourceTaskId,
          targetTaskId: input.targetTaskId,
        },
      });
      return { ok: true };
    });
  }

  async addBlocker(input: {
    taskId: string;
    actorMembershipId: string;
    actorType: "human" | "agent";
    adminModeActive: boolean;
    adminSessionEnteredFromExplicitUserRequest: boolean;
    expectedTaskVersion: number;
    requestId?: string;
    reason: string;
  }): Promise<AddTaskBlockerResult> {
    return this.database.transaction().execute(async (transaction) => {
      const task = await transaction
        .selectFrom("tasks")
        .select(["id", "project_id", "base_status", "archived", "version", "frozen"])
        .where("id", "=", input.taskId)
        .forUpdate()
        .executeTakeFirst();
      if (!task) {
        return { ok: false, reason: "task_not_found" };
      }
      if (task.frozen || task.base_status === "done") {
        return { ok: false, reason: "completed_task_frozen" };
      }
      if (task.archived) {
        return { ok: false, reason: "task_archived" };
      }
      const facts = await loadProjectFacts(transaction, task.project_id);
      const owners = resolveProjectOwners(facts);
      const actorMembership = facts.memberships.find(
        (membership) => membership.id === input.actorMembershipId,
      );
      const taskOwner = owners.ok ? owners.ownerByTaskId.get(task.id) : undefined;
      if (!actorMembership || !taskOwner) {
        return { ok: false, reason: "forbidden" };
      }
      const authorization = resolveTaskOperationAuthorization(
        {
          serverProjectId: task.project_id,
          targetProjectIds: [task.project_id],
          affectedOwnerMembershipIds: [taskOwner],
          projectOwnerMembershipId: facts.project.ownerMembershipId,
          projectRootOperation: false,
          adminSessionActive: input.adminModeActive,
          actorType: input.actorType,
          adminSessionEnteredFromExplicitUserRequest:
            input.adminSessionEnteredFromExplicitUserRequest,
          impactConfirmationRequired: false,
          impactConfirmed: true,
        },
        {
          userId: actorMembership.userId,
          active: actorMembership.userActive,
          membership: {
            id: actorMembership.id,
            userId: actorMembership.userId,
            projectId: actorMembership.projectId,
            role: actorMembership.role,
            active: actorMembership.active,
          },
        },
      );
      if (!authorization.allowed) {
        return { ok: false, reason: "forbidden" };
      }
      if (Number(task.version) !== input.expectedTaskVersion) {
        return { ok: false, reason: "task_version_conflict" };
      }
      const blockerId = randomUUID();
      await transaction
        .insertInto("task_blockers")
        .values({
          id: blockerId,
          project_id: task.project_id,
          task_id: input.taskId,
          reason: input.reason,
          created_by_membership_id: input.actorMembershipId,
        })
        .execute();
      const updated = await transaction
        .updateTable("tasks")
        .set({ version: sql`version + 1`, updated_at: sql`now()` })
        .where("id", "=", task.id)
        .returning("version")
        .executeTakeFirstOrThrow();
      const taskVersion = Number(updated.version);
      await writeTaskSuccessRecords(transaction, {
        projectId: task.project_id,
        actorMembershipId: input.actorMembershipId,
        actorType: input.actorType,
        targetId: input.taskId,
        requestId: input.requestId ?? randomUUID(),
        action: "task.blocker.add",
        reasonCode: "TASK_BLOCKER_ADDED",
        taskVersionBefore: Number(task.version),
        taskVersionAfter: taskVersion,
        eventType: "task.blocker.changed",
        payload: { taskId: input.taskId, blockerId, taskVersion },
      });
      return { ok: true, blockerId, taskVersion };
    });
  }

  private async findTaskWithExecutor(
    executor: DatabaseExecutor,
    taskId: string,
  ): Promise<FormalTaskRecord | undefined> {
    const task = await executor
      .selectFrom("tasks")
      .selectAll()
      .where("id", "=", taskId)
      .executeTakeFirst();
    return task ? mapTask(task) : undefined;
  }
}

async function writeTaskSuccessRecords(
  transaction: Transaction<DatabaseSchema>,
  input: {
    projectId: string;
    actorMembershipId: string;
    actorType: "human" | "agent";
    targetId: string;
    requestId: string;
    action: string;
    reasonCode: string;
    taskVersionBefore: number | null;
    taskVersionAfter: number | null;
    eventType: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  const actor = await transaction
    .selectFrom("memberships")
    .select("user_id")
    .where("id", "=", input.actorMembershipId)
    .where("project_id", "=", input.projectId)
    .executeTakeFirstOrThrow();
  await writeAudit(transaction, {
    actorUserId: actor.user_id,
    actorType: input.actorType,
    projectId: input.projectId,
    targetType: "task",
    targetId: input.targetId,
    requestId: input.requestId,
    action: input.action,
    result: "success",
    reasonCode: input.reasonCode,
    taskVersionBefore: input.taskVersionBefore,
    taskVersionAfter: input.taskVersionAfter,
    metadata: {},
  });
  await transaction
    .insertInto("outbox_events")
    .values({
      id: randomUUID(),
      project_id: input.projectId,
      aggregate_type: "task",
      aggregate_id: input.targetId,
      event_type: input.eventType,
      request_id: input.requestId,
      payload: input.payload,
    })
    .onConflict((conflict) =>
      conflict.columns(["request_id", "event_type", "aggregate_id"]).doNothing(),
    )
    .execute();
}

async function loadProjectFacts(
  executor: DatabaseExecutor,
  projectId: string,
): Promise<ProjectFacts> {
  const project = await executor
    .selectFrom("projects")
    .select(["id", "project_key", "owner_membership_id", "task_sequence"])
    .where("id", "=", projectId)
    .executeTakeFirstOrThrow();
  const tasks = await executor
    .selectFrom("tasks")
    .select([
      "id",
      "project_id",
      "parent_task_id",
      "parent_graph_scope_id",
      "explicit_owner_membership_id",
      "base_status",
      "archived",
      "version",
      "frozen",
    ])
    .where("project_id", "=", projectId)
    .orderBy("id")
    .execute();
  const memberships = await executor
    .selectFrom("memberships")
    .innerJoin("users", "users.id", "memberships.user_id")
    .select([
      "memberships.id",
      "memberships.project_id",
      "memberships.user_id",
      "memberships.role",
      "memberships.active",
      "users.active as user_active",
    ])
    .where("memberships.project_id", "=", projectId)
    .orderBy("memberships.id")
    .execute();
  return {
    project: {
      id: project.id,
      projectKey: project.project_key,
      ownerMembershipId: project.owner_membership_id,
      taskSequence: Number(project.task_sequence),
    },
    tasks,
    memberships: memberships.map((membership) => ({
      id: membership.id,
      projectId: membership.project_id,
      userId: membership.user_id,
      role: membership.role,
      active: membership.active,
      userActive: membership.user_active,
    })),
  };
}

function resolveProjectOwners(
  facts: ProjectFacts,
):
  { ok: true; ownerByTaskId: Map<string, string> } | { ok: false; reason: string; taskId: string } {
  const taskNodes = facts.tasks.map(mapOwnershipNode);
  const memberships = facts.memberships.map(mapOwnershipMembership);
  const ownerByTaskId = new Map<string, string>();
  for (const task of facts.tasks) {
    const owner = resolveEffectiveTaskOwner(task.id, taskNodes, memberships);
    if (!owner.ok) {
      return { ok: false, reason: owner.reason, taskId: task.id };
    }
    ownerByTaskId.set(task.id, owner.membershipId);
  }
  return { ok: true, ownerByTaskId };
}

async function mapGraphNodes(facts: ProjectFacts): Promise<TaskGraphNode[]> {
  const owners = resolveProjectOwners(facts);
  if (!owners.ok) {
    return [];
  }
  return facts.tasks.map((task) => ({
    id: task.id,
    projectId: task.project_id,
    parentTaskId: task.parent_task_id,
    effectiveOwnerMembershipId: owners.ownerByTaskId.get(task.id)!,
    baseStatus: task.base_status,
    archived: task.archived,
  }));
}

async function loadGraphDomainSnapshot(
  executor: DatabaseExecutor,
  facts: ProjectFacts,
  scopeId: string,
): Promise<
  | { ok: true; tasks: TaskGraphNode[]; dependencies: TaskDependencyEdge[] }
  | { ok: false; reason: "forbidden" }
> {
  const tasks = await mapGraphNodes(facts);
  if (tasks.length !== facts.tasks.length) {
    return { ok: false, reason: "forbidden" };
  }
  const dependencies = await executor
    .selectFrom("task_dependencies")
    .select(["predecessor_task_id", "successor_task_id"])
    .where("graph_scope_id", "=", scopeId)
    .where("enabled", "=", true)
    .orderBy("predecessor_task_id")
    .orderBy("successor_task_id")
    .execute();
  return {
    ok: true,
    tasks,
    dependencies: dependencies.map((dependency) => ({
      predecessorTaskId: dependency.predecessor_task_id,
      successorTaskId: dependency.successor_task_id,
    })),
  };
}

async function loadImpactDecision(
  executor: DatabaseExecutor,
  projectId: string,
  operation: "move" | "archive" | "delete" | "owner_change" | "cascade_reopen" | "follow_change",
  taskId: string,
  options: { relatedTaskIds?: readonly string[]; targetParentTaskId?: string | null } = {},
): Promise<TaskImpactDecision> {
  const facts = await loadProjectFacts(executor, projectId);
  const owners = resolveProjectOwners(facts);
  if (!owners.ok) {
    return { ok: false, reason: "invalid_task_tree", taskId: owners.taskId };
  }
  const workspaces = await executor
    .selectFrom("workspaces")
    .select(["id", "scope_id", "sync_version"])
    .where("scope_type", "=", "task")
    .where(
      "scope_id",
      "in",
      facts.tasks.length > 0 ? facts.tasks.map((task) => task.id) : [randomUUID()],
    )
    .execute();
  const workspaceByTaskId = new Map(workspaces.map((workspace) => [workspace.scope_id, workspace]));
  const leases =
    workspaces.length === 0
      ? []
      : await executor
          .selectFrom("workspace_leases")
          .select(["id", "workspace_id"])
          .where(
            "workspace_id",
            "in",
            workspaces.map((workspace) => workspace.id),
          )
          .where("revoked_at", "is", null)
          .execute();
  const leaseByWorkspaceId = new Map(leases.map((lease) => [lease.workspace_id, lease.id]));
  const tasks: TaskImpactNode[] = facts.tasks.map((task) => {
    const workspace = workspaceByTaskId.get(task.id);
    return {
      ...mapTreeNode(task),
      baseStatus: task.base_status,
      effectiveOwnerMembershipId: owners.ownerByTaskId.get(task.id)!,
      workspace: {
        activeLeaseId: workspace ? (leaseByWorkspaceId.get(workspace.id) ?? null) : null,
        syncVersion: workspace ? Number(workspace.sync_version) : 0,
        lastAcknowledgedSyncVersion: workspace ? Number(workspace.sync_version) : 0,
      },
    };
  });
  const dependencyRows = await executor
    .selectFrom("task_dependencies")
    .select(["id", "predecessor_task_id", "successor_task_id"])
    .where("project_id", "=", projectId)
    .where("enabled", "=", true)
    .execute();
  const dependencies: TaskImpactDependency[] = dependencyRows.map((dependency) => ({
    id: dependency.id,
    predecessorTaskId: dependency.predecessor_task_id,
    successorTaskId: dependency.successor_task_id,
  }));
  return computeTaskImpactSet({
    operation,
    targetTaskId: taskId,
    tasks,
    dependencies,
    ...options,
  });
}

async function applyDependencyMutation(
  transaction: Transaction<DatabaseSchema>,
  input: {
    action: DependencyAction;
    id: string;
    projectId: string;
    scopeId: string;
    predecessorTaskId: string;
    successorTaskId: string;
    actorMembershipId: string;
    requestId: string;
  },
): Promise<void> {
  if (input.action === "add") {
    await transaction
      .insertInto("task_dependencies")
      .values({
        id: input.id,
        project_id: input.projectId,
        graph_scope_id: input.scopeId,
        predecessor_task_id: input.predecessorTaskId,
        successor_task_id: input.successorTaskId,
        created_by_membership_id: input.actorMembershipId,
        request_id: input.requestId,
      })
      .execute();
    return;
  }
  await transaction
    .deleteFrom("task_dependencies")
    .where("graph_scope_id", "=", input.scopeId)
    .where("predecessor_task_id", "=", input.predecessorTaskId)
    .where("successor_task_id", "=", input.successorTaskId)
    .executeTakeFirstOrThrow();
}

async function lockGraphScope(transaction: Transaction<DatabaseSchema>, scopeId: string) {
  return transaction
    .selectFrom("sibling_task_graph_scopes")
    .select(["id", "project_id", "parent_task_id", "graph_version"])
    .where("id", "=", scopeId)
    .forUpdate()
    .executeTakeFirst();
}

async function readGraphVersion(executor: DatabaseExecutor, scopeId: string): Promise<number> {
  const scope = await executor
    .selectFrom("sibling_task_graph_scopes")
    .select("graph_version")
    .where("id", "=", scopeId)
    .executeTakeFirstOrThrow();
  return Number(scope.graph_version);
}

async function findGraphScope(
  executor: DatabaseExecutor,
  projectId: string,
  parentTaskId: string | null,
) {
  let query = executor
    .selectFrom("sibling_task_graph_scopes")
    .select(["id", "project_id", "parent_task_id", "graph_version"])
    .where("project_id", "=", projectId);
  query =
    parentTaskId === null
      ? query.where("parent_task_id", "is", null)
      : query.where("parent_task_id", "=", parentTaskId);
  return query.executeTakeFirst();
}

async function insertTaskWorkspace(
  transaction: Transaction<DatabaseSchema>,
  workspaceId: string,
  taskId: string,
): Promise<void> {
  await transaction
    .insertInto("workspaces")
    .values({ id: workspaceId, scope_type: "task", scope_id: taskId })
    .execute();
  await transaction
    .insertInto("workspace_versions")
    .values({
      workspace_id: workspaceId,
      sync_version: "0",
      manifest_sha256: EMPTY_MANIFEST_HASH,
      created_by_user_id: null,
      device_id: null,
      lease_id: null,
    })
    .execute();
}

async function findTaskWorkspaceId(
  executor: DatabaseExecutor,
  taskId: string,
): Promise<string | undefined> {
  const workspace = await executor
    .selectFrom("workspaces")
    .select("id")
    .where("scope_type", "=", "task")
    .where("scope_id", "=", taskId)
    .executeTakeFirst();
  return workspace?.id;
}

function mapTask(task: {
  id: string;
  project_id: string;
  task_sequence: string;
  task_key: string;
  title: string;
  base_status: "not_started" | "in_progress" | "done";
  archived: boolean;
  parent_task_id: string | null;
  parent_graph_scope_id: string;
  explicit_owner_membership_id: string | null;
  version: string;
  frozen: boolean;
}): FormalTaskRecord {
  return {
    id: task.id,
    projectId: task.project_id,
    taskSequence: Number(task.task_sequence),
    taskKey: task.task_key,
    title: task.title,
    baseStatus: task.base_status,
    archived: task.archived,
    parentTaskId: task.parent_task_id,
    parentGraphScopeId: task.parent_graph_scope_id,
    explicitOwnerMembershipId: task.explicit_owner_membership_id,
    version: Number(task.version),
    frozen: task.frozen,
  };
}

function mapOwnershipNode(task: ProjectTaskRow): TaskOwnershipNode {
  return {
    id: task.id,
    projectId: task.project_id,
    parentTaskId: task.parent_task_id,
    explicitOwnerMembershipId: task.explicit_owner_membership_id,
  };
}

function mapOwnershipMembership(membership: {
  id: string;
  projectId?: string;
  project_id?: string;
  active: boolean;
}): OwnershipMembership {
  return {
    id: membership.id,
    projectId: membership.projectId ?? membership.project_id!,
    active: membership.active,
  };
}

function mapTreeNode(task: ProjectTaskRow): TaskTreeNode {
  return {
    id: task.id,
    projectId: task.project_id,
    parentTaskId: task.parent_task_id,
  };
}
