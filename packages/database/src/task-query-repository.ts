import {
  deriveTaskActions,
  deriveTaskEffectiveStatus,
  evaluateCompletionReadiness,
  resolveEffectiveTaskOwner,
  type DerivedTaskAction,
  type OwnershipMembership,
  type TaskOwnershipNode,
} from "@ngapd/domain";

import type { Database } from "./client.js";

export interface TaskQueryRecord {
  id: string;
  projectId: string;
  taskSequence: number;
  taskKey: string;
  title: string;
  content: string;
  logicalRoleId: string | null;
  dueAt: string | null;
  labels: string[];
  displayType: "normal" | "sprint" | "milestone";
  parentTaskId: string | null;
  explicitOwnerMembershipId: string | null;
  effectiveOwnerMembershipId: string;
  effectiveOwnerSourceTaskId: string;
  baseStatus: "not_started" | "in_progress" | "done";
  effectiveStatus: "not_started" | "in_progress" | "done" | "blocked";
  archived: boolean;
  archivedAt: string | null;
  completionReady: boolean;
  childSummary: { total: number; done: number; blocked: number };
  graphVersion: number;
  version: number;
  workspace: {
    id: string;
    lifecycle: "active" | "frozen" | "archived" | "deleted";
    workCycle: number;
    syncVersion: number;
    hasActiveWriteLease: boolean;
  };
  createdByMembershipId: string;
  createdAt: string;
  updatedAt: string;
  actions: DerivedTaskAction[];
}

export interface TaskQueryPage {
  tasks: TaskQueryRecord[];
  nextCursor: string | null;
  graph: {
    projectId: string;
    parentTaskId: string | null;
    graphVersion: number;
  };
  dependencies: Array<{
    id: string;
    projectId: string;
    parentTaskId: string | null;
    predecessorTaskId: string;
    successorTaskId: string;
  }>;
}

export interface TaskLocationRecord {
  task: {
    id: string;
    projectId: string;
    taskKey: string;
    title: string;
    parentTaskKey: string | null;
    archived: boolean;
    displayType: "normal" | "sprint" | "milestone";
    baseStatus: "not_started" | "in_progress" | "done";
    effectiveStatus: "not_started" | "in_progress" | "done" | "blocked";
  };
  ancestors: Array<{
    id: string;
    taskKey: string;
    title: string;
    archived: boolean;
  }>;
}

export interface TaskSearchPage {
  results: TaskLocationRecord[];
  nextCursor: string | null;
}

export class TaskTreeIntegrityError extends Error {
  constructor() {
    super("TASK_TREE_INVALID");
    this.name = "TaskTreeIntegrityError";
  }
}

export class TaskQueryRepository {
  constructor(private readonly database: Database) {}

  async findProjectIdByKey(projectKey: string): Promise<string | undefined> {
    const project = await this.database
      .selectFrom("projects")
      .select("id")
      .where("project_key", "=", projectKey)
      .executeTakeFirst();
    return project?.id;
  }

  async findTaskIdByKey(projectId: string, taskKey: string): Promise<string | undefined> {
    const task = await this.database
      .selectFrom("tasks")
      .select("id")
      .where("project_id", "=", projectId)
      .where("task_key", "=", taskKey)
      .executeTakeFirst();
    return task?.id;
  }

  async readTask(input: {
    projectId: string;
    taskId: string;
    actorMembershipId: string;
    adminModeActive: boolean;
  }): Promise<TaskQueryRecord | undefined> {
    const snapshot = await this.loadProjectSnapshot(
      input.projectId,
      input.actorMembershipId,
      input.adminModeActive,
    );
    return snapshot.records.get(input.taskId);
  }

  async listTasks(input: {
    projectId: string;
    parentTaskId: string | null;
    lifecycle: "active" | "archived" | "all";
    afterTaskKey?: string;
    limit?: number;
    actorMembershipId: string;
    adminModeActive: boolean;
  }): Promise<TaskQueryPage> {
    const snapshot = await this.loadProjectSnapshot(
      input.projectId,
      input.actorMembershipId,
      input.adminModeActive,
    );
    const afterSequence =
      input.afterTaskKey === undefined
        ? 0
        : (snapshot.byKey.get(input.afterTaskKey)?.taskSequence ?? Number.MAX_SAFE_INTEGER);
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const candidates = [...snapshot.records.values()]
      .filter((task) => task.parentTaskId === input.parentTaskId)
      .filter((task) =>
        input.lifecycle === "all"
          ? true
          : input.lifecycle === "archived"
            ? task.archived
            : !task.archived,
      )
      .filter((task) => task.taskSequence > afterSequence)
      .sort((left, right) => left.taskSequence - right.taskSequence);
    const tasks = candidates.slice(0, limit);
    const nextCursor = candidates.length > limit && tasks.length > 0 ? tasks.at(-1)!.taskKey : null;
    const scope = snapshot.scopes.find(
      (candidate) => candidate.parent_task_id === input.parentTaskId,
    );
    return {
      tasks,
      nextCursor,
      graph: {
        projectId: input.projectId,
        parentTaskId: input.parentTaskId,
        graphVersion: Number(scope?.graph_version ?? 0),
      },
      dependencies: snapshot.dependencies
        .filter((dependency) => dependency.graph_scope_id === scope?.id)
        .map((dependency) => ({
          id: dependency.id,
          projectId: input.projectId,
          parentTaskId: input.parentTaskId,
          predecessorTaskId: dependency.predecessor_task_id,
          successorTaskId: dependency.successor_task_id,
        })),
    };
  }

