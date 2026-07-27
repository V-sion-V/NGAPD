import { randomUUID } from "node:crypto";

import {
  evaluateTaskCompletion,
  evaluateTaskReopen,
  planTaskWorkspaceCompletion,
  planTaskWorkspaceOwnerChange,
  planTaskWorkspaceReopen,
  resolveEffectiveTaskOwner,
  resolveTaskOperationAuthorization,
  type OwnershipMembership,
  type ReopenPolicy,
  type TaskLifecycleNode,
  type TaskOwnershipNode,
} from "@ngapd/domain";
import type { Kysely, Transaction } from "kysely";

import type { DatabaseSchema } from "./types.js";

export type TaskLifecycleFailurePoint =
  | "after_validation"
  | "after_task"
  | "after_snapshot"
  | "after_workspace"
  | "after_lease"
  | "after_audit"
  | "after_outbox";

export type TaskLifecycleFailureInjector = (
  point: TaskLifecycleFailurePoint,
) => void | Promise<void>;

export type CompletionResult =
  | {
      ok: true;
      taskId: string;
      taskVersion: number;
      workspaceId: string;
      workspaceSyncVersion: number;
      idempotentReplay: boolean;
    }
  | {
      ok: false;
      reason:
        | "task_not_found"
        | "task_archived"
        | "task_already_done"
        | "owner_unresolved"
        | "child_incomplete"
        | "predecessor_incomplete"
        | "manual_blocker_active"
        | "forbidden"
        | "task_version_conflict"
        | "graph_version_conflict"
        | "workspace_version_conflict"
        | "workspace_not_finalized"
        | "workspace_not_active"
        | "workspace_not_frozen"
        | "workspace_has_uncommitted_client_version"
        | "idempotency_conflict";
    };

type CompletionFailureReason = Extract<CompletionResult, { ok: false }>["reason"];

export type ReopenResult =
  | {
      ok: true;
      taskIds: string[];
      idempotentReplay: boolean;
    }
  | {
      ok: false;
      reason:
        | "task_not_found"
        | "task_not_done"
        | "completed_ancestor_exists"
        | "completed_successor_exists"
        | "admin_mode_required"
        | "impact_confirmation_stale"
        | "task_version_conflict"
        | "workspace_state_missing"
        | "forbidden"
        | "idempotency_conflict";
      taskIds: string[];
    };

export type OwnerChangeResult =
  | {
      ok: true;
      taskId: string;
      taskVersion: number;
      ownerMembershipId: string;
      idempotentReplay: boolean;
    }
  | {
      ok: false;
      reason:
        | "task_not_found"
        | "completed_task_frozen"
        | "owner_invalid"
        | "forbidden"
        | "task_version_conflict"
        | "workspace_version_conflict"
        | "workspace_not_active"
        | "workspace_not_frozen"
        | "workspace_has_uncommitted_client_version"
        | "idempotency_conflict";
    };

interface LifecycleActorInput {
  actorMembershipId: string;
  actorType: "human" | "agent";
  adminModeActive: boolean;
  adminSessionEnteredFromExplicitUserRequest: boolean;
}

interface LifecycleTaskRow {
  id: string;
  project_id: string;
  title: string;
  body: string;
  parent_task_id: string | null;
  parent_graph_scope_id: string;
  explicit_owner_membership_id: string | null;
  base_status: "not_started" | "in_progress" | "done";
  archived: boolean;
  version: string;
  frozen: boolean;
}

interface LifecycleFacts {
  projectOwnerMembershipId: string;
  tasks: LifecycleTaskRow[];
  memberships: Array<{
    id: string;
    projectId: string;
    userId: string;
    role: "admin" | "member";
    active: boolean;
    userActive: boolean;
  }>;
  dependencies: Array<{
    predecessorTaskId: string;
    successorTaskId: string;
  }>;
  ownerByTaskId: Map<string, string>;
}

export class TaskLifecycleRepository {
  constructor(
    private readonly database: Kysely<DatabaseSchema>,
    private readonly injectFailure?: TaskLifecycleFailureInjector,
  ) {}

