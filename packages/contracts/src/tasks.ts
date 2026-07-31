import { Type, type Static } from "@sinclair/typebox";

import { ProjectKeySchema } from "./projects.js";
import { Sha256Schema } from "./workspaces.js";

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

export const TaskDependencyChangeRequestCollectionSchema = Type.Object(
  {
    requests: Type.Array(TaskDependencyChangeRequestSchema),
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
    nextOwnerMembershipId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    expectedTaskVersion: Type.Integer({ minimum: 1 }),
    expectedWorkspaceSyncVersion: Type.Integer({ minimum: 0 }),
    hasUncommittedClientVersion: Type.Boolean(),
    impactConfirmed: Type.Boolean(),
    confirmedTaskIds: Type.Array(Type.String({ format: "uuid" }), { uniqueItems: true }),
    expectedAffectedTaskVersions: Type.Record(
      Type.String({ format: "uuid" }),
      Type.Integer({ minimum: 1 }),
    ),
    expectedAffectedWorkspaceSyncVersions: Type.Record(
      Type.String({ format: "uuid" }),
      Type.Integer({ minimum: 0 }),
    ),
    uncommittedWorkspaceTaskIds: Type.Array(Type.String({ format: "uuid" }), {
      uniqueItems: true,
    }),
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

export const ChangeTaskFollowCommandSchema = Type.Object(
  {
    action: DependencyActionSchema,
    sourceTaskId: Type.String({ format: "uuid" }),
    targetTaskId: Type.String({ format: "uuid" }),
    impactConfirmationToken: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const AddTaskBlockerCommandSchema = Type.Object(
  {
    taskId: Type.String({ format: "uuid" }),
    expectedTaskVersion: Type.Integer({ minimum: 1 }),
    reason: Type.String({ minLength: 1, maxLength: 2_000 }),
  },
  { additionalProperties: false },
);

export const TaskLabelsSchema = Type.Array(Type.String({ minLength: 1, maxLength: 64 }), {
  maxItems: 64,
  uniqueItems: true,
});

export const TaskActionSchema = Type.Union([
  Type.Literal("read"),
  Type.Literal("update"),
  Type.Literal("change_owner"),
  Type.Literal("manage_dependency"),
  Type.Literal("manage_follow"),
  Type.Literal("manage_blocker"),
  Type.Literal("change_status"),
  Type.Literal("complete"),
  Type.Literal("reopen"),
  Type.Literal("move"),
  Type.Literal("archive"),
  Type.Literal("delete"),
  Type.Literal("comment"),
  Type.Literal("read_workspace"),
  Type.Literal("write_workspace"),
]);

export const TaskOwnerResourceSchema = Type.Object(
  {
    membershipId: Type.String({ format: "uuid" }),
    sourceTaskId: Type.String({ format: "uuid" }),
    inherited: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const TaskChildSummarySchema = Type.Object(
  {
    total: Type.Integer({ minimum: 0 }),
    done: Type.Integer({ minimum: 0 }),
    blocked: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const TaskWorkspaceStateSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    lifecycle: Type.Union([
      Type.Literal("active"),
      Type.Literal("frozen"),
      Type.Literal("archived"),
      Type.Literal("deleted"),
    ]),
    workCycle: Type.Integer({ minimum: 1 }),
    syncVersion: Type.Integer({ minimum: 0 }),
    hasActiveWriteLease: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const TaskBlockerResourceSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    reason: Type.String({ minLength: 1, maxLength: 2_000 }),
    createdByMembershipId: Type.String({ format: "uuid" }),
    resolvedByMembershipId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    resolvedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    createdAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const TaskResourceSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    projectId: Type.String({ format: "uuid" }),
    key: TaskKeySchema,
    sequence: Type.Integer({ minimum: 1 }),
    title: Type.String({ minLength: 1, maxLength: 240 }),
    content: Type.String({ maxLength: 65_536 }),
    logicalRoleId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    dueAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    labels: TaskLabelsSchema,
    displayType: TaskDisplayTypeSchema,
    parentTaskId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    explicitOwnerMembershipId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    effectiveOwner: TaskOwnerResourceSchema,
    baseStatus: TaskStatusSchema,
    effectiveStatus: TaskEffectiveStatusSchema,
    archiveLifecycle: TaskArchiveLifecycleSchema,
    archivedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    completionReady: Type.Boolean(),
    childSummary: TaskChildSummarySchema,
    graphVersion: Type.Integer({ minimum: 0 }),
    version: Type.Integer({ minimum: 1 }),
    workspace: TaskWorkspaceStateSchema,
    follows: Type.Optional(Type.Array(Type.String({ format: "uuid" }), { uniqueItems: true })),
    blockers: Type.Optional(Type.Array(TaskBlockerResourceSchema)),
    createdByMembershipId: Type.String({ format: "uuid" }),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
    actions: Type.Array(TaskActionSchema, { uniqueItems: true }),
  },
  { additionalProperties: false },
);

export const TaskListCursorSchema = Type.String({
  pattern: "^[A-Z]{2,6}-[1-9][0-9]*$",
  maxLength: 32,
});

export const TaskCollectionSchema = Type.Object(
  {
    tasks: Type.Array(TaskResourceSchema),
    nextCursor: Type.Union([TaskListCursorSchema, Type.Null()]),
    graph: SiblingTaskGraphSchema,
    dependencies: Type.Array(TaskDependencySchema),
  },
  { additionalProperties: false },
);

export const ProjectTaskParamsSchema = Type.Object(
  {
    projectKey: ProjectKeySchema,
    taskKey: TaskKeySchema,
  },
  { additionalProperties: false },
);

export const ProjectTasksParamsSchema = Type.Object(
  {
    projectKey: ProjectKeySchema,
  },
  { additionalProperties: false },
);

export const TaskListQuerySchema = Type.Object(
  {
    cursor: Type.Optional(TaskListCursorSchema),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
    parentTaskKey: Type.Optional(Type.Union([TaskKeySchema, Type.Literal("root")])),
    lifecycle: Type.Optional(
      Type.Union([Type.Literal("active"), Type.Literal("archived"), Type.Literal("all")]),
    ),
  },
  { additionalProperties: false },
);

export const TaskSearchQuerySchema = Type.Object(
  {
    query: Type.String({ minLength: 1, maxLength: 240 }),
    cursor: Type.Optional(TaskListCursorSchema),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 25 })),
    lifecycle: Type.Optional(
      Type.Union([Type.Literal("active"), Type.Literal("archived"), Type.Literal("all")]),
    ),
  },
  { additionalProperties: false },
);

export const TaskAncestorResourceSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    key: TaskKeySchema,
    title: Type.String({ minLength: 1, maxLength: 240 }),
    archiveLifecycle: TaskArchiveLifecycleSchema,
  },
  { additionalProperties: false },
);

export const TaskLocationSummarySchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    projectId: Type.String({ format: "uuid" }),
    key: TaskKeySchema,
    title: Type.String({ minLength: 1, maxLength: 240 }),
    parentTaskKey: Type.Union([TaskKeySchema, Type.Null()]),
    archiveLifecycle: TaskArchiveLifecycleSchema,
    displayType: TaskDisplayTypeSchema,
    baseStatus: TaskStatusSchema,
    effectiveStatus: TaskEffectiveStatusSchema,
  },
  { additionalProperties: false },
);

