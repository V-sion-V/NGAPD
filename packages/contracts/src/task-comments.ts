import { Type, type Static } from "@sinclair/typebox";

import { Sha256Schema } from "./workspaces.js";

export const TaskCommentAttachmentSchema = Type.Object(
  {
    workspaceId: Type.String({ format: "uuid" }),
    path: Type.String({ minLength: 1, maxLength: 1_024 }),
    sha256: Type.Optional(Sha256Schema),
  },
  { additionalProperties: false },
);

export const TaskCommentActionSchema = Type.Union([
  Type.Literal("edit"),
  Type.Literal("delete"),
  Type.Literal("hide"),
]);

export const TaskCommentResourceSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    projectId: Type.String({ format: "uuid" }),
    taskId: Type.String({ format: "uuid" }),
    authorMembershipId: Type.String({ format: "uuid" }),
    body: Type.Union([Type.String({ minLength: 1, maxLength: 32_768 }), Type.Null()]),
    attachments: Type.Array(TaskCommentAttachmentSchema, { maxItems: 100 }),
    version: Type.Integer({ minimum: 1 }),
    editedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    deleted: Type.Boolean(),
    hidden: Type.Boolean(),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
    actions: Type.Array(TaskCommentActionSchema, { uniqueItems: true }),
  },
  { additionalProperties: false },
);

export const TaskCommentCollectionSchema = Type.Object(
  {
    comments: Type.Array(TaskCommentResourceSchema),
    nextCursor: Type.Union([Type.String({ minLength: 1, maxLength: 128 }), Type.Null()]),
  },
  { additionalProperties: false },
);

export const TaskCommentMutationResponseSchema = Type.Object(
  {
    comment: TaskCommentResourceSchema,
    idempotentReplay: Type.Boolean(),
    eventId: Type.String({ minLength: 1, maxLength: 128 }),
  },
  { additionalProperties: false },
);

export const CreateTaskCommentRequestSchema = Type.Object(
  {
    body: Type.String({ minLength: 1, maxLength: 32_768 }),
    attachments: Type.Optional(Type.Array(TaskCommentAttachmentSchema, { maxItems: 100 })),
    expectedTaskVersion: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export const UpdateTaskCommentRequestSchema = Type.Object(
  {
    body: Type.String({ minLength: 1, maxLength: 32_768 }),
    attachments: Type.Optional(Type.Array(TaskCommentAttachmentSchema, { maxItems: 100 })),
    expectedCommentVersion: Type.Integer({ minimum: 1 }),
    expectedTaskVersion: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export const DeleteTaskCommentRequestSchema = Type.Object(
  {
    expectedCommentVersion: Type.Integer({ minimum: 1 }),
    expectedTaskVersion: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export const HideTaskCommentRequestSchema = Type.Object(
  {
    reason: Type.String({ minLength: 1, maxLength: 2_000 }),
    expectedCommentVersion: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export const TaskActivityResourceSchema = Type.Object(
  {
    cursor: Type.String({ pattern: "^[1-9][0-9]*$" }),
    id: Type.String({ format: "uuid" }),
    projectId: Type.String({ format: "uuid" }),
    taskId: Type.String({ format: "uuid" }),
    eventType: Type.String({ minLength: 1, maxLength: 120 }),
    actorUserId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    resourceRefs: Type.Record(Type.String({ maxLength: 80 }), Type.String({ maxLength: 160 })),
    occurredAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const TaskActivityCollectionSchema = Type.Object(
  {
    activities: Type.Array(TaskActivityResourceSchema),
    nextCursor: Type.Union([Type.String({ pattern: "^[1-9][0-9]*$" }), Type.Null()]),
  },
  { additionalProperties: false },
);

export type TaskCommentAttachment = Static<typeof TaskCommentAttachmentSchema>;
export type TaskCommentAction = Static<typeof TaskCommentActionSchema>;
export type TaskCommentResource = Static<typeof TaskCommentResourceSchema>;
export type TaskCommentCollection = Static<typeof TaskCommentCollectionSchema>;
export type TaskCommentMutationResponse = Static<typeof TaskCommentMutationResponseSchema>;
export type CreateTaskCommentRequest = Static<typeof CreateTaskCommentRequestSchema>;
export type UpdateTaskCommentRequest = Static<typeof UpdateTaskCommentRequestSchema>;
export type DeleteTaskCommentRequest = Static<typeof DeleteTaskCommentRequestSchema>;
export type HideTaskCommentRequest = Static<typeof HideTaskCommentRequestSchema>;
export type TaskActivityResource = Static<typeof TaskActivityResourceSchema>;
export type TaskActivityCollection = Static<typeof TaskActivityCollectionSchema>;
