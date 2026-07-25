import { describe, expect, it } from "vitest";

import { resolveEffectiveTaskOwner } from "./task-owner.js";

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
});
