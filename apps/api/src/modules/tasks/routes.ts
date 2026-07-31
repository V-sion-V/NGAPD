import {
  AddTaskBlockerRequestSchema,
  ApiErrorSchema,
  ArchiveTaskRequestSchema,
  ChangeTaskDependencyRequestSchema,
  ChangeTaskFollowRequestSchema,
  ChangeTaskOwnerRequestSchema,
  ChangeTaskStatusRequestSchema,
  CompleteTaskRequestSchema,
  CreateTaskCommentRequestSchema,
  CreateTaskRequestSchema,
  DeleteTaskCommentRequestSchema,
  DeleteTaskRequestSchema,
  HideTaskCommentRequestSchema,
  MarkTaskNotificationReadRequestSchema,
  MoveTaskRequestSchema,
  ProjectTaskParamsSchema,
  ProjectTasksParamsSchema,
  ReopenTaskRequestSchema,
  ResolveTaskBlockerRequestSchema,
  ResolveTaskDependencyRequestSchema,
  TaskActivityCollectionSchema,
  TaskCollectionSchema,
  TaskCommentCollectionSchema,
  TaskCommentMutationResponseSchema,
  TaskDeletionResponseSchema,
  TaskDependencyChangeRequestCollectionSchema,
  TaskDependencyMutationResponseSchema,
  TaskImpactResponseSchema,
  TaskListQuerySchema,
  TaskLocationSchema,
  TaskMutationResponseSchema,
  TaskNotificationCollectionSchema,
  TaskNotificationEventTypeSchema,
  TaskNotificationPreferenceSchema,
  TaskNotificationResourceSchema,
  TaskResourceSchema,
  TaskSearchCollectionSchema,
  TaskSearchQuerySchema,
  TaskWorkspaceFileCollectionSchema,
  TaskWorkspaceFileContentQuerySchema,
  TaskWorkspaceStateSchema,
  UpdateTaskCommentRequestSchema,
  UpdateTaskNotificationPreferenceRequestSchema,
  UpdateTaskRequestSchema,
  type AddTaskBlockerRequest,
  type ArchiveTaskRequest,
  type ChangeTaskDependencyRequest,
  type ChangeTaskFollowRequest,
  type ChangeTaskOwnerRequest,
  type ChangeTaskStatusRequest,
  type CompleteTaskRequest,
  type CreateTaskCommentRequest,
  type CreateTaskRequest,
  type DeleteTaskCommentRequest,
  type DeleteTaskRequest,
  type HideTaskCommentRequest,
  type MarkTaskNotificationReadRequest,
  type MoveTaskRequest,
  type ProjectTaskParams,
  type ProjectTasksParams,
  type ReopenTaskRequest,
  type ResolveTaskBlockerRequest,
  type ResolveTaskDependencyRequest,
  type TaskListQuery,
  type TaskSearchQuery,
  type TaskWorkspaceFileContentQuery,
  type UpdateTaskCommentRequest,
  type UpdateTaskNotificationPreferenceRequest,
  type UpdateTaskRequest,
} from "@ngapd/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { taskApplicationError } from "../../application-errors.js";
import {
  AdminModeHeadersSchema,
  assertM1SameOrigin,
  m1ErrorResponses,
  resolveM1Request,
  type AdminModeHeaders,
  type M1RouteOptions,
} from "../authorization-audit/routes.js";
import type { AuthorizationAuditService } from "../authorization-audit/service.js";
import type { TaskApplicationContext, TaskApplicationService } from "./service.js";

interface MutationHeaders extends AdminModeHeaders {
  "idempotency-key": string;
}

interface PageQuery {
  cursor?: string;
  limit?: number;
}

const TaskMutationHeadersSchema = {
  type: "object",
  additionalProperties: true,
  required: ["idempotency-key"],
  properties: {
    ...AdminModeHeadersSchema.properties,
    "idempotency-key": { type: "string", minLength: 8, maxLength: 128 },
  },
} as const;

const IdParamsSchema = (name: string, pattern?: string) =>
  ({
    type: "object",
    additionalProperties: false,
    required: [name],
    properties: {
      [name]: pattern
        ? { type: "string", pattern, minLength: 1, maxLength: 120 }
        : { type: "string", format: "uuid" },
    },
  }) as const;

const PageQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    cursor: { type: "string", minLength: 1, maxLength: 128 },
    limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
  },
} as const;

const NotificationPreferenceParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["eventType"],
  properties: { eventType: TaskNotificationEventTypeSchema },
} as const;

const ImpactPreviewBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    targetParentTaskKey: {
      anyOf: [{ type: "string", pattern: "^[A-Z]{2,6}-[1-9][0-9]*$" }, { type: "null" }],
    },
    targetTaskKey: { type: "string", pattern: "^[A-Z]{2,6}-[1-9][0-9]*$" },
  },
} as const;

const errorResponses = { ...m1ErrorResponses, 400: ApiErrorSchema };

export async function registerTaskRoutes(
  app: FastifyInstance,
  options: M1RouteOptions & {
    service: TaskApplicationService;
    authorization: AuthorizationAuditService;
  },
): Promise<void> {
  app.get<{ Params: ProjectTasksParams; Querystring: TaskListQuery; Headers: AdminModeHeaders }>(
    "/api/v1/projects/:projectKey/tasks",
    {
      schema: {
        params: ProjectTasksParamsSchema,
        querystring: TaskListQuerySchema,
        headers: AdminModeHeadersSchema,
        response: { 200: TaskCollectionSchema, ...errorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const parentTaskId =
        request.query.parentTaskKey && request.query.parentTaskKey !== "root"
          ? await requireTaskId(options.service, resolved.projectId, request.query.parentTaskKey)
          : null;
      return options.service.listTasks(
        {
          projectId: resolved.projectId,
          parentTaskId,
          lifecycle: request.query.lifecycle ?? "active",
          ...(request.query.cursor ? { afterTaskKey: request.query.cursor } : {}),
          ...(request.query.limit ? { limit: request.query.limit } : {}),
        },
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.get<{
    Params: ProjectTasksParams;
    Querystring: TaskSearchQuery;
    Headers: AdminModeHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/search",
    {
      schema: {
        params: ProjectTasksParamsSchema,
        querystring: TaskSearchQuerySchema,
        headers: AdminModeHeadersSchema,
        response: { 200: TaskSearchCollectionSchema, ...errorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      return options.service.searchTaskLocations(
        {
          projectId: resolved.projectId,
          query: request.query.query,
          lifecycle: request.query.lifecycle ?? "active",
          ...(request.query.cursor ? { afterTaskKey: request.query.cursor } : {}),
          ...(request.query.limit ? { limit: request.query.limit } : {}),
        },
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.get<{ Params: ProjectTaskParams; Headers: AdminModeHeaders }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/ancestors",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: AdminModeHeadersSchema,
        response: { 200: TaskLocationSchema, ...errorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      return options.service.readTaskLocation(
        {
          projectId: resolved.projectId,
          taskId: await requireTaskId(options.service, resolved.projectId, request.params.taskKey),
        },
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.post<{
    Params: ProjectTasksParams;
    Body: CreateTaskRequest;
    Headers: MutationHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks",
    {
      schema: {
        params: ProjectTasksParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: CreateTaskRequestSchema,
        response: { 201: TaskMutationResponseSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const parentTaskId = request.body.parentTaskKey
        ? await requireTaskId(options.service, resolved.projectId, request.body.parentTaskKey)
        : null;
      const result = await options.service.createTask(
        {
          projectId: resolved.projectId,
          parentTaskId,
          explicitOwnerMembershipId: request.body.explicitOwnerMembershipId,
          title: request.body.title,
          ...(request.body.content === undefined ? {} : { content: request.body.content }),
          ...(request.body.logicalRoleId === undefined
            ? {}
            : { logicalRoleId: request.body.logicalRoleId }),
          ...(request.body.dueAt === undefined ? {} : { dueAt: request.body.dueAt }),
          ...(request.body.labels === undefined ? {} : { labels: request.body.labels }),
          ...(request.body.displayType === undefined
            ? {}
            : { displayType: request.body.displayType }),
        },
        resolved.actor,
        resolved.context,
      );
      const task = await options.service.readTaskResource(
        { projectId: resolved.projectId, taskId: result.task.id },
        resolved.actor,
        resolved.context,
      );
      return reply.code(201).send({
        task,
        idempotentReplay: result.idempotentReplay,
        eventId: resolved.context.requestId,
      });
    },
  );

  app.get<{ Params: ProjectTaskParams; Headers: AdminModeHeaders }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: AdminModeHeadersSchema,
        response: { 200: TaskResourceSchema, ...errorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      return options.service.readTaskResource(
        {
          projectId: resolved.projectId,
          taskId: await requireTaskId(options.service, resolved.projectId, request.params.taskKey),
        },
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.patch<{
    Params: ProjectTaskParams;
    Body: UpdateTaskRequest;
    Headers: MutationHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: UpdateTaskRequestSchema,
        response: { 200: TaskMutationResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const taskId = await requireTaskId(
        options.service,
        resolved.projectId,
        request.params.taskKey,
      );
      const { expectedTaskVersion, ...fields } = request.body;
      await options.service.updateTask(
        { taskId, expectedTaskVersion, fields },
        resolved.actor,
        resolved.context,
      );
      return mutationResponse(options.service, resolved, taskId, false);
    },
  );

  await registerOwnerRoutes(app, options);
  await registerDependencyRoutes(app, options);
  await registerFollowAndBlockerRoutes(app, options);
  await registerLifecycleRoutes(app, options);
  await registerCommentAndActivityRoutes(app, options);
  await registerNotificationRoutes(app, options);
}

async function registerOwnerRoutes(
  app: FastifyInstance,
  options: M1RouteOptions & {
    service: TaskApplicationService;
    authorization: AuthorizationAuditService;
  },
) {
  app.post<{ Params: ProjectTaskParams; Headers: AdminModeHeaders }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/owner/impact",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: AdminModeHeadersSchema,
        body: { type: "object", additionalProperties: false },
        response: { 200: TaskImpactResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      return options.service.previewDestructiveImpact(
        {
          taskId: await requireTaskId(options.service, resolved.projectId, request.params.taskKey),
          operation: "owner_change",
        },
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.post<{
    Params: ProjectTaskParams;
    Body: ChangeTaskOwnerRequest;
    Headers: MutationHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/owner",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: ChangeTaskOwnerRequestSchema,
        response: { 200: TaskMutationResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const taskId = await requireTaskId(
        options.service,
        resolved.projectId,
        request.params.taskKey,
      );
      await options.service.changeOwner(
        { taskId, ...request.body, impactConfirmed: true },
        resolved.actor,
        resolved.context,
      );
      return mutationResponse(options.service, resolved, taskId, false);
    },
  );
}

async function registerDependencyRoutes(
  app: FastifyInstance,
  options: M1RouteOptions & {
    service: TaskApplicationService;
    authorization: AuthorizationAuditService;
  },
) {
  app.get<{ Params: ProjectTasksParams; Headers: AdminModeHeaders }>(
    "/api/v1/projects/:projectKey/task-dependency-requests",
    {
      schema: {
        params: ProjectTasksParamsSchema,
        headers: AdminModeHeadersSchema,
        response: {
          200: TaskDependencyChangeRequestCollectionSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      return {
        requests: await options.service.listDependencyChangeRequests(
          resolved.projectId,
          resolved.actor,
          resolved.context,
        ),
      };
    },
  );

  app.post<{
    Params: ProjectTasksParams;
    Body: ChangeTaskDependencyRequest;
    Headers: MutationHeaders;
  }>(
    "/api/v1/projects/:projectKey/task-dependencies",
    {
      schema: {
        params: ProjectTasksParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: ChangeTaskDependencyRequestSchema,
        response: { 200: TaskDependencyMutationResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const result = await options.service.changeDependency(
        {
          projectId: resolved.projectId,
          action: request.body.action,
          predecessorTaskId: await requireTaskId(
            options.service,
            resolved.projectId,
            request.body.predecessorTaskKey,
          ),
          successorTaskId: await requireTaskId(
            options.service,
            resolved.projectId,
            request.body.successorTaskKey,
          ),
          expectedGraphVersion: request.body.expectedGraphVersion,
          expiresAt: new Date(resolved.context.now.getTime() + 24 * 60 * 60 * 1_000),
        },
        resolved.actor,
        resolved.context,
      );
      return {
        mode: result.mode,
        action: result.mode === "direct" ? result.action : request.body.action,
        graphVersion: result.graphVersion,
        requestId: result.mode === "request_required" ? result.requestId : null,
        eventId: resolved.context.requestId,
      };
    },
  );

  app.post<{
    Params: ProjectTasksParams & { changeRequestId: string };
    Body: ResolveTaskDependencyRequest;
    Headers: MutationHeaders;
  }>(
    "/api/v1/projects/:projectKey/task-dependency-requests/:changeRequestId/resolve",
    {
      schema: {
        params: {
          type: "object",
          additionalProperties: false,
          required: ["projectKey", "changeRequestId"],
          properties: {
            projectKey: { type: "string", pattern: "^[A-Z]{2,6}$" },
            changeRequestId: { type: "string", format: "uuid" },
          },
        },
        headers: TaskMutationHeadersSchema,
        body: ResolveTaskDependencyRequestSchema,
        response: { 200: TaskDependencyMutationResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const result = await options.service.resolveDependencyRequest(
        {
          projectId: resolved.projectId,
          changeRequestId: request.params.changeRequestId,
          ...request.body,
        },
        resolved.actor,
        resolved.context,
      );
      return {
        mode: result.mode,
        action: result.mode === "direct" ? result.action : "add",
        graphVersion: result.graphVersion,
        requestId: null,
        eventId: resolved.context.requestId,
      };
    },
  );
}

async function registerFollowAndBlockerRoutes(
  app: FastifyInstance,
  options: M1RouteOptions & {
    service: TaskApplicationService;
    authorization: AuthorizationAuditService;
  },
) {
  app.post<{
    Params: ProjectTaskParams;
    Body: { targetTaskKey: string };
    Headers: AdminModeHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/follows/impact",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: AdminModeHeadersSchema,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["targetTaskKey"],
          properties: {
            targetTaskKey: { type: "string", pattern: "^[A-Z]{2,6}-[1-9][0-9]*$" },
          },
        },
        response: { 200: TaskImpactResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      return options.service.previewFollowImpact(
        {
          sourceTaskId: await requireTaskId(
            options.service,
            resolved.projectId,
            request.params.taskKey,
          ),
          targetTaskId: await requireTaskId(
            options.service,
            resolved.projectId,
            request.body.targetTaskKey,
          ),
        },
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.post<{
    Params: ProjectTaskParams;
    Body: ChangeTaskFollowRequest;
    Headers: MutationHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/follows",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: ChangeTaskFollowRequestSchema,
        response: { 200: TaskMutationResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const sourceTaskId = await requireTaskId(
        options.service,
        resolved.projectId,
        request.params.taskKey,
      );
      await options.service.changeFollow(
        {
          action: request.body.action,
          sourceTaskId,
          targetTaskId: await requireTaskId(
            options.service,
            resolved.projectId,
            request.body.targetTaskKey,
          ),
          impactConfirmationToken: request.body.impactConfirmationToken,
        },
        resolved.actor,
        resolved.context,
      );
      return mutationResponse(options.service, resolved, sourceTaskId, false);
    },
  );

  app.post<{
    Params: ProjectTaskParams;
    Body: AddTaskBlockerRequest;
    Headers: MutationHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/blockers",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: AddTaskBlockerRequestSchema,
        response: { 200: TaskMutationResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const taskId = await requireTaskId(
        options.service,
        resolved.projectId,
        request.params.taskKey,
      );
      await options.service.addBlocker(
        { taskId, ...request.body },
        resolved.actor,
        resolved.context,
      );
      return mutationResponse(options.service, resolved, taskId, false);
    },
  );

  app.post<{
    Params: ProjectTaskParams & { blockerId: string };
    Body: ResolveTaskBlockerRequest;
    Headers: MutationHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/blockers/:blockerId/resolve",
    {
      schema: {
        params: {
          type: "object",
          additionalProperties: false,
          required: ["projectKey", "taskKey", "blockerId"],
          properties: {
            projectKey: { type: "string", pattern: "^[A-Z]{2,6}$" },
            taskKey: { type: "string", pattern: "^[A-Z]{2,6}-[1-9][0-9]*$" },
            blockerId: { type: "string", format: "uuid" },
          },
        },
        headers: TaskMutationHeadersSchema,
        body: ResolveTaskBlockerRequestSchema,
        response: { 200: TaskMutationResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const taskId = await requireTaskId(
        options.service,
        resolved.projectId,
        request.params.taskKey,
      );
      await options.service.resolveBlocker(
        { taskId, blockerId: request.params.blockerId, ...request.body },
        resolved.actor,
        resolved.context,
      );
      return mutationResponse(options.service, resolved, taskId, false);
    },
  );
}

async function registerLifecycleRoutes(
  app: FastifyInstance,
  options: M1RouteOptions & {
    service: TaskApplicationService;
    authorization: AuthorizationAuditService;
  },
) {
  const taskMutation = async (
    request: FastifyRequest<{
      Params: ProjectTaskParams;
      Headers: MutationHeaders;
      Body: Record<string, unknown>;
    }>,
    operation: "status" | "complete" | "reopen",
  ) => {
    assertM1SameOrigin(request, options.publicOrigin);
    const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
    const taskId = await requireTaskId(options.service, resolved.projectId, request.params.taskKey);
    if (operation === "status") {
      await options.service.changeStatus(
        { taskId, ...(request.body as ChangeTaskStatusRequest) },
        resolved.actor,
        resolved.context,
      );
    } else if (operation === "complete") {
      await options.service.completeTask(
        { taskId, ...(request.body as CompleteTaskRequest) },
        resolved.actor,
        resolved.context,
      );
    } else {
      await options.service.reopenTask(
        { taskId, ...(request.body as ReopenTaskRequest) },
        resolved.actor,
        resolved.context,
      );
    }
    return mutationResponse(options.service, resolved, taskId, false);
  };

  app.post<{
    Params: ProjectTaskParams;
    Body: ChangeTaskStatusRequest;
    Headers: MutationHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/status",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: ChangeTaskStatusRequestSchema,
        response: { 200: TaskMutationResponseSchema, ...errorResponses },
      },
    },
    (request) => taskMutation(request as never, "status"),
  );
  app.post<{ Params: ProjectTaskParams; Body: CompleteTaskRequest; Headers: MutationHeaders }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/complete",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: CompleteTaskRequestSchema,
        response: { 200: TaskMutationResponseSchema, ...errorResponses },
      },
    },
    (request) => taskMutation(request as never, "complete"),
  );
  app.post<{ Params: ProjectTaskParams; Body: ReopenTaskRequest; Headers: MutationHeaders }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/reopen",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: ReopenTaskRequestSchema,
        response: { 200: TaskMutationResponseSchema, ...errorResponses },
      },
    },
    (request) => taskMutation(request as never, "reopen"),
  );

  app.post<{
    Params: ProjectTaskParams;
    Body: { policy: "cascade" };
    Headers: AdminModeHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/reopen/impact",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: AdminModeHeadersSchema,
        body: {
          type: "object",
          additionalProperties: false,
          required: ["policy"],
          properties: { policy: { const: "cascade", type: "string" } },
        },
        response: { 200: TaskImpactResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      return options.service.previewDestructiveImpact(
        {
          taskId: await requireTaskId(options.service, resolved.projectId, request.params.taskKey),
          operation: "cascade_reopen",
        },
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.post<{
    Params: ProjectTaskParams;
    Body: { targetParentTaskKey?: string | null };
    Headers: AdminModeHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/move/impact",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: AdminModeHeadersSchema,
        body: ImpactPreviewBodySchema,
        response: { 200: TaskImpactResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      return options.service.previewMoveImpact(
        {
          taskId: await requireTaskId(options.service, resolved.projectId, request.params.taskKey),
          targetParentTaskId: request.body.targetParentTaskKey
            ? await requireTaskId(
                options.service,
                resolved.projectId,
                request.body.targetParentTaskKey,
              )
            : null,
        },
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.post<{ Params: ProjectTaskParams; Body: MoveTaskRequest; Headers: MutationHeaders }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/move",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: MoveTaskRequestSchema,
        response: { 200: TaskMutationResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const taskId = await requireTaskId(
        options.service,
        resolved.projectId,
        request.params.taskKey,
      );
      await options.service.moveTask(
        {
          taskId,
          targetParentTaskId: request.body.targetParentTaskKey
            ? await requireTaskId(
                options.service,
                resolved.projectId,
                request.body.targetParentTaskKey,
              )
            : null,
          expectedTaskVersion: request.body.expectedTaskVersion,
          expectedSourceGraphVersion: request.body.expectedSourceGraphVersion,
          expectedTargetGraphVersion: request.body.expectedTargetGraphVersion,
          impactConfirmationToken: request.body.impactConfirmationToken,
        },
        resolved.actor,
        resolved.context,
      );
      return mutationResponse(options.service, resolved, taskId, false);
    },
  );

  for (const operation of ["archive", "delete"] as const) {
    app.post<{ Params: ProjectTaskParams; Headers: AdminModeHeaders }>(
      `/api/v1/projects/:projectKey/tasks/:taskKey/${operation}/impact`,
      {
        schema: {
          params: ProjectTaskParamsSchema,
          headers: AdminModeHeadersSchema,
          body: { type: "object", additionalProperties: false },
          response: { 200: TaskImpactResponseSchema, ...errorResponses },
        },
      },
      async (request) => {
        const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
        return options.service.previewDestructiveImpact(
          {
            taskId: await requireTaskId(
              options.service,
              resolved.projectId,
              request.params.taskKey,
            ),
            operation,
          },
          resolved.actor,
          resolved.context,
        );
      },
    );
  }

  app.post<{ Params: ProjectTaskParams; Body: ArchiveTaskRequest; Headers: MutationHeaders }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/archive",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: ArchiveTaskRequestSchema,
        response: { 200: TaskMutationResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const taskId = await requireTaskId(
        options.service,
        resolved.projectId,
        request.params.taskKey,
      );
      await options.service.archiveTask(
        { taskId, ...request.body },
        resolved.actor,
        resolved.context,
      );
      return mutationResponse(options.service, resolved, taskId, false);
    },
  );

  app.delete<{ Params: ProjectTaskParams; Body: DeleteTaskRequest; Headers: MutationHeaders }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: DeleteTaskRequestSchema,
        response: { 200: TaskDeletionResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const taskId = await requireTaskId(
        options.service,
        resolved.projectId,
        request.params.taskKey,
      );
      const result = await options.service.deleteTask(
        { taskId, ...request.body },
        resolved.actor,
        resolved.context,
      );
      return {
        deletedTaskId: result.taskId,
        affectedTaskIds: result.affectedTaskIds,
        eventId: resolved.context.requestId,
      };
    },
  );

  app.get<{ Params: ProjectTaskParams; Headers: AdminModeHeaders }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/workspace",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: AdminModeHeadersSchema,
        response: { 200: TaskWorkspaceStateSchema, ...errorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const task = await options.service.readTaskResource(
        {
          projectId: resolved.projectId,
          taskId: await requireTaskId(options.service, resolved.projectId, request.params.taskKey),
        },
        resolved.actor,
        resolved.context,
      );
      return task.workspace;
    },
  );

  app.get<{ Params: ProjectTaskParams; Headers: AdminModeHeaders }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/workspace/files",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: AdminModeHeadersSchema,
        response: { 200: TaskWorkspaceFileCollectionSchema, ...errorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      return options.service.listTaskWorkspaceFiles(
        {
          projectId: resolved.projectId,
          taskId: await requireTaskId(options.service, resolved.projectId, request.params.taskKey),
        },
        resolved.actor,
        resolved.context,
      );
    },
  );

  app.get<{
    Params: ProjectTaskParams;
    Querystring: TaskWorkspaceFileContentQuery;
    Headers: AdminModeHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/workspace/files/content",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        querystring: TaskWorkspaceFileContentQuerySchema,
        headers: AdminModeHeadersSchema,
        response: {
          200: { type: "string", format: "binary" },
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const result = await options.service.readTaskWorkspaceFile(
        {
          projectId: resolved.projectId,
          taskId: await requireTaskId(options.service, resolved.projectId, request.params.taskKey),
          path: request.query.path,
          ...(request.query.sha256 ? { expectedSha256: request.query.sha256 } : {}),
        },
        resolved.actor,
        resolved.context,
      );
      return reply
        .header("cache-control", "private, no-store")
        .header("content-disposition", 'attachment; filename="workspace-file"')
        .header("x-content-type-options", "nosniff")
        .type("application/octet-stream")
        .send(Buffer.from(result.content));
    },
  );
}

async function registerCommentAndActivityRoutes(
  app: FastifyInstance,
  options: M1RouteOptions & {
    service: TaskApplicationService;
    authorization: AuthorizationAuditService;
  },
) {
  app.get<{
    Params: ProjectTaskParams;
    Querystring: PageQuery;
    Headers: AdminModeHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/comments",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        querystring: PageQuerySchema,
        headers: AdminModeHeadersSchema,
        response: { 200: TaskCommentCollectionSchema, ...errorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const comments = await options.service.listComments(
        {
          projectId: resolved.projectId,
          taskId: await requireTaskId(options.service, resolved.projectId, request.params.taskKey),
          ...(request.query.limit ? { limit: request.query.limit } : {}),
          ...(request.query.cursor ? { afterId: request.query.cursor } : {}),
        },
        resolved.actor,
        resolved.context,
      );
      return {
        comments,
        nextCursor: comments.length === (request.query.limit ?? 50) ? comments.at(-1)!.id : null,
      };
    },
  );

  app.post<{
    Params: ProjectTaskParams;
    Body: CreateTaskCommentRequest;
    Headers: MutationHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/comments",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: CreateTaskCommentRequestSchema,
        response: { 201: TaskCommentMutationResponseSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const result = await options.service.mutateComment(
        {
          operation: "create",
          projectId: resolved.projectId,
          taskId: await requireTaskId(options.service, resolved.projectId, request.params.taskKey),
          expectedTaskVersion: request.body.expectedTaskVersion,
          body: request.body.body,
          attachments: request.body.attachments ?? [],
        },
        resolved.actor,
        resolved.context,
      );
      return reply.code(201).send({ ...result, eventId: resolved.context.requestId });
    },
  );

  const commentParamsSchema = {
    type: "object",
    additionalProperties: false,
    required: ["projectKey", "taskKey", "commentId"],
    properties: {
      projectKey: { type: "string", pattern: "^[A-Z]{2,6}$" },
      taskKey: { type: "string", pattern: "^[A-Z]{2,6}-[1-9][0-9]*$" },
      commentId: { type: "string", format: "uuid" },
    },
  } as const;

  app.patch<{
    Params: ProjectTaskParams & { commentId: string };
    Body: UpdateTaskCommentRequest;
    Headers: MutationHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/comments/:commentId",
    {
      schema: {
        params: commentParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: UpdateTaskCommentRequestSchema,
        response: { 200: TaskCommentMutationResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const result = await options.service.mutateComment(
        {
          operation: "update",
          projectId: resolved.projectId,
          taskId: await requireTaskId(options.service, resolved.projectId, request.params.taskKey),
          commentId: request.params.commentId,
          ...request.body,
          attachments: request.body.attachments ?? [],
        },
        resolved.actor,
        resolved.context,
      );
      return { ...result, eventId: resolved.context.requestId };
    },
  );

  app.delete<{
    Params: ProjectTaskParams & { commentId: string };
    Body: DeleteTaskCommentRequest;
    Headers: MutationHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/comments/:commentId",
    {
      schema: {
        params: commentParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: DeleteTaskCommentRequestSchema,
        response: { 200: TaskCommentMutationResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const result = await options.service.mutateComment(
        {
          operation: "delete",
          projectId: resolved.projectId,
          taskId: await requireTaskId(options.service, resolved.projectId, request.params.taskKey),
          commentId: request.params.commentId,
          ...request.body,
        },
        resolved.actor,
        resolved.context,
      );
      return { ...result, eventId: resolved.context.requestId };
    },
  );

  app.post<{
    Params: ProjectTaskParams & { commentId: string };
    Body: HideTaskCommentRequest;
    Headers: MutationHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/comments/:commentId/hide",
    {
      schema: {
        params: commentParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: HideTaskCommentRequestSchema,
        response: { 200: TaskCommentMutationResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const result = await options.service.mutateComment(
        {
          operation: "hide",
          projectId: resolved.projectId,
          taskId: await requireTaskId(options.service, resolved.projectId, request.params.taskKey),
          commentId: request.params.commentId,
          ...request.body,
        },
        resolved.actor,
        resolved.context,
      );
      return { ...result, eventId: resolved.context.requestId };
    },
  );

  app.get<{
    Params: ProjectTaskParams;
    Querystring: PageQuery;
    Headers: AdminModeHeaders;
  }>(
    "/api/v1/projects/:projectKey/tasks/:taskKey/activity",
    {
      schema: {
        params: ProjectTaskParamsSchema,
        querystring: PageQuerySchema,
        headers: AdminModeHeadersSchema,
        response: { 200: TaskActivityCollectionSchema, ...errorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveTaskRequest(request, request.params.projectKey, options);
      const taskId = await requireTaskId(
        options.service,
        resolved.projectId,
        request.params.taskKey,
      );
      await options.service.readTaskResource(
        { projectId: resolved.projectId, taskId },
        resolved.actor,
        resolved.context,
      );
      const activities = await options.service.listActivity({
        projectId: resolved.projectId,
        taskId,
        ...(request.query.cursor ? { afterCursor: request.query.cursor } : {}),
        ...(request.query.limit ? { limit: request.query.limit } : {}),
      });
      return {
        activities: activities.map((activity) => ({
          ...activity,
          occurredAt: activity.occurredAt.toISOString(),
        })),
        nextCursor:
          activities.length === (request.query.limit ?? 50) ? activities.at(-1)!.cursor : null,
      };
    },
  );
}

async function registerNotificationRoutes(
  app: FastifyInstance,
  options: M1RouteOptions & {
    service: TaskApplicationService;
    authorization: AuthorizationAuditService;
  },
) {
  app.get<{ Querystring: PageQuery }>(
    "/api/v1/notifications",
    {
      schema: {
        querystring: PageQuerySchema,
        response: { 200: TaskNotificationCollectionSchema, ...errorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveM1Request(request, options);
      const notifications = await options.service.listNotifications(
        resolved.actor.userId,
        request.query.limit,
        request.query.cursor,
      );
      return {
        notifications: notifications.map(mapNotification),
        nextCursor:
          notifications.length === (request.query.limit ?? 50) ? notifications.at(-1)!.id : null,
      };
    },
  );

  app.post<{
    Params: { notificationId: string };
    Body: MarkTaskNotificationReadRequest;
    Headers: MutationHeaders;
  }>(
    "/api/v1/notifications/:notificationId/read",
    {
      schema: {
        params: IdParamsSchema("notificationId"),
        headers: TaskMutationHeadersSchema,
        body: MarkTaskNotificationReadRequestSchema,
        response: { 200: TaskNotificationResourceSchema, ...errorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveM1Request(request, options);
      return mapNotification(
        await options.service.markNotificationRead({
          userId: resolved.actor.userId,
          notificationId: request.params.notificationId,
          ...request.body,
          now: resolved.context.now,
          requestId: resolved.context.requestId,
        }),
      );
    },
  );

  app.get<{ Params: { eventType: string } }>(
    "/api/v1/notification-preferences/:eventType",
    {
      schema: {
        params: NotificationPreferenceParamsSchema,
        response: { 200: TaskNotificationPreferenceSchema, ...errorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveM1Request(request, options);
      return options.service.readNotificationPreference(
        resolved.actor.userId,
        request.params.eventType,
      );
    },
  );

  app.put<{
    Params: { eventType: string };
    Body: UpdateTaskNotificationPreferenceRequest;
    Headers: MutationHeaders;
  }>(
    "/api/v1/notification-preferences/:eventType",
    {
      schema: {
        params: NotificationPreferenceParamsSchema,
        headers: TaskMutationHeadersSchema,
        body: UpdateTaskNotificationPreferenceRequestSchema,
        response: { 200: TaskNotificationPreferenceSchema, ...errorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveM1Request(request, options);
      return options.service.updateNotificationPreference({
        userId: resolved.actor.userId,
        eventType: request.params.eventType,
        ...request.body,
        now: resolved.context.now,
        requestId: resolved.context.requestId,
      });
    },
  );
}

async function resolveTaskRequest(
  request: FastifyRequest,
  projectKey: string,
  options: M1RouteOptions & {
    service: TaskApplicationService;
    authorization: AuthorizationAuditService;
  },
) {
  const resolved = await resolveM1Request(request, options);
  const authorized = await options.authorization.requireMemberByProjectKey(
    projectKey,
    resolved.actor,
    resolved.context,
    {
      action: "task.route.resolve",
      targetType: "project",
      targetId: projectKey,
    },
  );
  const adminModeId = request.headers["x-ngapd-admin-mode-id"];
  const adminMode =
    typeof adminModeId === "string"
      ? await options.authorization.requireAdminMode(
          authorized,
          adminModeId,
          resolved.actor,
          resolved.context,
          {
            action: "task.route.resolve_admin",
            targetType: "project",
            targetId: authorized.project.id,
          },
        )
      : null;
  const idempotencyHeader = request.headers["idempotency-key"];
  const context: TaskApplicationContext = {
    ...resolved.context,
    idempotencyKey:
      typeof idempotencyHeader === "string"
        ? idempotencyHeader
        : `read-${resolved.context.requestId}`.slice(0, 128),
    actorType: "human",
    adminModeActive: adminMode !== null,
    adminSessionEnteredFromExplicitUserRequest: adminMode !== null,
  };
  return {
    projectId: authorized.project.id,
    actor: { userId: resolved.actor.userId, actorType: "human" as const },
    context,
  };
}

async function requireTaskId(
  service: TaskApplicationService,
  projectId: string,
  taskKey: string,
): Promise<string> {
  const taskId = await service.findTaskIdByKey(projectId, taskKey);
  if (!taskId) {
    throw taskApplicationError("task_not_found");
  }
  return taskId;
}

async function mutationResponse(
  service: TaskApplicationService,
  resolved: Awaited<ReturnType<typeof resolveTaskRequest>>,
  taskId: string,
  idempotentReplay: boolean,
) {
  return {
    task: await service.readTaskResource(
      { projectId: resolved.projectId, taskId },
      resolved.actor,
      resolved.context,
    ),
    idempotentReplay,
    eventId: resolved.context.requestId,
  };
}

function mapNotification(notification: {
  id: string;
  projectId: string;
  taskId: string | null;
  projectKey: string | null;
  taskKey: string | null;
  eventType: string;
  critical: boolean;
  resourceRefs: Record<string, string>;
  read: boolean;
  version: number;
  createdAt: Date;
}) {
  return { ...notification, createdAt: notification.createdAt.toISOString() };
}
