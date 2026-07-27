import { describe, expect, it } from "vitest";

import {
  resolveCompletionOwnerMaterialization,
  resolveEffectiveTaskOwner,
  validateTaskOwnership,
} from "./task-owner.js";

const memberships = [{ id: "membership-owner", projectId: "project-1", active: true }];
const tasks = [
  {
    id: "root",
    projectId: "project-1",
    parentTaskId: null,
    explicitOwnerMembershipId: "membership-owner",
  },
  {
    id: "child",
    projectId: "project-1",
    parentTaskId: "root",
    explicitOwnerMembershipId: null,
  },
];

describe("resolveEffectiveTaskOwner", () => {
  it("inherits the nearest active owner from the ancestor chain", () => {
    expect(resolveEffectiveTaskOwner("child", tasks, memberships)).toEqual({
      ok: true,
      membershipId: "membership-owner",
      sourceTaskId: "root",
    });
  });

  it("rejects inactive owners and cycles", () => {
    expect(
      resolveEffectiveTaskOwner("child", tasks, [{ ...memberships[0]!, active: false }]),
    ).toEqual({ ok: false, reason: "owner_inactive" });
    expect(
      resolveEffectiveTaskOwner(
        "a",
        [
          {
            id: "a",
            projectId: "project-1",
            parentTaskId: "b",
            explicitOwnerMembershipId: null,
          },
          {
            id: "b",
            projectId: "project-1",
            parentTaskId: "a",
            explicitOwnerMembershipId: null,
          },
        ],
        memberships,
      ),
    ).toEqual({ ok: false, reason: "ownership_cycle" });
  });

  it("requires active explicit owners at the project root", () => {
    expect(validateTaskOwnership(tasks, memberships)).toEqual({ ok: true });
    expect(
      validateTaskOwnership(
        [
          {
            id: "root",
            projectId: "project-1",
            parentTaskId: null,
            explicitOwnerMembershipId: null,
          },
        ],
        memberships,
      ),
    ).toEqual({
      ok: false,
      taskId: "root",
      reason: "top_level_owner_required",
    });
  });

  it("makes inherited completion ownership materialization explicit", () => {
    expect(resolveCompletionOwnerMaterialization("child", tasks, memberships)).toEqual({
      ok: true,
      membershipId: "membership-owner",
      sourceTaskId: "root",
      shouldMaterialize: true,
    });
    expect(resolveCompletionOwnerMaterialization("root", tasks, memberships)).toEqual({
      ok: true,
      membershipId: "membership-owner",
      sourceTaskId: "root",
      shouldMaterialize: false,
    });
  });
});
