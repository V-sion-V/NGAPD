import { describe, expect, it } from "vitest";

import {
  resolveAgentWorkspaceReadIntent,
  resolveTaskOperationAuthorization,
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

  it("keeps authenticated user-workspace reads separate from owner-only writes and Agent intent", () => {
    expect(
      resolveWorkspaceReadAccess({ scopeType: "user", scopeOwnerUserId: "another-user" }, member),
    ).toEqual({ allowed: true, reason: "allowed" });
    expect(
      resolveWorkspaceWriteEligibility(
        { scopeType: "user", scopeOwnerUserId: "another-user" },
        member,
      ),
    ).toEqual({ allowed: false, reason: "not_scope_owner" });
    expect(
      resolveAgentWorkspaceReadIntent({
        actorUserId: "user-member",
        scopeOwnerUserId: "another-user",
        explicitUserInstructionForScope: false,
      }),
    ).toEqual({ allowed: false, reason: "not_scope_owner" });
  });
});

describe("task operation authorization", () => {
  const context = {
    serverProjectId: "project-1",
    targetProjectIds: ["project-1"],
    affectedOwnerMembershipIds: ["membership-member"],
    projectOwnerMembershipId: "membership-owner",
    projectRootOperation: false,
    adminSessionActive: false,
    actorType: "human" as const,
    adminSessionEnteredFromExplicitUserRequest: false,
    impactConfirmationRequired: false,
    impactConfirmed: false,
  };

  it("uses server tenant and effective owner facts", () => {
    expect(resolveTaskOperationAuthorization(context, member)).toEqual({
      allowed: true,
      reason: "allowed",
    });
    expect(
      resolveTaskOperationAuthorization(
        { ...context, targetProjectIds: ["project-client-supplied"] },
        member,
      ),
    ).toEqual({ allowed: false, reason: "tenant_scope_mismatch" });
  });

  it("does not let confirmation replace authorization", () => {
    expect(
      resolveTaskOperationAuthorization(
        {
          ...context,
          affectedOwnerMembershipIds: ["another-owner"],
          impactConfirmationRequired: true,
          impactConfirmed: true,
        },
        member,
      ),
    ).toEqual({ allowed: false, reason: "admin_mode_required" });
  });

  it("requires explicit user entry before an Agent consumes admin capability", () => {
    expect(
      resolveTaskOperationAuthorization(
        {
          ...context,
          affectedOwnerMembershipIds: ["another-owner"],
          adminSessionActive: true,
          actorType: "agent",
          adminSessionEnteredFromExplicitUserRequest: false,
        },
        member,
      ),
    ).toEqual({
      allowed: false,
      reason: "agent_admin_mode_requires_explicit_request",
    });
  });
});