  async completeTask(
    input: LifecycleActorInput & {
      taskId: string;
      expectedTaskVersion: number;
      expectedGraphVersion: number;
      expectedWorkspaceSyncVersion: number;
      finalServerVersionReceived: boolean;
      hasUncommittedClientVersion: boolean;
      requestId: string;
      idempotencyKey: string;
      requestSha256: string;
      now: Date;
    },
  ): Promise<CompletionResult> {
    let auditContext: { projectId: string; actorUserId: string; taskVersion: number } | undefined;
    try {
      return await this.database.transaction().execute(async (transaction) => {
        const task = await transaction
          .selectFrom("tasks")
          .select([
            "id",
            "project_id",
            "title",
            "body",
            "parent_task_id",
            "parent_graph_scope_id",
            "explicit_owner_membership_id",
            "base_status",
            "archived",
            "version",
            "frozen",
          ])
          .where("id", "=", input.taskId)
          .forUpdate()
          .executeTakeFirst();
        if (!task) {
          return { ok: false, reason: "task_not_found" };
        }
        const actor = await loadLifecycleActor(
          transaction,
          task.project_id,
          input.actorMembershipId,
        );
        if (actor) {
          auditContext = {
            projectId: task.project_id,
            actorUserId: actor.userId,
            taskVersion: Number(task.version),
          };
        }
        const replay = await readLifecycleReplay(transaction, {
          projectId: task.project_id,
          actorMembershipId: input.actorMembershipId,
          operation: "task_complete",
          idempotencyKey: input.idempotencyKey,
          requestSha256: input.requestSha256,
        });
        if (replay.status === "conflict") {
          return { ok: false, reason: "idempotency_conflict" };
        }
        if (replay.status === "replay") {
          return {
            ok: true,
            taskId: input.taskId,
            taskVersion: numberField(replay.response.taskVersion),
            workspaceId: stringField(replay.response.workspaceId),
            workspaceSyncVersion: numberField(replay.response.workspaceSyncVersion),
            idempotentReplay: true,
          };
        }

        const childScope = await transaction
          .selectFrom("sibling_task_graph_scopes")
          .select("id")
          .where("parent_task_id", "=", task.id)
          .executeTakeFirstOrThrow();
        for (const scopeId of [task.parent_graph_scope_id, childScope.id].sort()) {
          await transaction
            .selectFrom("sibling_task_graph_scopes")
            .select("id")
            .where("id", "=", scopeId)
            .forUpdate()
            .executeTakeFirstOrThrow();
        }
        const graphScope = await transaction
          .selectFrom("sibling_task_graph_scopes")
          .select("graph_version")
          .where("id", "=", task.parent_graph_scope_id)
          .executeTakeFirstOrThrow();
        const workspace = await lockTaskWorkspace(transaction, task.id);
        if (!workspace) {
          throw new Error("TASK_WORKSPACE_MISSING");
        }
        const activeLease = await transaction
          .selectFrom("workspace_leases")
          .select("id")
          .where("workspace_id", "=", workspace.id)
          .where("work_cycle", "=", workspace.work_cycle)
          .where("revoked_at", "is", null)
          .executeTakeFirst();
        const facts = await loadLifecycleFacts(transaction, task.project_id);
        const owner = resolveEffectiveTaskOwner(
          task.id,
          facts.tasks.map(mapOwnershipNode),
          facts.memberships.map(mapOwnershipMembership),
        );
        const authorization =
          actor && owner.ok
            ? resolveTaskOperationAuthorization(
                {
                  serverProjectId: task.project_id,
                  targetProjectIds: [task.project_id],
                  affectedOwnerMembershipIds: [owner.membershipId],
                  projectOwnerMembershipId: facts.projectOwnerMembershipId,
                  projectRootOperation: false,
                  adminSessionActive: input.adminModeActive,
                  actorType: input.actorType,
                  adminSessionEnteredFromExplicitUserRequest:
                    input.adminSessionEnteredFromExplicitUserRequest,
                  impactConfirmationRequired: false,
                  impactConfirmed: true,
                },
                mapAuthorizationActor(actor),
              )
            : { allowed: false as const, reason: "task_owner_required" as const };
        const children = facts.tasks
          .filter((candidate) => candidate.parent_task_id === task.id)
          .map((candidate) => ({
            status: candidate.base_status,
            archived: candidate.archived,
          }));
        const predecessorIds = facts.dependencies
          .filter((dependency) => dependency.successorTaskId === task.id)
          .map((dependency) => dependency.predecessorTaskId);
        const predecessors = facts.tasks
          .filter((candidate) => predecessorIds.includes(candidate.id))
          .map((candidate) => ({
            status: candidate.base_status,
            archived: candidate.archived,
          }));
        const blockerCount = await transaction
          .selectFrom("task_blockers")
          .select(({ fn }) => fn.countAll<string>().as("count"))
          .where("task_id", "=", task.id)
          .where("resolved_at", "is", null)
          .executeTakeFirstOrThrow();
        const decision = evaluateTaskCompletion({
          task: mapLifecycleNode(task, owner.ok ? owner.membershipId : ""),
          ownerResolution: owner,
          directChildStatuses: children,
          predecessorStatuses: predecessors,
          unresolvedManualBlockers: Number(blockerCount.count),
          authorized: authorization.allowed,
          expectedTaskVersion: input.expectedTaskVersion,
          expectedGraphVersion: input.expectedGraphVersion,
          currentGraphVersion: Number(graphScope.graph_version),
          workspace: {
            workspaceId: workspace.id,
            lifecycle: workspace.lifecycle === "frozen" ? "frozen" : "active",
            syncVersion: Number(workspace.sync_version),
            expectedSyncVersion: input.expectedWorkspaceSyncVersion,
            finalServerVersionReceived: input.finalServerVersionReceived,
            activeLeaseId: activeLease?.id ?? null,
          },
        });
        const workspaceDecision = planTaskWorkspaceCompletion(
          {
            workspaceId: workspace.id,
            taskId: task.id,
            lifecycle: workspace.lifecycle === "frozen" ? "frozen" : "active",
            workCycle: workspace.work_cycle,
            syncVersion: Number(workspace.sync_version),
            latestSnapshotSyncVersion: await latestCompletionSnapshotVersion(transaction, task.id),
            activeLeaseId: activeLease?.id ?? null,
            hasUncommittedClientVersion: input.hasUncommittedClientVersion,
          },
          input.expectedWorkspaceSyncVersion,
        );
        if (!decision.ok || !workspaceDecision.ok) {
          const reason: CompletionFailureReason = !decision.ok
            ? decision.reason
            : !workspaceDecision.ok
              ? workspaceDecision.reason
              : "workspace_version_conflict";
          if (actor) {
            await writeLifecycleAudit(transaction, {
              actorUserId: actor.userId,
              actorType: input.actorType,
              projectId: task.project_id,
              taskId: task.id,
              requestId: input.requestId,
              action: "task.complete",
              result: "failure",
              reasonCode: reason,
              taskVersionBefore: Number(task.version),
              taskVersionAfter: null,
            });
          }
          return { ok: false, reason };
        }
        await this.failure("after_validation");
        const nextVersion = Number(task.version) + 1;
        const materializedOwner =
          decision.plan.materializeOwnerMembershipId ??
          task.explicit_owner_membership_id ??
          (owner.ok ? owner.membershipId : null);
        const updated = await transaction
          .updateTable("tasks")
          .set({
            base_status: "done",
            frozen: true,
            explicit_owner_membership_id: materializedOwner,
            version: String(nextVersion),
            updated_at: input.now,
          })
          .where("id", "=", task.id)
          .returning("version")
          .executeTakeFirstOrThrow();
        await this.failure("after_task");
        await transaction
          .insertInto("task_completion_snapshots")
          .values({
            id: randomUUID(),
            project_id: task.project_id,
            task_id: task.id,
            task_version: updated.version,
            owner_membership_id: materializedOwner!,
            workspace_id: workspace.id,
            workspace_sync_version: workspace.sync_version,
            work_cycle: workspace.work_cycle,
            task_snapshot: {
              id: task.id,
              title: task.title,
              body: task.body,
              baseStatus: "done",
              ownerMembershipId: materializedOwner,
              version: Number(updated.version),
            },
          })
          .execute();
        await this.failure("after_snapshot");
        await transaction
          .updateTable("workspaces")
          .set({ lifecycle: "frozen", updated_at: input.now })
          .where("id", "=", workspace.id)
          .execute();
        await this.failure("after_workspace");
        await revokeWorkspaceLeases(transaction, workspace.id, input.now, "task_completed");
        await this.failure("after_lease");
        await writeLifecycleAudit(transaction, {
          actorUserId: actor!.userId,
          actorType: input.actorType,
          projectId: task.project_id,
          taskId: task.id,
          requestId: input.requestId,
          action: "task.complete",
          result: "success",
          reasonCode: "completed",
          taskVersionBefore: Number(task.version),
          taskVersionAfter: Number(updated.version),
        });
        await this.failure("after_audit");
        await writeLifecycleOutbox(transaction, {
          projectId: task.project_id,
          taskId: task.id,
          requestId: input.requestId,
          eventType: "task.completed",
          payload: {
            taskId: task.id,
            taskVersion: Number(updated.version),
            workspaceSyncVersion: Number(workspace.sync_version),
          },
        });
        await this.failure("after_outbox");
        const response = {
          taskId: task.id,
          taskVersion: Number(updated.version),
          workspaceId: workspace.id,
          workspaceSyncVersion: Number(workspace.sync_version),
        };
        await writeLifecycleIdempotency(transaction, {
          projectId: task.project_id,
          actorMembershipId: input.actorMembershipId,
          operation: "task_complete",
          idempotencyKey: input.idempotencyKey,
          requestSha256: input.requestSha256,
          response,
          taskId: task.id,
        });
        return { ok: true, ...response, idempotentReplay: false };
      });
    } catch (error) {
      if (auditContext) {
        await writeLifecycleAudit(this.database, {
          actorUserId: auditContext.actorUserId,
          actorType: input.actorType,
          projectId: auditContext.projectId,
          taskId: input.taskId,
          requestId: input.requestId,
          action: "task.complete",
          result: "failure",
          reasonCode: "transaction_failed",
          taskVersionBefore: auditContext.taskVersion,
          taskVersionAfter: null,
        });
      }
      throw error;
    }
  }

