import { Type, type Static } from "@sinclair/typebox";

export const EventCursorSchema = Type.String({
  pattern: "^(0|[1-9][0-9]*)$",
  maxLength: 20,
});

export type EventCursor = Static<typeof EventCursorSchema>;

export const ResourceInvalidationEventSchema = Type.Object(
  {
    cursor: EventCursorSchema,
    projectId: Type.String({ format: "uuid" }),
    resourceType: Type.String({ minLength: 1, maxLength: 80 }),
    resourceId: Type.String({ format: "uuid" }),
    eventType: Type.String({ minLength: 1, maxLength: 120 }),
    refetch: Type.Literal(true),
    createdAt: Type.String({ format: "date-time" }),
  },
  {
    $id: "ResourceInvalidationEvent",
    additionalProperties: false,
  },
);

export type ResourceInvalidationEvent = Static<typeof ResourceInvalidationEventSchema>;
