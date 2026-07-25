import { Type, type Static } from "@sinclair/typebox";

export const MembershipRoleSchema = Type.Union([Type.Literal("admin"), Type.Literal("member")]);

export const ProjectSummarySchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    key: Type.String({ pattern: "^[A-Z][A-Z0-9]{1,15}$" }),
    name: Type.String({ minLength: 1, maxLength: 160 }),
    ownerMembershipId: Type.String({ format: "uuid" }),
    workspaceId: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export type MembershipRole = Static<typeof MembershipRoleSchema>;
export type ProjectSummary = Static<typeof ProjectSummarySchema>;
