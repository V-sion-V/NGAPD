import type {
  AddTaskBlockerCommand,
  ChangeTaskOwnerCommand,
  ChangeTaskFollowCommand,
  CompleteTaskCommand,
  MoveTaskCommand,
  ReopenTaskCommand,
  TaskActorType,
  TaskCommandContext,
} from "@ngapd/contracts";
import {
  FoundationRepository,
  TaskCommentRepository,
  TaskLifecycleRepository,
  TaskProjectionRepository,
  TaskQueryRepository,
  TaskRepository,
  type Database,
  type TaskCommentRecord,
  type TaskApplicationActor,
  type TaskQueryRecord,
} from "@ngapd/database";
import type { DependencyAction } from "@ngapd/domain";

import { taskApplicationError, taskReasonCode } from "../../application-errors.js";

export interface AuthenticatedTaskActor {
  userId: string;
  actorType: TaskActorType;
}

export interface TaskApplicationContext extends TaskCommandContext {
  now: Date;
}

export class TaskApplicationService {
  private readonly tasks: TaskRepository;
  private readonly lifecycle: TaskLifecycleRepository;
  private readonly query: TaskQueryRepository;
  private readonly comments: TaskCommentRepository;
  private readonly projections: TaskProjectionRepository;
  private readonly audit: FoundationRepository;

  constructor(database: Database) {
    this.tasks = new TaskRepository(database);
    this.lifecycle = new TaskLifecycleRepository(database);
    this.query = new TaskQueryRepository(database);
    this.comments = new TaskCommentRepository(database);
    this.projections = new TaskProjectionRepository(database);
    this.audit = new FoundationRepository(database);
  }