  async searchTasks(input: {
    projectId: string;
    query: string;
    lifecycle: "active" | "archived" | "all";
    afterTaskKey?: string;
    limit?: number;
    actorMembershipId: string;
    adminModeActive: boolean;
  }): Promise<TaskSearchPage> {
    const snapshot = await this.loadProjectSnapshot(
      input.projectId,
      input.actorMembershipId,
      input.adminModeActive,
    );
    const query = input.query.trim();
    const taskKeyQuery = query.toUpperCase();
    const titleQuery = query.toLowerCase();
    const matches = [...snapshot.records.values()]
      .map((task) => {
        const rank =
          task.taskKey === taskKeyQuery
            ? 0
            : task.taskKey.startsWith(taskKeyQuery)
              ? 1
              : task.title.toLowerCase().includes(titleQuery)
                ? 2
                : null;
        return { task, rank };
      })
      .filter(
        (
          candidate,
        ): candidate is {
          task: TaskQueryRecord;
          rank: number;
        } =>
          candidate.rank !== null &&
          (input.lifecycle === "all" ||
            (input.lifecycle === "archived" ? candidate.task.archived : !candidate.task.archived)),
      )
      .sort(
        (left, right) => left.rank - right.rank || left.task.taskSequence - right.task.taskSequence,
      );
    const start =
      input.afterTaskKey === undefined
        ? 0
        : Math.max(
            0,
            matches.findIndex((candidate) => candidate.task.taskKey === input.afterTaskKey) + 1,
          );
    if (
      input.afterTaskKey !== undefined &&
      !matches.some((candidate) => candidate.task.taskKey === input.afterTaskKey)
    ) {
      return { results: [], nextCursor: null };
    }
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
    const selected = matches.slice(start, start + limit);
    return {
      results: selected.map(({ task }) => this.buildTaskLocation(snapshot.records, task)),
      nextCursor:
        matches.length > start + limit && selected.length > 0
          ? selected.at(-1)!.task.taskKey
          : null,
    };
  }

  async readTaskLocation(input: {
    projectId: string;
    taskId: string;
    actorMembershipId: string;
    adminModeActive: boolean;
  }): Promise<TaskLocationRecord | undefined> {
    const snapshot = await this.loadProjectSnapshot(
      input.projectId,
      input.actorMembershipId,
      input.adminModeActive,
    );
    const task = snapshot.records.get(input.taskId);
    return task ? this.buildTaskLocation(snapshot.records, task) : undefined;
  }

  async listFollows(taskId: string): Promise<string[]> {
    const rows = await this.database
      .selectFrom("task_follows")
      .select("target_task_id")
      .where("source_task_id", "=", taskId)
      .orderBy("target_task_id")
      .execute();
    return rows.map((row) => row.target_task_id);
  }

  async listBlockers(taskId: string) {
    return this.database
      .selectFrom("task_blockers")
      .selectAll()
      .where("task_id", "=", taskId)
      .orderBy("created_at")
      .orderBy("id")
      .execute();
  }

  async listDependencyChangeRequests(projectId: string) {
    return this.database
      .selectFrom("task_dependency_change_requests")
      .innerJoin(
        "sibling_task_graph_scopes",
        "sibling_task_graph_scopes.id",
        "task_dependency_change_requests.graph_scope_id",
      )
      .select([
        "task_dependency_change_requests.id",
        "task_dependency_change_requests.action",
        "task_dependency_change_requests.predecessor_task_id",
        "task_dependency_change_requests.successor_task_id",
        "task_dependency_change_requests.expected_graph_version",
        "task_dependency_change_requests.predecessor_owner_membership_id",
        "task_dependency_change_requests.successor_owner_membership_id",
        "task_dependency_change_requests.required_acceptance_by_membership_id",
        "task_dependency_change_requests.status",
        "sibling_task_graph_scopes.parent_task_id",
      ])
      .where("task_dependency_change_requests.project_id", "=", projectId)
      .orderBy("task_dependency_change_requests.created_at")
      .orderBy("task_dependency_change_requests.id")
      .execute();
  }

