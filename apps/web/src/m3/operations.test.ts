import type {
  TaskImpactResponse,
  TaskNotificationResource,
  TaskResource,
  TaskWorkspaceFileCollection,
} from "@ngapd/contracts";
import { describe, expect, it } from "vitest";

import { safeFilenamePart } from "../api.js";
import {
  attachmentIsCurrent,
  canonicalJson,
  impactHasWorkspaceRisk,
  IntentKeyManager,
  parseLabelsInput,
  taskFactsForImpact,
  taskKeyFromNotification,
  taskKeyIsValid,
} from "./operations.js";

const taskId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const workspaceId = "33333333-3333-4333-8333-333333333333";

describe("M3 write intent and impact helpers", () => {
  it("canonicalizes payloads and rotates an idempotency key only for a new intent", () => {
    const generated = ["intent-1", "intent-2", "intent-3"];
    const manager = new IntentKeyManager(() => generated.shift()!);

    expect(manager.keyFor({ z: 2, a: 1, omitted: undefined })).toBe("intent-1");
    expect(manager.keyFor({ a: 1, z: 2 })).toBe("intent-1");
    expect(manager.keyFor({ a: 1, z: 3 })).toBe("intent-2");
    manager.complete();
    expect(manager.keyFor({ a: 1, z: 3 })).toBe("intent-3");
    expect(canonicalJson({ z: [2, { b: true, a: null }], a: "value" })).toBe(
      '{"a":"value","z":[2,{"a":null,"b":true}]}',
    );
    expect(() => canonicalJson(Number.NaN)).toThrow(TypeError);
  });

  it("maps the exact server impact facts and fails closed when any Task is missing", () => {
    const preview = impact([taskId]);
    const task = taskFact();
    expect(taskFactsForImpact(preview, [task])).toEqual({
      confirmedTaskIds: [taskId],
      expectedTaskVersions: { [taskId]: 7 },
      expectedWorkspaceSyncVersions: { [taskId]: 3 },
      expectedOwnerMembershipIds: { [taskId]: ownerId },
    });
    expect(() => taskFactsForImpact(preview, [])).toThrow("无法由当前授权事实解析");
  });

  it("treats leases or unsynced workspaces as impact risk", () => {
    expect(impactHasWorkspaceRisk(impact([]))).toBe(false);
    expect(
      impactHasWorkspaceRisk(
        impact([], { workspaceLeaseIds: ["44444444-4444-4444-8444-444444444444"] }),
      ),
    ).toBe(true);
    expect(impactHasWorkspaceRisk(impact([], { unsyncedWorkspaceTaskIds: [taskId] }))).toBe(true);
  });
});

describe("M3 attachment, notification and input helpers", () => {
  const files: TaskWorkspaceFileCollection = {
    workspaceId,
    syncVersion: 3,
    manifestSha256: "a".repeat(64),
    files: [{ path: "evidence/result.txt", size: 12, sha256: "b".repeat(64) }],
  };

  it("accepts only an attachment from the current authorized manifest", () => {
    expect(
      attachmentIsCurrent(
        { workspaceId, path: "evidence/result.txt", sha256: "b".repeat(64) },
        files,
      ),
    ).toBe(true);
    expect(
      attachmentIsCurrent(
        { workspaceId, path: "evidence/result.txt", sha256: "c".repeat(64) },
        files,
      ),
    ).toBe(false);
    expect(
      attachmentIsCurrent(
        {
          workspaceId: "55555555-5555-4555-8555-555555555555",
          path: "evidence/result.txt",
        },
        files,
      ),
    ).toBe(false);
  });

  it("uses only the currently authorized notification Task Key", () => {
    expect(taskKeyFromNotification(notification({ taskKey: "GAME-42" }))).toBe("GAME-42");
    expect(
      taskKeyFromNotification(
        notification({ taskKey: null, resourceRefs: { taskKey: "GAME-42" } }),
      ),
    ).toBeNull();
    expect(taskKeyFromNotification(notification({ taskKey: "invalid" }))).toBeNull();
  });

  it("normalizes labels and validates complete Task Keys", () => {
    expect(parseLabelsInput(" ui,api，ui\n release ")).toEqual(["ui", "api", "release"]);
    expect(taskKeyIsValid("GAME-42")).toBe(true);
    expect(taskKeyIsValid("game-42")).toBe(false);
    expect(safeFilenamePart(" unsafe:/name\u0000.txt ")).toBe("unsafe__name_.txt");
  });
});

function taskFact(): TaskResource {
  return {
    id: taskId,
    version: 7,
    workspace: { syncVersion: 3 },
    effectiveOwner: { membershipId: ownerId },
  } as TaskResource;
}

function impact(
  affectedTaskIds: string[],
  patch: Partial<TaskImpactResponse["impact"]> = {},
): TaskImpactResponse {
  return {
    confirmationToken: "d".repeat(64),
    impact: {
      operation: "owner_change",
      targetTaskId: taskId,
      affectedTaskIds,
      descendantTaskIds: [],
      dependencyIds: [],
      effectiveStatusTaskIds: [],
      completedAncestorTaskIds: [],
      workspaceLeaseIds: [],
      unsyncedWorkspaceTaskIds: [],
      graphScopeIds: [],
      ...patch,
    },
  };
}

function notification(patch: Partial<TaskNotificationResource>): TaskNotificationResource {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    projectId: "77777777-7777-4777-8777-777777777777",
    taskId,
    projectKey: "GAME",
    taskKey: "GAME-1",
    eventType: "task.comment.created",
    critical: false,
    resourceRefs: {},
    read: false,
    version: 1,
    createdAt: "2026-07-31T00:00:00.000Z",
    ...patch,
  };
}
