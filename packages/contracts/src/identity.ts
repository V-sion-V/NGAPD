import { Type, type Static } from "@sinclair/typebox";

export const LoginNameSchema = Type.String({
  minLength: 3,
  maxLength: 80,
  pattern: "^[\\p{L}\\p{N}._-]+$",
});

export const PasswordSchema = Type.String({ minLength: 12, maxLength: 256 });

export const RegisterRequestSchema = Type.Object(
  {
    loginName: LoginNameSchema,
    password: PasswordSchema,
  },
  { additionalProperties: false },
);

export const LoginRequestSchema = Type.Object(
  {
    loginName: LoginNameSchema,
    password: PasswordSchema,
  },
  { additionalProperties: false },
);

export const SessionActorSchema = Type.Object(
  {
    userId: Type.String({ format: "uuid" }),
    loginName: Type.String(),
    expiresAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const DevicePlatformSchema = Type.Union([
  Type.Literal("macos"),
  Type.Literal("windows"),
  Type.Literal("linux"),
]);

export const DeviceSummarySchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    name: Type.String({ minLength: 1, maxLength: 120 }),
    platform: DevicePlatformSchema,
    createdAt: Type.String({ format: "date-time" }),
    revokedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  },
  { additionalProperties: false },
);

export const DeviceListSchema = Type.Object(
  {
    devices: Type.Array(DeviceSummarySchema),
  },
  { additionalProperties: false },
);

export const DeviceAccessTokenRequestSchema = Type.Object(
  {
    deviceId: Type.String({ format: "uuid" }),
    deviceCredential: Type.String({ minLength: 32, maxLength: 256 }),
  },
  { additionalProperties: false },
);

export const DeviceAccessTokenSchema = Type.Object(
  {
    deviceId: Type.String({ format: "uuid" }),
    accessToken: Type.String({ minLength: 32, maxLength: 256 }),
    accessTokenExpiresAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const EmptySuccessSchema = Type.Object(
  {
    ok: Type.Literal(true),
  },
  { additionalProperties: false },
);

export type RegisterRequest = Static<typeof RegisterRequestSchema>;
export type LoginRequest = Static<typeof LoginRequestSchema>;
export type SessionActor = Static<typeof SessionActorSchema>;
export type DevicePlatform = Static<typeof DevicePlatformSchema>;
export type DeviceSummary = Static<typeof DeviceSummarySchema>;
export type DeviceAccessTokenRequest = Static<typeof DeviceAccessTokenRequestSchema>;
export type DeviceAccessToken = Static<typeof DeviceAccessTokenSchema>;
