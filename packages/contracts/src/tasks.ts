import { Type, type Static } from "@sinclair/typebox";

export const TaskStatusSchema = Type.Union([
  Type.Literal("not_started"),
  Type.Literal("in_progress"),
  Type.Literal("done"),
]);
export const TaskEffectiveStatusSchema = Type.Union([TaskStatusSchema, Type.Literal("blocked")]);
export const TaskArchiveLifecycleSchema = Type.Union([
  Type.Literal("active"),
  Type.Literal("archived"),
]);
export const TaskDisplayTypeSchema = Type.Union([
  Type.Literal("normal"),
  Type.Literal("sprint"),
  Type.Literal("milestone"),
]);
export const TaskKeySchema = Type.String({ pattern: "^[A-Z]{2,6}-[1-9][0-9]*$" });
export const DependencyActionSchema = Type.Union([Type.Literal("add"), Type.Literal("remove")]);
export const DependencyChangeRequestStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("accepted"),
  Type.Literal("rejected"),
  Type.Literal("expired"),
  Type.Literal("stale"),
]);

export const TaskSummarySchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    projectId: Type.String({ format: "uuid" }),
    key: TaskKeySchema,
    sequence: Type.Integer({ minimum: 1 }),
    title: Type.String(),
    parentTaskId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    explicitOwnerMembershipId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    baseStatus: TaskStatusSchema,
    effectiveStatus: TaskEffectiveStatusSchema,
    archiveLifecycle: TaskArchiveLifecycleSchema,
    version: Type.Integer({ minimum: 1 }),
    workspaceId: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const SiblingTaskGraphSchema = Type.Object(
  {
    projectId: Type.String({ format: "uuid" }),
    parentTaskId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    graphVersion: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const TaskDependencySchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    projectId: Type.String({ format: "uuid" }),
    parentTaskId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    predecessorTaskId: Type.String({ format: "uuid" }),
    successorTaskId: Type.String({ format: "uuid" }),
  },
  { additionalProperties: false },
);

export const TaskDependencyChangeRequestSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    action: DependencyActionSchema,
    predecessorTaskId: Type.String({ format: "uuid" }),
    successorTaskId: Type.String({ format: "uuid" }),
    parentTaskId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    expectedGraphVersion: Type.Integer({ minimum: 0 }),
    predecessorOwnerMembershipId: Type.String({ format: "uuid" }),
    successorOwnerMembershipId: Type.String({ format: "uuid" }),
    requiredAcceptanceByMembershipId: Type.String({ format: "uuid" }),
    status: DependencyChangeRequestStatusSchema,
  },
  { additionalProperties: false },
);

export const TaskImpactSetSchema = Type.Object(
  {
    operation: Type.Union([
      Type.Literal("move"),
      Type.Literal("archive"),
      Type.Literal("delete"),
      Type.Literal("owner_change"),
      Type.Literal("cascade_reopen"),
      Type.Literal("follow_change"),
    ]),
    targetTaskId: Type.String({ format: "uuid" }),
    affectedTaskIds: Type.Array(Type.String({ format: "uuid" }), { uniqueItems: true }),
    descendantTaskIds: Type.Array(Type.String({ format: "uuid" }), { uniqueItems: true }),
    dependencyIds: Type.Array(Type.String({ format: "uuid" }), { uniqueItems: true }),
    effectiveStatusTaskIds: Type.Array(Type.String({ format: "uuid" }), {
      uniqueItems: true,
    }),
    completedAncestorTaskIds: Type.Array(Type.String({ format: "uuid" }), {
      uniqueItems: true,
    }),
    workspaceLeaseIds: Type.Array(Type.String({ format: "uuid" }), { uniqueItems: true }),
    unsyncedWorkspaceTaskIds: Type.Array(Type.String({ format: "uuid" }), {
      uniqueItems: true,
    }),
    graphScopeIds: Type.Array(Type.String(), { uniqueItems: true }),
  },
  { additionalProperties: false },
);

