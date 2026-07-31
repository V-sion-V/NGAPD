import type {
  TaskCollection,
  TaskDependency,
  TaskEffectiveStatus,
  TaskLocation,
  TaskResource,
} from "@ngapd/contracts";

export type TaskLifecycleView = "active" | "history";
export type TaskDueFilter = "all" | "overdue" | "scheduled" | "none";

export interface TaskFilters {
  ownerMembershipId: string;
  logicalRoleId: string;
  effectiveStatus: TaskEffectiveStatus | "";
  due: TaskDueFilter;
  label: string;
}

export interface TaskViewport {
  left: number;
  top: number;
}

export interface TaskScopeSnapshot {
  filters: TaskFilters;
  viewport: TaskViewport;
}

export interface TaskPageSnapshot extends TaskScopeSnapshot {
  parentTaskKey: string | null;
  selectedTaskKey: string | null;
  lifecycle: TaskLifecycleView;
  searchQuery: string;
}

export interface TaskPageState extends TaskPageSnapshot {
  projectKey: string;
  scopeSnapshots: Record<string, TaskScopeSnapshot>;
  searchBefore: TaskPageSnapshot | null;
  searchLocated: boolean;
}

export interface TaskRoute {
  projectKey: string;
  parentTaskKey: string | null;
  selectedTaskKey: string | null;
  lifecycle: TaskLifecycleView;
}

export interface TaskScope {
  tasks: readonly TaskResource[];
  dependencies: readonly TaskDependency[];
  graphVersion: number;
  projectId: string;
  parentTaskId: string | null;
}

export interface VisibleTaskScope extends TaskScope {
  hiddenDependencyCount: number;
}

export class TaskGraphIntegrityError extends Error {
  override readonly name = "TaskGraphIntegrityError";
}

const PROJECT_KEY = /^[A-Z]{2,6}$/u;
const TASK_KEY = /^[A-Z]{2,6}-[1-9][0-9]*$/u;

export function parseTaskRoute(search: string): TaskRoute | null {
  const query = new URLSearchParams(search);
  if (query.get("view") !== "tasks") {
    return null;
  }
  const projectKey = query.get("project")?.toUpperCase() ?? "";
  if (!PROJECT_KEY.test(projectKey)) {
    return null;
  }
  const parentValue = query.get("parent");
  const parentTaskKey =
    parentValue && parentValue !== "root" && TASK_KEY.test(parentValue.toUpperCase())
      ? parentValue.toUpperCase()
      : null;
  const selectedValue = query.get("task");
  const selectedTaskKey =
    selectedValue && TASK_KEY.test(selectedValue.toUpperCase())
      ? selectedValue.toUpperCase()
      : null;
  return {
    projectKey,
    parentTaskKey,
    selectedTaskKey,
    lifecycle: query.get("history") === "1" ? "history" : "active",
  };
}

export function taskRouteUrl(state: Pick<TaskPageState, keyof TaskRoute>): string {
  const query = new URLSearchParams({
    view: "tasks",
    project: state.projectKey,
    parent: state.parentTaskKey ?? "root",
  });
  if (state.selectedTaskKey) {
    query.set("task", state.selectedTaskKey);
  }
  if (state.lifecycle === "history") {
    query.set("history", "1");
  }
  return `/?${query.toString()}`;
}

export function createTaskPageState(route: TaskRoute): TaskPageState {
  return {
    ...route,
    filters: createTaskFilters(),
    viewport: { left: 0, top: 0 },
    searchQuery: "",
    scopeSnapshots: {},
    searchBefore: null,
    searchLocated: false,
  };
}

export function readTaskHistoryState(value: unknown, route: TaskRoute): TaskPageState | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = (value as { m3TaskState?: unknown }).m3TaskState;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  const state = candidate as Partial<TaskPageState>;
  if (
    state.projectKey !== route.projectKey ||
    state.parentTaskKey !== route.parentTaskKey ||
    state.selectedTaskKey !== route.selectedTaskKey ||
    state.lifecycle !== route.lifecycle ||
    !isFilters(state.filters) ||
    !isViewport(state.viewport) ||
    typeof state.searchQuery !== "string" ||
    typeof state.searchLocated !== "boolean" ||
    !state.scopeSnapshots ||
    typeof state.scopeSnapshots !== "object"
  ) {
    return null;
  }
  return state as TaskPageState;
}

export function createTaskFilters(): TaskFilters {
  return {
    ownerMembershipId: "",
    logicalRoleId: "",
    effectiveStatus: "",
    due: "all",
    label: "",
  };
}