export const TaskLocationSchema = Type.Object(
  {
    task: TaskLocationSummarySchema,
    ancestors: Type.Array(TaskAncestorResourceSchema, { maxItems: 256 }),
  },
  { additionalProperties: false },
);

export const TaskSearchCollectionSchema = Type.Object(
  {
    results: Type.Array(TaskLocationSchema),
    nextCursor: Type.Union([TaskListCursorSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

export const TaskWorkspaceFileSchema = Type.Object(
  {
    path: Type.String({ minLength: 1, maxLength: 1024 }),
    size: Type.Integer({ minimum: 0 }),
    sha256: Sha256Schema,
  },
  { additionalProperties: false },
);

export const TaskWorkspaceFileCollectionSchema = Type.Object(
  {
    workspaceId: Type.String({ format: "uuid" }),
    syncVersion: Type.Integer({ minimum: 0 }),
    manifestSha256: Sha256Schema,
    files: Type.Array(TaskWorkspaceFileSchema, { maxItems: 2_000 }),
  },
  { additionalProperties: false },
);

export const TaskWorkspaceFileContentQuerySchema = Type.Object(
  {
    path: Type.String({ minLength: 1, maxLength: 1024 }),
    sha256: Type.Optional(Sha256Schema),
  },
  { additionalProperties: false },
);

export const TaskMutationHeadersSchema = Type.Object(
  {
    "idempotency-key": Type.String({ minLength: 8, maxLength: 128 }),
  },
  { additionalProperties: true },
);

export const CreateTaskRequestSchema = Type.Object(
  {
    parentTaskKey: Type.Union([TaskKeySchema, Type.Null()]),
    explicitOwnerMembershipId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    title: Type.String({ minLength: 1, maxLength: 240 }),
    content: Type.Optional(Type.String({ maxLength: 65_536 })),
    logicalRoleId: Type.Optional(Type.Union([Type.String({ format: "uuid" }), Type.Null()])),
    dueAt: Type.Optional(Type.Union([Type.String({ format: "date-time" }), Type.Null()])),
    labels: Type.Optional(TaskLabelsSchema),
    displayType: Type.Optional(TaskDisplayTypeSchema),
  },
  { additionalProperties: false },
);

export const UpdateTaskRequestSchema = Type.Object(
  {
    expectedTaskVersion: Type.Integer({ minimum: 1 }),
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 240 })),
    content: Type.Optional(Type.String({ maxLength: 65_536 })),
    logicalRoleId: Type.Optional(Type.Union([Type.String({ format: "uuid" }), Type.Null()])),
    dueAt: Type.Optional(Type.Union([Type.String({ format: "date-time" }), Type.Null()])),
    labels: Type.Optional(TaskLabelsSchema),
    displayType: Type.Optional(TaskDisplayTypeSchema),
  },
  { additionalProperties: false, minProperties: 2 },
);

export const TaskMutationResponseSchema = Type.Object(
  {
    task: TaskResourceSchema,
    idempotentReplay: Type.Boolean(),
    eventId: Type.String({ minLength: 1, maxLength: 128 }),
  },
  { additionalProperties: false },
);

export const TaskDependencyMutationResponseSchema = Type.Object(
  {
    mode: Type.Union([Type.Literal("direct"), Type.Literal("request_required")]),
    action: DependencyActionSchema,
    graphVersion: Type.Integer({ minimum: 0 }),
    requestId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    eventId: Type.String({ minLength: 1, maxLength: 128 }),
  },
  { additionalProperties: false },
);

export const TaskDeletionResponseSchema = Type.Object(
  {
    deletedTaskId: Type.String({ format: "uuid" }),
    affectedTaskIds: Type.Array(Type.String({ format: "uuid" }), { uniqueItems: true }),
    eventId: Type.String({ minLength: 1, maxLength: 128 }),
  },
  { additionalProperties: false },
);

export const TaskImpactResponseSchema = Type.Object(
  {
    impact: TaskImpactSetSchema,
    confirmationToken: Sha256Schema,
  },
  { additionalProperties: false },
);

export const ChangeTaskOwnerRequestSchema = Type.Object(
  {
    nextOwnerMembershipId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    expectedTaskVersion: Type.Integer({ minimum: 1 }),
    expectedWorkspaceSyncVersion: Type.Integer({ minimum: 0 }),
    hasUncommittedClientVersion: Type.Boolean(),
    confirmedTaskIds: Type.Array(Type.String({ format: "uuid" }), { uniqueItems: true }),
    expectedAffectedTaskVersions: Type.Record(
      Type.String({ format: "uuid" }),
      Type.Integer({ minimum: 1 }),
    ),
    expectedAffectedWorkspaceSyncVersions: Type.Record(
      Type.String({ format: "uuid" }),
      Type.Integer({ minimum: 0 }),
    ),
    uncommittedWorkspaceTaskIds: Type.Array(Type.String({ format: "uuid" }), {
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

export const ChangeTaskDependencyRequestSchema = Type.Object(
  {
    action: DependencyActionSchema,
    predecessorTaskKey: TaskKeySchema,
    successorTaskKey: TaskKeySchema,
    expectedGraphVersion: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const ResolveTaskDependencyRequestSchema = Type.Object(
  {
    decision: Type.Union([Type.Literal("accept"), Type.Literal("reject")]),
    expectedGraphVersion: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const ChangeTaskFollowRequestSchema = Type.Object(
  {
    action: DependencyActionSchema,
    targetTaskKey: TaskKeySchema,
    impactConfirmationToken: Sha256Schema,
  },
  { additionalProperties: false },
);

export const AddTaskBlockerRequestSchema = Type.Object(
  {
    expectedTaskVersion: Type.Integer({ minimum: 1 }),
    reason: Type.String({ minLength: 1, maxLength: 2_000 }),
  },
  { additionalProperties: false },
);

export const ResolveTaskBlockerRequestSchema = Type.Object(
  {
    expectedTaskVersion: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export const ChangeTaskStatusRequestSchema = Type.Object(
  {
    status: Type.Union([Type.Literal("not_started"), Type.Literal("in_progress")]),
    expectedTaskVersion: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export const CompleteTaskRequestSchema = Type.Omit(CompleteTaskCommandSchema, ["taskId"], {
  additionalProperties: false,
});

export const ReopenTaskRequestSchema = Type.Omit(ReopenTaskCommandSchema, ["taskId"], {
  additionalProperties: false,
});

export const MoveTaskRequestSchema = Type.Object(
  {
    targetParentTaskKey: Type.Union([TaskKeySchema, Type.Null()]),
    expectedTaskVersion: Type.Integer({ minimum: 1 }),
    expectedSourceGraphVersion: Type.Integer({ minimum: 0 }),
    expectedTargetGraphVersion: Type.Integer({ minimum: 0 }),
    impactConfirmationToken: Sha256Schema,
  },
  { additionalProperties: false },
);

export const ArchiveTaskRequestSchema = Type.Object(
  {
    expectedTaskVersion: Type.Integer({ minimum: 1 }),
    expectedGraphVersion: Type.Integer({ minimum: 0 }),
    impactConfirmationToken: Sha256Schema,
  },
  { additionalProperties: false },
);

export const DeleteTaskRequestSchema = Type.Object(
  {
    expectedTaskVersion: Type.Integer({ minimum: 1 }),
    expectedGraphVersion: Type.Integer({ minimum: 0 }),
    impactConfirmationToken: Sha256Schema,
    confirmTaskKey: TaskKeySchema,
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
export type TaskDependencyChangeRequestCollection = Static<
  typeof TaskDependencyChangeRequestCollectionSchema
>;
export type TaskImpactSet = Static<typeof TaskImpactSetSchema>;
export type TaskActorType = Static<typeof TaskActorTypeSchema>;
export type TaskCommandContext = Static<typeof TaskCommandContextSchema>;
export type CompleteTaskCommand = Static<typeof CompleteTaskCommandSchema>;
export type ReopenTaskCommand = Static<typeof ReopenTaskCommandSchema>;
export type ChangeTaskOwnerCommand = Static<typeof ChangeTaskOwnerCommandSchema>;
export type MoveTaskCommand = Static<typeof MoveTaskCommandSchema>;
export type ChangeTaskFollowCommand = Static<typeof ChangeTaskFollowCommandSchema>;
export type AddTaskBlockerCommand = Static<typeof AddTaskBlockerCommandSchema>;
export type TaskLabels = Static<typeof TaskLabelsSchema>;
export type TaskAction = Static<typeof TaskActionSchema>;
export type TaskOwnerResource = Static<typeof TaskOwnerResourceSchema>;
export type TaskChildSummary = Static<typeof TaskChildSummarySchema>;
export type TaskWorkspaceState = Static<typeof TaskWorkspaceStateSchema>;
export type TaskBlockerResource = Static<typeof TaskBlockerResourceSchema>;
export type TaskResource = Static<typeof TaskResourceSchema>;
export type TaskCollection = Static<typeof TaskCollectionSchema>;
export type ProjectTaskParams = Static<typeof ProjectTaskParamsSchema>;
export type ProjectTasksParams = Static<typeof ProjectTasksParamsSchema>;
export type TaskListQuery = Static<typeof TaskListQuerySchema>;
export type TaskSearchQuery = Static<typeof TaskSearchQuerySchema>;
export type TaskAncestorResource = Static<typeof TaskAncestorResourceSchema>;
export type TaskLocationSummary = Static<typeof TaskLocationSummarySchema>;
export type TaskLocation = Static<typeof TaskLocationSchema>;
export type TaskSearchCollection = Static<typeof TaskSearchCollectionSchema>;
export type TaskWorkspaceFile = Static<typeof TaskWorkspaceFileSchema>;
export type TaskWorkspaceFileCollection = Static<typeof TaskWorkspaceFileCollectionSchema>;
export type TaskWorkspaceFileContentQuery = Static<typeof TaskWorkspaceFileContentQuerySchema>;
export type CreateTaskRequest = Static<typeof CreateTaskRequestSchema>;
export type UpdateTaskRequest = Static<typeof UpdateTaskRequestSchema>;
export type TaskMutationResponse = Static<typeof TaskMutationResponseSchema>;
export type TaskDependencyMutationResponse = Static<typeof TaskDependencyMutationResponseSchema>;
export type TaskDeletionResponse = Static<typeof TaskDeletionResponseSchema>;
export type TaskImpactResponse = Static<typeof TaskImpactResponseSchema>;
export type ChangeTaskOwnerRequest = Static<typeof ChangeTaskOwnerRequestSchema>;
export type ChangeTaskDependencyRequest = Static<typeof ChangeTaskDependencyRequestSchema>;
export type ResolveTaskDependencyRequest = Static<typeof ResolveTaskDependencyRequestSchema>;
export type ChangeTaskFollowRequest = Static<typeof ChangeTaskFollowRequestSchema>;
export type AddTaskBlockerRequest = Static<typeof AddTaskBlockerRequestSchema>;
export type ResolveTaskBlockerRequest = Static<typeof ResolveTaskBlockerRequestSchema>;
export type ChangeTaskStatusRequest = Static<typeof ChangeTaskStatusRequestSchema>;
export type CompleteTaskRequest = Static<typeof CompleteTaskRequestSchema>;
export type ReopenTaskRequest = Static<typeof ReopenTaskRequestSchema>;
export type MoveTaskRequest = Static<typeof MoveTaskRequestSchema>;
export type ArchiveTaskRequest = Static<typeof ArchiveTaskRequestSchema>;
export type DeleteTaskRequest = Static<typeof DeleteTaskRequestSchema>;
