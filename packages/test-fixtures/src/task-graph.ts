export type TaskDisplayType = "normal" | "sprint" | "milestone";
export type TaskProfileId = "deep-tree" | "wide-siblings" | "dense-dag";
export type TaskLogicalRole = "programming" | "art" | "design" | "music";
export type TaskBaseStatus = "pending" | "in_progress" | "completed";
export type TaskEffectiveStatus = TaskBaseStatus | "blocked";
export type TaskDependencyDensity = "sparse" | "medium" | "dense-acyclic";

export interface TaskFixture {
  key: string;
  parentKey: string | null;
  title: string;
  displayType: TaskDisplayType;
}

export interface TaskFixtureOwner {
  id: string;
  name: string;
}

export interface TaskChildStatusCounts {
  pending: number;
  inProgress: number;
  blocked: number;
  completed: number;
}

export interface TaskUiTask {
  id: string;
  key: string;
  projectKey: string;
  parentTaskId: string | null;
  parentKey: string | null;
  title: string;
  body: string;
  explicitOwnerId: string | null;
  effectiveOwnerId: string;
  ownerSourceTaskId: string;
  logicalRole: TaskLogicalRole;
  baseStatus: TaskBaseStatus;
  manualBlocked: boolean;
  dependencyBlocked: boolean;
  effectiveStatus: TaskEffectiveStatus;
  dueAtUtc: string | null;
  labels: string[];
  displayType: TaskDisplayType;
  directChildCount: number;
  childStatusCounts: TaskChildStatusCounts;
}

export interface TaskUiDependency {
  id: string;
  projectKey: string;
  parentTaskId: string | null;
  predecessorTaskId: string;
  successorTaskId: string;
}

export interface TaskProfileSpec {
  id: TaskProfileId;
  depth: number;
  childrenPerLevel: number[];
  dependencyDensity: TaskDependencyDensity;
}

export interface TaskUiDatasetSpec {
  schemaVersion: 1;
  seed: number;
  projectKey: string;
  profiles: TaskProfileSpec[];
  displayTypes: TaskDisplayType[];
  statuses: TaskEffectiveStatus[];
  requiredLabels: string[];
}

export interface TaskUiFixture {
  schemaVersion: 1;
  seed: number;
  projectKey: string;
  profileId: TaskProfileId;
  owners: TaskFixtureOwner[];
  tasks: TaskUiTask[];
  dependencies: TaskUiDependency[];
}

export interface TaskUiIndex {
  tasksById: ReadonlyMap<string, TaskUiTask>;
  tasksByKey: ReadonlyMap<string, TaskUiTask>;
  childrenByParentId: ReadonlyMap<string | null, readonly TaskUiTask[]>;
  dependenciesByParentId: ReadonlyMap<string | null, readonly TaskUiDependency[]>;
  ancestorsByTaskId: ReadonlyMap<string, readonly TaskUiTask[]>;
}

export type TaskFixtureErrorCode =
  | "DUPLICATE_TASK_ID"
  | "DUPLICATE_TASK_KEY"
  | "ORPHAN_PARENT"
  | "CROSS_PROJECT_PARENT"
  | "INVALID_DUE_AT"
  | "MISSING_DEPENDENCY_ENDPOINT"
  | "CROSS_PROJECT_DEPENDENCY"
  | "CROSS_PARENT_DEPENDENCY"
  | "SELF_DEPENDENCY"
  | "DUPLICATE_DEPENDENCY"
  | "DEPENDENCY_CYCLE";

export class TaskFixtureValidationError extends Error {
  readonly code: TaskFixtureErrorCode;
  readonly subject: string;

  constructor(code: TaskFixtureErrorCode, subject: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "TaskFixtureValidationError";
    this.code = code;
    this.subject = subject;
  }
}