export function navigateTaskScope(
  state: TaskPageState,
  parentTaskKey: string | null,
  lifecycle: TaskLifecycleView = state.lifecycle,
): TaskPageState {
  const scopeSnapshots = saveTaskScope(state);
  const target = scopeSnapshots[scopeKey(parentTaskKey, lifecycle)];
  return {
    ...state,
    parentTaskKey,
    selectedTaskKey: null,
    lifecycle,
    filters: target?.filters ?? createTaskFilters(),
    viewport: target?.viewport ?? { left: 0, top: 0 },
    scopeSnapshots,
  };
}

export function selectTaskKey(state: TaskPageState, selectedTaskKey: string | null): TaskPageState {
  return { ...state, selectedTaskKey };
}

export function updateTaskViewport(state: TaskPageState, viewport: TaskViewport): TaskPageState {
  return { ...state, viewport };
}

export function updateTaskSearchQuery(state: TaskPageState, searchQuery: string): TaskPageState {
  const beginsSearch = state.searchQuery.trim() === "" && searchQuery.trim() !== "";
  const searchBefore =
    beginsSearch && !state.searchBefore
      ? pageSnapshot({ ...state, searchQuery: "" })
      : searchQuery.trim() === "" && !state.searchLocated
        ? null
        : state.searchBefore;
  return { ...state, searchQuery, searchBefore };
}

export function updateTaskFilters(
  state: TaskPageState,
  patch: Partial<TaskFilters>,
  tasks: readonly TaskResource[],
  now = Date.now(),
): TaskPageState {
  const filters = { ...state.filters, ...patch };
  const visibleKeys = new Set(filterTasks(tasks, filters, now).map((task) => task.key));
  return {
    ...state,
    filters,
    selectedTaskKey:
      state.selectedTaskKey && !visibleKeys.has(state.selectedTaskKey)
        ? null
        : state.selectedTaskKey,
  };
}

export function locateSearchResult(state: TaskPageState, result: TaskLocation): TaskPageState {
  const searchBefore = state.searchBefore ?? pageSnapshot(state);
  return {
    ...state,
    parentTaskKey: result.task.parentTaskKey,
    selectedTaskKey: result.task.key,
    lifecycle: result.task.archiveLifecycle === "archived" ? "history" : "active",
    filters: createTaskFilters(),
    viewport: { left: 0, top: 0 },
    searchBefore,
    searchLocated: true,
  };
}

export function returnFromTaskSearch(state: TaskPageState): TaskPageState {
  if (!state.searchBefore) {
    return state;
  }
  return {
    ...state,
    ...state.searchBefore,
    searchBefore: null,
    searchLocated: false,
  };
}

export function validateTaskScope(
  pages: readonly TaskCollection[],
  expectedProjectId: string,
  expectedParentTaskId: string | null,
): TaskScope {
  if (pages.length === 0) {
    return {
      tasks: [],
      dependencies: [],
      graphVersion: 0,
      projectId: expectedProjectId,
      parentTaskId: expectedParentTaskId,
    };
  }

  const tasksById = new Map<string, TaskResource>();
  const dependenciesById = new Map<string, TaskDependency>();
  const graphVersion = pages[0]!.graph.graphVersion;
  for (const page of pages) {
    if (
      page.graph.projectId !== expectedProjectId ||
      page.graph.parentTaskId !== expectedParentTaskId ||
      page.graph.graphVersion !== graphVersion
    ) {
      throw new TaskGraphIntegrityError("任务图作用域或版本不一致");
    }
    for (const task of page.tasks) {
      if (task.projectId !== expectedProjectId || task.parentTaskId !== expectedParentTaskId) {
        throw new TaskGraphIntegrityError("任务节点跨越当前作用域");
      }
      const existing = tasksById.get(task.id);
      if (existing && existing.key !== task.key) {
        throw new TaskGraphIntegrityError("任务节点标识不唯一");
      }
      tasksById.set(task.id, task);
    }
    for (const dependency of page.dependencies) {
      if (
        dependency.projectId !== expectedProjectId ||
        dependency.parentTaskId !== expectedParentTaskId ||
        dependency.predecessorTaskId === dependency.successorTaskId
      ) {
        throw new TaskGraphIntegrityError("依赖越界或自环");
      }
      dependenciesById.set(dependency.id, dependency);
    }
  }

  const tasks = [...tasksById.values()].sort((left, right) => left.sequence - right.sequence);
  const dependencies = [...dependenciesById.values()];
  const taskIds = new Set(tasks.map((task) => task.id));
  const loadedDependencies = dependencies.filter(
    (dependency) =>
      taskIds.has(dependency.predecessorTaskId) && taskIds.has(dependency.successorTaskId),
  );
  assertAcyclic(tasks, loadedDependencies);
  return {
    tasks,
    dependencies,
    graphVersion,
    projectId: expectedProjectId,
    parentTaskId: expectedParentTaskId,
  };
}

