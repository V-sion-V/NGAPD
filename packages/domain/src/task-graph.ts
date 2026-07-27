export type FormalTaskBaseStatus = "not_started" | "in_progress" | "done";
export type DependencyAction = "add" | "remove";

export interface TaskGraphNode {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  effectiveOwnerMembershipId: string;
  baseStatus: FormalTaskBaseStatus;
  archived: boolean;
}

export interface TaskDependencyEdge {
  predecessorTaskId: string;
  successorTaskId: string;
}

export interface TaskFollowEdge {
  sourceTaskId: string;
  targetTaskId: string;
}

export type TaskGraphFailureReason =
  | "task_not_found"
  | "duplicate_task"
  | "cross_project_dependency"
  | "cross_parent_dependency"
  | "self_dependency"
  | "duplicate_dependency"
  | "dependency_cycle"
  | "endpoint_archived"
  | "dependency_not_found"
  | "completed_task_frozen"
  | "graph_version_conflict"
  | "forbidden"
  | "request_stale";

export type TaskGraphValidation =
  | { ok: true }
  | {
      ok: false;
      reason: TaskGraphFailureReason;
      subject: string;
    };

export interface DependencyChangeRequestSnapshot {
  action: DependencyAction;
  predecessorTaskId: string;
  successorTaskId: string;
  parentTaskId: string | null;
  graphVersion: number;
  predecessorOwnerMembershipId: string;
  successorOwnerMembershipId: string;
  requiredAcceptanceByMembershipId: string;
}

export type DependencyChangeDecision =
  | { ok: true; mode: "direct"; action: DependencyAction }
  | {
      ok: true;
      mode: "request_required";
      request: DependencyChangeRequestSnapshot;
    }
  | {
      ok: false;
      reason: TaskGraphFailureReason;
      subject: string;
    };

function taskIndex(
  tasks: readonly TaskGraphNode[],
):
  | { ok: true; tasksById: Map<string, TaskGraphNode> }
  | { ok: false; reason: "duplicate_task"; subject: string } {
  const tasksById = new Map<string, TaskGraphNode>();
  for (const task of tasks) {
    if (tasksById.has(task.id)) {
      return { ok: false, reason: "duplicate_task", subject: task.id };
    }
    tasksById.set(task.id, task);
  }
  return { ok: true, tasksById };
}

function edgeKey(edge: TaskDependencyEdge): string {
  return `${edge.predecessorTaskId}->${edge.successorTaskId}`;
}

export function graphScopeKey(projectId: string, parentTaskId: string | null): string {
  return `${projectId}:${parentTaskId ?? "$project-root"}`;
}

export function validateTaskDependencyGraph(
  tasks: readonly TaskGraphNode[],
  dependencies: readonly TaskDependencyEdge[],
): TaskGraphValidation {
  const index = taskIndex(tasks);
  if (!index.ok) {
    return index;
  }
  const seenEdges = new Set<string>();
  const dependenciesByScope = new Map<string, TaskDependencyEdge[]>();

  for (const dependency of [...dependencies].sort((left, right) =>
    edgeKey(left).localeCompare(edgeKey(right)),
  )) {
    const key = edgeKey(dependency);
    const predecessor = index.tasksById.get(dependency.predecessorTaskId);
    const successor = index.tasksById.get(dependency.successorTaskId);
    if (!predecessor || !successor) {
      return { ok: false, reason: "task_not_found", subject: key };
    }
    if (predecessor.id === successor.id) {
      return { ok: false, reason: "self_dependency", subject: key };
    }
    if (predecessor.projectId !== successor.projectId) {
      return { ok: false, reason: "cross_project_dependency", subject: key };
    }
    if (predecessor.parentTaskId !== successor.parentTaskId) {
      return { ok: false, reason: "cross_parent_dependency", subject: key };
    }
    if (predecessor.archived || successor.archived) {
      return { ok: false, reason: "endpoint_archived", subject: key };
    }
    if (seenEdges.has(key)) {
      return { ok: false, reason: "duplicate_dependency", subject: key };
    }
    seenEdges.add(key);
    const scope = graphScopeKey(predecessor.projectId, predecessor.parentTaskId);
    const scoped = dependenciesByScope.get(scope) ?? [];
    scoped.push(dependency);
    dependenciesByScope.set(scope, scoped);
  }

  for (const [scope, scopedDependencies] of [...dependenciesByScope].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const outgoing = new Map<string, string[]>();
    const indegree = new Map<string, number>();
    for (const dependency of scopedDependencies) {
      const successors = outgoing.get(dependency.predecessorTaskId) ?? [];
      successors.push(dependency.successorTaskId);
      outgoing.set(dependency.predecessorTaskId, successors);
      indegree.set(dependency.successorTaskId, (indegree.get(dependency.successorTaskId) ?? 0) + 1);
      indegree.set(dependency.predecessorTaskId, indegree.get(dependency.predecessorTaskId) ?? 0);
    }

    const pending = [...indegree]
      .filter(([, degree]) => degree === 0)
      .map(([taskId]) => taskId)
      .sort();
    let visited = 0;
    while (pending.length > 0) {
      const taskId = pending.shift();
      if (!taskId) {
        break;
      }
      visited += 1;
      for (const successorId of (outgoing.get(taskId) ?? []).sort()) {
        const next = (indegree.get(successorId) ?? 0) - 1;
        indegree.set(successorId, next);
        if (next === 0) {
          pending.push(successorId);
          pending.sort();
        }
      }
    }
    if (visited !== indegree.size) {
      return { ok: false, reason: "dependency_cycle", subject: scope };
    }
  }
  return { ok: true };
}

