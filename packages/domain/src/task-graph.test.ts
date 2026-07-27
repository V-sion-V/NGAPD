import { describe, expect, it } from "vitest";

import {
  evaluateDependencyChange,
  evaluateDependencyRequestAcceptance,
  expandTaskFollowsOneHop,
  validateTaskDependencyGraph,
  validateTaskFollow,
  type TaskGraphNode,
} from "./task-graph.js";

function node(id: string, owner: string, parentTaskId: string | null = null): TaskGraphNode {
  return {
    id,
    projectId: "project-1",
    parentTaskId,
    effectiveOwnerMembershipId: owner,
    baseStatus: "in_progress",
    archived: false,
  };
}

describe("formal sibling task graph", () => {
  it("uses the same acyclic semantics for project root and ordinary parent scopes", () => {
    const tasks = [
      node("root-a", "owner-a"),
      node("root-b", "owner-b"),
      node("parent", "owner-parent"),
      node("child-a", "owner-a", "parent"),
      node("child-b", "owner-b", "parent"),
    ];
    expect(
      validateTaskDependencyGraph(tasks, [
        { predecessorTaskId: "root-a", successorTaskId: "root-b" },
        { predecessorTaskId: "child-a", successorTaskId: "child-b" },
      ]),
    ).toEqual({ ok: true });
    expect(
      validateTaskDependencyGraph(tasks, [
        { predecessorTaskId: "root-a", successorTaskId: "child-a" },
      ]),
    ).toEqual({
      ok: false,
      reason: "cross_parent_dependency",
      subject: "root-a->child-a",
    });
    expect(
      validateTaskDependencyGraph(tasks, [
        { predecessorTaskId: "root-a", successorTaskId: "root-b" },
        { predecessorTaskId: "root-b", successorTaskId: "root-a" },
      ]),
    ).toEqual({
      ok: false,
      reason: "dependency_cycle",
      subject: "project-1:$project-root",
    });
  });

  it("supports direct ownership and binds one-sided changes to acceptance facts", () => {
    const tasks = [node("a", "owner-a"), node("b", "owner-b")];
    const requested = evaluateDependencyChange({
      action: "add",
      predecessorTaskId: "a",
      successorTaskId: "b",
      actorMembershipId: "owner-a",
      projectOwnerMembershipId: "project-owner",
      adminModeActive: false,
      expectedGraphVersion: 4,
      currentGraphVersion: 4,
      tasks,
      dependencies: [],
    });
    expect(requested).toEqual({
      ok: true,
      mode: "request_required",
      request: {
        action: "add",
        predecessorTaskId: "a",
        successorTaskId: "b",
        parentTaskId: null,
        graphVersion: 4,
        predecessorOwnerMembershipId: "owner-a",
        successorOwnerMembershipId: "owner-b",
        requiredAcceptanceByMembershipId: "owner-b",
      },
    });
    if (!requested.ok || requested.mode !== "request_required") {
      throw new Error("Expected dependency request");
    }
    expect(
      evaluateDependencyRequestAcceptance({
        request: requested.request,
        acceptingMembershipId: "owner-b",
        currentGraphVersion: 4,
        tasks,
        dependencies: [],
      }),
    ).toEqual({ ok: true, mode: "direct", action: "add" });
    expect(
      evaluateDependencyRequestAcceptance({
        request: requested.request,
        acceptingMembershipId: "owner-b",
        currentGraphVersion: 5,
        tasks,
        dependencies: [],
      }),
    ).toEqual({ ok: false, reason: "request_stale", subject: "a->b" });
  });

  it("lets a common parent owner control children but freezes completed endpoints", () => {
    const tasks = [
      node("parent", "parent-owner"),
      node("a", "owner-a", "parent"),
      node("b", "owner-b", "parent"),
    ];
    expect(
      evaluateDependencyChange({
        action: "add",
        predecessorTaskId: "a",
        successorTaskId: "b",
        actorMembershipId: "parent-owner",
        projectOwnerMembershipId: "project-owner",
        adminModeActive: false,
        expectedGraphVersion: 1,
        currentGraphVersion: 1,
        tasks,
        dependencies: [],
      }),
    ).toEqual({ ok: true, mode: "direct", action: "add" });
    expect(
      evaluateDependencyChange({
        action: "add",
        predecessorTaskId: "a",
        successorTaskId: "b",
        actorMembershipId: "parent-owner",
        projectOwnerMembershipId: "project-owner",
        adminModeActive: false,
        expectedGraphVersion: 1,
        currentGraphVersion: 1,
        tasks: tasks.map((task) =>
          task.id === "b" ? { ...task, baseStatus: "done" as const } : task,
        ),
        dependencies: [],
      }),
    ).toEqual({ ok: false, reason: "completed_task_frozen", subject: "a->b" });
  });

  it("validates a 200-node DAG without imposing a domain hard limit", () => {
    const tasks = Array.from({ length: 200 }, (_, index) =>
      node(`task-${String(index).padStart(3, "0")}`, "owner"),
    );
    const dependencies = tasks.slice(1).map((task, index) => ({
      predecessorTaskId: tasks[index]?.id ?? "",
      successorTaskId: task.id,
    }));
    expect(validateTaskDependencyGraph(tasks, dependencies)).toEqual({ ok: true });
  });
});

describe("task follows", () => {
  it("allows cycles but expands exactly one stable hop", () => {
    const tasks = [node("a", "owner-a"), node("b", "owner-b"), node("c", "owner-c")];
    expect(
      validateTaskFollow({
        sourceTaskId: "a",
        targetTaskId: "b",
        tasks,
        follows: [{ sourceTaskId: "b", targetTaskId: "a" }],
      }),
    ).toEqual({ ok: true });
    expect(
      expandTaskFollowsOneHop("a", [
        { sourceTaskId: "b", targetTaskId: "c" },
        { sourceTaskId: "a", targetTaskId: "c" },
        { sourceTaskId: "a", targetTaskId: "b" },
      ]),
    ).toEqual(["b", "c"]);
  });

  it("rejects a Follow from a completed source Task", () => {
    expect(
      validateTaskFollow({
        sourceTaskId: "a",
        targetTaskId: "b",
        tasks: [{ ...node("a", "owner-a"), baseStatus: "done" }, node("b", "owner-b")],
        follows: [],
      }),
    ).toEqual({ ok: false, reason: "completed_task_frozen", subject: "a->b" });
  });
});
