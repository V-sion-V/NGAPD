import { buildTaskUiIndex, createTaskUiFixture } from "@ngapd/test-fixtures/task-graph";
import { describe, expect, it } from "vitest";

import { layoutTaskGraph, nextNodeForArrow } from "./layout.js";
import {
  closeTaskDrawer,
  createInitialTaskUiState,
  enterSelectedTask,
  filterTaskScope,
  navigateToScope,
  returnFromSearch,
  searchTasks,
  selectSearchResult,
  selectTask,
  updateFilters,
  updateSearchQuery,
  updateViewport,
} from "./model.js";

describe("Task UI pure state", () => {
  it("opens and closes one drawer without changing scope or viewport", () => {
    const fixture = createTaskUiFixture("dense-dag");
    const index = buildTaskUiIndex(fixture);
    const firstTask = index.childrenByParentId.get(null)?.[0];
    expect(firstTask).toBeDefined();
    const initial = updateViewport(createInitialTaskUiState("dense-dag"), {
      left: 310,
      top: 42,
    });
    const selected = selectTask(initial, firstTask?.id ?? "", index);
    const closed = closeTaskDrawer(selected);

    expect(selected.selectedTaskId).toBe(firstTask?.id);
    expect(closed).toEqual({ ...initial, selectedTaskId: null });
  });

  it("enters only through a selected parent and restores the prior scope snapshot", () => {
    const fixture = createTaskUiFixture("deep-tree");
    const index = buildTaskUiIndex(fixture);
    const parent = fixture.tasks.find((task) => task.directChildCount > 0);
    expect(parent).toBeDefined();
    let state = createInitialTaskUiState("deep-tree");
    state = updateSearchQuery(state, "深层");
    state = updateViewport(state, { left: 96, top: 28 });
    state = updateFilters(state, index, { role: parent?.logicalRole ?? "" });
    state = selectTask(state, parent?.id ?? "", index);
    state = enterSelectedTask(state, index);

    expect(state.parentTaskId).toBe(parent?.id);
    expect(state.selectedTaskId).toBeNull();
    expect(state.viewport).toEqual({ left: 0, top: 0 });

    const returned = navigateToScope(state, null, index);
    expect(returned.parentTaskId).toBeNull();
    expect(returned.selectedTaskId).toBeNull();
    expect(returned.viewport).toEqual({ left: 96, top: 28 });
    expect(returned.searchQuery).toBe("深层");
  });

  it("locates a deep task project-wide and restores the complete search-before page", () => {
    const fixture = createTaskUiFixture("deep-tree");
    const index = buildTaskUiIndex(fixture);
    const deepest = [...fixture.tasks].sort(
      (left, right) =>
        (index.ancestorsByTaskId.get(right.id)?.length ?? 0) -
        (index.ancestorsByTaskId.get(left.id)?.length ?? 0),
    )[0];
    expect(deepest).toBeDefined();
    const initial = updateViewport(createInitialTaskUiState("deep-tree"), {
      left: 120,
      top: 64,
    });
    const querying = updateSearchQuery(initial, deepest?.key.slice(0, -1) ?? "");
    expect(searchTasks(index, querying.searchQuery)).toContainEqual(deepest);

    const located = selectSearchResult(querying, deepest!);
    expect(located.parentTaskId).toBe(deepest?.parentTaskId);
    expect(located.selectedTaskId).toBe(deepest?.id);
    expect(returnFromSearch(located)).toEqual(initial);
  });

  it("combines filters with AND and clears a selection hidden by a filter", () => {
    const fixture = createTaskUiFixture("wide-siblings");
    const index = buildTaskUiIndex(fixture);
    const parent = fixture.tasks.find((task) => task.directChildCount === 200);
    const scope = index.childrenByParentId.get(parent?.id ?? null) ?? [];
    const task = scope[0];
    expect(task).toBeDefined();
    let state = {
      ...createInitialTaskUiState("wide-siblings"),
      parentTaskId: parent?.id ?? null,
    };
    state = selectTask(state, task?.id ?? "", index);
    state = updateFilters(state, index, {
      ownerId: task?.effectiveOwnerId ?? "",
      role: task?.logicalRole ?? "",
      status: task?.effectiveStatus ?? "",
      label: task?.labels[0] ?? "",
    });

    const filtered = filterTaskScope(index, state.parentTaskId, state.filters);
    expect(filtered.tasks.length).toBeGreaterThan(0);
    expect(
      filtered.tasks.every((candidate) => candidate.effectiveOwnerId === task?.effectiveOwnerId),
    ).toBe(true);

    const otherRole = task?.logicalRole === "art" ? "music" : "art";
    const hidden = updateFilters(state, index, { role: otherRole });
    expect(hidden.selectedTaskId).toBeNull();
  });
});

describe("Task UI deterministic DAG layout", () => {
  it("places every dependency successor to the right and supports arrow navigation", () => {
    const fixture = createTaskUiFixture("dense-dag");
    const index = buildTaskUiIndex(fixture);
    const scope = filterTaskScope(index, null, createInitialTaskUiState("dense-dag").filters);
    const first = layoutTaskGraph(scope.tasks, scope.dependencies);
    const second = layoutTaskGraph(scope.tasks, scope.dependencies);
    expect(first).toEqual(second);

    const byTaskId = new Map(first.nodes.map((node) => [node.task.id, node]));
    for (const edge of scope.dependencies) {
      expect(byTaskId.get(edge.successorTaskId)?.x).toBeGreaterThan(
        byTaskId.get(edge.predecessorTaskId)?.x ?? Number.POSITIVE_INFINITY,
      );
    }
    const leftmost = [...first.nodes].sort((left, right) => left.x - right.x)[0];
    expect(leftmost).toBeDefined();
    expect(nextNodeForArrow(first, leftmost?.task.id ?? "", "right")).not.toBe(leftmost?.task.id);
  });
});