  private buildTaskLocation(
    records: ReadonlyMap<string, TaskQueryRecord>,
    task: TaskQueryRecord,
  ): TaskLocationRecord {
    const ancestors: TaskLocationRecord["ancestors"] = [];
    const visited = new Set([task.id]);
    let parentTaskId = task.parentTaskId;
    while (parentTaskId !== null) {
      if (visited.has(parentTaskId)) {
        throw new TaskTreeIntegrityError();
      }
      visited.add(parentTaskId);
      const parent = records.get(parentTaskId);
      if (!parent || parent.projectId !== task.projectId) {
        throw new TaskTreeIntegrityError();
      }
      ancestors.unshift({
        id: parent.id,
        taskKey: parent.taskKey,
        title: parent.title,
        archived: parent.archived,
      });
      parentTaskId = parent.parentTaskId;
      if (ancestors.length > 256) {
        throw new TaskTreeIntegrityError();
      }
    }
    const parent = task.parentTaskId ? records.get(task.parentTaskId) : undefined;
    return {
      task: {
        id: task.id,
        projectId: task.projectId,
        taskKey: task.taskKey,
        title: task.title,
        parentTaskKey: parent?.taskKey ?? null,
        archived: task.archived,
        displayType: task.displayType,
        baseStatus: task.baseStatus,
        effectiveStatus: task.effectiveStatus,
      },
      ancestors,
    };
  }