  async reopenTask(
    input: LifecycleActorInput & {
      taskId: string;
      policy: ReopenPolicy;
      expectedTaskVersions: Readonly<Record<string, number>>;
      expectedOwnerMembershipIds: Readonly<Record<string, string>>;
      confirmedTaskIds: readonly string[];
      requestId: string;
      idempotencyKey: string;
      requestSha256: string;
      now: Date;
    },
  ): Promise<ReopenResult> {
    let auditContext: { projectId: string; actorUserId: string; taskVersion: number } | undefined;
    try {
      return await this.database.transaction().execute(async (transaction) => {
        const target = await transaction
          .selectFrom("tasks")
          .select(["id", "project_id", "version"])
          .where("id", "=", input.taskId)
          .executeTakeFirst();
        if (!target) {
          return { ok: false, reason: "task_not_found", taskIds: [input.taskId] };
        }
        const actor = await loadLifecycleActor(
          transaction,
          target.project_id,
          input.actorMembershipId,
        );
        if (actor) {
          auditContext = {
            projectId: target.project_id,
            actorUserId: actor.userId,
            taskVersion: Number(target.version),
          };
        }
        const replay = await readLifecycleReplay(transaction, {
          projectId: target.project_id,
          actorMembershipId: input.actorMembershipId,
          operation: "task_reopen",
          idempotencyKey: input.idempotencyKey,
          requestSha256: input.requestSha256,
        });
        if (replay.status === "conflict") {
          return {
            ok: false,
            reason: "idempotency_conflict",
            taskIds: [input.taskId],
          };
        }
        if (replay.status === "replay") {
          return {
            ok: true,
            taskIds: stringArrayField(replay.response.taskIds),
            idempotentReplay: true,
          };
        }
        const initial = await buildReopenDecision(transaction, target.project_id, input);
        if (!initial.ok) {
          if (actor) {
            await writeLifecycleAudit(transaction, {
              actorUserId: actor.userId,
              actorType: input.actorType,
              projectId: target.project_id,
              taskId: target.id,
              requestId: input.requestId,
              action: "task.reopen",
              result: "failure",
              reasonCode: initial.reason,
              taskVersionBefore: Number(target.version),
              taskVersionAfter: null,
            });
          }
          return initial;
        }
        for (const taskId of [...initial.plan.taskIds].sort()) {
          await transaction
            .selectFrom("tasks")
            .select("id")
            .where("id", "=", taskId)
            .forUpdate()
            .executeTakeFirstOrThrow();
        }
        const workspaces = await transaction
          .selectFrom("workspaces")
          .selectAll()
          .where("scope_type", "=", "task")
          .where("scope_id", "in", initial.plan.taskIds)
          .orderBy("id")
          .forUpdate()
          .execute();
        const decision = await buildReopenDecision(transaction, target.project_id, input);
        if (!decision.ok) {
          return decision;
        }
        const facts = await loadLifecycleFacts(transaction, target.project_id);
        const authorization =
          actor &&
          resolveTaskOperationAuthorization(
            {
              serverProjectId: target.project_id,
              targetProjectIds: decision.plan.taskIds.map(() => target.project_id),
              affectedOwnerMembershipIds: decision.plan.taskIds.map((taskId) =>
                facts.ownerByTaskId.get(taskId)!,
              ),
              projectOwnerMembershipId: facts.projectOwnerMembershipId,
              projectRootOperation: false,
              adminSessionActive: input.adminModeActive,
              actorType: input.actorType,
              adminSessionEnteredFromExplicitUserRequest:
                input.adminSessionEnteredFromExplicitUserRequest,
              impactConfirmationRequired: true,
              impactConfirmed:
                JSON.stringify([...input.confirmedTaskIds].sort()) ===
                JSON.stringify([...decision.plan.taskIds].sort()),
            },
            mapAuthorizationActor(actor),
          );
        if (!authorization || !authorization.allowed) {
          return { ok: false, reason: "forbidden", taskIds: decision.plan.taskIds };
        }
        await this.failure("after_validation");
        const workspaceByTaskId = new Map(
          workspaces.map((workspace) => [workspace.scope_id, workspace]),
        );
        for (const taskId of decision.plan.taskIds) {
          const task = facts.tasks.find((candidate) => candidate.id === taskId)!;
          const workspace = workspaceByTaskId.get(taskId);
          if (!workspace) {
            return {
              ok: false,
              reason: "workspace_state_missing",
              taskIds: decision.plan.taskIds,
            };
          }
          const workspacePlan = planTaskWorkspaceReopen({
            workspaceId: workspace.id,
            taskId,
            lifecycle: workspace.lifecycle === "frozen" ? "frozen" : "active",
            workCycle: workspace.work_cycle,
            syncVersion: Number(workspace.sync_version),
            latestSnapshotSyncVersion: await latestCompletionSnapshotVersion(transaction, taskId),
            activeLeaseId: await activeLeaseId(transaction, workspace.id),
            hasUncommittedClientVersion: false,
          });
          if (!workspacePlan.ok) {
            return {
              ok: false,
              reason: "workspace_state_missing",
              taskIds: decision.plan.taskIds,
            };
          }
          const nextVersion = Number(task.version) + 1;
          await transaction
            .updateTable("tasks")
            .set({
              base_status: "in_progress",
              frozen: false,
              version: String(nextVersion),
              updated_at: input.now,
            })
            .where("id", "=", taskId)
            .execute();
          await transaction
            .insertInto("task_workspace_transition_snapshots")
            .values({
              id: randomUUID(),
              project_id: task.project_id,
              task_id: taskId,
              task_version: String(nextVersion),
              transition_type: "reopen",
              owner_membership_id: facts.ownerByTaskId.get(taskId)!,
              workspace_id: workspace.id,
              workspace_sync_version: workspace.sync_version,
              work_cycle: workspace.work_cycle,
              snapshot: {
                previousWorkCycle: workspace.work_cycle,
                nextWorkCycle: workspace.work_cycle + 1,
                preservedCompletionSyncVersion: workspacePlan.plan.snapshotSyncVersion,
              },
            })
            .execute();
          await transaction
            .updateTable("workspaces")
            .set({
              lifecycle: "active",
              work_cycle: workspace.work_cycle + 1,
              updated_at: input.now,
            })
            .where("id", "=", workspace.id)
            .execute();
          await revokeWorkspaceLeases(transaction, workspace.id, input.now, "task_reopened");
          await writeLifecycleOutbox(transaction, {
            projectId: task.project_id,
            taskId,
            requestId: input.requestId,
            eventType: "task.reopened",
            payload: { taskId, taskVersion: nextVersion },
          });
        }
        await this.failure("after_task");
        await this.failure("after_snapshot");
        await this.failure("after_workspace");
        await this.failure("after_lease");
        await writeLifecycleAudit(transaction, {
          actorUserId: actor.userId,
          actorType: input.actorType,
          projectId: target.project_id,
          taskId: target.id,
          requestId: input.requestId,
          action: "task.reopen",
          result: "success",
          reasonCode: "reopened",
          taskVersionBefore: Number(target.version),
          taskVersionAfter: input.expectedTaskVersions[target.id]! + 1,
        });
        await this.failure("after_audit");
        await this.failure("after_outbox");
        const response = { taskIds: decision.plan.taskIds };
        await writeLifecycleIdempotency(transaction, {
          projectId: target.project_id,
          actorMembershipId: input.actorMembershipId,
          operation: "task_reopen",
          idempotencyKey: input.idempotencyKey,
          requestSha256: input.requestSha256,
          response,
          taskId: target.id,
        });
        return { ok: true, ...response, idempotentReplay: false };
      });
    } catch (error) {
      if (auditContext) {
        await writeLifecycleAudit(this.database, {
          actorUserId: auditContext.actorUserId,
          actorType: input.actorType,
          projectId: auditContext.projectId,
          taskId: input.taskId,
          requestId: input.requestId,
          action: "task.reopen",
          result: "failure",
          reasonCode: "transaction_failed",
          taskVersionBefore: auditContext.taskVersion,
          taskVersionAfter: null,
        });
      }
      throw error;
    }
  }