function validateChangedEdge(input: {
  action: DependencyAction;
  predecessor: TaskGraphNode;
  successor: TaskGraphNode;
  dependencies: readonly TaskDependencyEdge[];
  tasks: readonly TaskGraphNode[];
}): TaskGraphValidation {
  const key = `${input.predecessor.id}->${input.successor.id}`;
  if (input.predecessor.baseStatus === "done" || input.successor.baseStatus === "done") {
    return { ok: false, reason: "completed_task_frozen", subject: key };
  }

  const exists = input.dependencies.some(
    (edge) =>
      edge.predecessorTaskId === input.predecessor.id &&
      edge.successorTaskId === input.successor.id,
  );
  if (input.action === "remove" && !exists) {
    return { ok: false, reason: "dependency_not_found", subject: key };
  }

  const nextDependencies =
    input.action === "add"
      ? [
          ...input.dependencies,
          {
            predecessorTaskId: input.predecessor.id,
            successorTaskId: input.successor.id,
          },
        ]
      : input.dependencies.filter(
          (edge) =>
            edge.predecessorTaskId !== input.predecessor.id ||
            edge.successorTaskId !== input.successor.id,
        );
  return validateTaskDependencyGraph(input.tasks, nextDependencies);
}

export function evaluateDependencyChange(input: {
  action: DependencyAction;
  predecessorTaskId: string;
  successorTaskId: string;
  actorMembershipId: string;
  projectOwnerMembershipId: string;
  adminModeActive: boolean;
  expectedGraphVersion: number;
  currentGraphVersion: number;
  tasks: readonly TaskGraphNode[];
  dependencies: readonly TaskDependencyEdge[];
}): DependencyChangeDecision {
  const index = taskIndex(input.tasks);
  if (!index.ok) {
    return index;
  }
  const predecessor = index.tasksById.get(input.predecessorTaskId);
  const successor = index.tasksById.get(input.successorTaskId);
  const subject = `${input.predecessorTaskId}->${input.successorTaskId}`;
  if (!predecessor || !successor) {
    return { ok: false, reason: "task_not_found", subject };
  }
  if (input.expectedGraphVersion !== input.currentGraphVersion) {
    return { ok: false, reason: "graph_version_conflict", subject };
  }

  const edge = validateChangedEdge({
    action: input.action,
    predecessor,
    successor,
    dependencies: input.dependencies,
    tasks: input.tasks,
  });
  if (!edge.ok) {
    return edge;
  }

  const commonParent =
    predecessor.parentTaskId === null ? undefined : index.tasksById.get(predecessor.parentTaskId);
  const ownsPredecessor = predecessor.effectiveOwnerMembershipId === input.actorMembershipId;
  const ownsSuccessor = successor.effectiveOwnerMembershipId === input.actorMembershipId;
  const controlsCommonParent = commonParent?.effectiveOwnerMembershipId === input.actorMembershipId;
  const controlsRoot =
    predecessor.parentTaskId === null && input.projectOwnerMembershipId === input.actorMembershipId;

  if (
    input.adminModeActive ||
    controlsRoot ||
    controlsCommonParent ||
    (ownsPredecessor && ownsSuccessor)
  ) {
    return { ok: true, mode: "direct", action: input.action };
  }
  if (ownsPredecessor !== ownsSuccessor) {
    return {
      ok: true,
      mode: "request_required",
      request: {
        action: input.action,
        predecessorTaskId: predecessor.id,
        successorTaskId: successor.id,
        parentTaskId: predecessor.parentTaskId,
        graphVersion: input.currentGraphVersion,
        predecessorOwnerMembershipId: predecessor.effectiveOwnerMembershipId,
        successorOwnerMembershipId: successor.effectiveOwnerMembershipId,
        requiredAcceptanceByMembershipId: ownsPredecessor
          ? successor.effectiveOwnerMembershipId
          : predecessor.effectiveOwnerMembershipId,
      },
    };
  }
  return { ok: false, reason: "forbidden", subject };
}

