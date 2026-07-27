import type {
  ChangeTaskOwnerCommand,
  CompleteTaskCommand,
  MoveTaskCommand,
  ReopenTaskCommand,
  TaskActorType,
  TaskCommandContext,
} from "@ngapd/contracts";
import {
  FoundationRepository,
  TaskLifecycleRepository,
  TaskRepository,
  type Database,
  type TaskApplicationActor,
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
  private readonly audit: FoundationRepository;

  constructor(database: Database) {
    this.tasks = new TaskRepository(database);
    this.lifecycle = new TaskLifecycleRepository(database);
    this.audit = new FoundationRepository(database);
  }

  async createTask(
    input: {
      projectId: string;
      title: string;
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
    input: { projectId: string; changeRequestId: string },
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
      !applicationActor.membershipActive
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