export function filterTaskScope(
  scope: TaskScope,
  filters: TaskFilters,
  now = Date.now(),
): VisibleTaskScope {
  const tasks = filterTasks(scope.tasks, filters, now);
  const visibleIds = new Set(tasks.map((task) => task.id));
  const dependencies = scope.dependencies.filter(
    (dependency) =>
      visibleIds.has(dependency.predecessorTaskId) && visibleIds.has(dependency.successorTaskId),
  );
  return {
    ...scope,
    tasks,
    dependencies,
    hiddenDependencyCount: scope.dependencies.length - dependencies.length,
  };
}

function filterTasks(
  tasks: readonly TaskResource[],
  filters: TaskFilters,
  now: number,
): TaskResource[] {
  return tasks.filter((task) => {
    if (
      filters.ownerMembershipId &&
      task.effectiveOwner.membershipId !== filters.ownerMembershipId
    ) {
      return false;
    }
    if (filters.logicalRoleId && task.logicalRoleId !== filters.logicalRoleId) {
      return false;
    }
    if (filters.effectiveStatus && task.effectiveStatus !== filters.effectiveStatus) {
      return false;
    }
    if (filters.label && !task.labels.includes(filters.label)) {
      return false;
    }
    const dueAt = task.dueAt ? new Date(task.dueAt).getTime() : null;
    if (filters.due === "none" && dueAt !== null) {
      return false;
    }
    if (filters.due === "scheduled" && dueAt === null) {
      return false;
    }
    if (filters.due === "overdue" && (dueAt === null || dueAt >= now)) {
      return false;
    }
    return true;
  });
}

function assertAcyclic(
  tasks: readonly TaskResource[],
  dependencies: readonly TaskDependency[],
): void {
  const indegree = new Map(tasks.map((task) => [task.id, 0]));
  const outgoing = new Map<string, string[]>();
  for (const dependency of dependencies) {
    indegree.set(dependency.successorTaskId, (indegree.get(dependency.successorTaskId) ?? 0) + 1);
    outgoing.set(dependency.predecessorTaskId, [
      ...(outgoing.get(dependency.predecessorTaskId) ?? []),
      dependency.successorTaskId,
    ]);
  }
  const queue = [...indegree.entries()]
    .filter(([, count]) => count === 0)
    .map(([taskId]) => taskId);
  let visited = 0;
  while (queue.length > 0) {
    const taskId = queue.shift()!;
    visited += 1;
    for (const successorId of outgoing.get(taskId) ?? []) {
      const count = (indegree.get(successorId) ?? 0) - 1;
      indegree.set(successorId, count);
      if (count === 0) {
        queue.push(successorId);
      }
    }
  }
  if (visited !== tasks.length) {
    throw new TaskGraphIntegrityError("当前任务图包含循环");
  }
}

function pageSnapshot(state: TaskPageState): TaskPageSnapshot {
  return {
    parentTaskKey: state.parentTaskKey,
    selectedTaskKey: state.selectedTaskKey,
    lifecycle: state.lifecycle,
    filters: state.filters,
    viewport: state.viewport,
    searchQuery: state.searchQuery,
  };
}

function saveTaskScope(state: TaskPageState): Record<string, TaskScopeSnapshot> {
  return {
    ...state.scopeSnapshots,
    [scopeKey(state.parentTaskKey, state.lifecycle)]: {
      filters: state.filters,
      viewport: state.viewport,
    },
  };
}

function scopeKey(parentTaskKey: string | null, lifecycle: TaskLifecycleView): string {
  return `${lifecycle}:${parentTaskKey ?? "PROJECT_ROOT"}`;
}

function isFilters(value: unknown): value is TaskFilters {
  if (!value || typeof value !== "object") {
    return false;
  }
  const filters = value as Partial<TaskFilters>;
  return (
    typeof filters.ownerMembershipId === "string" &&
    typeof filters.logicalRoleId === "string" &&
    typeof filters.effectiveStatus === "string" &&
    ["all", "overdue", "scheduled", "none"].includes(filters.due ?? "") &&
    typeof filters.label === "string"
  );
}

function isViewport(value: unknown): value is TaskViewport {
  if (!value || typeof value !== "object") {
    return false;
  }
  const viewport = value as Partial<TaskViewport>;
  return (
    typeof viewport.left === "number" &&
    Number.isFinite(viewport.left) &&
    viewport.left >= 0 &&
    typeof viewport.top === "number" &&
    Number.isFinite(viewport.top) &&
    viewport.top >= 0
  );
}
