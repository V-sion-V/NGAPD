import { Type, type Static } from "@sinclair/typebox";

import { IntroductionSchema } from "./identity.js";

export const MembershipPermissionLevelSchema = Type.Union([
  Type.Literal("admin"),
  Type.Literal("member"),
]);

export const MembershipStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("active"),
  Type.Literal("removed"),
]);

export const MembershipActionSchema = Type.Union([
  Type.Literal("read"),
  Type.Literal("edit_self"),
  Type.Literal("edit_other"),
  Type.Literal("grant_admin"),
  Type.Literal("revoke_admin"),
  Type.Literal("remove"),
  Type.Literal("request_ownership_transfer"),
]);

export const ProjectMembershipResourceSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    projectId: Type.String({ format: "uuid" }),
    userId: Type.String({ format: "uuid" }),
    displayName: Type.String({ minLength: 1, maxLength: 80 }),
    permissionLevel: MembershipPermissionLevelSchema,
    status: MembershipStatusSchema,
    introduction: IntroductionSchema,
    roleIds: Type.Array(Type.String({ format: "uuid" }), { uniqueItems: true }),
    version: Type.Integer({ minimum: 1 }),
    actions: Type.Array(MembershipActionSchema, { uniqueItems: true }),
  },
  { additionalProperties: false },
);

export const UpdateMembershipProfileRequestSchema = Type.Object(
  {
    introduction: IntroductionSchema,
    roleIds: Type.Array(Type.String({ format: "uuid" }), { uniqueItems: true }),
    expectedVersion: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export const MembershipJoinRequestStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("approved"),
  Type.Literal("rejected"),
  Type.Literal("stale"),
]);

export const MembershipJoinRequestActionSchema = Type.Union([
  Type.Literal("approve"),
  Type.Literal("reject"),
]);

export const MembershipJoinRequestResourceSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    projectId: Type.String({ format: "uuid" }),
    membershipId: Type.String({ format: "uuid" }),
    requestedByUserId: Type.String({ format: "uuid" }),
    status: MembershipJoinRequestStatusSchema,
    version: Type.Integer({ minimum: 1 }),
    createdAt: Type.String({ format: "date-time" }),
    resolvedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    actions: Type.Array(MembershipJoinRequestActionSchema, { uniqueItems: true }),
  },
  { additionalProperties: false },
);

export const CreateMembershipJoinRequestSchema = Type.Object(
  {
    projectKey: Type.String({ pattern: "^[A-Z]{2,6}$" }),
    idempotencyKey: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const MembershipParamsSchema = Type.Object(
  {
    projectKey: Type.String({ pattern: "^[A-Z]{2,6}$" }),
    membershipId: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const JoinRequestParamsSchema = Type.Object(
  {
    projectKey: Type.String({ pattern: "^[A-Z]{2,6}$" }),
    requestId: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const MembershipCollectionSchema = Type.Object(
  {
    members: Type.Array(ProjectMembershipResourceSchema),
  },
  { additionalProperties: false },
);

export const MembershipJoinRequestItemSchema = Type.Object(
  {
    request: MembershipJoinRequestResourceSchema,
    membership: ProjectMembershipResourceSchema,
  },
  { additionalProperties: false },
);

export const MembershipJoinRequestCollectionSchema = Type.Object(
  {
    requests: Type.Array(MembershipJoinRequestItemSchema),
  },
  { additionalProperties: false },
);

export const MembershipMutationResponseSchema = Type.Object(
  {
    membership: ProjectMembershipResourceSchema,
    idempotentReplay: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const MembershipJoinRequestMutationResponseSchema = Type.Object(
  {
    ...MembershipJoinRequestItemSchema.properties,
    idempotentReplay: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const ResolveMembershipJoinRequestSchema = Type.Object(
  {
    decision: Type.Union([Type.Literal("approve"), Type.Literal("reject")]),
    expectedProjectVersion: Type.Integer({ minimum: 1 }),
    expectedMembershipVersion: Type.Integer({ minimum: 1 }),
    expectedRequestVersion: Type.Integer({ minimum: 1 }),
    idempotencyKey: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const ChangeMembershipPermissionRequestSchema = Type.Object(
  {
    permissionLevel: MembershipPermissionLevelSchema,
    expectedProjectVersion: Type.Integer({ minimum: 1 }),
    expectedMembershipVersion: Type.Integer({ minimum: 1 }),
    idempotencyKey: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const MembershipRemovalPreviewSchema = Type.Object(
  {
    membershipId: Type.String({ format: "uuid" }),
    blockingTasks: Type.Array(
      Type.Object(
        {
          id: Type.String({ format: "uuid" }),
          key: Type.String({ pattern: "^[A-Z]{2,6}-[1-9][0-9]*$" }),
        },
        { additionalProperties: false },
      ),
    ),
    canRemove: Type.Boolean(),
    projectVersion: Type.Integer({ minimum: 1 }),
    membershipVersion: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export const RemoveMembershipRequestSchema = Type.Object(
  {
    expectedProjectVersion: Type.Integer({ minimum: 1 }),
    expectedMembershipVersion: Type.Integer({ minimum: 1 }),
    confirmedBlockingTaskIds: Type.Array(Type.String({ format: "uuid" }), {
      uniqueItems: true,
    }),
    idempotencyKey: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export type MembershipPermissionLevel = Static<typeof MembershipPermissionLevelSchema>;
export type MembershipStatus = Static<typeof MembershipStatusSchema>;
export type MembershipAction = Static<typeof MembershipActionSchema>;
export type ProjectMembershipResource = Static<typeof ProjectMembershipResourceSchema>;
export type UpdateMembershipProfileRequest = Static<typeof UpdateMembershipProfileRequestSchema>;
export type MembershipJoinRequestStatus = Static<typeof MembershipJoinRequestStatusSchema>;
export type MembershipJoinRequestResource = Static<typeof MembershipJoinRequestResourceSchema>;
export type CreateMembershipJoinRequest = Static<typeof CreateMembershipJoinRequestSchema>;
export type MembershipParams = Static<typeof MembershipParamsSchema>;
export type JoinRequestParams = Static<typeof JoinRequestParamsSchema>;
export type MembershipCollection = Static<typeof MembershipCollectionSchema>;
export type MembershipJoinRequestItem = Static<typeof MembershipJoinRequestItemSchema>;
export type MembershipJoinRequestCollection = Static<typeof MembershipJoinRequestCollectionSchema>;
export type MembershipMutationResponse = Static<typeof MembershipMutationResponseSchema>;
export type MembershipJoinRequestMutationResponse = Static<
  typeof MembershipJoinRequestMutationResponseSchema
>;
export type ResolveMembershipJoinRequest = Static<typeof ResolveMembershipJoinRequestSchema>;
export type ChangeMembershipPermissionRequest = Static<
  typeof ChangeMembershipPermissionRequestSchema
>;
export type MembershipRemovalPreview = Static<typeof MembershipRemovalPreviewSchema>;
export type RemoveMembershipRequest = Static<typeof RemoveMembershipRequestSchema>;
