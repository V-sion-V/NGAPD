import { Type, type Static } from "@sinclair/typebox";

import { ProjectKeySchema } from "./projects.js";
import { TaskKeySchema } from "./tasks.js";

export const TaskNotificationEventTypeSchema = Type.Union([
  Type.Literal("task.owner.changed"),
  Type.Literal("task.blocker.changed"),
  Type.Literal("task.dependency.requested"),
  Type.Literal("task.dependency.resolved"),
  Type.Literal("task.comment.created"),
  Type.Literal("task.comment.mentioned"),
  Type.Literal("task.due.reminder"),
  Type.Literal("task.completion_ready"),
  Type.Literal("task.archived"),
  Type.Literal("task.deleted"),
  Type.Literal("task.permission.result"),
]);

export const TaskNotificationResourceSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    projectId: Type.String({ format: "uuid" }),
    taskId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    projectKey: Type.Union([ProjectKeySchema, Type.Null()]),
    taskKey: Type.Union([TaskKeySchema, Type.Null()]),
    eventType: TaskNotificationEventTypeSchema,
    critical: Type.Boolean(),
    resourceRefs: Type.Record(Type.String({ maxLength: 80 }), Type.String({ maxLength: 160 })),
    read: Type.Boolean(),
    version: Type.Integer({ minimum: 1 }),
    createdAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const TaskNotificationCollectionSchema = Type.Object(
  {
    notifications: Type.Array(TaskNotificationResourceSchema),
    nextCursor: Type.Union([Type.String({ minLength: 1, maxLength: 128 }), Type.Null()]),
  },
  { additionalProperties: false },
);

export const MarkTaskNotificationReadRequestSchema = Type.Object(
  {
    read: Type.Boolean(),
    expectedVersion: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export const TaskNotificationPreferenceSchema = Type.Object(
  {
    eventType: TaskNotificationEventTypeSchema,
    enabled: Type.Boolean(),
    configurable: Type.Boolean(),
    version: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export const UpdateTaskNotificationPreferenceRequestSchema = Type.Object(
  {
    enabled: Type.Boolean(),
    expectedVersion: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export type TaskNotificationEventType = Static<typeof TaskNotificationEventTypeSchema>;
export type TaskNotificationResource = Static<typeof TaskNotificationResourceSchema>;
export type TaskNotificationCollection = Static<typeof TaskNotificationCollectionSchema>;
export type MarkTaskNotificationReadRequest = Static<typeof MarkTaskNotificationReadRequestSchema>;
export type TaskNotificationPreference = Static<typeof TaskNotificationPreferenceSchema>;
export type UpdateTaskNotificationPreferenceRequest = Static<
  typeof UpdateTaskNotificationPreferenceRequestSchema
>;
