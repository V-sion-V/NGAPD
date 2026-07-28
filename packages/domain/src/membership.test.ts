import { describe, expect, it } from "vitest";

import {
  previewMembershipRemoval,
  requestMembershipJoin,
  resolveMembershipJoin,
  resolveMembershipLifecycleLockScope,
  type MembershipState,
} from "./membership.js";

const member: MembershipState = {
  id: "member-1",
  projectId: "project-1",
  userId: "user-1",
  permissionLevel: "admin",
  status: "removed",
  hasBeenActive: true,
};

describe("Membership lifecycle", () => {
  it("reuses one Membership and copies user defaults only on first approval", () => {
    expect(requestMembershipJoin(null)).toEqual({
      ok: true,
      nextStatus: "pending",
      nextPermissionLevel: "member",
      initializeProjectProfileFromUserDefaults: false,
    });
    expect(requestMembershipJoin(member)).toEqual({
      ok: true,
      nextStatus: "pending",
      nextPermissionLevel: "member",
      initializeProjectProfileFromUserDefaults: false,
    });
    expect(
      resolveMembershipJoin({ ...member, status: "pending", hasBeenActive: false }, "approve"),
    ).toEqual({
      ok: true,
      nextStatus: "active",
      nextPermissionLevel: "member",
      initializeProjectProfileFromUserDefaults: true,
    });
    expect(resolveMembershipJoin({ ...member, status: "pending" }, "approve")).toEqual({
      ok: true,
      nextStatus: "active",
      nextPermissionLevel: "member",
      initializeProjectProfileFromUserDefaults: false,
    });
  });

  it("uses the same stable Membership lock scope for removal and Task Owner writes", () => {
    expect(
      resolveMembershipLifecycleLockScope({
        projectId: "project-1",
        membershipIds: ["member-b", "member-a", "member-b"],
        purpose: "assign_task_owner",
      }),
    ).toEqual({
      projectId: "project-1",
      membershipIds: ["member-a", "member-b"],
      purpose: "assign_task_owner",
    });
  });

  it("blocks removal for explicit and inherited owners but excludes done and archived trees", () => {
    const activeMember = { ...member, status: "active" as const };
    const tasks = [
      {
        id: "root",
        key: "GAME-1",
        projectId: "project-1",
        parentTaskId: null,
        explicitOwnerMembershipId: "owner",
        status: "in_progress" as const,
        lifecycle: "active" as const,
      },
      {
        id: "child",
        key: "GAME-2",
        projectId: "project-1",
        parentTaskId: "root",
        explicitOwnerMembershipId: "member-1",
        status: "blocked" as const,
        lifecycle: "active" as const,
      },
      {
        id: "grandchild",
        key: "GAME-3",
        projectId: "project-1",
        parentTaskId: "child",
        explicitOwnerMembershipId: null,
        status: "not_started" as const,
        lifecycle: "active" as const,
      },
      {
        id: "done",
        key: "GAME-4",
        projectId: "project-1",
        parentTaskId: "child",
        explicitOwnerMembershipId: null,
        status: "done" as const,
        lifecycle: "frozen" as const,
      },
      {
        id: "archived",
        key: "GAME-5",
        projectId: "project-1",
        parentTaskId: null,
        explicitOwnerMembershipId: "member-1",
        status: "in_progress" as const,
        lifecycle: "archived" as const,
      },
      {
        id: "archived-child",
        key: "GAME-6",
        projectId: "project-1",
        parentTaskId: "archived",
        explicitOwnerMembershipId: null,
        status: "not_started" as const,
        lifecycle: "active" as const,
      },
    ];
    expect(
      previewMembershipRemoval({
        projectId: "project-1",
        ownerMembershipId: "owner",
        targetMembership: activeMember,
        tasks,
        memberships: [
          { id: "owner", projectId: "project-1", status: "active" },
          { id: "member-1", projectId: "project-1", status: "active" },
        ],
      }),
    ).toEqual({
      ok: false,
      reason: "active_task_ownership_blocked",
      blockers: [
        { id: "child", key: "GAME-2" },
        { id: "grandchild", key: "GAME-3" },
      ],
    });
  });

  it("never permits direct removal of the Project Owner", () => {
    expect(
      previewMembershipRemoval({
        projectId: "project-1",
        ownerMembershipId: "member-1",
        targetMembership: { ...member, status: "active" },
        tasks: [],
        memberships: [],
      }),
    ).toEqual({
      ok: false,
      reason: "owner_removal_forbidden",
      blockers: [],
    });
  });
});
