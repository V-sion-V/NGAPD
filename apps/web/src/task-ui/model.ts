import type {
  TaskEffectiveStatus,
  TaskLogicalRole,
  TaskProfileId,
  TaskUiDependency,
  TaskUiIndex,
  TaskUiTask,
} from "@ngapd/test-fixtures/task-graph";

export type DueFilter = "all" | "scheduled" | "overdue" | "none";

export interface TaskUiFilters {
  ownerId: string;
  role: TaskLogicalRole | "";
  status: TaskEffectiveStatus | "";
  due: DueFilter;
  label: string;
}

export interface TaskUiViewport {
  left: number;
  top: number;
}

export interface TaskUiScopeSnapshot {
  filters: TaskUiFilters;
  searchQuery: string;
  viewport: TaskUiViewport;
}

export interface TaskUiPageSnapshot extends TaskUiScopeSnapshot {
  parentTaskId: string | null;
  selectedTaskId: string | null;
}

export interface TaskUiState extends TaskUiPageSnapshot {
  profileId: TaskProfileId;
  searchBefore: TaskUiPageSnapshot | null;
  searchLocated: boolean;
  scopeSnapshots: Record<string, TaskUiScopeSnapshot>;
}

export interface FilteredTaskScope {
  tasks: readonly TaskUiTask[];
  dependencies: readonly TaskUiDependency[];
  hiddenDependencyCount: number;
}

export function createEmptyFilters(): TaskUiFilters {
  return {
    ownerId: "",
    role: "",
    status: "",
    due: "all",
    label: "",
  };
}

export function createInitialTaskUiState(profileId: TaskProfileId): TaskUiState {
  return {
    profileId,
    parentTaskId: null,
    selectedTaskId: null,
    filters: createEmptyFilters(),
    searchQuery: "",
    searchBefore: null,
    searchLocated: false,
    scopeSnapshots: {},
    viewport: { left: 0, top: 0 },
  };
}

export function selectTask(state: TaskUiState, taskId: string, index: TaskUiIndex): TaskUiState {
  const isInCurrentScope = (index.childrenByParentId.get(state.parentTaskId) ?? []).some(
    (task) => task.id === taskId,
  );
  return isInCurrentScope ? { ...state, selectedTaskId: taskId } : state;
}

export function closeTaskDrawer(state: TaskUiState): TaskUiState {
  return { ...state, selectedTaskId: null };
}

export function updateViewport(state: TaskUiState, viewport: TaskUiViewport): TaskUiState {
  return { ...state, viewport };
}

export function updateSearchQuery(state: TaskUiState, searchQuery: string): TaskUiState {
  const beginsSearch = state.searchQuery.trim() === "" && searchQuery.trim() !== "";
  const searchBefore =
    beginsSearch && !state.searchBefore
      ? ({
          parentTaskId: state.parentTaskId,
          selectedTaskId: state.selectedTaskId,
          filters: state.filters,
          searchQuery: "",
          viewport: state.viewport,
        } satisfies TaskUiPageSnapshot)
      : searchQuery.trim() === "" && !state.searchLocated
        ? null
        : state.searchBefore;
  return { ...state, searchQuery, searchBefore };
}

export function updateFilters(
  state: TaskUiState,
  index: TaskUiIndex,
  patch: Partial<TaskUiFilters>,
  now = Date.now(),
): TaskUiState {
  const filters = { ...state.filters, ...patch };
  const visible = new Set(
    filterTaskScope(index, state.parentTaskId, filters, now).tasks.map((task) => task.id),
  );
  return {
    ...state,
    filters,
    selectedTaskId:
      state.selectedTaskId && !visible.has(state.selectedTaskId) ? null : state.selectedTaskId,
  };
}

export function enterSelectedTask(state: TaskUiState, index: TaskUiIndex): TaskUiState {
  if (!state.selectedTaskId) {
    return state;
  }
  const selected = index.tasksById.get(state.selectedTaskId);
  if (!selected || (index.childrenByParentId.get(selected.id)?.length ?? 0) === 0) {
    return state;
  }

  const scopeSnapshots = saveCurrentScope(state);
  const targetSnapshot = scopeSnapshots[scopeKey(selected.id)];
  return {
    ...state,
    parentTaskId: selected.id,
    selectedTaskId: null,
    filters: targetSnapshot?.filters ?? createEmptyFilters(),
    searchQuery: targetSnapshot?.searchQuery ?? "",
    viewport: targetSnapshot?.viewport ?? { left: 0, top: 0 },
    scopeSnapshots,
  };
}

