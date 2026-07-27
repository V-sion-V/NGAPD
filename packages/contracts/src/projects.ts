import { Type, type Static } from "@sinclair/typebox";

export const MembershipRoleSchema = Type.Union([Type.Literal("admin"), Type.Literal("member")]);
export const ProjectKeySchema = Type.String({ pattern: "^[A-Z]{2,6}$" });
export const ProjectLifecycleSchema = Type.Union([
  Type.Literal("active"),
  Type.Literal("archived"),
]);
export const CompletedSuccessorReopenPolicySchema = Type.Union([
  Type.Literal("deny"),
  Type.Literal("cascade"),
]);

export const ProjectSummarySchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    key: ProjectKeySchema,
    name: Type.String({ minLength: 1, maxLength: 160 }),
    ownerMembershipId: Type.String({ format: "uuid" }),
    workspaceId: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const ProjectDomainStateSchema = Type.Object(
  {
    ...ProjectSummarySchema.properties,
    taskSequence: Type.Integer({ minimum: 0 }),
    lifecycle: ProjectLifecycleSchema,
    completedSuccessorReopenPolicy: CompletedSuccessorReopenPolicySchema,
    recoveryEpoch: Type.Integer({ minimum: 0 }),
    version: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export type MembershipRole = Static<typeof MembershipRoleSchema>;
export type ProjectKey = Static<typeof ProjectKeySchema>;
export type ProjectLifecycle = Static<typeof ProjectLifecycleSchema>;
export type CompletedSuccessorReopenPolicy = Static<typeof CompletedSuccessorReopenPolicySchema>;
export type ProjectSummary = Static<typeof ProjectSummarySchema>;
export type ProjectDomainState = Static<typeof ProjectDomainStateSchema>;