  async changeOwner(
    input: LifecycleActorInput & {
      taskId: string;
      nextOwnerMembershipId: string;
      expectedTaskVersion: number;
      expectedWorkspaceSyncVersion: number;
      hasUncommittedClientVersion: boolean;
      impactConfirmed: boolean;
      requestId: string;
      idempotencyKey: string;
      requestSha256: string;
      now: Date;
    },
  ): Promise<OwnerChangeResult> {
    let auditContext: { projectId: string; actorUserId: string; taskVersion: number } | undefined;
    try {
      return await this.database.transaction().execute(async (transaction) => {
        const task = await transaction
          .selectFrom("tasks")
          .select([
            "id",
            "project_id",
            "title",
            "body",
            "parent_task_id",
            "parent_graph_scope_id",
            "explicit_owner_membership_id",
            "base_status",
            "archived",
            "version",
            "frozen",
          ])
          .where("id", "=", input.taskId)
          .forUpdate()
          .executeTakeFirst();
        if (!task) {
          return { ok: false, reason: "task_not_found" };
        }
        if (task.frozen || task.base_status === "done") {
          return { ok: false, reason: "completed_task_frozen" };
        }
        if (Number(task.version) !== input.expectedTaskVersion) {
          return { ok: false, reason: "task_version_conflict" };
        }
        const actor = await loadLifecycleActor(
          transaction,
          task.project_id,
          input.actorMembershipId,
        );
        if (actor) {
          auditContext = {
            projectId: task.project_id,
            actorUserId: actor.userId,
            taskVersion: Number(task.version),
          };
        }
        const replay = await readLifecycleReplay(transaction, {
          projectId: task.project_id,
          actorMembershipId: input.actorMembershipId,
          operation: "task_owner_change",
          idempotencyKey: input.idempotencyKey,
          requestSha256: input.requestSha256,
        });
        if (replay.status === "conflict") {
          return { ok: false, reason: "idempotency_conflict" };
        }
        if (replay.status === "replay") {
          return {
            ok: true,
            taskId: input.taskId,
            taskVersion: numberField(replay.response.taskVersion),
            ownerMembershipId: stringField(replay.response.ownerMembershipId),
            idempotentReplay: true,
          };
        }
        const nextOwner = await transaction
          .selectFrom("memberships")
          .select(["id", "project_id", "active"])
          .where("id", "=", input.nextOwnerMembershipId)
          .executeTakeFirst();
        if (!nextOwner || !nextOwner.active || nextOwner.project_id !== task.project_id) {
          return { ok: false, reason: "owner_invalid" };
        }
        const facts = await loadLifecycleFacts(transaction, task.project_id);
        const currentOwner = facts.ownerByTaskId.get(task.id);
        const authorization =
          actor &&
          currentOwner &&
          resolveTaskOperationAuthorization(
            {
              serverProjectId: task.project_id,
              targetProjectIds: [task.project_id],
              affectedOwnerMembershipIds: [currentOwner],
              projectOwnerMembershipId: facts.projectOwnerMembershipId,
              projectRootOperation: false,
              adminSessionActive: input.adminModeActive,
              actorType: input.actorType,
              adminSessionEnteredFromExplicitUserRequest:
                input.adminSessionEnteredFromExplicitUserRequest,
              impactConfirmationRequired: true,
              impactConfirmed: input.impactConfirmed,
            },
            mapAuthorizationActor(actor),
          );
        if (!authorization || !authorization.allowed) {
          return { ok: false, reason: "forbidden" };
        }
        const workspace = await lockTaskWorkspace(transaction, task.id);
        if (!workspace) {
          return { ok: false, reason: "workspace_not_active" };
        }
        const leaseId = await activeLeaseId(transaction, workspace.id);
        const workspaceDecision = planTaskWorkspaceOwnerChange(
          {
            workspaceId: workspace.id,
            taskId: task.id,
            lifecycle: workspace.lifecycle === "frozen" ? "frozen" : "active",
            workCycle: workspace.work_cycle,
            syncVersion: Number(workspace.sync_version),
            latestSnapshotSyncVersion: await latestCompletionSnapshotVersion(transaction, task.id),
            activeLeaseId: leaseId,
            hasUncommittedClientVersion: input.hasUncommittedClientVersion,
          },
          input.expectedWorkspaceSyncVersion,
        );
        if (!workspaceDecision.ok) {
          return { ok: false, reason: workspaceDecision.reason };
        }
        await this.failure("after_validation");
        const nextVersion = Number(task.version) + 1;
        await transaction
          .updateTable("tasks")
          .set({
            explicit_owner_membership_id: input.nextOwnerMembershipId,
            version: String(nextVersion),
            updated_at: input.now,
          })
          .where("id", "=", task.id)
          .execute();
        await this.failure("after_task");
        await transaction
          .insertInto("task_workspace_transition_snapshots")
          .values({
            id: randomUUID(),
            project_id: task.project_id,
            task_id: task.id,
            task_version: String(nextVersion),
            transition_type: "owner_change",
            owner_membership_id: input.nextOwnerMembershipId,
            workspace_id: workspace.id,
            workspace_sync_version: workspace.sync_version,
            work_cycle: workspace.work_cycle,
            snapshot: {
              previousOwnerMembershipId: currentOwner,
              nextOwnerMembershipId: input.nextOwnerMembershipId,
              snapshotSyncVersion: workspaceDecision.plan.snapshotSyncVersion,
            },
          })
          .execute();
        await this.failure("after_snapshot");
        await this.failure("after_workspace");
        await revokeWorkspaceLeases(transaction, workspace.id, input.now, "task_owner_changed");
        await this.failure("after_lease");
        await writeLifecycleAudit(transaction, {
          actorUserId: actor.userId,
          actorType: input.actorType,
          projectId: task.project_id,
          taskId: task.id,
          requestId: input.requestId,
          action: "task.owner_change",
          result: "success",
          reasonCode: "owner_changed",
          taskVersionBefore: Number(task.version),
          taskVersionAfter: nextVersion,
        });
        await this.failure("after_audit");
        await writeLifecycleOutbox(transaction, {
          projectId: task.project_id,
          taskId: task.id,
          requestId: input.requestId,
          eventType: "task.owner_changed",
          payload: { taskId: task.id, taskVersion: nextVersion },
        });
        await this.failure("after_outbox");
        const response = {
          taskId: task.id,
          taskVersion: nextVersion,
          ownerMembershipId: input.nextOwnerMembershipId,
        };
        await writeLifecycleIdempotency(transaction, {
          projectId: task.project_id,
          actorMembershipId: input.actorMembershipId,
          operation: "task_owner_change",
          idempotencyKey: input.idempotencyKey,
          requestSha256: input.requestSha256,
          response,
          taskId: task.id,
        });
        return { ok: true, ...response, idempotentReplay: false };
      });
    } catch (error) {
      if (auditContext) {
        await writeLifecycleAudit(this.database, {
          actorUserId: auditContext.actorUserId,
          actorType: input.actorType,
          projectId: auditContext.projectId,
          taskId: input.taskId,
          requestId: input.requestId,
          action: "task.owner_change",
          result: "failure",
          reasonCode: "transaction_failed",
          taskVersionBefore: auditContext.taskVersion,
          taskVersionAfter: null,
        });
      }
      throw error;
    }
  }

