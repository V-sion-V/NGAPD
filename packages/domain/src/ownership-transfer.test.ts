import { describe, expect, it } from "vitest";

import { createOwnershipTransfer, resolveOwnershipTransfer } from "./ownership-transfer.js";

const target = {
  id: "target",
  projectId: "project-1",
  permissionLevel: "member" as const,
  status: "active" as const,
};

describe("Project ownership transfer", () => {
  it("requires the current Owner, one pending request and an active target", () => {
    expect(
      createOwnershipTransfer({
        projectId: "project-1",
        currentOwnerMembershipId: "owner",
        actorMembershipId: "owner",
        targetMembership: target,
        existingPending: false,
      }),
    ).toEqual({
      ok: true,
      fromOwnerMembershipId: "owner",
      targetMembershipId: "target",
      status: "pending",
    });
    expect(
      createOwnershipTransfer({
        projectId: "project-1",
        currentOwnerMembershipId: "owner",
        actorMembershipId: "owner",
        targetMembership: target,
        existingPending: true,
      }),
    ).toEqual({ ok: false, reason: "ownership_transfer_already_pending" });
  });

  it("changes only the owner authority when the target accepts and rejects stale facts", () => {
    const transfer = {
      id: "transfer-1",
      projectId: "project-1",
      fromOwnerMembershipId: "owner",
      targetMembershipId: "target",
      status: "pending" as const,
      version: 1,
    };
    expect(
      resolveOwnershipTransfer({
        transfer,
        action: "accept",
        actorMembershipId: "target",
        projectLifecycle: "active",
        currentOwnerMembershipId: "owner",
        targetMembership: target,
      }),
    ).toEqual({
      ok: true,
      nextStatus: "accepted",
      nextOwnerMembershipId: "target",
    });
    expect(
      resolveOwnershipTransfer({
        transfer,
        action: "accept",
        actorMembershipId: "target",
        projectLifecycle: "archived",
        currentOwnerMembershipId: "owner",
        targetMembership: target,
      }),
    ).toEqual({ ok: false, reason: "ownership_transfer_stale" });
  });
});