  async createTask(
    input: {
      projectId: string;
      title: string;
      content?: string;
      logicalRoleId?: string | null;
      dueAt?: string | null;
      labels?: string[];
      displayType?: "normal" | "sprint" | "milestone";
      parentTaskId: string | null;
      explicitOwnerMembershipId: string | null;
    },
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const applicationActor = await this.requireActor(input.projectId, actor, context, {
      action: "task.create",
      targetId: input.projectId,
      targetType: "project",
    });
    const result = await this.tasks.createTask({
      projectId: input.projectId,
      actorMembershipId: applicationActor.membershipId!,
      actorType: actor.actorType,
      adminModeActive: context.adminModeActive,
      adminSessionEnteredFromExplicitUserRequest:
        context.adminSessionEnteredFromExplicitUserRequest,
      idempotencyKey: context.idempotencyKey,
      requestSha256: context.requestSha256,
      requestId: context.requestId,
      title: input.title,
      ...(input.content === undefined ? {} : { content: input.content }),
      ...(input.logicalRoleId === undefined ? {} : { logicalRoleId: input.logicalRoleId }),
      ...(input.dueAt === undefined ? {} : { dueAt: input.dueAt }),
      ...(input.labels === undefined ? {} : { labels: input.labels }),
      ...(input.displayType === undefined ? {} : { displayType: input.displayType }),
      parentTaskId: input.parentTaskId,
      explicitOwnerMembershipId: input.explicitOwnerMembershipId,
    });
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: input.projectId,
      targetId: result.ok ? result.task.id : input.projectId,
      targetType: result.ok ? "task" : "project",
      action: "task.create",
    });
  }

  async listProjectTasks(
    projectId: string,
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    await this.requireActor(projectId, actor, context, {
      action: "task.list",
      targetId: projectId,
      targetType: "project",
    });
    return this.tasks.listProjectTasks(projectId);
  }

  async changeDependency(
    input: {
      projectId: string;
      action: DependencyAction;
      predecessorTaskId: string;
      successorTaskId: string;
      expectedGraphVersion: number;
      expiresAt: Date;
    },
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const applicationActor = await this.requireActor(input.projectId, actor, context, {
      action: "task.dependency.change",
      targetId: input.predecessorTaskId,
    });
    const result = await this.tasks.changeDependency({
      action: input.action,
      predecessorTaskId: input.predecessorTaskId,
      successorTaskId: input.successorTaskId,
      actorMembershipId: applicationActor.membershipId!,
      actorType: actor.actorType,
      adminModeActive: context.adminModeActive,
      expectedGraphVersion: input.expectedGraphVersion,
      requestId: context.requestId,
      expiresAt: input.expiresAt,
    });
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: input.projectId,
      targetId: input.predecessorTaskId,
      action: "task.dependency.change",
    });
  }

  async acceptDependencyRequest(
    input: { projectId: string; changeRequestId: string; expectedGraphVersion: number },
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const applicationActor = await this.requireActor(input.projectId, actor, context, {
      action: "task.dependency.accept",
      targetId: input.changeRequestId,
      targetType: "dependency_request",
    });
    const result = await this.tasks.acceptDependencyRequest({
      requestId: input.changeRequestId,
      acceptingMembershipId: applicationActor.membershipId!,
      expectedGraphVersion: input.expectedGraphVersion,
      actorType: actor.actorType,
      now: context.now,
    });
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: input.projectId,
      targetId: input.changeRequestId,
      targetType: "dependency_request",
      action: "task.dependency.accept",
    });
  }

  async previewMoveImpact(
    input: { taskId: string; targetParentTaskId: string | null },
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const task = await this.requireTask(input.taskId, actor, context, "task.move.preview");
    await this.requireActor(task.projectId, actor, context, {
      action: "task.move.preview",
      targetId: task.id,
    });
    const result = await this.tasks.previewMoveImpact(input);
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: task.projectId,
      targetId: task.id,
      action: "task.move.preview",
    });
  }

  async moveTask(
    command: MoveTaskCommand,
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const task = await this.requireTask(command.taskId, actor, context, "task.move");
    const applicationActor = await this.requireActor(task.projectId, actor, context, {
      action: "task.move",
      targetId: task.id,
      taskVersionBefore: task.version,
    });
    const result = await this.tasks.moveTask({
      ...command,
      actorMembershipId: applicationActor.membershipId!,
      actorType: actor.actorType,
      adminModeActive: context.adminModeActive,
      adminSessionEnteredFromExplicitUserRequest:
        context.adminSessionEnteredFromExplicitUserRequest,
      requestId: context.requestId,
    });
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: task.projectId,
      targetId: task.id,
      action: "task.move",
      taskVersionBefore: task.version,
    });
  }

  async previewFollowImpact(
    input: { sourceTaskId: string; targetTaskId: string },
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const source = await this.requireTask(
      input.sourceTaskId,
      actor,
      context,
      "task.follow.preview",
    );
    await this.requireActor(source.projectId, actor, context, {
      action: "task.follow.preview",
      targetId: source.id,
    });
    const result = await this.tasks.previewFollowImpact(input);
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: source.projectId,
      targetId: source.id,
      action: "task.follow.preview",
    });
  }

  async changeFollow(
    command: ChangeTaskFollowCommand,
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const source = await this.requireTask(
      command.sourceTaskId,
      actor,
      context,
      "task.follow.change",
    );
    const applicationActor = await this.requireActor(source.projectId, actor, context, {
      action: "task.follow.change",
      targetId: source.id,
    });
    const result = await this.tasks.changeFollow({
      ...command,
      actorMembershipId: applicationActor.membershipId!,
      actorType: actor.actorType,
      adminModeActive: context.adminModeActive,
      adminSessionEnteredFromExplicitUserRequest:
        context.adminSessionEnteredFromExplicitUserRequest,
      requestId: context.requestId,
    });
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: source.projectId,
      targetId: source.id,
      action: "task.follow.change",
    });
  }

  async addBlocker(
    command: AddTaskBlockerCommand,
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const task = await this.requireTask(command.taskId, actor, context, "task.blocker.add");
    const applicationActor = await this.requireActor(task.projectId, actor, context, {
      action: "task.blocker.add",
      targetId: task.id,
      taskVersionBefore: task.version,
    });
    const result = await this.tasks.addBlocker({
      ...command,
      actorMembershipId: applicationActor.membershipId!,
      actorType: actor.actorType,
      adminModeActive: context.adminModeActive,
      adminSessionEnteredFromExplicitUserRequest:
        context.adminSessionEnteredFromExplicitUserRequest,
      requestId: context.requestId,
    });
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: task.projectId,
      targetId: task.id,
      action: "task.blocker.add",
      taskVersionBefore: task.version,
    });
  }

  async completeTask(
    command: CompleteTaskCommand,
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const task = await this.requireTask(command.taskId, actor, context, "task.complete");
    const applicationActor = await this.requireActor(task.projectId, actor, context, {
      action: "task.complete",
      targetId: task.id,
      taskVersionBefore: task.version,
    });
    const result = await this.lifecycle.completeTask({
      ...command,
      ...lifecycleActor(applicationActor, actor, context),
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey,
      requestSha256: context.requestSha256,
      now: context.now,
    });
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: task.projectId,
      targetId: task.id,
      action: "task.complete",
      taskVersionBefore: task.version,
    });
  }

  async reopenTask(
    command: ReopenTaskCommand,
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const task = await this.requireTask(command.taskId, actor, context, "task.reopen");
    const applicationActor = await this.requireActor(task.projectId, actor, context, {
      action: "task.reopen",
      targetId: task.id,
      taskVersionBefore: task.version,
    });
    const result = await this.lifecycle.reopenTask({
      ...command,
      ...lifecycleActor(applicationActor, actor, context),
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey,
      requestSha256: context.requestSha256,
      now: context.now,
    });
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: task.projectId,
      targetId: task.id,
      action: "task.reopen",
      taskVersionBefore: task.version,
    });
  }

  async changeOwner(
    command: ChangeTaskOwnerCommand,
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const task = await this.requireTask(command.taskId, actor, context, "task.owner_change");
    const applicationActor = await this.requireActor(task.projectId, actor, context, {
      action: "task.owner_change",
      targetId: task.id,
      taskVersionBefore: task.version,
    });
    const result = await this.lifecycle.changeOwner({
      ...command,
      ...lifecycleActor(applicationActor, actor, context),
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey,
      requestSha256: context.requestSha256,
      now: context.now,
    });
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: task.projectId,
      targetId: task.id,
      action: "task.owner_change",
      taskVersionBefore: task.version,
    });
  }

  async findProjectIdByKey(projectKey: string): Promise<string | undefined> {
    return this.query.findProjectIdByKey(projectKey);
  }

  async findTaskIdByKey(projectId: string, taskKey: string): Promise<string | undefined> {
    return this.query.findTaskIdByKey(projectId, taskKey);
  }

  async listTasks(
    input: {
      projectId: string;
      parentTaskId: string | null;
      lifecycle: "active" | "archived" | "all";
      afterTaskKey?: string;
      limit?: number;
    },
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const applicationActor = await this.requireActor(input.projectId, actor, context, {
      action: "task.list",
      targetId: input.projectId,
      targetType: "project",
    });
    const page = await this.query.listTasks({
      ...input,
      actorMembershipId: applicationActor.membershipId!,
      adminModeActive: context.adminModeActive,
    });
    return { ...page, tasks: page.tasks.map(mapTaskResource) };
  }

  async readTaskResource(
    input: { projectId: string; taskId: string },
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const applicationActor = await this.requireActor(input.projectId, actor, context, {
      action: "task.read",
      targetId: input.taskId,
    });
    const task = await this.query.readTask({
      ...input,
      actorMembershipId: applicationActor.membershipId!,
      adminModeActive: context.adminModeActive,
    });
    if (!task) {
      throw taskApplicationError("task_not_found");
    }
    const [follows, blockers] = await Promise.all([
      this.query.listFollows(task.id),
      this.query.listBlockers(task.id),
    ]);
    return {
      ...mapTaskResource(task),
      follows,
      blockers: blockers.map((blocker) => ({
        id: blocker.id,
        reason: blocker.reason,
        createdByMembershipId: blocker.created_by_membership_id,
        resolvedByMembershipId: blocker.resolved_by_membership_id,
        resolvedAt: blocker.resolved_at?.toISOString() ?? null,
        createdAt: blocker.created_at.toISOString(),
      })),
    };
  }

  async listDependencyChangeRequests(
    projectId: string,
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    await this.requireActor(projectId, actor, context, {
      action: "task.dependency.request.list",
      targetId: projectId,
      targetType: "project",
    });
    const requests = await this.query.listDependencyChangeRequests(projectId);
    return requests.map((request) => ({
      id: request.id,
      action: request.action,
      predecessorTaskId: request.predecessor_task_id,
      successorTaskId: request.successor_task_id,
      parentTaskId: request.parent_task_id,
      expectedGraphVersion: Number(request.expected_graph_version),
      predecessorOwnerMembershipId: request.predecessor_owner_membership_id,
      successorOwnerMembershipId: request.successor_owner_membership_id,
      requiredAcceptanceByMembershipId: request.required_acceptance_by_membership_id,
      status: request.status,
    }));
  }

  async updateTask(
    input: {
      taskId: string;
      expectedTaskVersion: number;
      fields: Partial<{
        title: string;
        content: string;
        logicalRoleId: string | null;
        dueAt: string | null;
        labels: string[];
        displayType: "normal" | "sprint" | "milestone";
      }>;
    },
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const task = await this.requireTask(input.taskId, actor, context, "task.update");
    const applicationActor = await this.requireActor(task.projectId, actor, context, {
      action: "task.update",
      targetId: task.id,
      taskVersionBefore: task.version,
    });
    const result = await this.tasks.updateTask({
      ...input,
      fields: input.fields,
      actorMembershipId: applicationActor.membershipId!,
      actorType: actor.actorType,
      adminModeActive: context.adminModeActive,
      adminSessionEnteredFromExplicitUserRequest:
        context.adminSessionEnteredFromExplicitUserRequest,
      requestId: context.requestId,
      now: context.now,
    });
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: task.projectId,
      targetId: task.id,
      action: "task.update",
      taskVersionBefore: task.version,
    });
  }

  async changeStatus(
    input: {
      taskId: string;
      expectedTaskVersion: number;
      status: "not_started" | "in_progress";
    },
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const task = await this.requireTask(input.taskId, actor, context, "task.status.change");
    const applicationActor = await this.requireActor(task.projectId, actor, context, {
      action: "task.status.change",
      targetId: task.id,
      taskVersionBefore: task.version,
    });
    const result = await this.tasks.changeStatus({
      ...input,
      actorMembershipId: applicationActor.membershipId!,
      actorType: actor.actorType,
      adminModeActive: context.adminModeActive,
      adminSessionEnteredFromExplicitUserRequest:
        context.adminSessionEnteredFromExplicitUserRequest,
      requestId: context.requestId,
      now: context.now,
    });
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: task.projectId,
      targetId: task.id,
      action: "task.status.change",
      taskVersionBefore: task.version,
    });
  }

  async resolveBlocker(
    input: {
      taskId: string;
      blockerId: string;
      expectedTaskVersion: number;
    },
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const task = await this.requireTask(input.taskId, actor, context, "task.blocker.resolve");
    const applicationActor = await this.requireActor(task.projectId, actor, context, {
      action: "task.blocker.resolve",
      targetId: task.id,
      taskVersionBefore: task.version,
    });
    const result = await this.tasks.resolveBlocker({
      ...input,
      actorMembershipId: applicationActor.membershipId!,
      actorType: actor.actorType,
      adminModeActive: context.adminModeActive,
      adminSessionEnteredFromExplicitUserRequest:
        context.adminSessionEnteredFromExplicitUserRequest,
      requestId: context.requestId,
      now: context.now,
    });
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: task.projectId,
      targetId: task.id,
      action: "task.blocker.resolve",
      taskVersionBefore: task.version,
    });
  }

  async resolveDependencyRequest(
    input: {
      projectId: string;
      changeRequestId: string;
      decision: "accept" | "reject";
      expectedGraphVersion: number;
    },
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const applicationActor = await this.requireActor(input.projectId, actor, context, {
      action: `task.dependency.${input.decision}`,
      targetId: input.changeRequestId,
      targetType: "dependency_request",
    });
    const result =
      input.decision === "accept"
        ? await this.tasks.acceptDependencyRequest({
            requestId: input.changeRequestId,
            acceptingMembershipId: applicationActor.membershipId!,
            expectedGraphVersion: input.expectedGraphVersion,
            actorType: actor.actorType,
            now: context.now,
          })
        : await this.tasks.rejectDependencyRequest({
            requestId: input.changeRequestId,
            rejectingMembershipId: applicationActor.membershipId!,
            expectedGraphVersion: input.expectedGraphVersion,
            actorType: actor.actorType,
            now: context.now,
          });
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: input.projectId,
      targetId: input.changeRequestId,
      targetType: "dependency_request",
      action: `task.dependency.${input.decision}`,
    });
  }

  async previewDestructiveImpact(
    input: {
      taskId: string;
      operation: "archive" | "delete" | "owner_change" | "cascade_reopen";
    },
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const task = await this.requireTask(
      input.taskId,
      actor,
      context,
      `task.${input.operation}.preview`,
    );
    await this.requireActor(task.projectId, actor, context, {
      action: `task.${input.operation}.preview`,
      targetId: task.id,
    });
    const result = await this.tasks.previewDestructiveImpact(input);
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: task.projectId,
      targetId: task.id,
      action: `task.${input.operation}.preview`,
    });
  }

  async archiveTask(
    input: {
      taskId: string;
      expectedTaskVersion: number;
      expectedGraphVersion: number;
      impactConfirmationToken: string;
    },
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const task = await this.requireTask(input.taskId, actor, context, "task.archive");
    const applicationActor = await this.requireActor(task.projectId, actor, context, {
      action: "task.archive",
      targetId: task.id,
      taskVersionBefore: task.version,
    });
    const result = await this.tasks.archiveTask({
      ...input,
      actorMembershipId: applicationActor.membershipId!,
      actorType: actor.actorType,
      adminModeActive: context.adminModeActive,
      adminSessionEnteredFromExplicitUserRequest:
        context.adminSessionEnteredFromExplicitUserRequest,
      requestId: context.requestId,
      now: context.now,
    });
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: task.projectId,
      targetId: task.id,
      action: "task.archive",
      taskVersionBefore: task.version,
    });
  }

  async deleteTask(
    input: {
      taskId: string;
      confirmTaskKey: string;
      expectedTaskVersion: number;
      expectedGraphVersion: number;
      impactConfirmationToken: string;
    },
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const task = await this.requireTask(input.taskId, actor, context, "task.delete");
    const applicationActor = await this.requireActor(task.projectId, actor, context, {
      action: "task.delete",
      targetId: task.id,
      taskVersionBefore: task.version,
    });
    const result = await this.tasks.deleteTask({
      ...input,
      actorMembershipId: applicationActor.membershipId!,
      actorType: actor.actorType,
      adminModeActive: context.adminModeActive,
      adminSessionEnteredFromExplicitUserRequest:
        context.adminSessionEnteredFromExplicitUserRequest,
      requestId: context.requestId,
      now: context.now,
    });
    return this.requireSuccess(result, {
      actor,
      context,
      projectId: task.projectId,
      targetId: task.id,
      action: "task.delete",
      taskVersionBefore: task.version,
    });
  }

  async listComments(
    input: { projectId: string; taskId: string; afterId?: string; limit?: number },
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const applicationActor = await this.requireActor(input.projectId, actor, context, {
      action: "task.comment.list",
      targetId: input.taskId,
    });
    const task = await this.query.readTask({
      projectId: input.projectId,
      taskId: input.taskId,
      actorMembershipId: applicationActor.membershipId!,
      adminModeActive: context.adminModeActive,
    });
    if (!task) {
      throw taskApplicationError("task_not_found");
    }
    const comments = await this.comments.list(input);
    return comments.map((comment) =>
      mapCommentResource(
        comment,
        applicationActor.membershipId!,
        context.adminModeActive,
        task.baseStatus,
      ),
    );
  }

  async mutateComment(
    input:
      | {
          operation: "create";
          projectId: string;
          taskId: string;
          expectedTaskVersion: number;
          body: string;
          attachments: Array<{ workspaceId: string; path: string; sha256?: string }>;
        }
      | {
          operation: "update";
          projectId: string;
          taskId: string;
          commentId: string;
          expectedTaskVersion: number;
          expectedCommentVersion: number;
          body: string;
          attachments: Array<{ workspaceId: string; path: string; sha256?: string }>;
        }
      | {
          operation: "delete";
          projectId: string;
          taskId: string;
          commentId: string;
          expectedTaskVersion: number;
          expectedCommentVersion: number;
        }
      | {
          operation: "hide";
          projectId: string;
          taskId: string;
          commentId: string;
          expectedCommentVersion: number;
          reason: string;
        },
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
  ) {
    const applicationActor = await this.requireActor(input.projectId, actor, context, {
      action: `task.comment.${input.operation}`,
      targetId: input.taskId,
    });
    const common = {
      projectId: input.projectId,
      taskId: input.taskId,
      actorMembershipId: applicationActor.membershipId!,
      actorType: actor.actorType,
      requestId: context.requestId,
      idempotencyKey: context.idempotencyKey,
      requestSha256: context.requestSha256,
    } as const;
    const result =
      input.operation === "create"
        ? await this.comments.create({ ...common, ...input })
        : input.operation === "update"
          ? await this.comments.update({ ...common, ...input, now: context.now })
          : input.operation === "delete"
            ? await this.comments.delete({ ...common, ...input, now: context.now })
            : await this.comments.hide({
                ...common,
                ...input,
                adminModeActive: context.adminModeActive,
                now: context.now,
              });
    const success = await this.requireSuccess(result, {
      actor,
      context,
      projectId: input.projectId,
      targetId: input.taskId,
      action: `task.comment.${input.operation}`,
    });
    const task = await this.query.readTask({
      projectId: input.projectId,
      taskId: input.taskId,
      actorMembershipId: applicationActor.membershipId!,
      adminModeActive: context.adminModeActive,
    });
    return {
      comment: mapCommentResource(
        success.comment,
        applicationActor.membershipId!,
        context.adminModeActive,
        task?.baseStatus ?? "done",
      ),
      idempotentReplay: success.idempotentReplay,
    };
  }

  async listActivity(input: {
    projectId: string;
    taskId: string;
    afterCursor?: string;
    limit?: number;
  }) {
    return this.projections.listActivity(input);
  }

  async listNotifications(userId: string, limit?: number, afterId?: string) {
    return this.projections.listNotifications({
      userId,
      ...(limit ? { limit } : {}),
      ...(afterId ? { afterId } : {}),
    });
  }

  async markNotificationRead(input: {
    userId: string;
    notificationId: string;
    expectedVersion: number;
    read: boolean;
    now: Date;
    requestId: string;
  }) {
    const result = await this.projections.markNotificationRead(input);
    if (!result.ok) {
      throw taskApplicationError(result.reason);
    }
    return result.notification;
  }

  async readNotificationPreference(userId: string, eventType: string) {
    return this.projections.readPreference(userId, eventType);
  }

  async updateNotificationPreference(input: {
    userId: string;
    eventType: string;
    enabled: boolean;
    expectedVersion: number;
    now: Date;
    requestId: string;
  }) {
    const result = await this.projections.updatePreference(input);
    if (!result.ok) {
      throw taskApplicationError(result.reason);
    }
    return result.preference;
  }

  private async requireTask(
    taskId: string,
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
    action: string,
  ) {
    const task = await this.tasks.findTask(taskId);
    if (!task) {
      await this.recordFailure({
        actor,
        context,
        projectId: null,
        targetId: taskId,
        action,
        reason: "task_not_found",
      });
      throw taskApplicationError("task_not_found");
    }
    return task;
  }

  private async requireActor(
    projectId: string,
    actor: AuthenticatedTaskActor,
    context: TaskApplicationContext,
    operation: {
      action: string;
      targetId: string;
      targetType?: string;
      taskVersionBefore?: number;
    },
  ): Promise<TaskApplicationActor> {
    const applicationActor = await this.tasks.resolveApplicationActor(projectId, actor.userId);
    if (!applicationActor) {
      await this.recordFailure({
        actor,
        context,
        projectId,
        targetId: operation.targetId,
        action: operation.action,
        reason: "project_not_found",
        ...(operation.targetType ? { targetType: operation.targetType } : {}),
        ...(operation.taskVersionBefore === undefined
          ? {}
          : { taskVersionBefore: operation.taskVersionBefore }),
      });
      throw taskApplicationError("project_not_found");
    }
    if (
      !applicationActor.userActive ||
      !applicationActor.membershipId ||
      applicationActor.membershipStatus !== "active"
    ) {
      await this.recordFailure({
        actor,
        context,
        projectId,
        targetId: operation.targetId,
        action: operation.action,
        reason: "forbidden",
        ...(operation.targetType ? { targetType: operation.targetType } : {}),
        ...(operation.taskVersionBefore === undefined
          ? {}
          : { taskVersionBefore: operation.taskVersionBefore }),
      });
      throw taskApplicationError("forbidden");
    }
    return applicationActor;
  }

  private async requireSuccess<T extends { ok: boolean; reason?: string }>(
    result: T,
    operation: {
      actor: AuthenticatedTaskActor;
      context: TaskApplicationContext;
      projectId: string;
      targetId: string;
      targetType?: string;
      action: string;
      taskVersionBefore?: number;
    },
  ): Promise<Extract<T, { ok: true }>> {
    if (result.ok) {
      return result as Extract<T, { ok: true }>;
    }
    const reason = result.reason ?? "conflict";
    await this.recordFailure({ ...operation, reason });
    throw taskApplicationError(reason);
  }

  private async recordFailure(input: {
    actor: AuthenticatedTaskActor;
    context: TaskApplicationContext;
    projectId: string | null;
    targetId: string;
    targetType?: string;
    action: string;
    reason: string;
    taskVersionBefore?: number;
  }): Promise<void> {
    await this.audit.writeAudit({
      actorUserId: input.actor.userId,
      actorType: input.actor.actorType,
      projectId: input.projectId,
      targetType: input.targetType ?? "task",
      targetId: input.targetId,
      requestId: input.context.requestId,
      action: input.action,
      result: "failure",
      reasonCode: taskReasonCode(input.reason),
      taskVersionBefore: input.taskVersionBefore ?? null,
      taskVersionAfter: null,
      metadata: {},
    });
  }
}