export function evaluateDependencyRequestAcceptance(input: {
  request: DependencyChangeRequestSnapshot;
  acceptingMembershipId: string;
  currentGraphVersion: number;
  tasks: readonly TaskGraphNode[];
  dependencies: readonly TaskDependencyEdge[];
}): DependencyChangeDecision {
  const index = taskIndex(input.tasks);
  if (!index.ok) {
    return index;
  }
  const predecessor = index.tasksById.get(input.request.predecessorTaskId);
  const successor = index.tasksById.get(input.request.successorTaskId);
  const subject = `${input.request.predecessorTaskId}->${input.request.successorTaskId}`;
  if (!predecessor || !successor) {
    return { ok: false, reason: "request_stale", subject };
  }
  if (input.acceptingMembershipId !== input.request.requiredAcceptanceByMembershipId) {
    return { ok: false, reason: "forbidden", subject };
  }
  if (
    input.currentGraphVersion !== input.request.graphVersion ||
    predecessor.parentTaskId !== input.request.parentTaskId ||
    successor.parentTaskId !== input.request.parentTaskId ||
    predecessor.effectiveOwnerMembershipId !== input.request.predecessorOwnerMembershipId ||
    successor.effectiveOwnerMembershipId !== input.request.successorOwnerMembershipId ||
    predecessor.archived ||
    successor.archived ||
    predecessor.baseStatus === "done" ||
    successor.baseStatus === "done"
  ) {
    return { ok: false, reason: "request_stale", subject };
  }

  const edge = validateChangedEdge({
    action: input.request.action,
    predecessor,
    successor,
    dependencies: input.dependencies,
    tasks: input.tasks,
  });
  return edge.ok
    ? { ok: true, mode: "direct", action: input.request.action }
    : { ok: false, reason: "request_stale", subject };
}

export function validateTaskFollow(input: {
  sourceTaskId: string;
  targetTaskId: string;
  tasks: readonly TaskGraphNode[];
  follows: readonly TaskFollowEdge[];
}): TaskGraphValidation {
  const index = taskIndex(input.tasks);
  if (!index.ok) {
    return index;
  }
  const source = index.tasksById.get(input.sourceTaskId);
  const target = index.tasksById.get(input.targetTaskId);
  const subject = `${input.sourceTaskId}->${input.targetTaskId}`;
  if (!source || !target) {
    return { ok: false, reason: "task_not_found", subject };
  }
  if (source.id === target.id) {
    return { ok: false, reason: "self_dependency", subject };
  }
  if (source.projectId !== target.projectId) {
    return { ok: false, reason: "cross_project_dependency", subject };
  }
  if (
    input.follows.some(
      (follow) =>
        follow.sourceTaskId === input.sourceTaskId && follow.targetTaskId === input.targetTaskId,
    )
  ) {
    return { ok: false, reason: "duplicate_dependency", subject };
  }
  return { ok: true };
}

export function expandTaskFollowsOneHop(
  sourceTaskId: string,
  follows: readonly TaskFollowEdge[],
): string[] {
  return [
    ...new Set(
      follows
        .filter((follow) => follow.sourceTaskId === sourceTaskId)
        .map((follow) => follow.targetTaskId),
    ),
  ].sort();
}
