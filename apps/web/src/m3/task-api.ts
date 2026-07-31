import type { TaskCollection, TaskImpactResponse, TaskResource } from "@ngapd/contracts";

import { apiRequest } from "../api.js";

export function taskListPath(
  projectKey: string,
  parentTaskKey: string | null,
  lifecycle: "active" | "archived",
  cursor: string | null,
): string {
  const query = new URLSearchParams({
    parentTaskKey: parentTaskKey ?? "root",
    lifecycle,
    limit: "200",
  });
  if (cursor) {
    query.set("cursor", cursor);
  }
  return `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks?${query.toString()}`;
}

export function taskSearchPath(
  projectKey: string,
  queryText: string,
  cursor: string | null,
): string {
  const query = new URLSearchParams({ query: queryText, lifecycle: "all", limit: "100" });
  if (cursor) {
    query.set("cursor", cursor);
  }
  return `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/search?${query.toString()}`;
}

export async function fetchCompleteTaskScope(input: {
  projectKey: string;
  parentTaskKey: string | null;
  adminModeId: string | null;
  lifecycle?: "active" | "archived";
  signal?: AbortSignal;
}): Promise<{ tasks: TaskResource[]; graphVersion: number }> {
  const tasks: TaskResource[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  let graphVersion: number | null = null;

  do {
    const collection: TaskCollection = await apiRequest<TaskCollection>(
      taskListPath(input.projectKey, input.parentTaskKey, input.lifecycle ?? "active", cursor),
      {
        adminModeId: input.adminModeId,
        ...(input.signal ? { signal: input.signal } : {}),
      },
    );
    graphVersion ??= collection.graph.graphVersion;
    if (graphVersion !== collection.graph.graphVersion) {
      throw new Error("分页期间图版本发生变化；请重新加载影响预览。");
    }
    tasks.push(...collection.tasks);
    cursor = collection.nextCursor;
    if (cursor) {
      if (seenCursors.has(cursor)) {
        throw new Error("任务分页游标重复；已阻止不完整影响确认。");
      }
      seenCursors.add(cursor);
    }
    if (tasks.length > 10_000) {
      throw new Error("影响解析超过 10,000 个 Task 的客户端安全上限。");
    }
  } while (cursor);

  return { tasks, graphVersion: graphVersion ?? 0 };
}

export async function resolveImpactTaskResources(input: {
  preview: TaskImpactResponse;
  projectKey: string;
  sourceParentTaskKey: string | null;
  selectedTask: TaskResource;
  adminModeId: string | null;
}): Promise<TaskResource[]> {
  const affected = new Set(input.preview.impact.affectedTaskIds);
  const source = await fetchCompleteTaskScope({
    projectKey: input.projectKey,
    parentTaskKey: input.sourceParentTaskKey,
    adminModeId: input.adminModeId,
  });
  const resources = new Map(source.tasks.map((task) => [task.id, task]));
  resources.set(input.selectedTask.id, input.selectedTask);
  const queued = new Set<string>();
  const queue: TaskResource[] = [];

  const enqueueAffected = (task: TaskResource) => {
    if (affected.has(task.id) && task.childSummary.total > 0 && !queued.has(task.id)) {
      queued.add(task.id);
      queue.push(task);
    }
  };
  for (const task of resources.values()) {
    enqueueAffected(task);
  }

  while (queue.length > 0) {
    const parent = queue.shift()!;
    const childScope = await fetchCompleteTaskScope({
      projectKey: input.projectKey,
      parentTaskKey: parent.key,
      adminModeId: input.adminModeId,
    });
    for (const child of childScope.tasks) {
      resources.set(child.id, child);
      enqueueAffected(child);
    }
  }

  return input.preview.impact.affectedTaskIds.flatMap((id) => {
    const task = resources.get(id);
    return task ? [task] : [];
  });
}
