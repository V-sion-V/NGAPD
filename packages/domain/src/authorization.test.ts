import { describe, expect, it } from "vitest";

import {
  resolveWorkspaceReadAccess,
  resolveWorkspaceWriteEligibility,
  type AuthorizationActor,
} from "./authorization.js";

const member: AuthorizationActor = {
  userId: "user-member",
  active: true,
  membership: {
    id: "membership-member",
    userId: "user-member",
    projectId: "project-1",
    role: "member",
    active: true,
  },
};

describe("workspace authorization", () => {
  it("uses server facts for user, project owner/admin and task owner writes", () => {
    expect(
      resolveWorkspaceWriteEligibility(
        { scopeType: "user", scopeOwnerUserId: "user-member" },
        member,
      ),
    ).toEqual({ allowed: true, reason: "allowed" });

    expect(
      resolveWorkspaceWriteEligibility(
        {
          scopeType: "project",
          projectId: "project-1",
          projectOwnerMembershipId: "membership-member",
        },
        member,
      ),
    ).toEqual({ allowed: true, reason: "allowed" });

    expect(
      resolveWorkspaceWriteEligibility(
        {
          scopeType: "task",
          projectId: "project-1",
          effectiveTaskOwnerMembershipId: "membership-member",
        },
        member,
      ),
    ).toEqual({ allowed: true, reason: "allowed" });
  });

  it("allows active project members to read but rejects unqualified writes", () => {
    expect(
      resolveWorkspaceReadAccess({ scopeType: "project", projectId: "project-1" }, member),
    ).toEqual({ allowed: true, reason: "allowed" });
    expect(
      resolveWorkspaceWriteEligibility(
        {
          scopeType: "project",
          projectId: "project-1",
          projectOwnerMembershipId: "someone-else",
        },
        member,
      ),
    ).toEqual({
      allowed: false,
      reason: "project_write_requires_owner_or_admin",
    });
  });

  it("rejects inactive and cross-project membership facts", () => {
    expect(
      resolveWorkspaceReadAccess({ scopeType: "project", projectId: "project-2" }, member),
    ).toEqual({ allowed: false, reason: "membership_project_mismatch" });
    expect(
      resolveWorkspaceReadAccess(
        { scopeType: "user", scopeOwnerUserId: "user-member" },
        { ...member, active: false },
      ),
    ).toEqual({ allowed: false, reason: "account_inactive" });
  });
});
