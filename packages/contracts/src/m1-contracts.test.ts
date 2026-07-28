import { FormatRegistry } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { AdminModeResourceSchema } from "./admin-mode.js";
import { UpdateUserProfileRequestSchema, UserProfileSchema } from "./identity.js";
import {
  MembershipCollectionSchema,
  MembershipJoinRequestResourceSchema,
  ProjectMembershipResourceSchema,
} from "./memberships.js";
import { OwnershipTransferResourceSchema } from "./ownership-transfers.js";
import {
  CreateProjectRequestSchema,
  ProjectDetailSchema,
  ProjectJoinTargetSchema,
  ProjectResourceSchema,
} from "./projects.js";
import {
  ProjectLogicalRoleCollectionSchema,
  ProjectLogicalRoleResourceSchema,
  SystemLogicalRoleTemplateSchema,
} from "./roles.js";

FormatRegistry.Set("uuid", (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
);
FormatRegistry.Set("date-time", (value) => !Number.isNaN(Date.parse(value)));

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
const now = "2026-07-28T00:00:00.000Z";

describe("M1 runtime contracts", () => {
  it("keeps SessionActor-compatible identity separate from versioned profile data", () => {
    expect(
      Value.Check(UserProfileSchema, {
        userId: id("1"),
        displayName: "示例用户",
        defaultIntroduction: "团队成员",
        defaultRoleTemplateIds: ["programmer-l1", "qa-l2"],
        version: 1,
        actions: ["update"],
      }),
    ).toBe(true);
    expect(
      Value.Check(UpdateUserProfileRequestSchema, {
        displayName: "",
        defaultIntroduction: "",
        defaultRoleTemplateIds: [],
        expectedVersion: 1,
      }),
    ).toBe(false);
  });

  it("validates immutable project keys, minimum join disclosure and versioned resources", () => {
    expect(
      Value.Check(CreateProjectRequestSchema, {
        key: "GAME",
        name: "Project",
        description: "Private description",
        idempotencyKey: id("2"),
      }),
    ).toBe(true);
    expect(
      Value.Check(CreateProjectRequestSchema, {
        key: "game",
        name: "Project",
        idempotencyKey: id("2"),
      }),
    ).toBe(false);
    expect(
      Value.Check(ProjectJoinTargetSchema, {
        key: "GAME",
        name: "Project",
        acceptsJoinRequests: true,
        description: "must not leak",
      }),
    ).toBe(false);
    expect(
      Value.Check(ProjectResourceSchema, {
        id: id("3"),
        key: "GAME",
        name: "Project",
        description: "",
        ownerMembershipId: id("4"),
        workspaceId: id("5"),
        lifecycle: "active",
        completedSuccessorReopenPolicy: "deny",
        version: 1,
        actions: ["read", "archive"],
      }),
    ).toBe(true);
  });

  it("uses status and permissionLevel as the only Membership authority fields", () => {
    const membership = {
      id: id("6"),
      projectId: id("3"),
      userId: id("7"),
      displayName: "成员",
      permissionLevel: "member",
      status: "active",
      introduction: "",
      roleIds: [id("8")],
      version: 2,
      actions: ["read", "edit_self"],
    };
    expect(Value.Check(ProjectMembershipResourceSchema, membership)).toBe(true);
    expect(
      Value.Check(MembershipCollectionSchema, {
        members: [membership],
      }),
    ).toBe(true);
    expect(
      Value.Check(ProjectMembershipResourceSchema, {
        ...membership,
        active: true,
        role: "member",
      }),
    ).toBe(false);
  });

  it("validates composed project details and collection boundaries", () => {
    const membership = {
      id: id("6"),
      projectId: id("3"),
      userId: id("7"),
      displayName: "Owner",
      permissionLevel: "admin",
      status: "active",
      introduction: "",
      roleIds: [],
      version: 1,
      actions: ["read", "edit_self"],
    };
    expect(
      Value.Check(ProjectDetailSchema, {
        project: {
          id: id("3"),
          key: "GAME",
          name: "Project",
          description: "",
          ownerMembershipId: id("6"),
          workspaceId: id("5"),
          lifecycle: "active",
          completedSuccessorReopenPolicy: "deny",
          version: 1,
          actions: ["read", "archive"],
        },
        currentMembership: membership,
        adminMode: null,
      }),
    ).toBe(true);
    expect(
      Value.Check(ProjectLogicalRoleCollectionSchema, {
        roles: [],
        leakedDatabaseRow: true,
      }),
    ).toBe(false);
  });

  it("validates join, transfer and scoped Admin Mode state independently", () => {
    expect(
      Value.Check(MembershipJoinRequestResourceSchema, {
        id: id("9"),
        projectId: id("3"),
        membershipId: id("6"),
        requestedByUserId: id("7"),
        status: "pending",
        version: 1,
        createdAt: now,
        resolvedAt: null,
        actions: ["approve", "reject"],
      }),
    ).toBe(true);
    expect(
      Value.Check(OwnershipTransferResourceSchema, {
        id: id("10"),
        projectId: id("3"),
        fromOwnerMembershipId: id("4"),
        targetMembershipId: id("6"),
        status: "pending",
        version: 1,
        createdAt: now,
        resolvedAt: null,
        actions: ["accept", "reject", "cancel"],
      }),
    ).toBe(true);
    expect(
      Value.Check(AdminModeResourceSchema, {
        id: id("11"),
        webSessionId: id("12"),
        projectId: id("3"),
        membershipId: id("4"),
        status: "active",
        issuedAt: now,
        lastProtectedActivityAt: now,
        expiresAt: "2026-07-28T00:30:00.000Z",
        version: 1,
        actions: ["close", "perform_protected_action"],
      }),
    ).toBe(true);
  });

  it("keeps system templates on id/title/desc and project roles on one capability field", () => {
    expect(
      Value.Check(SystemLogicalRoleTemplateSchema, {
        id: "programmer-l1",
        title: "程序员 L1",
        desc: "在指导下实现功能。",
      }),
    ).toBe(true);
    const role = {
      id: id("8"),
      projectId: id("3"),
      sourceTemplateId: "programmer-l1",
      name: "客户端程序员",
      capability: "负责客户端实现，同时作为 Agent 提示。",
      status: "active",
      version: 1,
      actions: ["edit", "copy", "archive", "bind"],
    };
    expect(Value.Check(ProjectLogicalRoleResourceSchema, role)).toBe(true);
    expect(
      Value.Check(ProjectLogicalRoleResourceSchema, {
        ...role,
        responsibilities: "second authority",
      }),
    ).toBe(false);
  });
});
