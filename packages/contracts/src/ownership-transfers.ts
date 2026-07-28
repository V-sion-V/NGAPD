import { Type, type Static } from "@sinclair/typebox";

export const OwnershipTransferStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("accepted"),
  Type.Literal("rejected"),
  Type.Literal("cancelled"),
  Type.Literal("stale"),
]);

export const OwnershipTransferActionSchema = Type.Union([
  Type.Literal("accept"),
  Type.Literal("reject"),
  Type.Literal("cancel"),
]);

export const OwnershipTransferResourceSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    projectId: Type.String({ format: "uuid" }),
    fromOwnerMembershipId: Type.String({ format: "uuid" }),
    targetMembershipId: Type.String({ format: "uuid" }),
    status: OwnershipTransferStatusSchema,
    version: Type.Integer({ minimum: 1 }),
    createdAt: Type.String({ format: "date-time" }),
    resolvedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    actions: Type.Array(OwnershipTransferActionSchema, { uniqueItems: true }),
  },
  { additionalProperties: false },
);

export const CreateOwnershipTransferRequestSchema = Type.Object(
  {
    targetMembershipId: Type.String({ format: "uuid" }),
    expectedProjectVersion: Type.Integer({ minimum: 1 }),
    expectedTargetMembershipVersion: Type.Integer({ minimum: 1 }),
    idempotencyKey: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const OwnershipTransferParamsSchema = Type.Object(
  {
    projectKey: Type.String({ pattern: "^[A-Z]{2,6}$" }),
    transferId: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const OwnershipTransferCollectionSchema = Type.Object(
  {
    transfers: Type.Array(OwnershipTransferResourceSchema),
  },
  { additionalProperties: false },
);

export const OwnershipTransferMutationResponseSchema = Type.Object(
  {
    transfer: OwnershipTransferResourceSchema,
    idempotentReplay: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const ResolveOwnershipTransferRequestSchema = Type.Object(
  {
    action: OwnershipTransferActionSchema,
    expectedProjectVersion: Type.Integer({ minimum: 1 }),
    expectedTransferVersion: Type.Integer({ minimum: 1 }),
    idempotencyKey: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export type OwnershipTransferStatus = Static<typeof OwnershipTransferStatusSchema>;
export type OwnershipTransferAction = Static<typeof OwnershipTransferActionSchema>;
export type OwnershipTransferResource = Static<typeof OwnershipTransferResourceSchema>;
export type OwnershipTransferParams = Static<typeof OwnershipTransferParamsSchema>;
export type OwnershipTransferCollection = Static<typeof OwnershipTransferCollectionSchema>;
export type OwnershipTransferMutationResponse = Static<
  typeof OwnershipTransferMutationResponseSchema
>;
export type CreateOwnershipTransferRequest = Static<typeof CreateOwnershipTransferRequestSchema>;
export type ResolveOwnershipTransferRequest = Static<typeof ResolveOwnershipTransferRequestSchema>;
