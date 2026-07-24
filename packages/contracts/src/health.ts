import { Type, type Static } from "@sinclair/typebox";

export const HealthStatusSchema = Type.Object(
  {
    status: Type.Union([Type.Literal("ok"), Type.Literal("error")]),
    service: Type.String(),
    version: Type.String(),
    timestamp: Type.String({ format: "date-time" }),
    checks: Type.Optional(Type.Record(Type.String(), Type.Boolean())),
  },
  {
    $id: "HealthStatus",
    additionalProperties: false,
  },
);

export type HealthStatus = Static<typeof HealthStatusSchema>;
