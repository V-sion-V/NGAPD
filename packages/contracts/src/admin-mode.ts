import { Type, type Static } from "@sinclair/typebox";

export const AdminModeStatusSchema = Type.Union([
  Type.Literal("active"),
  Type.Literal("closed"),
  Type.Literal("expired"),
  Type.Literal("revoked"),
]);

export const AdminModeActionSchema = Type.Union([
  Type.Literal("close"),
  Type.Literal("perform_protected_action"),
]);

export const AdminModeResourceSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    webSessionId: Type.String({ format: "uuid" }),
    projectId: Type.String({ format: "uuid" }),
    membershipId: Type.String({ format: "uuid" }),
    status: AdminModeStatusSchema,
    issuedAt: Type.String({ format: "date-time" }),
    lastProtectedActivityAt: Type.String({ format: "date-time" }),
    expiresAt: Type.String({ format: "date-time" }),
    version: Type.Integer({ minimum: 1 }),
    actions: Type.Array(AdminModeActionSchema, { uniqueItems: true }),
  },
  { additionalProperties: false },
);

export const OpenAdminModeRequestSchema = Type.Object(
  {
    projectId: Type.String({ format: "uuid" }),
    expectedMembershipVersion: Type.Integer({ minimum: 1 }),
    idempotencyKey: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const AdminModeParamsSchema = Type.Object(
  {
    adminModeId: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const AdminModeMutationResponseSchema = Type.Object(
  {
    adminMode: AdminModeResourceSchema,
    idempotentReplay: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const CloseAdminModeRequestSchema = Type.Object(
  {
    expectedVersion: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export type AdminModeStatus = Static<typeof AdminModeStatusSchema>;
export type AdminModeAction = Static<typeof AdminModeActionSchema>;
export type AdminModeResource = Static<typeof AdminModeResourceSchema>;
export type AdminModeParams = Static<typeof AdminModeParamsSchema>;
export type AdminModeMutationResponse = Static<typeof AdminModeMutationResponseSchema>;
export type OpenAdminModeRequest = Static<typeof OpenAdminModeRequestSchema>;
export type CloseAdminModeRequest = Static<typeof CloseAdminModeRequestSchema>;
