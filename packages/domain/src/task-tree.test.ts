import { describe, expect, it } from "vitest";

import {
  collectTaskAncestorIds,
  collectTaskDescendantIds,
  evaluateTaskParentChange,
  validateTaskTree,
  type TaskTreeNode,
} from "./task-tree.js";

const tasks: TaskTreeNode[] = [
  { id: "root", projectId: "project-1", parentTaskId: null },
  { id: "child-b", projectId: "project-1", parentTaskId: "root" },
  { id: "child-a", projectId: "project-1", parentTaskId: "root" },
  { id: "grandchild", projectId: "project-1", parentTaskId: "child-a" },
];

describe("formal task adjacency tree", () => {
  it("validates a same-project tree and returns deterministic traversals", () => {
    expect(validateTaskTree(tasks)).toEqual({ ok: true });
    expect(collectTaskDescendantIds("root", [...tasks].reverse())).toEqual({
      ok: true,
      taskIds: ["child-a", "child-b", "grandchild"],
    });
    expect(collectTaskAncestorIds("grandchild", tasks)).toEqual({
      ok: true,
      taskIds: ["child-a", "root"],
    });
  });

  it("rejects orphan, cross-project, self and cyclic parent facts", () => {
    expect(
      validateTaskTree([{ id: "orphan", projectId: "project-1", parentTaskId: "missing" }]),
    ).toEqual({ ok: false, reason: "parent_not_found", taskId: "orphan" });
    expect(
      validateTaskTree([
        { id: "parent", projectId: "project-2", parentTaskId: null },
        { id: "child", projectId: "project-1", parentTaskId: "parent" },
      ]),
    ).toEqual({ ok: false, reason: "project_mismatch", taskId: "child" });
    expect(
      validateTaskTree([{ id: "self", projectId: "project-1", parentTaskId: "self" }]),
    ).toEqual({ ok: false, reason: "self_parent", taskId: "self" });
    expect(
      validateTaskTree([
        { id: "a", projectId: "project-1", parentTaskId: "b" },
        { id: "b", projectId: "project-1", parentTaskId: "a" },
      ]),
    ).toEqual({ ok: false, reason: "tree_cycle", taskId: "a" });
  });

  it("rejects moves under a descendant and across projects", () => {
    expect(
      evaluateTaskParentChange({
        taskId: "child-a",
        targetParentTaskId: "grandchild",
        tasks,
      }),
    ).toEqual({ ok: false, reason: "tree_cycle", taskId: "child-a" });
    expect(
      evaluateTaskParentChange({
        taskId: "child-a",
        targetParentTaskId: "other",
        tasks: [...tasks, { id: "other", projectId: "project-2", parentTaskId: null }],
      }),
    ).toEqual({ ok: false, reason: "project_mismatch", taskId: "child-a" });
    expect(
      evaluateTaskParentChange({
        taskId: "grandchild",
        targetParentTaskId: "child-b",
        tasks,
      }),
    ).toEqual({
      ok: true,
      taskId: "grandchild",
      sourceParentTaskId: "child-a",
      targetParentTaskId: "child-b",
    });
  });
});
