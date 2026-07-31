export interface GraphTaskLike {
  id: string;
  key: string;
}

export interface GraphDependencyLike {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
}

export interface TaskLayoutNode<TTask extends GraphTaskLike = GraphTaskLike> {
  task: TTask;
  x: number;
  y: number;
  width: number;
  height: number;
  rank: number;
}

export interface TaskLayoutEdge<TDependency extends GraphDependencyLike = GraphDependencyLike> {
  dependency: TDependency;
  path: string;
}

export interface TaskGraphLayout<
  TTask extends GraphTaskLike = GraphTaskLike,
  TDependency extends GraphDependencyLike = GraphDependencyLike,
> {
  nodes: readonly TaskLayoutNode<TTask>[];
  edges: readonly TaskLayoutEdge<TDependency>[];
  width: number;
  height: number;
}

export type ArrowDirection = "left" | "right" | "up" | "down";

const NODE_WIDTH = 196;
const NODE_HEIGHT = 94;
const COLUMN_GAP = 76;
const ROW_GAP = 24;
const PADDING = 32;

export function layoutTaskGraph<
  TTask extends GraphTaskLike,
  TDependency extends GraphDependencyLike,
>(
  tasks: readonly TTask[],
  dependencies: readonly TDependency[],
): TaskGraphLayout<TTask, TDependency> {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map(tasks.map((task) => [task.id, 0]));
  const rank = new Map(tasks.map((task) => [task.id, 0]));

  for (const dependency of dependencies) {
    if (
      !tasksById.has(dependency.predecessorTaskId) ||
      !tasksById.has(dependency.successorTaskId)
    ) {
      continue;
    }
    outgoing.set(dependency.predecessorTaskId, [
      ...(outgoing.get(dependency.predecessorTaskId) ?? []),
      dependency.successorTaskId,
    ]);
    indegree.set(dependency.successorTaskId, (indegree.get(dependency.successorTaskId) ?? 0) + 1);
  }

  const queue = tasks
    .filter((task) => (indegree.get(task.id) ?? 0) === 0)
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((task) => task.id);
  while (queue.length > 0) {
    const taskId = queue.shift();
    if (!taskId) {
      break;
    }
    for (const successorId of outgoing.get(taskId) ?? []) {
      rank.set(successorId, Math.max(rank.get(successorId) ?? 0, (rank.get(taskId) ?? 0) + 1));
      const nextIndegree = (indegree.get(successorId) ?? 0) - 1;
      indegree.set(successorId, nextIndegree);
      if (nextIndegree === 0) {
        queue.push(successorId);
        queue.sort((left, right) => {
          const leftTask = tasksById.get(left);
          const rightTask = tasksById.get(right);
          return (leftTask?.key ?? left).localeCompare(rightTask?.key ?? right);
        });
      }
    }
  }

  const byRank = new Map<number, TTask[]>();
  for (const task of tasks) {
    const taskRank = rank.get(task.id) ?? 0;
    const column = byRank.get(taskRank) ?? [];
    column.push(task);
    byRank.set(taskRank, column);
  }
  for (const column of byRank.values()) {
    column.sort((left, right) => left.key.localeCompare(right.key));
  }

  const nodes: TaskLayoutNode<TTask>[] = [];
  for (const [taskRank, column] of [...byRank.entries()].sort(([left], [right]) => left - right)) {
    for (const [row, task] of column.entries()) {
      nodes.push({
        task,
        x: PADDING + taskRank * (NODE_WIDTH + COLUMN_GAP),
        y: PADDING + row * (NODE_HEIGHT + ROW_GAP),
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        rank: taskRank,
      });
    }
  }

  const layoutByTaskId = new Map(nodes.map((node) => [node.task.id, node]));
  const edges = dependencies.flatMap((dependency) => {
    const predecessor = layoutByTaskId.get(dependency.predecessorTaskId);
    const successor = layoutByTaskId.get(dependency.successorTaskId);
    if (!predecessor || !successor) {
      return [];
    }
    const startX = predecessor.x + predecessor.width;
    const startY = predecessor.y + predecessor.height / 2;
    const endX = successor.x;
    const endY = successor.y + successor.height / 2;
    const controlOffset = Math.max(32, (endX - startX) / 2);
    return [
      {
        dependency,
        path: `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`,
      },
    ];
  });

  return {
    nodes,
    edges,
    width: Math.max(640, ...nodes.map((node) => node.x + node.width + PADDING)),
    height: Math.max(420, ...nodes.map((node) => node.y + node.height + PADDING)),
  };
}

export function nextNodeForArrow(
  layout: TaskGraphLayout,
  currentTaskId: string,
  direction: ArrowDirection,
): string {
  const current = layout.nodes.find((node) => node.task.id === currentTaskId);
  if (!current) {
    return currentTaskId;
  }
  const currentCenter = center(current);
  const candidates = layout.nodes
    .filter((candidate) => candidate.task.id !== currentTaskId)
    .map((candidate) => {
      const candidateCenter = center(candidate);
      const horizontal = candidateCenter.x - currentCenter.x;
      const vertical = candidateCenter.y - currentCenter.y;
      const isInDirection =
        direction === "left"
          ? horizontal < 0
          : direction === "right"
            ? horizontal > 0
            : direction === "up"
              ? vertical < 0
              : vertical > 0;
      const primary =
        direction === "left" || direction === "right" ? Math.abs(horizontal) : Math.abs(vertical);
      const secondary =
        direction === "left" || direction === "right" ? Math.abs(vertical) : Math.abs(horizontal);
      return { candidate, isInDirection, score: primary * 4 + secondary };
    })
    .filter(({ isInDirection }) => isInDirection)
    .sort(
      (left, right) =>
        left.score - right.score || left.candidate.task.key.localeCompare(right.candidate.task.key),
    );
  return candidates[0]?.candidate.task.id ?? currentTaskId;
}

function center(node: TaskLayoutNode): { x: number; y: number } {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}
