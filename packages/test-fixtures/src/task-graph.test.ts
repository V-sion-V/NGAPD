import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  TASK_UI_DATASET_SPEC,
  TaskFixtureValidationError,
  buildTaskUiIndex,
  createTaskUiFixture,
  createWideTaskFixture,
  getTaskScope,
  validateTaskUiFixture,
  type TaskFixtureErrorCode,
  type TaskUiFixture,
} from "./task-graph.js";

function cloneFixture(fixture: TaskUiFixture): TaskUiFixture {
  return structuredClone(fixture);
}

function expectValidationCode(fixture: TaskUiFixture, code: TaskFixtureErrorCode): void {
  try {
    validateTaskUiFixture(fixture);
  } catch (error) {
    expect(error).toBeInstanceOf(TaskFixtureValidationError);
    expect((error as TaskFixtureValidationError).code).toBe(code);
    expect((error as Error).message).toContain(code);
    return;
  }
  throw new Error(`Expected validation error ${code}.`);
}

describe("Task UI dataset contract", () => {
  it("stays aligned with the repository JSON specification", async () => {
    const jsonUrl = new URL("../../../prototypes/task-ui/fixtures/dataset.json", import.meta.url);
    const json = JSON.parse(await readFile(jsonUrl, "utf8")) as unknown;

    expect(TASK_UI_DATASET_SPEC).toEqual(json);
  });

  it("creates deterministic complete profiles with expected depth and scope sizes", () => {
    for (const profileId of ["deep-tree", "wide-siblings", "dense-dag"] as const) {
      expect(createTaskUiFixture(profileId)).toEqual(createTaskUiFixture(profileId));
    }

    const deep = createTaskUiFixture("deep-tree");
    const deepIndex = buildTaskUiIndex(deep);
    const deepestTask = [...deep.tasks].sort(
      (left, right) =>
        (deepIndex.ancestorsByTaskId.get(right.id)?.length ?? 0) -
        (deepIndex.ancestorsByTaskId.get(left.id)?.length ?? 0),
    )[0];
    expect(deepestTask).toBeDefined();
    expect(deepIndex.ancestorsByTaskId.get(deepestTask?.id ?? "")).toHaveLength(6);
    expect(deep.tasks.some((task) => task.directChildCount > 0)).toBe(true);

    const wide = createTaskUiFixture("wide-siblings");
    const wideIndex = buildTaskUiIndex(wide);
    const wideParent = wide.tasks.find((task) => task.directChildCount === 200);
    expect(wideParent).toBeDefined();
    expect(getTaskScope(wide, wideIndex, wideParent?.id ?? null).tasks).toHaveLength(200);

    const dense = createTaskUiFixture("dense-dag");
    const denseIndex = buildTaskUiIndex(dense);
    expect(getTaskScope(dense, denseIndex, null).tasks).toHaveLength(36);
    expect(dense.dependencies.length).toBeGreaterThan(36);
    const connectedDenseIds = new Set(
      dense.dependencies.flatMap((dependency) => [
        dependency.predecessorTaskId,
        dependency.successorTaskId,
      ]),
    );
    expect(dense.tasks.some((task) => !connectedDenseIds.has(task.id))).toBe(true);
  });

  it("provides every display field, inherited owners, UTC dates, and local DAG edges", () => {
    const fixture = createTaskUiFixture("wide-siblings");
    const index = buildTaskUiIndex(fixture);

    expect(fixture.tasks.some((task) => task.explicitOwnerId === null)).toBe(true);
    expect(fixture.tasks.some((task) => task.effectiveStatus === "blocked")).toBe(true);
    expect(fixture.tasks.some((task) => task.dueAtUtc === null)).toBe(true);

    for (const task of fixture.tasks) {
      expect(task.key).toMatch(/^ZERO-W-\d{4}$/);
      expect(task.body).toContain(String(TASK_UI_DATASET_SPEC.seed));
      expect(task.effectiveOwnerId).toMatch(/^owner-/);
      expect(task.ownerSourceTaskId).toBeTruthy();
      expect(task.labels.length).toBeGreaterThan(0);
      if (task.dueAtUtc !== null) {
        expect(new Date(task.dueAtUtc).toISOString()).toBe(task.dueAtUtc);
      }
      expect(task.directChildCount).toBe(index.childrenByParentId.get(task.id)?.length ?? 0);
    }

    for (const dependency of fixture.dependencies) {
      const predecessor = index.tasksById.get(dependency.predecessorTaskId);
      const successor = index.tasksById.get(dependency.successorTaskId);
      expect(predecessor?.parentTaskId).toBe(successor?.parentTaskId);
      expect(dependency.parentTaskId).toBe(predecessor?.parentTaskId);
    }
  });
});