export const TASK_UI_DATASET_SPEC: TaskUiDatasetSpec = {
  schemaVersion: 1,
  seed: 20260724,
  projectKey: "ZERO",
  profiles: [
    {
      id: "deep-tree",
      depth: 8,
      childrenPerLevel: [6, 5, 4, 3, 2, 2, 2, 0],
      dependencyDensity: "sparse",
    },
    {
      id: "wide-siblings",
      depth: 3,
      childrenPerLevel: [5, 200, 0],
      dependencyDensity: "medium",
    },
    {
      id: "dense-dag",
      depth: 2,
      childrenPerLevel: [36, 0],
      dependencyDensity: "dense-acyclic",
    },
  ],
  displayTypes: ["normal", "sprint", "milestone"],
  statuses: ["pending", "in_progress", "blocked", "completed"],
  requiredLabels: ["程序", "美术", "策划", "音乐"],
};

const OWNERS: TaskFixtureOwner[] = [
  { id: "owner-lin", name: "林岚" },
  { id: "owner-chen", name: "陈澈" },
  { id: "owner-zhao", name: "赵野" },
  { id: "owner-he", name: "何星" },
];

const ROLES: TaskLogicalRole[] = ["programming", "art", "design", "music"];
const BASE_STATUSES: TaskBaseStatus[] = ["pending", "in_progress", "completed"];
const PROFILE_CODES: Record<TaskProfileId, string> = {
  "deep-tree": "D",
  "wide-siblings": "W",
  "dense-dag": "G",
};