  private async loadProjectSnapshot(
    projectId: string,
    actorMembershipId: string,
    adminModeActive: boolean,
  ) {
    const [taskRows, membershipRows, dependencies, blockerRows, scopes, workspaces] =
      await Promise.all([
        this.database
          .selectFrom("tasks")
          .selectAll()
          .where("project_id", "=", projectId)
          .orderBy("task_sequence")
          .execute(),
        this.database
          .selectFrom("memberships")
          .select(["id", "project_id", "status"])
          .where("project_id", "=", projectId)
          .execute(),
        this.database
          .selectFrom("task_dependencies")
          .selectAll()
          .where("project_id", "=", projectId)
          .where("enabled", "=", true)
          .execute(),
        this.database
          .selectFrom("task_blockers")
          .select(["id", "task_id", "resolved_at"])
          .where("project_id", "=", projectId)
          .execute(),
        this.database
          .selectFrom("sibling_task_graph_scopes")
          .select(["id", "parent_task_id", "graph_version"])
          .where("project_id", "=", projectId)
          .execute(),
        this.database
          .selectFrom("workspaces")
          .select(["id", "scope_id", "lifecycle", "work_cycle", "sync_version"])
          .where("scope_type", "=", "task")
          .execute(),
      ]);
    const projectTaskIds = new Set(taskRows.map((task) => task.id));
    const taskWorkspaces = workspaces.filter((workspace) => projectTaskIds.has(workspace.scope_id));
    const leases =
      taskWorkspaces.length === 0
        ? []
        : await this.database
            .selectFrom("workspace_leases")
            .select(["workspace_id", "expires_at"])
            .where(
              "workspace_id",
              "in",
              taskWorkspaces.map((workspace) => workspace.id),
            )
            .where("revoked_at", "is", null)
            .where("expires_at", ">", new Date())
            .execute();

    const ownershipNodes: TaskOwnershipNode[] = taskRows.map((task) => ({
      id: task.id,
      projectId: task.project_id,
      parentTaskId: task.parent_task_id,
      explicitOwnerMembershipId: task.explicit_owner_membership_id,
    }));
    const memberships: OwnershipMembership[] = membershipRows.map((membership) => ({
      id: membership.id,
      projectId: membership.project_id,
      status: membership.status,
    }));
    const taskById = new Map(taskRows.map((task) => [task.id, task]));
    const workspaceByTaskId = new Map(
      taskWorkspaces.map((workspace) => [workspace.scope_id, workspace]),
    );
    const activeLeaseWorkspaceIds = new Set(leases.map((lease) => lease.workspace_id));
    const unresolvedByTask = new Map<string, string[]>();
    for (const blocker of blockerRows) {
      if (blocker.resolved_at === null) {
        unresolvedByTask.set(blocker.task_id, [
          ...(unresolvedByTask.get(blocker.task_id) ?? []),
          blocker.id,
        ]);
      }
    }
    const predecessorsByTask = new Map<string, typeof taskRows>();
    for (const dependency of dependencies) {
      const predecessor = taskById.get(dependency.predecessor_task_id);
      if (predecessor) {
        predecessorsByTask.set(dependency.successor_task_id, [
          ...(predecessorsByTask.get(dependency.successor_task_id) ?? []),
          predecessor,
        ]);
      }
    }
    const childrenByTask = new Map<string, typeof taskRows>();
    for (const task of taskRows) {
      if (task.parent_task_id !== null) {
        childrenByTask.set(task.parent_task_id, [
          ...(childrenByTask.get(task.parent_task_id) ?? []),
          task,
        ]);
      }
    }
    const records = new Map<string, TaskQueryRecord>();
    for (const task of taskRows) {
      const owner = resolveEffectiveTaskOwner(task.id, ownershipNodes, memberships);
      const workspace = workspaceByTaskId.get(task.id);
      const scope = scopes.find((candidate) => candidate.id === task.parent_graph_scope_id);
      if (!owner.ok || !workspace || !scope) {
        continue;
      }
      const predecessors = predecessorsByTask.get(task.id) ?? [];
      const children = childrenByTask.get(task.id) ?? [];
      const unresolvedBlockerIds = unresolvedByTask.get(task.id) ?? [];
      const effectiveStatus = deriveTaskEffectiveStatus({
        baseStatus: task.base_status,
        unresolvedManualBlockers: unresolvedBlockerIds.length,
        predecessorStatuses: predecessors
          .filter((predecessor) => !predecessor.archived)
          .map((predecessor) => predecessor.base_status),
      });
      const readiness = evaluateCompletionReadiness({
        taskId: task.id,
        taskVersion: Number(task.version),
        graphVersion: Number(scope.graph_version),
        baseStatus: task.base_status,
        archived: task.archived,
        effectiveOwnerMembershipId: owner.membershipId,
        directChildren: children.map((child) => ({
          id: child.id,
          status: child.base_status,
          archived: child.archived,
          version: Number(child.version),
        })),
        predecessors: predecessors.map((predecessor) => ({
          id: predecessor.id,
          status: predecessor.base_status,
          archived: predecessor.archived,
          version: Number(predecessor.version),
        })),
        unresolvedBlockerIds,
      });
      const childEffectiveStatuses = children.map((child) =>
        deriveTaskEffectiveStatus({
          baseStatus: child.base_status,
          unresolvedManualBlockers: (unresolvedByTask.get(child.id) ?? []).length,
          predecessorStatuses: (predecessorsByTask.get(child.id) ?? [])
            .filter((predecessor) => !predecessor.archived)
            .map((predecessor) => predecessor.base_status),
        }),
      );
      records.set(task.id, {
        id: task.id,
        projectId: task.project_id,
        taskSequence: Number(task.task_sequence),
        taskKey: task.task_key,
        title: task.title,
        content: task.content,
        logicalRoleId: task.logical_role_id,
        dueAt: task.due_at?.toISOString() ?? null,
        labels: task.labels,
        displayType: task.display_type,
        parentTaskId: task.parent_task_id,
        explicitOwnerMembershipId: task.explicit_owner_membership_id,
        effectiveOwnerMembershipId: owner.membershipId,
        effectiveOwnerSourceTaskId: owner.sourceTaskId,
        baseStatus: task.base_status,
        effectiveStatus,
        archived: task.archived,
        archivedAt: task.archived_at?.toISOString() ?? null,
        completionReady: readiness.ready,
        childSummary: {
          total: children.filter((child) => !child.archived).length,
          done: children.filter((child) => !child.archived && child.base_status === "done").length,
          blocked: childEffectiveStatuses.filter((status) => status === "blocked").length,
        },
        graphVersion: Number(scope.graph_version),
        version: Number(task.version),
        workspace: {
          id: workspace.id,
          lifecycle: workspace.lifecycle,
          workCycle: workspace.work_cycle,
          syncVersion: Number(workspace.sync_version),
          hasActiveWriteLease: activeLeaseWorkspaceIds.has(workspace.id),
        },
        createdByMembershipId: task.created_by_membership_id,
        createdAt: task.created_at.toISOString(),
        updatedAt: task.updated_at.toISOString(),
        actions: deriveTaskActions({
          activeMember: true,
          actorMembershipId,
          effectiveOwnerMembershipId: owner.membershipId,
          adminModeActive,
          baseStatus: task.base_status,
          archived: task.archived,
          parentTaskId: task.parent_task_id,
          completionReady: readiness.ready,
        }),
      });
    }
    return {
      records,
      byKey: new Map([...records.values()].map((task) => [task.taskKey, task])),
      scopes,
      dependencies,
    };
  }
}
