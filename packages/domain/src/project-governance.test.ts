import { describe, expect, it } from "vitest";

import {
  resolveProjectGovernanceAuthorization,
  resolveProjectLifecycleTransition,
  validateProjectOwnership,
  type GovernanceMembership,
} from "./project-governance.js";

const owner: GovernanceMembership = {
  id: "owner",
  projectId: "project-1",
  permissionLevel: "member",
  status: "active",
};
const admin: GovernanceMembership = {
  id: "admin",
  projectId: "project-1",
  permissionLevel: "admin",
  status: "active",
};

describe("Project governance", () => {
  it("keeps Owner-direct, Admin Mode and self-service actions separate", () => {
    expect(
      resolveProjectGovernanceAuthorization({
        action: "remove_membership",
        projectId: "project-1",
        projectLifecycle: "active",
        projectOwnerMembershipId: owner.id,
        actorMembership: owner,
        targetMembershipId: admin.id,
        adminModeActive: false,
      }),
    ).toEqual({ allowed: true, reason: "allowed" });
    expect(
      resolveProjectGovernanceAuthorization({
        action: "remove_membership",
        projectId: "project-1",
        projectLifecycle: "active",
        projectOwnerMembershipId: owner.id,
        actorMembership: admin,
        targetMembershipId: owner.id,
        adminModeActive: true,
      }),
    ).toEqual({ allowed: false, reason: "project_owner_required" });
    expect(
      resolveProjectGovernanceAuthorization({
        action: "manage_project_roles",
        projectId: "project-1",
        projectLifecycle: "active",
        projectOwnerMembershipId: owner.id,
        actorMembership: admin,
        adminModeActive: false,
      }),
    ).toEqual({ allowed: false, reason: "admin_mode_required" });
    expect(
      resolveProjectGovernanceAuthorization({
        action: "manage_project_roles",
        projectId: "project-1",
        projectLifecycle: "active",
        projectOwnerMembershipId: owner.id,
        actorMembership: admin,
        adminModeActive: true,
      }),
    ).toEqual({ allowed: true, reason: "allowed" });
  });

  it("requires one same-project active owner Membership", () => {
    expect(
      validateProjectOwnership({
        projectId: "project-1",
        ownerMembershipId: owner.id,
        memberships: [owner, admin],
      }),
    ).toEqual({ ok: true });
    expect(
      validateProjectOwnership({
        projectId: "project-1",
        ownerMembershipId: owner.id,
        memberships: [{ ...owner, status: "removed" }],
      }),
    ).toEqual({ ok: false, reason: "owner_membership_inactive" });
  });

  it("archives into a capability-revoking state and does not restore old capabilities", () => {
    expect(resolveProjectLifecycleTransition({ current: "active", requested: "archived" })).toEqual(
      {
        ok: true,
        next: "archived",
        revokeProjectCapabilities: true,
      },
    );
    expect(resolveProjectLifecycleTransition({ current: "archived", requested: "active" })).toEqual(
      {
        ok: true,
        next: "active",
        revokeProjectCapabilities: false,
      },
    );
  });
});