function stableHash(...parts: Array<string | number>): number {
  let hash = 2166136261;
  for (const character of parts.join(":")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function profileSpec(profileId: TaskProfileId): TaskProfileSpec {
  const profile = TASK_UI_DATASET_SPEC.profiles.find((candidate) => candidate.id === profileId);
  if (!profile) {
    throw new Error(`Unknown Task UI profile: ${profileId}`);
  }
  return profile;
}

function createTask(
  profileId: TaskProfileId,
  ordinal: number,
  parent: TaskUiTask | null,
  level: number,
  siblingIndex: number,
): TaskUiTask {
  const hash = stableHash(TASK_UI_DATASET_SPEC.seed, profileId, ordinal);
  const code = PROFILE_CODES[profileId];
  const key = `${TASK_UI_DATASET_SPEC.projectKey}-${code}-${String(ordinal).padStart(4, "0")}`;
  const id = `${profileId}:${String(ordinal).padStart(4, "0")}`;
  const explicitOwner =
    parent === null || siblingIndex % 4 === 0 ? OWNERS[hash % OWNERS.length] : undefined;
  const effectiveOwnerId = explicitOwner?.id ?? parent?.effectiveOwnerId ?? OWNERS[0]?.id;
  const ownerSourceTaskId = explicitOwner ? id : (parent?.ownerSourceTaskId ?? id);
  const baseStatus = BASE_STATUSES[hash % BASE_STATUSES.length] ?? "pending";
  const manualBlocked = baseStatus !== "completed" && hash % 11 === 0;
  const dueAtUtc =
    hash % 5 === 0
      ? null
      : new Date(Date.UTC(2026, 7 + (level % 3), 1 + (hash % 24), 8 + (hash % 8))).toISOString();
  const label =
    TASK_UI_DATASET_SPEC.requiredLabels[hash % TASK_UI_DATASET_SPEC.requiredLabels.length];
  const secondaryLabel =
    TASK_UI_DATASET_SPEC.requiredLabels[
      (hash + siblingIndex + 1) % TASK_UI_DATASET_SPEC.requiredLabels.length
    ];

  if (!effectiveOwnerId || !ownerSourceTaskId || !label || !secondaryLabel) {
    throw new Error("Task UI fixture constants are incomplete.");
  }

  return {
    id,
    key,
    projectKey: TASK_UI_DATASET_SPEC.projectKey,
    parentTaskId: parent?.id ?? null,
    parentKey: parent?.key ?? null,
    title: `${profileId === "deep-tree" ? "深层" : profileId === "wide-siblings" ? "宽层" : "密集"}任务 ${String(
      ordinal,
    ).padStart(3, "0")}`,
    body: `固定种子 ${TASK_UI_DATASET_SPEC.seed} 生成的合成任务，用于 Task UI 原型验证。`,
    explicitOwnerId: explicitOwner?.id ?? null,
    effectiveOwnerId,
    ownerSourceTaskId,
    logicalRole: ROLES[(hash + level) % ROLES.length] ?? "programming",
    baseStatus,
    manualBlocked,
    dependencyBlocked: false,
    effectiveStatus: manualBlocked ? "blocked" : baseStatus,
    dueAtUtc,
    labels: label === secondaryLabel ? [label] : [label, secondaryLabel],
    displayType:
      TASK_UI_DATASET_SPEC.displayTypes[
        (hash + siblingIndex) % TASK_UI_DATASET_SPEC.displayTypes.length
      ] ?? "normal",
    directChildCount: 0,
    childStatusCounts: emptyStatusCounts(),
  };
}

function emptyStatusCounts(): TaskChildStatusCounts {
  return { pending: 0, inProgress: 0, blocked: 0, completed: 0 };
}

function generateTasks(profile: TaskProfileSpec): TaskUiTask[] {
  const tasks: TaskUiTask[] = [];
  let ordinal = 1;

  if (profile.id === "deep-tree") {
    let parent: TaskUiTask | null = null;
    for (let level = 0; level < profile.depth; level += 1) {
      const childCount = profile.childrenPerLevel[level] ?? 0;
      const siblings: TaskUiTask[] = [];
      for (let siblingIndex = 0; siblingIndex < childCount; siblingIndex += 1) {
        const task = createTask(profile.id, ordinal, parent, level, siblingIndex);
        ordinal += 1;
        siblings.push(task);
        tasks.push(task);
      }
      parent = siblings[0] ?? parent;
    }
    return tasks;
  }

  const topLevelCount = profile.childrenPerLevel[0] ?? 0;
  const topLevel: TaskUiTask[] = [];
  for (let index = 0; index < topLevelCount; index += 1) {
    const task = createTask(profile.id, ordinal, null, 0, index);
    ordinal += 1;
    topLevel.push(task);
    tasks.push(task);
  }

  if (profile.id === "wide-siblings") {
    const parent = topLevel[0];
    if (!parent) {
      return tasks;
    }
    const wideCount = profile.childrenPerLevel[1] ?? 0;
    for (let index = 0; index < wideCount; index += 1) {
      tasks.push(createTask(profile.id, ordinal, parent, 1, index));
      ordinal += 1;
    }
  }

  return tasks;
}

function dependencyPairs(count: number, density: TaskDependencyDensity): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  if (count < 2) {
    return pairs;
  }

  const connectedLimit = count - 1;
  if (density === "sparse") {
    for (let index = 0; index + 1 < connectedLimit; index += 3) {
      pairs.push([index, index + 1]);
    }
    return pairs;
  }

  const columnSize = density === "medium" ? 20 : 6;
  for (let index = 0; index + columnSize < connectedLimit; index += 1) {
    pairs.push([index, index + columnSize]);
    if (index % 2 === 0 && index + columnSize + 1 < connectedLimit) {
      pairs.push([index, index + columnSize + 1]);
    }
    if (index % 5 === 0 && index + columnSize * 2 < connectedLimit) {
      pairs.push([index, index + columnSize * 2]);
    }
  }
  return pairs;
}

function generateDependencies(
  tasks: TaskUiTask[],
  density: TaskDependencyDensity,
): TaskUiDependency[] {
  const grouped = new Map<string | null, TaskUiTask[]>();
  for (const task of tasks) {
    const siblings = grouped.get(task.parentTaskId) ?? [];
    siblings.push(task);
    grouped.set(task.parentTaskId, siblings);
  }

  const dependencies: TaskUiDependency[] = [];
  for (const [parentTaskId, siblings] of grouped) {
    siblings.sort((left, right) => left.key.localeCompare(right.key));
    for (const [predecessorIndex, successorIndex] of dependencyPairs(siblings.length, density)) {
      const predecessor = siblings[predecessorIndex];
      const successor = siblings[successorIndex];
      if (!predecessor || !successor) {
        continue;
      }
      dependencies.push({
        id: `dep:${predecessor.id}->${successor.id}`,
        projectKey: predecessor.projectKey,
        parentTaskId,
        predecessorTaskId: predecessor.id,
        successorTaskId: successor.id,
      });
    }
  }
  return dependencies;
}

function hydrateDerivedFields(tasks: TaskUiTask[], dependencies: TaskUiDependency[]): TaskUiTask[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const predecessorsByTaskId = new Map<string, TaskUiTask[]>();
  for (const dependency of dependencies) {
    const predecessor = taskById.get(dependency.predecessorTaskId);
    if (predecessor) {
      const predecessors = predecessorsByTaskId.get(dependency.successorTaskId) ?? [];
      predecessors.push(predecessor);
      predecessorsByTaskId.set(dependency.successorTaskId, predecessors);
    }
  }

  const hydrated = tasks.map((task) => {
    const dependencyBlocked =
      task.baseStatus !== "completed" &&
      (predecessorsByTaskId.get(task.id) ?? []).some(
        (predecessor) => predecessor.baseStatus !== "completed",
      );
    return {
      ...task,
      dependencyBlocked,
      effectiveStatus:
        task.baseStatus === "completed"
          ? "completed"
          : task.manualBlocked || dependencyBlocked
            ? "blocked"
            : task.baseStatus,
    } satisfies TaskUiTask;
  });

  const hydratedById = new Map(hydrated.map((task) => [task.id, task]));
  return hydrated.map((task) => {
    const children = hydrated.filter((candidate) => candidate.parentTaskId === task.id);
    const childStatusCounts = emptyStatusCounts();
    for (const child of children) {
      const current = hydratedById.get(child.id)?.effectiveStatus ?? child.effectiveStatus;
      if (current === "in_progress") {
        childStatusCounts.inProgress += 1;
      } else {
        childStatusCounts[current] += 1;
      }
    }
    return {
      ...task,
      directChildCount: children.length,
      childStatusCounts,
    };
  });
}

export function createTaskUiFixture(profileId: TaskProfileId): TaskUiFixture {
  const profile = profileSpec(profileId);
  const generatedTasks = generateTasks(profile);
  const dependencies = generateDependencies(generatedTasks, profile.dependencyDensity);
  const fixture: TaskUiFixture = {
    schemaVersion: TASK_UI_DATASET_SPEC.schemaVersion,
    seed: TASK_UI_DATASET_SPEC.seed,
    projectKey: TASK_UI_DATASET_SPEC.projectKey,
    profileId,
    owners: OWNERS.map((owner) => ({ ...owner })),
    tasks: hydrateDerivedFields(generatedTasks, dependencies),
    dependencies,
  };
  validateTaskUiFixture(fixture);
  return fixture;
}

export function createTaskUiFixtures(): Record<TaskProfileId, TaskUiFixture> {
  return {
    "deep-tree": createTaskUiFixture("deep-tree"),
    "wide-siblings": createTaskUiFixture("wide-siblings"),
    "dense-dag": createTaskUiFixture("dense-dag"),
  };
}

export function validateTaskUiFixture(fixture: TaskUiFixture): void {
  const tasksById = new Map<string, TaskUiTask>();
  const tasksByKey = new Map<string, TaskUiTask>();

  for (const task of fixture.tasks) {
    if (tasksById.has(task.id)) {
      throw new TaskFixtureValidationError(
        "DUPLICATE_TASK_ID",
        task.id,
        `任务 ID ${task.id} 重复。`,
      );
    }
    if (tasksByKey.has(task.key)) {
      throw new TaskFixtureValidationError(
        "DUPLICATE_TASK_KEY",
        task.key,
        `Task Key ${task.key} 重复。`,
      );
    }
    if (task.dueAtUtc !== null && !isCanonicalUtc(task.dueAtUtc)) {
      throw new TaskFixtureValidationError(
        "INVALID_DUE_AT",
        task.key,
        `任务 ${task.key} 的截止时间不是有效 UTC 时间。`,
      );
    }
    tasksById.set(task.id, task);
    tasksByKey.set(task.key, task);
  }

  for (const task of fixture.tasks) {
    if (task.parentTaskId === null) {
      continue;
    }
    const parent = tasksById.get(task.parentTaskId);
    if (!parent) {
      throw new TaskFixtureValidationError(
        "ORPHAN_PARENT",
        task.key,
        `任务 ${task.key} 引用了不存在的父任务 ${task.parentTaskId}。`,
      );
    }
    if (parent.projectKey !== task.projectKey) {
      throw new TaskFixtureValidationError(
        "CROSS_PROJECT_PARENT",
        task.key,
        `任务 ${task.key} 与父任务 ${parent.key} 不属于同一项目。`,
      );
    }
  }

  const seenDependencies = new Set<string>();
  const dependenciesByParent = new Map<string | null, TaskUiDependency[]>();
  for (const dependency of fixture.dependencies) {
    const predecessor = tasksById.get(dependency.predecessorTaskId);
    const successor = tasksById.get(dependency.successorTaskId);
    if (!predecessor || !successor) {
      throw new TaskFixtureValidationError(
        "MISSING_DEPENDENCY_ENDPOINT",
        dependency.id,
        `依赖 ${dependency.id} 引用了不存在的任务。`,
      );
    }
    if (
      predecessor.projectKey !== successor.projectKey ||
      predecessor.projectKey !== dependency.projectKey
    ) {
      throw new TaskFixtureValidationError(
        "CROSS_PROJECT_DEPENDENCY",
        dependency.id,
        `依赖 ${dependency.id} 跨越项目边界。`,
      );
    }
    if (
      predecessor.parentTaskId !== successor.parentTaskId ||
      predecessor.parentTaskId !== dependency.parentTaskId
    ) {
      throw new TaskFixtureValidationError(
        "CROSS_PARENT_DEPENDENCY",
        dependency.id,
        `依赖 ${dependency.id} 跨越父级作用域。`,
      );
    }
    if (predecessor.id === successor.id) {
      throw new TaskFixtureValidationError(
        "SELF_DEPENDENCY",
        dependency.id,
        `任务 ${predecessor.key} 不能依赖自身。`,
      );
    }
    const pair = `${predecessor.id}->${successor.id}`;
    if (seenDependencies.has(pair)) {
      throw new TaskFixtureValidationError(
        "DUPLICATE_DEPENDENCY",
        dependency.id,
        `依赖方向 ${pair} 重复。`,
      );
    }
    seenDependencies.add(pair);
    const scoped = dependenciesByParent.get(dependency.parentTaskId) ?? [];
    scoped.push(dependency);
    dependenciesByParent.set(dependency.parentTaskId, scoped);
  }

  for (const [parentTaskId, dependencies] of dependenciesByParent) {
    assertAcyclic(parentTaskId, dependencies, tasksById);
  }
}

function isCanonicalUtc(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function assertAcyclic(
  parentTaskId: string | null,
  dependencies: TaskUiDependency[],
  tasksById: ReadonlyMap<string, TaskUiTask>,
): void {
  const nodeIds = new Set<string>();
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const dependency of dependencies) {
    nodeIds.add(dependency.predecessorTaskId);
    nodeIds.add(dependency.successorTaskId);
    outgoing.set(dependency.predecessorTaskId, [
      ...(outgoing.get(dependency.predecessorTaskId) ?? []),
      dependency.successorTaskId,
    ]);
    indegree.set(dependency.successorTaskId, (indegree.get(dependency.successorTaskId) ?? 0) + 1);
    indegree.set(dependency.predecessorTaskId, indegree.get(dependency.predecessorTaskId) ?? 0);
  }

  const queue = [...nodeIds].filter((nodeId) => (indegree.get(nodeId) ?? 0) === 0).sort();
  let visited = 0;
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) {
      break;
    }
    visited += 1;
    for (const successorId of outgoing.get(nodeId) ?? []) {
      const next = (indegree.get(successorId) ?? 0) - 1;
      indegree.set(successorId, next);
      if (next === 0) {
        queue.push(successorId);
        queue.sort();
      }
    }
  }

  if (visited !== nodeIds.size) {
    const scope = parentTaskId
      ? (tasksById.get(parentTaskId)?.key ?? parentTaskId)
      : "PROJECT_ROOT";
    throw new TaskFixtureValidationError(
      "DEPENDENCY_CYCLE",
      scope,
      `父级作用域 ${scope} 的依赖图包含环。`,
    );
  }
}

