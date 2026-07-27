import { FormatRegistry } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { API_ERROR_CODES, DOMAIN_ERROR_CODES } from "./errors.js";
import { ResourceInvalidationEventSchema } from "./events.js";
import { ProjectDomainStateSchema, ProjectKeySchema } from "./projects.js";
import {
  ChangeTaskOwnerCommandSchema,
  TaskArchiveLifecycleSchema,
  TaskImpactSetSchema,
  TaskStatusSchema,
} from "./tasks.js";

FormatRegistry.Set("uuid", (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
);
FormatRegistry.Set("date-time", (value) => !Number.isNaN(Date.parse(value)));

describe("formal M0 runtime contracts", () => {
  it("enforces canonical project keys and formal task state independently from archive", () => {
    expect(Value.Check(ProjectKeySchema, "ZERO")).toBe(true);
    expect(Value.Check(ProjectKeySchema, "Z1")).toBe(false);
    expect(Value.Check(ProjectKeySchema, "TOOLONG")).toBe(false);
    expect(Value.Check(TaskStatusSchema, "not_started")).toBe(true);
    expect(Value.Check(TaskStatusSchema, "open")).toBe(false);
    expect(Value.Check(TaskStatusSchema, "archived")).toBe(false);
    expect(Value.Check(TaskArchiveLifecycleSchema, "archived")).toBe(true);
  });

  it("validates complete project state and deterministic impact payloads", () => {
    const uuid = "00000000-0000-4000-8000-000000000001";
    expect(
      Value.Check(ProjectDomainStateSchema, {
        id: uuid,
        key: "ZERO",
        name: "Project",
        ownerMembershipId: uuid,
        workspaceId: uuid,
        taskSequence: 8,
        lifecycle: "active",
        completedSuccessorReopenPolicy: "cascade",
        recoveryEpoch: 0,
        version: 1,
      }),
    ).toBe(true);
    expect(
      Value.Check(TaskImpactSetSchema, {
        operation: "move",
        targetTaskId: uuid,
        affectedTaskIds: [uuid],
        descendantTaskIds: [],
        dependencyIds: [],
        effectiveStatusTaskIds: [],
        completedAncestorTaskIds: [],
        workspaceLeaseIds: [],
        unsyncedWorkspaceTaskIds: [],
        graphScopeIds: ["project:$project-root"],
      }),
    ).toBe(true);
  });

  it("requires complete affected Task and Workspace facts for Owner changes", () => {
    const targetId = "00000000-0000-4000-8000-000000000001";
    const childId = "00000000-0000-4000-8000-000000000002";
    const ownerId = "00000000-0000-4000-8000-000000000003";
    const command = {
      taskId: targetId,
      nextOwnerMembershipId: ownerId,
      expectedTaskVersion: 2,
      expectedWorkspaceSyncVersion: 4,
      hasUncommittedClientVersion: false,
      impactConfirmed: true,
      confirmedTaskIds: [targetId, childId],
      expectedAffectedTaskVersions: { [targetId]: 2, [childId]: 1 },
      expectedAffectedWorkspaceSyncVersions: { [targetId]: 4, [childId]: 3 },
      uncommittedWorkspaceTaskIds: [],
    };
    expect(Value.Check(ChangeTaskOwnerCommandSchema, command)).toBe(true);
    expect(
      Value.Check(ChangeTaskOwnerCommandSchema, {
        ...command,
        expectedAffectedWorkspaceSyncVersions: undefined,
      }),
    ).toBe(false);
  });

  it("keeps the expanded machine error catalog unique and mapped", () => {
    expect(new Set(API_ERROR_CODES).size).toBe(API_ERROR_CODES.length);
    for (const code of DOMAIN_ERROR_CODES) {
      expect(API_ERROR_CODES).toContain(code);
    }
  });

  it("keeps SSE payloads cursor-based and invalidation-only", () => {
    const event = {
      cursor: "42",
      projectId: "00000000-0000-4000-8000-000000000001",
      resourceType: "task",
      resourceId: "00000000-0000-4000-8000-000000000002",
      eventType: "task.updated",
      refetch: true,
      createdAt: "2026-07-27T00:00:00.000Z",
    };
    expect(Value.Check(ResourceInvalidationEventSchema, event)).toBe(true);
    expect(Value.Check(ResourceInvalidationEventSchema, { ...event, cursor: "-1" })).toBe(false);
    expect(Value.Check(ResourceInvalidationEventSchema, { ...event, title: "secret" })).toBe(false);
  });
});
