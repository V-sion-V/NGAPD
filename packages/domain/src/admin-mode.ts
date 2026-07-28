import type { GovernanceMembership } from "./project-governance.js";

export const ADMIN_MODE_IDLE_TIMEOUT_MS = 30 * 60 * 1_000;

export interface AdminModeState {
  id: string;
  webSessionId: string;
  projectId: string;
  membershipId: string;
  status: "active" | "closed" | "expired" | "revoked";
  issuedAt: Date;
  lastProtectedActivityAt: Date;
  expiresAt: Date;
  version: number;
}

export type AdminModeDecision =
  | { allowed: true; reason: "allowed"; effectiveStatus: "active" }
  | {
      allowed: false;
      reason:
        | "admin_mode_not_active"
        | "admin_mode_expired"
        | "admin_mode_scope_mismatch"
        | "web_session_inactive"
        | "project_archived"
        | "membership_inactive"
        | "owner_or_admin_required";
      effectiveStatus: "closed" | "expired" | "revoked";
    };

export function openAdminMode(input: {
  id: string;
  webSessionId: string;
  projectId: string;
  membership: GovernanceMembership;
  ownerMembershipId: string;
  projectLifecycle: "active" | "archived";
  now: Date;
}):
  | { ok: true; state: AdminModeState }
  | {
      ok: false;
      reason: "project_archived" | "membership_inactive" | "owner_or_admin_required";
    } {
  if (input.projectLifecycle !== "active") {
    return { ok: false, reason: "project_archived" };
  }
  if (input.membership.projectId !== input.projectId || input.membership.status !== "active") {
    return { ok: false, reason: "membership_inactive" };
  }
  if (
    input.membership.id !== input.ownerMembershipId &&
    input.membership.permissionLevel !== "admin"
  ) {
    return { ok: false, reason: "owner_or_admin_required" };
  }
  return {
    ok: true,
    state: {
      id: input.id,
      webSessionId: input.webSessionId,
      projectId: input.projectId,
      membershipId: input.membership.id,
      status: "active",
      issuedAt: input.now,
      lastProtectedActivityAt: input.now,
      expiresAt: new Date(input.now.getTime() + ADMIN_MODE_IDLE_TIMEOUT_MS),
      version: 1,
    },
  };
}

export function evaluateAdminMode(input: {
  state: AdminModeState;
  webSessionId: string;
  webSessionActive: boolean;
  projectId: string;
  projectLifecycle: "active" | "archived";
  membership: GovernanceMembership;
  ownerMembershipId: string;
  now: Date;
}): AdminModeDecision {
  if (input.state.status !== "active") {
    return {
      allowed: false,
      reason: "admin_mode_not_active",
      effectiveStatus: input.state.status,
    };
  }
  if (
    input.state.webSessionId !== input.webSessionId ||
    input.state.projectId !== input.projectId ||
    input.state.membershipId !== input.membership.id
  ) {
    return {
      allowed: false,
      reason: "admin_mode_scope_mismatch",
      effectiveStatus: "revoked",
    };
  }
  if (!input.webSessionActive) {
    return { allowed: false, reason: "web_session_inactive", effectiveStatus: "revoked" };
  }
  if (input.projectLifecycle !== "active") {
    return { allowed: false, reason: "project_archived", effectiveStatus: "revoked" };
  }
  if (input.membership.projectId !== input.projectId || input.membership.status !== "active") {
    return { allowed: false, reason: "membership_inactive", effectiveStatus: "revoked" };
  }
  if (
    input.membership.id !== input.ownerMembershipId &&
    input.membership.permissionLevel !== "admin"
  ) {
    return {
      allowed: false,
      reason: "owner_or_admin_required",
      effectiveStatus: "revoked",
    };
  }
  if (input.now.getTime() >= input.state.expiresAt.getTime()) {
    return { allowed: false, reason: "admin_mode_expired", effectiveStatus: "expired" };
  }
  return { allowed: true, reason: "allowed", effectiveStatus: "active" };
}

export function recordProtectedAdminActivity(input: {
  state: AdminModeState;
  decision: AdminModeDecision;
  protectedOperationSucceeded: boolean;
  now: Date;
}): AdminModeState {
  if (!input.decision.allowed || !input.protectedOperationSucceeded) {
    return input.state;
  }
  return {
    ...input.state,
    lastProtectedActivityAt: input.now,
    expiresAt: new Date(input.now.getTime() + ADMIN_MODE_IDLE_TIMEOUT_MS),
    version: input.state.version + 1,
  };
}