  private async failure(point: TaskLifecycleFailurePoint): Promise<void> {
    await this.injectFailure?.(point);
  }
}

async function buildReopenDecision(
  transaction: Transaction<DatabaseSchema>,
  projectId: string,
  input: {
    taskId: string;
    policy: ReopenPolicy;
    expectedTaskVersions: Readonly<Record<string, number>>;
    expectedOwnerMembershipIds: Readonly<Record<string, string>>;
    confirmedTaskIds: readonly string[];
    adminModeActive: boolean;
  },
) {
  const facts = await loadLifecycleFacts(transaction, projectId);
  const workspaces = await transaction
    .selectFrom("workspaces")
    .select(["scope_id", "work_cycle"])
    .where("scope_type", "=", "task")
    .where(
      "scope_id",
      "in",
      facts.tasks.map((task) => task.id),
    )
    .execute();
  return evaluateTaskReopen({
    taskId: input.taskId,
    policy: input.policy,
    tasks: facts.tasks.map((task) =>
      mapLifecycleNode(task, facts.ownerByTaskId.get(task.id) ?? ""),
    ),
    dependencies: facts.dependencies,
    expectedTaskVersions: input.expectedTaskVersions,
    expectedOwnerMembershipIds: input.expectedOwnerMembershipIds,
    workspaceWorkCycles: Object.fromEntries(
      workspaces.map((workspace) => [workspace.scope_id, workspace.work_cycle]),
    ),
    adminModeActive: input.adminModeActive,
    confirmedTaskIds: input.confirmedTaskIds,
  });
}

