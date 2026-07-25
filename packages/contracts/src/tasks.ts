import { Type, type Static } from "@sinclair/typebox";

export const TaskStatusSchema = Type.Union([
  Type.Literal("open"),
  Type.Literal("in_progress"),
  Type.Literal("done"),
  Type.Literal("archived"),
]);

export const TaskSummarySchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    projectId: Type.String({ format: "uuid" }),
    key: Type.String(),
    title: Type.String(),
    parentTaskId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    explicitOwnerMembershipId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    workspaceId: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export type TaskStatus = Static<typeof TaskStatusSchema>;
export type TaskSummary = Static<typeof TaskSummarySchema>;
