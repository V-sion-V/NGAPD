import type { TaskCollection, TaskLocation, TaskResource } from "@ngapd/contracts";
import { describe, expect, it } from "vitest";

import {
  createTaskPageState,
  filterTaskScope,
  locateSearchResult,
  navigateTaskScope,
  parseTaskRoute,
  readTaskHistoryState,
  returnFromTaskSearch,
  selectTaskKey,
  TaskGraphIntegrityError,
  taskRouteUrl,
  updateTaskFilters,
  updateTaskSearchQuery,
  updateTaskViewport,
  validateTaskScope,
} from "./model.js";

const projectId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const workspaceId = "33333333-3333-4333-8333-333333333333";

describe("M3 production task route and navigation state", () => {
  it("round-trips a formal history deep link without retaining secrets", () => {
    const route = parseTaskRoute(
      "?view=tasks&project=game&parent=GAME-10&task=GAME-11&history=1&adminModeId=secret",
    );
    expect(route).toEqual({
      projectKey: "GAME",
      parentTaskKey: "GAME-10",
      selectedTaskKey: "GAME-11",
      lifecycle: "history",
    });
    expect(taskRouteUrl(createTaskPageState(route!))).toBe(
      "/?view=tasks&project=GAME&parent=GAME-10&task=GAME-11&history=1",
    );
  });

  it("restores scope snapshots and the complete search-before position", () => {
    let state = createTaskPageState({
      projectKey: "GAME",
      parentTaskKey: null,
      selectedTaskKey: null,
      lifecycle: "active",
    });
    state = updateTaskViewport(state, { left: 120, top: 64 });
    state = selectTaskKey(state, "GAME-1");
    state = updateTaskSearchQuery(state, "GAME-20");
    const location = {
      task: {
        id: task("GAME-20", "parent").id,
        projectId,
        key: "GAME-20",
        title: "deep",
        parentTaskKey: "GAME-19",
        archiveLifecycle: "active",
        displayType: "normal",
        baseStatus: "not_started",
        effectiveStatus: "not_started",
      },
      ancestors: [],
    } satisfies TaskLocation;
    const located = locateSearchResult(state, location);
    expect(located.parentTaskKey).toBe("GAME-19");
    expect(located.selectedTaskKey).toBe("GAME-20");
    expect(returnFromTaskSearch(located)).toMatchObject({
      parentTaskKey: null,
      selectedTaskKey: "GAME-1",
      viewport: { left: 120, top: 64 },
      searchQuery: "",
    });

    const child = navigateTaskScope(state, "GAME-1");
    const returned = navigateTaskScope(child, null);
    expect(returned.viewport).toEqual({ left: 120, top: 64 });
    expect(returned.selectedTaskKey).toBeNull();
  });

  it("accepts only matching, serializable History state", () => {
    const route = {
      projectKey: "GAME",
      parentTaskKey: null,
      selectedTaskKey: null,
      lifecycle: "active",
    } as const;
    const state = createTaskPageState(route);
    expect(readTaskHistoryState({ m3TaskState: state }, route)).toEqual(state);
    expect(
      readTaskHistoryState(
        { m3TaskState: { ...state, projectKey: "OTHER", adminModeId: "secret" } },
        route,
      ),
    ).toBeNull();
  });
});

describe("M3 production task graph projection", () => {
  it("keeps isolated nodes, stable sequence and visible-endpoint dependencies", () => {
    const first = task("GAME-1", "first", { labels: ["ui"], dueAt: "2026-01-01T00:00:00.000Z" });
    const second = task("GAME-2", "second", { effectiveStatus: "blocked", labels: ["ui"] });
    const isolated = task("GAME-3", "isolated", { logicalRoleId: "role-art" });
    const page = collection(
      [first, second, isolated],
      [
        {
          id: "44444444-4444-4444-8444-444444444444",
          projectId,
          parentTaskId: null,
          predecessorTaskId: first.id,
          successorTaskId: second.id,
        },
      ],
    );
    const scope = validateTaskScope([page], projectId, null);
    expect(scope.tasks.map((candidate) => candidate.key)).toEqual(["GAME-1", "GAME-2", "GAME-3"]);

    const visible = filterTaskScope(scope, {
      ownerMembershipId: ownerId,
      logicalRoleId: "",
      effectiveStatus: "blocked",
      due: "all",
      label: "ui",
    });
    expect(visible.tasks.map((candidate) => candidate.key)).toEqual(["GAME-2"]);
    expect(visible.dependencies).toEqual([]);
    expect(visible.hiddenDependencyCount).toBe(1);

    const selected = selectTaskKey(
      createTaskPageState({
        projectKey: "GAME",
        parentTaskKey: null,
        selectedTaskKey: null,
        lifecycle: "active",
      }),
      "GAME-3",
    );
    expect(
      updateTaskFilters(selected, { logicalRoleId: "role-other" }, scope.tasks).selectedTaskKey,
    ).toBeNull();
  });

  it("fails closed for cross-scope nodes, self edges and cycles", () => {
    const first = task("GAME-1", "first");
    const second = task("GAME-2", "second");
    expect(() =>
      validateTaskScope(
        [collection([{ ...first, projectId: "99999999-9999-4999-8999-999999999999" }], [])],
        projectId,
        null,
      ),
    ).toThrow(TaskGraphIntegrityError);
    expect(() =>
      validateTaskScope(
        [
          collection(
            [first],
            [
              {
                id: "55555555-5555-4555-8555-555555555555",
                projectId,
                parentTaskId: null,
                predecessorTaskId: first.id,
                successorTaskId: first.id,
              },
            ],
          ),
        ],
        projectId,
        null,
      ),
    ).toThrow(TaskGraphIntegrityError);
    expect(() =>
      validateTaskScope(
        [
          collection(
            [first, second],
            [
              dependency("66666666-6666-4666-8666-666666666666", first, second),
              dependency("77777777-7777-4777-8777-777777777777", second, first),
            ],
          ),
        ],
        projectId,
        null,
      ),
    ).toThrow("包含循环");
  });
});

function task(key: string, title: string, patch: Partial<TaskResource> = {}): TaskResource {
  const sequence = Number(key.split("-")[1]);
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    projectId,
    key,
    sequence,
    title,
    content: "",
    logicalRoleId: null,
    dueAt: null,
    labels: [],
    displayType: "normal",
    parentTaskId: null,
    explicitOwnerMembershipId: ownerId,
    effectiveOwner: { membershipId: ownerId, sourceTaskId: projectId, inherited: false },
    baseStatus: "not_started",
    effectiveStatus: "not_started",
    archiveLifecycle: "active",
    archivedAt: null,
    completionReady: false,
    childSummary: { total: 0, done: 0, blocked: 0 },
    graphVersion: 1,
    version: 1,
    workspace: {
      id: workspaceId,
      lifecycle: "active",
      workCycle: 1,
      syncVersion: 0,
      hasActiveWriteLease: false,
    },
    follows: [],
    blockers: [],
    createdByMembershipId: ownerId,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    actions: ["read"],
    ...patch,
  };
}

function collection(
  tasks: TaskResource[],
  dependencies: TaskCollection["dependencies"],
): TaskCollection {
  return {
    tasks,
    dependencies,
    nextCursor: null,
    graph: { projectId, parentTaskId: null, graphVersion: 1 },
  };
}

function dependency(
  id: string,
  predecessor: TaskResource,
  successor: TaskResource,
): TaskCollection["dependencies"][number] {
  return {
    id,
    projectId,
    parentTaskId: null,
    predecessorTaskId: predecessor.id,
    successorTaskId: successor.id,
  };
}