async function loadLifecycleFacts(
  transaction: Transaction<DatabaseSchema>,
  projectId: string,
): Promise<LifecycleFacts> {
  const project = await transaction
    .selectFrom("projects")
    .select("owner_membership_id")
    .where("id", "=", projectId)
    .executeTakeFirstOrThrow();
  const tasks = await transaction
    .selectFrom("tasks")
    .select([
      "id",
      "project_id",
      "title",
      "body",
      "parent_task_id",
      "parent_graph_scope_id",
      "explicit_owner_membership_id",
      "base_status",
      "archived",
      "version",
      "frozen",
    ])
    .where("project_id", "=", projectId)
    .orderBy("id")
    .execute();
  const memberships = await transaction
    .selectFrom("memberships")
    .innerJoin("users", "users.id", "memberships.user_id")
    .select([
      "memberships.id",
      "memberships.project_id",
      "memberships.user_id",
      "memberships.role",
      "memberships.active",
      "users.active as user_active",
    ])
    .where("memberships.project_id", "=", projectId)
    .execute();
  const dependencies = await transaction
    .selectFrom("task_dependencies")
    .select(["predecessor_task_id", "successor_task_id"])
    .where("project_id", "=", projectId)
    .where("enabled", "=", true)
    .execute();
  const ownershipNodes = tasks.map(mapOwnershipNode);
  const ownershipMemberships = memberships.map((membership) =>
    mapOwnershipMembership({
      id: membership.id,
      projectId: membership.project_id,
      active: membership.active,
    }),
  );
  const ownerByTaskId = new Map<string, string>();
  for (const task of tasks) {
    const owner = resolveEffectiveTaskOwner(task.id, ownershipNodes, ownershipMemberships);
    if (owner.ok) {
      ownerByTaskId.set(task.id, owner.membershipId);
    }
  }
  return {
    projectOwnerMembershipId: project.owner_membership_id,
    tasks,
    memberships: memberships.map((membership) => ({
      id: membership.id,
      projectId: membership.project_id,
      userId: membership.user_id,
      role: membership.role,
      active: membership.active,
      userActive: membership.user_active,
    })),
    dependencies: dependencies.map((dependency) => ({
      predecessorTaskId: dependency.predecessor_task_id,
      successorTaskId: dependency.successor_task_id,
    })),
    ownerByTaskId,
  };
}

