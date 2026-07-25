import { Type, type Static } from "@sinclair/typebox";

import { DevicePlatformSchema, DeviceSummarySchema } from "./identity.js";

export const PairingStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("approved"),
  Type.Literal("denied"),
  Type.Literal("consumed"),
  Type.Literal("expired"),
  Type.Literal("revoked"),
]);

export const PairingRequestSchema = Type.Object(
  {
    deviceName: Type.String({ minLength: 1, maxLength: 120 }),
    platform: DevicePlatformSchema,
    correlationSecret: Type.String({ minLength: 32, maxLength: 256 }),
  },
  { additionalProperties: false },
);

export const PairingCreatedSchema = Type.Object(
  {
    pairingId: Type.String({ format: "uuid" }),
    code: Type.String({ pattern: "^[A-Z0-9]{8}$" }),
    verificationPath: Type.String(),
    expiresAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const PairingDecisionSchema = Type.Object(
  {
    decision: Type.Union([Type.Literal("approve"), Type.Literal("deny")]),
  },
  { additionalProperties: false },
);

export const PairingWebSummarySchema = Type.Object(
  {
    pairingId: Type.String({ format: "uuid" }),
    status: PairingStatusSchema,
    device: Type.Pick(DeviceSummarySchema, ["name", "platform"]),
    expiresAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const PairingCliStatusRequestSchema = Type.Object(
  {
    correlationSecret: Type.String({ minLength: 32, maxLength: 256 }),
  },
  { additionalProperties: false },
);

export const PairingCliStatusSchema = Type.Object(
  {
    pairingId: Type.String({ format: "uuid" }),
    status: PairingStatusSchema,
    expiresAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const PairingConsumeRequestSchema = Type.Object(
  {
    correlationSecret: Type.String({ minLength: 32, maxLength: 256 }),
  },
  { additionalProperties: false },
);

export const PairingCredentialSchema = Type.Object(
  {
    deviceId: Type.String({ format: "uuid" }),
    accessToken: Type.String(),
    deviceCredential: Type.String(),
    accessTokenExpiresAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export type PairingStatus = Static<typeof PairingStatusSchema>;
export type PairingRequest = Static<typeof PairingRequestSchema>;
export type PairingDecision = Static<typeof PairingDecisionSchema>;
export type PairingCliStatusRequest = Static<typeof PairingCliStatusRequestSchema>;
export type PairingConsumeRequest = Static<typeof PairingConsumeRequestSchema>;
