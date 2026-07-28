import { Type, type Static } from "@sinclair/typebox";

import { AdminModeResourceSchema } from "./admin-mode.js";
import { MembershipPermissionLevelSchema } from "./memberships.js";
import { ProjectMembershipResourceSchema } from "./memberships.js";

/**
 * Kept as a source-compatible export for M0 consumers. New M1 code must use
 * MembershipPermissionLevelSchema and the permissionLevel field.
 */
export const MembershipRoleSchema = MembershipPermissionLevelSchema;
export const ProjectKeySchema = Type.String({ pattern: "^[A-Z]{2,6}$" });
export const ProjectNameSchema = Type.String({ minLength: 1, maxLength: 160 });
export const ProjectDescriptionSchema = Type.String({ maxLength: 8_000 });
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
    name: ProjectNameSchema,
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

export const ProjectActionSchema = Type.Union([
  Type.Literal("read"),
  Type.Literal("update"),
  Type.Literal("archive"),
  Type.Literal("unarchive"),
  Type.Literal("request_join"),
  Type.Literal("review_join_request"),
  Type.Literal("manage_admins"),
  Type.Literal("remove_member"),
  Type.Literal("transfer_ownership"),
  Type.Literal("manage_roles"),
]);

export const ProjectResourceSchema = Type.Object(
  {
    ...ProjectSummarySchema.properties,
    description: ProjectDescriptionSchema,
    lifecycle: ProjectLifecycleSchema,
    completedSuccessorReopenPolicy: CompletedSuccessorReopenPolicySchema,
    version: Type.Integer({ minimum: 1 }),
    actions: Type.Array(ProjectActionSchema, { uniqueItems: true }),
  },
  { additionalProperties: false },
);

export const ProjectJoinTargetSchema = Type.Object(
  {
    key: ProjectKeySchema,
    name: ProjectNameSchema,
    acceptsJoinRequests: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const ProjectKeyParamsSchema = Type.Object(
  {
    projectKey: ProjectKeySchema,
  },
  { additionalProperties: false },
);

export const ProjectCollectionSchema = Type.Object(
  {
    projects: Type.Array(ProjectResourceSchema),
  },
  { additionalProperties: false },
);

export const ProjectDetailSchema = Type.Object(
  {
    project: ProjectResourceSchema,
    currentMembership: ProjectMembershipResourceSchema,
    adminMode: Type.Union([AdminModeResourceSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

export const ProjectMutationResponseSchema = Type.Object(
  {
    project: ProjectResourceSchema,
    idempotentReplay: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const CreateProjectRequestSchema = Type.Object(
  {
    key: ProjectKeySchema,
    name: ProjectNameSchema,
    description: Type.Optional(ProjectDescriptionSchema),
    completedSuccessorReopenPolicy: Type.Optional(CompletedSuccessorReopenPolicySchema),
    idempotencyKey: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const ChangeProjectLifecycleRequestSchema = Type.Object(
  {
    expectedVersion: Type.Integer({ minimum: 1 }),
    lifecycle: ProjectLifecycleSchema,
    idempotencyKey: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export type MembershipRole = Static<typeof MembershipRoleSchema>;
export type ProjectKey = Static<typeof ProjectKeySchema>;
export type ProjectLifecycle = Static<typeof ProjectLifecycleSchema>;
export type CompletedSuccessorReopenPolicy = Static<typeof CompletedSuccessorReopenPolicySchema>;
export type ProjectSummary = Static<typeof ProjectSummarySchema>;
export type ProjectDomainState = Static<typeof ProjectDomainStateSchema>;
export type ProjectAction = Static<typeof ProjectActionSchema>;
export type ProjectResource = Static<typeof ProjectResourceSchema>;
export type ProjectJoinTarget = Static<typeof ProjectJoinTargetSchema>;
export type ProjectKeyParams = Static<typeof ProjectKeyParamsSchema>;
export type ProjectCollection = Static<typeof ProjectCollectionSchema>;
export type ProjectDetail = Static<typeof ProjectDetailSchema>;
export type ProjectMutationResponse = Static<typeof ProjectMutationResponseSchema>;
export type CreateProjectRequest = Static<typeof CreateProjectRequestSchema>;
export type ChangeProjectLifecycleRequest = Static<typeof ChangeProjectLifecycleRequestSchema>;
