import { resolveEffectiveTaskOwner, resolveWorkspaceWriteEligibility } from "@ngapd/domain";
import { describe, expect, it } from "vitest";

import { createWorkspaceAuthorizationFixture } from "./workspace-authorization.js";

describe("workspace authorization fixture", () => {
  it("proves project owner/admin and inherited task owner against negative controls", () => {
    const fixture = createWorkspaceAuthorizationFixture();
    const taskOwner = resolveEffectiveTaskOwner(
      "task-child",
      fixture.tasks,
      Object.values(fixture.memberships),
    );
    expect(taskOwner).toEqual({
      ok: true,
      membershipId: fixture.memberships.owner.id,
      sourceTaskId: "task-root",
    });

    for (const membership of [fixture.memberships.owner, fixture.memberships.admin]) {
      expect(
        resolveWorkspaceWriteEligibility(
          {
            scopeType: "project",
            projectId: "project-sync",
            projectOwnerMembershipId: fixture.memberships.owner.id,
          },
          {
            userId: membership.userId,
            active: true,
            membership,
          },
        ).allowed,
      ).toBe(true);
    }
    expect(
      resolveWorkspaceWriteEligibility(
        {
          scopeType: "task",
          projectId: "project-sync",
          effectiveTaskOwnerMembershipId: fixture.memberships.owner.id,
        },
        {
          userId: fixture.memberships.member.userId,
          active: true,
          membership: fixture.memberships.member,
        },
      ),
    ).toMatchObject({ allowed: false });
  });
});