export function buildTaskUiIndex(fixture: TaskUiFixture): TaskUiIndex {
  validateTaskUiFixture(fixture);
  const tasksById = new Map(fixture.tasks.map((task) => [task.id, task]));
  const tasksByKey = new Map(fixture.tasks.map((task) => [task.key, task]));
  const childrenByParentId = new Map<string | null, TaskUiTask[]>();
  const dependenciesByParentId = new Map<string | null, TaskUiDependency[]>();
  const ancestorsByTaskId = new Map<string, TaskUiTask[]>();

  for (const task of fixture.tasks) {
    const children = childrenByParentId.get(task.parentTaskId) ?? [];
    children.push(task);
    childrenByParentId.set(task.parentTaskId, children);
  }
  for (const children of childrenByParentId.values()) {
    children.sort((left, right) => left.key.localeCompare(right.key));
  }
  for (const dependency of fixture.dependencies) {
    const dependencies = dependenciesByParentId.get(dependency.parentTaskId) ?? [];
    dependencies.push(dependency);
    dependenciesByParentId.set(dependency.parentTaskId, dependencies);
  }
  for (const task of fixture.tasks) {
    const ancestors: TaskUiTask[] = [];
    let parentId = task.parentTaskId;
    while (parentId !== null) {
      const parent = tasksById.get(parentId);
      if (!parent) {
        break;
      }
      ancestors.unshift(parent);
      parentId = parent.parentTaskId;
    }
    ancestorsByTaskId.set(task.id, ancestors);
  }

  return {
    tasksById,
    tasksByKey,
    childrenByParentId,
    dependenciesByParentId,
    ancestorsByTaskId,
  };
}

export function getTaskScope(
  fixture: TaskUiFixture,
  index: TaskUiIndex,
  parentTaskId: string | null,
): { tasks: readonly TaskUiTask[]; dependencies: readonly TaskUiDependency[] } {
  return {
    tasks: index.childrenByParentId.get(parentTaskId) ?? [],
    dependencies: index.dependenciesByParentId.get(parentTaskId) ?? [],
  };
}

export function createWideTaskFixture(count = 200): TaskFixture[] {
  const parentKey = "ZERO-1";
  const displayTypes: TaskDisplayType[] = ["normal", "sprint", "milestone"];

  return [
    {
      key: parentKey,
      parentKey: null,
      title: "宽层级原型",
      displayType: "normal",
    },
    ...Array.from({ length: count }, (_, index) => ({
      key: `ZERO-${index + 2}`,
      parentKey,
      title: `原型任务 ${String(index + 1).padStart(3, "0")}`,
      displayType: displayTypes[index % displayTypes.length] ?? "normal",
    })),
  ];
}