export const TaskActorTypeSchema = Type.Union([Type.Literal("human"), Type.Literal("agent")]);

export const TaskCommandContextSchema = Type.Object(
  {
    requestId: Type.String({ minLength: 1, maxLength: 128 }),
    idempotencyKey: Type.String({ minLength: 1, maxLength: 180 }),
    requestSha256: Type.String({ pattern: "^[0-9a-f]{64}$" }),
    actorType: TaskActorTypeSchema,
    adminModeActive: Type.Boolean(),
    adminSessionEnteredFromExplicitUserRequest: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const CompleteTaskCommandSchema = Type.Object(
  {
    taskId: Type.String({ format: "uuid" }),
    expectedTaskVersion: Type.Integer({ minimum: 1 }),
    expectedGraphVersion: Type.Integer({ minimum: 0 }),
    expectedWorkspaceSyncVersion: Type.Integer({ minimum: 0 }),
    finalServerVersionReceived: Type.Boolean(),
    hasUncommittedClientVersion: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const ReopenTaskCommandSchema = Type.Object(
  {
    taskId: Type.String({ format: "uuid" }),
    policy: Type.Union([Type.Literal("deny"), Type.Literal("cascade")]),
    expectedTaskVersions: Type.Record(
      Type.String({ format: "uuid" }),
      Type.Integer({ minimum: 1 }),
    ),
    expectedOwnerMembershipIds: Type.Record(
      Type.String({ format: "uuid" }),
      Type.String({ format: "uuid" }),
    ),
    confirmedTaskIds: Type.Array(Type.String({ format: "uuid" }), { uniqueItems: true }),
  },
  { additionalProperties: false },
);

export const ChangeTaskOwnerCommandSchema = Type.Object(
  {
    taskId: Type.String({ format: "uuid" }),
    nextOwnerMembershipId: Type.String({ format: "uuid" }),
    expectedTaskVersion: Type.Integer({ minimum: 1 }),
    expectedWorkspaceSyncVersion: Type.Integer({ minimum: 0 }),
    hasUncommittedClientVersion: Type.Boolean(),
    impactConfirmed: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const MoveTaskCommandSchema = Type.Object(
  {
    taskId: Type.String({ format: "uuid" }),
    targetParentTaskId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    expectedTaskVersion: Type.Integer({ minimum: 1 }),
    expectedSourceGraphVersion: Type.Integer({ minimum: 0 }),
    expectedTargetGraphVersion: Type.Integer({ minimum: 0 }),
    impactConfirmationToken: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export type TaskStatus = Static<typeof TaskStatusSchema>;
export type TaskEffectiveStatus = Static<typeof TaskEffectiveStatusSchema>;
export type TaskArchiveLifecycle = Static<typeof TaskArchiveLifecycleSchema>;
export type TaskDisplayType = Static<typeof TaskDisplayTypeSchema>;
export type TaskKey = Static<typeof TaskKeySchema>;
export type DependencyAction = Static<typeof DependencyActionSchema>;
export type DependencyChangeRequestStatus = Static<typeof DependencyChangeRequestStatusSchema>;
export type TaskSummary = Static<typeof TaskSummarySchema>;
export type SiblingTaskGraph = Static<typeof SiblingTaskGraphSchema>;
export type TaskDependency = Static<typeof TaskDependencySchema>;
export type TaskDependencyChangeRequest = Static<typeof TaskDependencyChangeRequestSchema>;
export type TaskImpactSet = Static<typeof TaskImpactSetSchema>;
export type TaskActorType = Static<typeof TaskActorTypeSchema>;
export type TaskCommandContext = Static<typeof TaskCommandContextSchema>;
export type CompleteTaskCommand = Static<typeof CompleteTaskCommandSchema>;
export type ReopenTaskCommand = Static<typeof ReopenTaskCommandSchema>;
export type ChangeTaskOwnerCommand = Static<typeof ChangeTaskOwnerCommandSchema>;
export type MoveTaskCommand = Static<typeof MoveTaskCommandSchema>;