async function loadLifecycleActor(
  transaction: Transaction<DatabaseSchema>,
  projectId: string,
  membershipId: string,
) {
  const actor = await transaction
    .selectFrom("memberships")
    .innerJoin("users", "users.id", "memberships.user_id")
    .select([
      "memberships.id",
      "memberships.project_id",
      "memberships.user_id",
      "memberships.role",
      "memberships.active",
      "users.active as user_active",
    ])
    .where("memberships.id", "=", membershipId)
    .where("memberships.project_id", "=", projectId)
    .executeTakeFirst();
  return actor
    ? {
        id: actor.id,
        projectId: actor.project_id,
        userId: actor.user_id,
        role: actor.role,
        active: actor.active,
        userActive: actor.user_active,
      }
    : undefined;
}

function mapAuthorizationActor(actor: {
  id: string;
  projectId: string;
  userId: string;
  role: "admin" | "member";
  active: boolean;
  userActive: boolean;
}) {
  return {
    userId: actor.userId,
    active: actor.userActive,
    membership: {
      id: actor.id,
      userId: actor.userId,
      projectId: actor.projectId,
      role: actor.role,
      active: actor.active,
    },
  };
}

function mapLifecycleNode(
  task: LifecycleTaskRow,
  effectiveOwnerMembershipId: string,
): TaskLifecycleNode {
  return {
    id: task.id,
    projectId: task.project_id,
    parentTaskId: task.parent_task_id,
    explicitOwnerMembershipId: task.explicit_owner_membership_id,
    effectiveOwnerMembershipId,
    baseStatus: task.base_status,
    archived: task.archived,
    version: Number(task.version),
  };
}

function mapOwnershipNode(task: LifecycleTaskRow): TaskOwnershipNode {
  return {
    id: task.id,
    projectId: task.project_id,
    parentTaskId: task.parent_task_id,
    explicitOwnerMembershipId: task.explicit_owner_membership_id,
  };
}

function mapOwnershipMembership(membership: {
  id: string;
  projectId: string;
  active: boolean;
}): OwnershipMembership {
  return {
    id: membership.id,
    projectId: membership.projectId,
    active: membership.active,
  };
}

