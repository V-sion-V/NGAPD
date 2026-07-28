import type { GovernanceMembership } from "./project-governance.js";

export interface OwnershipTransferState {
  id: string;
  projectId: string;
  fromOwnerMembershipId: string;
  targetMembershipId: string;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "stale";
  version: number;
}

export function createOwnershipTransfer(input: {
  projectId: string;
  currentOwnerMembershipId: string;
  actorMembershipId: string;
  targetMembership: GovernanceMembership;
  existingPending: boolean;
}):
  | {
      ok: true;
      fromOwnerMembershipId: string;
      targetMembershipId: string;
      status: "pending";
    }
  | {
      ok: false;
      reason:
        | "project_owner_required"
        | "target_is_current_owner"
        | "target_membership_inactive"
        | "ownership_transfer_already_pending";
    } {
  if (input.actorMembershipId !== input.currentOwnerMembershipId) {
    return { ok: false, reason: "project_owner_required" };
  }
  if (input.targetMembership.id === input.currentOwnerMembershipId) {
    return { ok: false, reason: "target_is_current_owner" };
  }
  if (
    input.targetMembership.projectId !== input.projectId ||
    input.targetMembership.status !== "active"
  ) {
    return { ok: false, reason: "target_membership_inactive" };
  }
  if (input.existingPending) {
    return { ok: false, reason: "ownership_transfer_already_pending" };
  }
  return {
    ok: true,
    fromOwnerMembershipId: input.currentOwnerMembershipId,
    targetMembershipId: input.targetMembership.id,
    status: "pending",
  };
}

export function resolveOwnershipTransfer(input: {
  transfer: OwnershipTransferState;
  action: "accept" | "reject" | "cancel";
  actorMembershipId: string;
  projectLifecycle: "active" | "archived";
  currentOwnerMembershipId: string;
  targetMembership: GovernanceMembership;
}):
  | {
      ok: true;
      nextStatus: "accepted" | "rejected" | "cancelled";
      nextOwnerMembershipId: string;
    }
  | {
      ok: false;
      reason:
        | "ownership_transfer_not_pending"
        | "ownership_transfer_stale"
        | "project_owner_required"
        | "target_membership_required";
    } {
  if (input.transfer.status !== "pending") {
    return { ok: false, reason: "ownership_transfer_not_pending" };
  }
  if (
    input.projectLifecycle !== "active" ||
    input.currentOwnerMembershipId !== input.transfer.fromOwnerMembershipId ||
    input.targetMembership.id !== input.transfer.targetMembershipId ||
    input.targetMembership.projectId !== input.transfer.projectId ||
    input.targetMembership.status !== "active"
  ) {
    return { ok: false, reason: "ownership_transfer_stale" };
  }
  if (input.action === "cancel") {
    return input.actorMembershipId === input.currentOwnerMembershipId
      ? {
          ok: true,
          nextStatus: "cancelled",
          nextOwnerMembershipId: input.currentOwnerMembershipId,
        }
      : { ok: false, reason: "project_owner_required" };
  }
  if (input.actorMembershipId !== input.targetMembership.id) {
    return { ok: false, reason: "target_membership_required" };
  }
  return input.action === "accept"
    ? {
        ok: true,
        nextStatus: "accepted",
        nextOwnerMembershipId: input.targetMembership.id,
      }
    : {
        ok: true,
        nextStatus: "rejected",
        nextOwnerMembershipId: input.currentOwnerMembershipId,
      };
}
