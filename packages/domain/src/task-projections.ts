export interface CompletionReadinessFacts {
  taskId: string;
  taskVersion: number;
  graphVersion: number;
  baseStatus: "not_started" | "in_progress" | "done";
  archived: boolean;
  effectiveOwnerMembershipId: string;
  directChildren: readonly {
    id: string;
    status: "not_started" | "in_progress" | "done";
    archived: boolean;
    version: number;
  }[];
  predecessors: readonly {
    id: string;
    status: "not_started" | "in_progress" | "done";
    archived: boolean;
    version: number;
  }[];
  unresolvedBlockerIds: readonly string[];
}

export interface CompletionReadinessDecision {
  ready: boolean;
  conditionMaterial: string | null;
  ownerMembershipId: string;
}

export function evaluateCompletionReadiness(
  facts: CompletionReadinessFacts,
): CompletionReadinessDecision {
  const ready =
    !facts.archived &&
    facts.baseStatus !== "done" &&
    facts.directChildren
      .filter((child) => !child.archived)
      .every((child) => child.status === "done") &&
    facts.predecessors
      .filter((predecessor) => !predecessor.archived)
      .every((predecessor) => predecessor.status === "done") &&
    facts.unresolvedBlockerIds.length === 0;
  if (!ready) {
    return {
      ready: false,
      conditionMaterial: null,
      ownerMembershipId: facts.effectiveOwnerMembershipId,
    };
  }
  return {
    ready: true,
    conditionMaterial: JSON.stringify({
      taskId: facts.taskId,
      taskVersion: facts.taskVersion,
      graphVersion: facts.graphVersion,
      ownerMembershipId: facts.effectiveOwnerMembershipId,
      children: [...facts.directChildren]
        .filter((child) => !child.archived)
        .map((child) => [child.id, child.status, child.version])
        .sort(([left], [right]) => String(left).localeCompare(String(right))),
      predecessors: [...facts.predecessors]
        .filter((predecessor) => !predecessor.archived)
        .map((predecessor) => [predecessor.id, predecessor.status, predecessor.version])
        .sort(([left], [right]) => String(left).localeCompare(String(right))),
    }),
    ownerMembershipId: facts.effectiveOwnerMembershipId,
  };
}

export type TaskNotificationKind =
  | "task.owner.changed"
  | "task.blocker.changed"
  | "task.dependency.requested"
  | "task.dependency.resolved"
  | "task.comment.created"
  | "task.comment.mentioned"
  | "task.due.reminder"
  | "task.completion_ready"
  | "task.archived"
  | "task.deleted"
  | "task.permission.result";

const CRITICAL_NOTIFICATION_KINDS = new Set<TaskNotificationKind>([
  "task.owner.changed",
  "task.blocker.changed",
  "task.dependency.requested",
  "task.dependency.resolved",
  "task.completion_ready",
  "task.archived",
  "task.deleted",
  "task.permission.result",
]);

export function isCriticalTaskNotification(kind: TaskNotificationKind): boolean {
  return CRITICAL_NOTIFICATION_KINDS.has(kind);
}

export function mayDisableTaskNotification(kind: TaskNotificationKind): boolean {
  return !isCriticalTaskNotification(kind);
}
