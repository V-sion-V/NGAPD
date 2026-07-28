import { describe, expect, it } from "vitest";

import {
  ADMIN_MODE_IDLE_TIMEOUT_MS,
  evaluateAdminMode,
  openAdminMode,
  recordProtectedAdminActivity,
} from "./admin-mode.js";

const membership = {
  id: "admin",
  projectId: "project-1",
  permissionLevel: "admin" as const,
  status: "active" as const,
};
const startedAt = new Date("2026-07-28T00:00:00.000Z");

describe("Admin Mode", () => {
  it("opens only for active Owner/Admin and binds session, project and Membership", () => {
    const opened = openAdminMode({
      id: "mode-1",
      webSessionId: "session-1",
      projectId: "project-1",
      membership,
      ownerMembershipId: "owner",
      projectLifecycle: "active",
      now: startedAt,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.state.expiresAt.getTime() - startedAt.getTime()).toBe(ADMIN_MODE_IDLE_TIMEOUT_MS);
    expect(
      evaluateAdminMode({
        state: opened.state,
        webSessionId: "another-session",
        webSessionActive: true,
        projectId: "project-1",
        projectLifecycle: "active",
        membership,
        ownerMembershipId: "owner",
        now: startedAt,
      }),
    ).toEqual({
      allowed: false,
      reason: "admin_mode_scope_mismatch",
      effectiveStatus: "revoked",
    });
  });

  it("expires after 30 minutes and only successful protected operations extend it", () => {
    const opened = openAdminMode({
      id: "mode-1",
      webSessionId: "session-1",
      projectId: "project-1",
      membership,
      ownerMembershipId: "owner",
      projectLifecycle: "active",
      now: startedAt,
    });
    if (!opened.ok) throw new Error("expected Admin Mode to open");

    const activeDecision = evaluateAdminMode({
      state: opened.state,
      webSessionId: "session-1",
      webSessionActive: true,
      projectId: "project-1",
      projectLifecycle: "active",
      membership,
      ownerMembershipId: "owner",
      now: new Date(startedAt.getTime() + 1_000),
    });
    expect(
      recordProtectedAdminActivity({
        state: opened.state,
        decision: activeDecision,
        protectedOperationSucceeded: false,
        now: new Date(startedAt.getTime() + 1_000),
      }),
    ).toBe(opened.state);
    expect(
      evaluateAdminMode({
        state: opened.state,
        webSessionId: "session-1",
        webSessionActive: true,
        projectId: "project-1",
        projectLifecycle: "active",
        membership,
        ownerMembershipId: "owner",
        now: new Date(startedAt.getTime() + ADMIN_MODE_IDLE_TIMEOUT_MS),
      }),
    ).toEqual({
      allowed: false,
      reason: "admin_mode_expired",
      effectiveStatus: "expired",
    });
  });
});
