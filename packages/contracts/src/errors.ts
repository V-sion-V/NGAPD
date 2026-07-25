import { Type, type Static } from "@sinclair/typebox";

export const ApiErrorSchema = Type.Object(
  {
    code: Type.String(),
    message: Type.String(),
    requestId: Type.String(),
    currentVersion: Type.Optional(Type.Integer({ minimum: 0 })),
    recovery: Type.Optional(Type.String()),
  },
  {
    $id: "ApiError",
    additionalProperties: false,
  },
);

export type ApiError = Static<typeof ApiErrorSchema>;

export const API_ERROR_CODES = [
  "AUTHENTICATION_REQUIRED",
  "AUTHENTICATION_FAILED",
  "ACCOUNT_INACTIVE",
  "LOGIN_NAME_TAKEN",
  "ORIGIN_NOT_ALLOWED",
  "PAIRING_NOT_FOUND",
  "PAIRING_PENDING",
  "PAIRING_EXPIRED",
  "PAIRING_DENIED",
  "PAIRING_CONSUMED",
  "PAIRING_ASSOCIATION_MISMATCH",
  "PAIRING_ATTEMPTS_EXCEEDED",
  "DEVICE_CREDENTIAL_INVALID",
  "DEVICE_REVOKED",
  "WORKSPACE_NOT_FOUND",
  "WORKSPACE_NOT_ACTIVE",
  "WORK_CYCLE_CHANGED",
  "LEASE_CONFLICT",
  "LEASE_NOT_FOUND",
  "LEASE_EXPIRED",
  "LEASE_INVALID",
  "BASE_VERSION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "MANIFEST_INVALID",
  "OBJECT_HASH_MISMATCH",
  "OBJECT_NOT_FOUND",
  "FORBIDDEN",
  "CONFLICT",
  "VALIDATION_ERROR",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