function lifecycleActor(
  applicationActor: TaskApplicationActor,
  actor: AuthenticatedTaskActor,
  context: TaskApplicationContext,
) {
  return {
    actorMembershipId: applicationActor.membershipId!,
    actorType: actor.actorType,
    adminModeActive: context.adminModeActive,
    adminSessionEnteredFromExplicitUserRequest: context.adminSessionEnteredFromExplicitUserRequest,
  } as const;
}

function mapTaskResource(task: TaskQueryRecord) {
  return {
    id: task.id,
    projectId: task.projectId,
    key: task.taskKey,
    sequence: task.taskSequence,
    title: task.title,
    content: task.content,
    logicalRoleId: task.logicalRoleId,
    dueAt: task.dueAt,
    labels: task.labels,
    displayType: task.displayType,
    parentTaskId: task.parentTaskId,
    explicitOwnerMembershipId: task.explicitOwnerMembershipId,
    effectiveOwner: {
      membershipId: task.effectiveOwnerMembershipId,
      sourceTaskId: task.effectiveOwnerSourceTaskId,
      inherited: task.effectiveOwnerSourceTaskId !== task.id,
    },
    baseStatus: task.baseStatus,
    effectiveStatus: task.effectiveStatus,
    archiveLifecycle: task.archived ? ("archived" as const) : ("active" as const),
    archivedAt: task.archivedAt,
    completionReady: task.completionReady,
    childSummary: task.childSummary,
    graphVersion: task.graphVersion,
    version: task.version,
    workspace: task.workspace,
    createdByMembershipId: task.createdByMembershipId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    actions: task.actions,
  };
}

function mapCommentResource(
  comment: TaskCommentRecord,
  actorMembershipId: string,
  adminModeActive: boolean,
  taskStatus: "not_started" | "in_progress" | "done",
) {
  const deleted = comment.deletedAt !== null;
  const hidden = comment.hiddenAt !== null;
  const actions: Array<"edit" | "delete" | "hide"> = [];
  if (
    !deleted &&
    !hidden &&
    taskStatus !== "done" &&
    comment.authorMembershipId === actorMembershipId
  ) {
    actions.push("edit", "delete");
  }
  if (!deleted && !hidden && adminModeActive) {
    actions.push("hide");
  }
  return {
    id: comment.id,
    projectId: comment.projectId,
    taskId: comment.taskId,
    authorMembershipId: comment.authorMembershipId,
    body: hidden ? null : comment.body,
    attachments: hidden ? [] : comment.attachments,
    version: comment.version,
    editedAt: comment.editedAt,
    deleted,
    hidden,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    actions,
  };
}
