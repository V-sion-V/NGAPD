export interface TaskTreeNode {
  id: string;
  projectId: string;
  parentTaskId: string | null;
}

export type TaskTreeFailureReason =
  | "duplicate_task"
  | "task_not_found"
  | "parent_not_found"
  | "project_mismatch"
  | "self_parent"
  | "tree_cycle";

export type TaskTreeValidation =
  { ok: true } | { ok: false; reason: TaskTreeFailureReason; taskId: string };

export type TaskParentChangeValidation =
  | {
      ok: true;
      taskId: string;
      sourceParentTaskId: string | null;
      targetParentTaskId: string | null;
    }
  | { ok: false; reason: TaskTreeFailureReason; taskId: string };

export type TaskTraversalResult =
  { ok: true; taskIds: string[] } | { ok: false; reason: TaskTreeFailureReason; taskId: string };

function buildTaskIndex(
  tasks: readonly TaskTreeNode[],
):
  | { ok: true; tasksById: Map<string, TaskTreeNode> }
  | { ok: false; reason: "duplicate_task"; taskId: string } {
  const tasksById = new Map<string, TaskTreeNode>();
  for (const task of tasks) {
    if (tasksById.has(task.id)) {
      return { ok: false, reason: "duplicate_task", taskId: task.id };
    }
    tasksById.set(task.id, task);
  }
  return { ok: true, tasksById };
}

export function validateTaskTree(tasks: readonly TaskTreeNode[]): TaskTreeValidation {
  const index = buildTaskIndex(tasks);
  if (!index.ok) {
    return index;
  }

  for (const task of [...tasks].sort((left, right) => left.id.localeCompare(right.id))) {
    if (task.parentTaskId === task.id) {
      return { ok: false, reason: "self_parent", taskId: task.id };
    }
    if (task.parentTaskId !== null) {
      const parent = index.tasksById.get(task.parentTaskId);
      if (!parent) {
        return { ok: false, reason: "parent_not_found", taskId: task.id };
      }
      if (parent.projectId !== task.projectId) {
        return { ok: false, reason: "project_mismatch", taskId: task.id };
      }
    }

    const visited = new Set<string>();
    let current: TaskTreeNode | undefined = task;
    while (current?.parentTaskId !== null) {
      if (visited.has(current.id)) {
        return { ok: false, reason: "tree_cycle", taskId: task.id };
      }
      visited.add(current.id);
      const parent = index.tasksById.get(current.parentTaskId);
      if (!parent) {
        return { ok: false, reason: "parent_not_found", taskId: current.id };
      }
      if (parent.projectId !== task.projectId) {
        return { ok: false, reason: "project_mismatch", taskId: current.id };
      }
      current = parent;
    }
    if (current && visited.has(current.id)) {
      return { ok: false, reason: "tree_cycle", taskId: task.id };
    }
  }
  return { ok: true };
}

export function evaluateTaskParentChange(input: {
  taskId: string;
  targetParentTaskId: string | null;
  tasks: readonly TaskTreeNode[];
}): TaskParentChangeValidation {
  const tree = validateTaskTree(input.tasks);
  if (!tree.ok) {
    return tree;
  }
  const tasksById = new Map(input.tasks.map((task) => [task.id, task]));
  const task = tasksById.get(input.taskId);
  if (!task) {
    return { ok: false, reason: "task_not_found", taskId: input.taskId };
  }
  if (input.targetParentTaskId === task.id) {
    return { ok: false, reason: "self_parent", taskId: task.id };
  }

  let target: TaskTreeNode | undefined;
  if (input.targetParentTaskId !== null) {
    target = tasksById.get(input.targetParentTaskId);
    if (!target) {
      return { ok: false, reason: "parent_not_found", taskId: task.id };
    }
    if (target.projectId !== task.projectId) {
      return { ok: false, reason: "project_mismatch", taskId: task.id };
    }

    let current: TaskTreeNode | undefined = target;
    while (current) {
      if (current.id === task.id) {
        return { ok: false, reason: "tree_cycle", taskId: task.id };
      }
      current = current.parentTaskId === null ? undefined : tasksById.get(current.parentTaskId);
    }
  }

  return {
    ok: true,
    taskId: task.id,
    sourceParentTaskId: task.parentTaskId,
    targetParentTaskId: target?.id ?? null,
  };
}

export function collectTaskDescendantIds(
  taskId: string,
  tasks: readonly TaskTreeNode[],
): TaskTraversalResult {
  const tree = validateTaskTree(tasks);
  if (!tree.ok) {
    return tree;
  }
  if (!tasks.some((task) => task.id === taskId)) {
    return { ok: false, reason: "task_not_found", taskId };
  }

  const childrenByParentId = new Map<string, string[]>();
  for (const task of tasks) {
    if (task.parentTaskId !== null) {
      const children = childrenByParentId.get(task.parentTaskId) ?? [];
      children.push(task.id);
      childrenByParentId.set(task.parentTaskId, children);
    }
  }

  const descendants: string[] = [];
  const pending = [...(childrenByParentId.get(taskId) ?? [])].sort();
  while (pending.length > 0) {
    const descendantId = pending.shift();
    if (!descendantId) {
      break;
    }
    descendants.push(descendantId);
    pending.push(...(childrenByParentId.get(descendantId) ?? []));
    pending.sort();
  }
  return { ok: true, taskIds: descendants.sort() };
}

export function collectTaskAncestorIds(
  taskId: string,
  tasks: readonly TaskTreeNode[],
): TaskTraversalResult {
  const tree = validateTaskTree(tasks);
  if (!tree.ok) {
    return tree;
  }
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  let current = tasksById.get(taskId);
  if (!current) {
    return { ok: false, reason: "task_not_found", taskId };
  }

  const ancestors: string[] = [];
  while (current.parentTaskId !== null) {
    ancestors.push(current.parentTaskId);
    const parent = tasksById.get(current.parentTaskId);
    if (!parent) {
      return { ok: false, reason: "parent_not_found", taskId: current.id };
    }
    current = parent;
  }
  return { ok: true, taskIds: ancestors };
}
