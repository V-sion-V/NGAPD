import { describe, expect, it } from "vitest";

import { evaluateTaskCommentMutation } from "./task-comments.js";
import {
  deriveTaskActions,
  evaluateTaskStatusTransition,
  validateTaskFields,
} from "./task-fields.js";
import {
  evaluateCompletionReadiness,
  isCriticalTaskNotification,
  mayDisableTaskNotification,
} from "./task-projections.js";

describe("M2 Task domain rules", () => {
  it("validates stable fields, active roles and UTC-only deadlines", () => {
    const fields = {
      title: "  Ship demo  ",
      content: "Markdown",
      logicalRoleId: "role-1",
      dueAt: "2026-08-01T01:02:03.000Z",
      labels: ["release", "demo"],
      displayType: "milestone" as const,
    };
    expect(
      validateTaskFields(fields, {
        required: true,
        exists: true,
        projectMatches: true,
        status: "active",
      }),
    ).toMatchObject({ ok: true, fields: { title: "Ship demo" } });
    expect(
      validateTaskFields(
        { ...fields, dueAt: "2026-08-01T09:02:03+08:00" },
        { required: true, exists: true, projectMatches: true, status: "active" },
      ),
    ).toEqual({ ok: false, reason: "due_at_invalid" });
    expect(
      validateTaskFields(fields, {
        required: true,
        exists: true,
        projectMatches: true,
        status: "archived",
      }),
    ).toEqual({ ok: false, reason: "logical_role_invalid" });
  });

  it("permits only the forward start transition and keeps blocked/done guarded", () => {
    expect(
      evaluateTaskStatusTransition({
        current: "not_started",
        next: "in_progress",
        blocked: false,
      }),
    ).toEqual({ ok: true, next: "in_progress" });
    expect(
      evaluateTaskStatusTransition({
        current: "not_started",
        next: "in_progress",
        blocked: true,
      }),
    ).toEqual({ ok: false, reason: "task_blocked" });
    expect(
      evaluateTaskStatusTransition({
        current: "done",
        next: "in_progress",
        blocked: false,
      }),
    ).toEqual({ ok: false, reason: "completed_task_frozen" });
  });

  it("keeps completed comments append-only and admin hiding distinct from deletion", () => {
    const base = {
      actorMembershipId: "author",
      actorMembershipActive: true,
      taskBaseStatus: "done" as const,
      taskArchived: false,
      adminModeActive: false,
      comment: { authorMembershipId: "author", deleted: false, hidden: false },
    };
    expect(evaluateTaskCommentMutation({ ...base, operation: "create" })).toEqual({ ok: true });
    expect(evaluateTaskCommentMutation({ ...base, operation: "update" })).toEqual({
      ok: false,
      reason: "comment_immutable",
    });
    expect(
      evaluateTaskCommentMutation({
        ...base,
        operation: "hide",
        adminModeActive: true,
      }),
    ).toEqual({ ok: true });
  });

  it("derives completion readiness without completing the parent and keys exact facts", () => {
    const decision = evaluateCompletionReadiness({
      taskId: "parent",
      taskVersion: 3,
      graphVersion: 4,
      baseStatus: "in_progress",
      archived: false,
      effectiveOwnerMembershipId: "owner",
      directChildren: [{ id: "child", status: "done", archived: false, version: 2 }],
      predecessors: [{ id: "pred", status: "done", archived: false, version: 5 }],
      unresolvedBlockerIds: [],
    });
    expect(decision.ready).toBe(true);
    expect(decision.conditionMaterial).toContain('"taskId":"parent"');
    expect(decision.conditionMaterial).not.toContain('"baseStatus":"done"');
  });

  it("never grants admins another Owner's Workspace write and keeps critical notices enabled", () => {
    const actions = deriveTaskActions({
      activeMember: true,
      actorMembershipId: "admin",
      effectiveOwnerMembershipId: "owner",
      adminModeActive: true,
      baseStatus: "in_progress",
      archived: false,
      parentTaskId: "parent",
      completionReady: true,
    });
    expect(actions).toContain("update");
    expect(actions).not.toContain("write_workspace");
    expect(isCriticalTaskNotification("task.deleted")).toBe(true);
    expect(mayDisableTaskNotification("task.deleted")).toBe(false);
    expect(mayDisableTaskNotification("task.due.reminder")).toBe(true);
  });
});
