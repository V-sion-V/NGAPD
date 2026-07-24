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
