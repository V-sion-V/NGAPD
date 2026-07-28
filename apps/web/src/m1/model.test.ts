import type { ProjectDetail, ResourceInvalidationEvent } from "@ngapd/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  activeAdminMode,
  canChangeRoleBinding,
  firstVisibleGrapheme,
  invalidationQueryKeys,
  membershipStatusLabel,
  m1QueryKeys,
  newIdempotencyKey,
  projectStatusLabel,
  remainingMinutes,
} from "./model.js";

describe("M1 Web model", () => {
  it("derives an accessible Unicode grapheme without persisting avatar content", () => {
    expect(firstVisibleGrapheme("  👩🏽‍💻 开发者")).toBe("👩🏽‍💻");
    expect(firstVisibleGrapheme("e\u0301quipe")).toBe("é");
    expect(firstVisibleGrapheme("\u0000 \n")).toBe("?");
  });

  it("uses stable user and project scoped query keys", () => {
    expect(m1QueryKeys.project("user-1", "GAME")).toEqual(["m1", "user-1", "project", "GAME"]);
    expect(m1QueryKeys.roles("user-1", "GAME")).toEqual([
      "m1",
      "user-1",
      "project",
      "GAME",
      "roles",
    ]);
  });

  it("invalidates only the affected current project scope when possible", () => {
    const event: ResourceInvalidationEvent = {
      cursor: "17",
      projectId: "0dcbf010-3210-4bee-bac8-626f044965ed",
      resourceType: "project_role",
      resourceId: "77677edb-ed1e-48ca-85c2-5ec5fd0ccab3",
      eventType: "project_role.updated",
      refetch: true,
      createdAt: "2026-07-28T00:00:00.000Z",
    };

    expect(
      invalidationQueryKeys("user-1", event, {
        id: "0dcbf010-3210-4bee-bac8-626f044965ed",
        key: "GAME",
      }),
    ).toEqual([m1QueryKeys.roles("user-1", "GAME"), m1QueryKeys.members("user-1", "GAME")]);
  });

  it("creates one UUID per explicit intent and keeps time labels deterministic", () => {
    const randomUUID = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("9260b554-cc61-4487-ab0e-3a38752701f0");
    expect(newIdempotencyKey()).toBe("9260b554-cc61-4487-ab0e-3a38752701f0");
    expect(remainingMinutes("2026-07-28T00:30:00.000Z", new Date("2026-07-28T00:00:01.000Z"))).toBe(
      30,
    );
    randomUUID.mockRestore();
  });

  it("describes project and membership states with text, not color", () => {
    const detail = projectDetail();
    expect(projectStatusLabel(detail)).toBe("活动项目");
    expect(membershipStatusLabel(detail.currentMembership)).toBe("项目管理员 · 活动");
    detail.currentMembership.permissionLevel = "member";
    expect(membershipStatusLabel(detail.currentMembership)).toBe("项目成员 · 活动");
  });

  it("never treats an expired or cross-project admin capability as active", () => {
    const detail = projectDetail();
    detail.adminMode = {
      id: "18d44e07-a8e0-44a6-a366-17511f92579c",
      webSessionId: "271f8e6a-650b-4b95-8f50-bb7ff99a1320",
      projectId: detail.project.id,
      membershipId: detail.currentMembership.id,
      status: "active",
      issuedAt: "2026-07-28T00:00:00.000Z",
      lastProtectedActivityAt: "2026-07-28T00:00:00.000Z",
      expiresAt: "2026-07-28T00:30:00.000Z",
      version: 1,
      actions: ["close", "perform_protected_action"],
    };
    expect(activeAdminMode(detail, new Date("2026-07-28T00:29:59.000Z"))?.id).toBe(
      "18d44e07-a8e0-44a6-a366-17511f92579c",
    );
    expect(activeAdminMode(detail, new Date("2026-07-28T00:30:00.000Z"))).toBeNull();
    detail.adminMode.projectId = "31c632bc-0b9b-4da7-b104-4134b9a6c6ea";
    expect(activeAdminMode(detail, new Date("2026-07-28T00:10:00.000Z"))).toBeNull();
  });

  it("keeps archived historical bindings removable but prevents new binding", () => {
    const role = {
      id: "77677edb-ed1e-48ca-85c2-5ec5fd0ccab3",
      projectId: "0dcbf010-3210-4bee-bac8-626f044965ed",
      sourceTemplateId: null,
      name: "Archived role",
      capability: "Historical",
      status: "archived" as const,
      version: 2,
      actions: ["copy" as const],
    };
    expect(canChangeRoleBinding(role, false)).toBe(false);
    expect(canChangeRoleBinding(role, true)).toBe(true);
    expect(canChangeRoleBinding({ ...role, status: "active" }, false, true)).toBe(true);
  });
});

function projectDetail(): ProjectDetail {
  return {
    project: {
      id: "0dcbf010-3210-4bee-bac8-626f044965ed",
      key: "GAME",
      name: "Project",
      ownerMembershipId: "e22b88d0-d0aa-46c6-ae20-c1bb190415a0",
      workspaceId: "4410983b-08e9-4aaf-a37d-799433ca2ae5",
      description: "",
      lifecycle: "active",
      completedSuccessorReopenPolicy: "deny",
      version: 1,
      actions: ["read", "archive"],
    },
    currentMembership: {
      id: "e22b88d0-d0aa-46c6-ae20-c1bb190415a0",
      projectId: "0dcbf010-3210-4bee-bac8-626f044965ed",
      userId: "18337763-706a-4775-a787-6c6d24cc6979",
      displayName: "Owner",
      permissionLevel: "admin",
      status: "active",
      introduction: "",
      roleIds: [],
      version: 1,
      actions: ["read", "request_ownership_transfer"],
    },
    adminMode: null,
  };
}