export function navigateToScope(
  state: TaskUiState,
  parentTaskId: string | null,
  index: TaskUiIndex,
): TaskUiState {
  if (parentTaskId !== null && !index.tasksById.has(parentTaskId)) {
    return state;
  }
  const allowed = new Set<string | null>([null]);
  if (state.parentTaskId) {
    allowed.add(state.parentTaskId);
    for (const ancestor of index.ancestorsByTaskId.get(state.parentTaskId) ?? []) {
      allowed.add(ancestor.id);
    }
  }
  if (!allowed.has(parentTaskId)) {
    return state;
  }

  const scopeSnapshots = saveCurrentScope(state);
  const target = scopeSnapshots[scopeKey(parentTaskId)];
  return {
    ...state,
    parentTaskId,
    selectedTaskId: null,
    filters: target?.filters ?? createEmptyFilters(),
    searchQuery: target?.searchQuery ?? "",
    viewport: target?.viewport ?? { left: 0, top: 0 },
    scopeSnapshots,
  };
}

export function selectSearchResult(state: TaskUiState, task: TaskUiTask): TaskUiState {
  const searchBefore =
    state.searchBefore ??
    ({
      parentTaskId: state.parentTaskId,
      selectedTaskId: state.selectedTaskId,
      filters: state.filters,
      searchQuery: state.searchQuery,
      viewport: state.viewport,
    } satisfies TaskUiPageSnapshot);

  return {
    ...state,
    parentTaskId: task.parentTaskId,
    selectedTaskId: task.id,
    filters: createEmptyFilters(),
    viewport: { left: 0, top: 0 },
    searchBefore,
    searchLocated: true,
  };
}

export function returnFromSearch(state: TaskUiState): TaskUiState {
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

function saveCurrentScope(state: TaskUiState): Record<string, TaskUiScopeSnapshot> {
  return {
    ...state.scopeSnapshots,
    [scopeKey(state.parentTaskId)]: {
      filters: state.filters,
      searchQuery: state.searchQuery,
      viewport: state.viewport,
    },
  };
}

function scopeKey(parentTaskId: string | null): string {
  return parentTaskId ?? "PROJECT_ROOT";
}

export function searchTasks(index: TaskUiIndex, query: string, limit = 12): readonly TaskUiTask[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    return [];
  }
  return [...index.tasksById.values()]
    .map((task) => {
      const key = task.key.toLocaleLowerCase();
      const title = task.title.toLocaleLowerCase();
      const score =
        key === normalized
          ? 0
          : key.startsWith(normalized)
            ? 1
            : title.includes(normalized)
              ? 2
              : 3;
      return { task, score };
    })
    .filter(({ score }) => score < 3)
    .sort((left, right) => left.score - right.score || left.task.key.localeCompare(right.task.key))
    .slice(0, limit)
    .map(({ task }) => task);
}

export function filterTaskScope(
  index: TaskUiIndex,
  parentTaskId: string | null,
  filters: TaskUiFilters,
  now = Date.now(),
): FilteredTaskScope {
  const allTasks = index.childrenByParentId.get(parentTaskId) ?? [];
  const allDependencies = index.dependenciesByParentId.get(parentTaskId) ?? [];
  const tasks = allTasks.filter((task) => taskMatchesFilters(task, filters, now));
  const visibleIds = new Set(tasks.map((task) => task.id));
  const dependencies = allDependencies.filter(
    (dependency) =>
      visibleIds.has(dependency.predecessorTaskId) && visibleIds.has(dependency.successorTaskId),
  );
  const hiddenDependencyCount = allDependencies.filter(
    (dependency) =>
      visibleIds.has(dependency.predecessorTaskId) !== visibleIds.has(dependency.successorTaskId),
  ).length;

  return { tasks, dependencies, hiddenDependencyCount };
}

function taskMatchesFilters(task: TaskUiTask, filters: TaskUiFilters, now: number): boolean {
  if (filters.ownerId && task.effectiveOwnerId !== filters.ownerId) {
    return false;
  }
  if (filters.role && task.logicalRole !== filters.role) {
    return false;
  }
  if (filters.status && task.effectiveStatus !== filters.status) {
    return false;
  }
  if (filters.label && !task.labels.includes(filters.label)) {
    return false;
  }
  if (filters.due === "none" && task.dueAtUtc !== null) {
    return false;
  }
  if (filters.due === "scheduled" && task.dueAtUtc === null) {
    return false;
  }
  if (
    filters.due === "overdue" &&
    (task.dueAtUtc === null ||
      Date.parse(task.dueAtUtc) >= now ||
      task.effectiveStatus === "completed")
  ) {
    return false;
  }
  return true;
}

export function breadcrumbsForScope(
  index: TaskUiIndex,
  parentTaskId: string | null,
): readonly TaskUiTask[] {
  if (!parentTaskId) {
    return [];
  }
  const parent = index.tasksById.get(parentTaskId);
  return parent ? [...(index.ancestorsByTaskId.get(parent.id) ?? []), parent] : [];
}