describe("Task UI fixture validation", () => {
  it("rejects duplicate keys and IDs", () => {
    const duplicateKey = cloneFixture(createTaskUiFixture("dense-dag"));
    const first = duplicateKey.tasks[0];
    const second = duplicateKey.tasks[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first && second) {
      second.key = first.key;
    }
    expectValidationCode(duplicateKey, "DUPLICATE_TASK_KEY");

    const duplicateId = cloneFixture(createTaskUiFixture("dense-dag"));
    const idFirst = duplicateId.tasks[0];
    const idSecond = duplicateId.tasks[1];
    if (idFirst && idSecond) {
      idSecond.id = idFirst.id;
    }
    expectValidationCode(duplicateId, "DUPLICATE_TASK_ID");
  });

  it("rejects orphan parents, cross-parent dependencies, self edges, and duplicate edges", () => {
    const orphan = cloneFixture(createTaskUiFixture("wide-siblings"));
    const child = orphan.tasks.find((task) => task.parentTaskId !== null);
    if (child) {
      child.parentTaskId = "missing-parent";
    }
    expectValidationCode(orphan, "ORPHAN_PARENT");

    const crossParent = cloneFixture(createTaskUiFixture("deep-tree"));
    const edge = crossParent.dependencies[0];
    const otherScopeTask = crossParent.tasks.find(
      (task) => edge && task.parentTaskId !== edge.parentTaskId,
    );
    if (edge && otherScopeTask) {
      edge.successorTaskId = otherScopeTask.id;
    }
    expectValidationCode(crossParent, "CROSS_PARENT_DEPENDENCY");

    const self = cloneFixture(createTaskUiFixture("dense-dag"));
    const selfEdge = self.dependencies[0];
    if (selfEdge) {
      selfEdge.successorTaskId = selfEdge.predecessorTaskId;
    }
    expectValidationCode(self, "SELF_DEPENDENCY");

    const duplicate = cloneFixture(createTaskUiFixture("dense-dag"));
    const duplicateEdge = duplicate.dependencies[0];
    if (duplicateEdge) {
      duplicate.dependencies.push({ ...duplicateEdge, id: "duplicate-edge" });
    }
    expectValidationCode(duplicate, "DUPLICATE_DEPENDENCY");
  });

  it("rejects cycles, missing endpoints, cross-project edges, and invalid UTC dates", () => {
    const cycle = cloneFixture(createTaskUiFixture("dense-dag"));
    const firstEdge = cycle.dependencies[0];
    if (firstEdge) {
      cycle.dependencies.push({
        id: "cycle-edge",
        projectKey: cycle.projectKey,
        parentTaskId: null,
        predecessorTaskId: firstEdge.successorTaskId,
        successorTaskId: firstEdge.predecessorTaskId,
      });
    }
    expectValidationCode(cycle, "DEPENDENCY_CYCLE");

    const missing = cloneFixture(createTaskUiFixture("dense-dag"));
    const missingEdge = missing.dependencies[0];
    if (missingEdge) {
      missingEdge.successorTaskId = "missing-task";
    }
    expectValidationCode(missing, "MISSING_DEPENDENCY_ENDPOINT");

    const crossProject = cloneFixture(createTaskUiFixture("dense-dag"));
    const crossProjectEdge = crossProject.dependencies[0];
    if (crossProjectEdge) {
      crossProjectEdge.projectKey = "OTHER";
    }
    expectValidationCode(crossProject, "CROSS_PROJECT_DEPENDENCY");

    const invalidDueAt = cloneFixture(createTaskUiFixture("dense-dag"));
    const dueTask = invalidDueAt.tasks[0];
    if (dueTask) {
      dueTask.dueAtUtc = "2026-08-20 12:00";
    }
    expectValidationCode(invalidDueAt, "INVALID_DUE_AT");
  });
});

describe("createWideTaskFixture compatibility", () => {
  it("creates one parent and 200 stable direct children by default", () => {
    const tasks = createWideTaskFixture();

    expect(tasks).toHaveLength(201);
    expect(tasks.filter((task) => task.parentKey === "ZERO-1")).toHaveLength(200);
    expect(new Set(tasks.map((task) => task.key)).size).toBe(tasks.length);
  });
});