async function lockTaskWorkspace(transaction: Transaction<DatabaseSchema>, taskId: string) {
  return transaction
    .selectFrom("workspaces")
    .selectAll()
    .where("scope_type", "=", "task")
    .where("scope_id", "=", taskId)
    .forUpdate()
    .executeTakeFirst();
}

async function activeLeaseId(
  transaction: Transaction<DatabaseSchema>,
  workspaceId: string,
): Promise<string | null> {
  const lease = await transaction
    .selectFrom("workspace_leases")
    .select("id")
    .where("workspace_id", "=", workspaceId)
    .where("revoked_at", "is", null)
    .executeTakeFirst();
  return lease?.id ?? null;
}

async function latestCompletionSnapshotVersion(
  transaction: Transaction<DatabaseSchema>,
  taskId: string,
): Promise<number | null> {
  const snapshot = await transaction
    .selectFrom("task_completion_snapshots")
    .select("workspace_sync_version")
    .where("task_id", "=", taskId)
    .orderBy("created_at", "desc")
    .executeTakeFirst();
  return snapshot ? Number(snapshot.workspace_sync_version) : null;
}

async function revokeWorkspaceLeases(
  transaction: Transaction<DatabaseSchema>,
  workspaceId: string,
  now: Date,
  reason: string,
): Promise<void> {
  await transaction
    .updateTable("workspace_leases")
    .set({ revoked_at: now, revoke_reason: reason })
    .where("workspace_id", "=", workspaceId)
    .where("revoked_at", "is", null)
    .execute();
}

async function writeLifecycleAudit(
  executor: Kysely<DatabaseSchema> | Transaction<DatabaseSchema>,
  input: {
    actorUserId: string;
    actorType: "human" | "agent";
    projectId: string;
    taskId: string;
    requestId: string;
    action: string;
    result: "success" | "failure";
    reasonCode: string;
    taskVersionBefore: number;
    taskVersionAfter: number | null;
  },
): Promise<void> {
  await executor
    .insertInto("audit_events")
    .values({
      id: randomUUID(),
      actor_user_id: input.actorUserId,
      device_id: null,
      workspace_id: null,
      request_id: input.requestId,
      action: input.action,
      result: input.result,
      reason_code: input.reasonCode,
      before_version: String(input.taskVersionBefore),
      after_version: input.taskVersionAfter === null ? null : String(input.taskVersionAfter),
      actor_type: input.actorType,
      project_id: input.projectId,
      target_type: "task",
      target_id: input.taskId,
      task_version_before: String(input.taskVersionBefore),
      task_version_after: input.taskVersionAfter === null ? null : String(input.taskVersionAfter),
      metadata: {},
    })
    .onConflict((conflict) =>
      conflict.columns(["request_id", "action", "result", "target_type", "target_id"]).doNothing(),
    )
    .execute();
}

async function writeLifecycleOutbox(
  transaction: Transaction<DatabaseSchema>,
  input: {
    projectId: string;
    taskId: string;
    requestId: string;
    eventType: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  await transaction
    .insertInto("outbox_events")
    .values({
      id: randomUUID(),
      project_id: input.projectId,
      aggregate_type: "task",
      aggregate_id: input.taskId,
      event_type: input.eventType,
      request_id: input.requestId,
      payload: input.payload,
    })
    .execute();
}

async function readLifecycleReplay(
  transaction: Transaction<DatabaseSchema>,
  input: {
    projectId: string;
    actorMembershipId: string;
    operation: "task_complete" | "task_reopen" | "task_owner_change";
    idempotencyKey: string;
    requestSha256: string;
  },
): Promise<
  | { status: "none" }
  | { status: "conflict" }
  | { status: "replay"; response: Record<string, unknown> }
> {
  const record = await transaction
    .selectFrom("task_operation_idempotency")
    .select(["request_sha256", "response"])
    .where("project_id", "=", input.projectId)
    .where("actor_membership_id", "=", input.actorMembershipId)
    .where("operation", "=", input.operation)
    .where("idempotency_key", "=", input.idempotencyKey)
    .executeTakeFirst();
  if (!record) {
    return { status: "none" };
  }
  return record.request_sha256 === input.requestSha256
    ? { status: "replay", response: record.response }
    : { status: "conflict" };
}

async function writeLifecycleIdempotency(
  transaction: Transaction<DatabaseSchema>,
  input: {
    projectId: string;
    actorMembershipId: string;
    operation: "task_complete" | "task_reopen" | "task_owner_change";
    idempotencyKey: string;
    requestSha256: string;
    response: Record<string, unknown>;
    taskId: string;
  },
): Promise<void> {
  await transaction
    .insertInto("task_operation_idempotency")
    .values({
      id: randomUUID(),
      project_id: input.projectId,
      actor_membership_id: input.actorMembershipId,
      operation: input.operation,
      idempotency_key: input.idempotencyKey,
      request_sha256: input.requestSha256,
      response: input.response,
      response_task_id: input.taskId,
    })
    .execute();
}

function numberField(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error("INVALID_IDEMPOTENCY_RESPONSE");
  }
  return value;
}

function stringField(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("INVALID_IDEMPOTENCY_RESPONSE");
  }
  return value;
}

function stringArrayField(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error("INVALID_IDEMPOTENCY_RESPONSE");
  }
  return [...value].sort();
}
