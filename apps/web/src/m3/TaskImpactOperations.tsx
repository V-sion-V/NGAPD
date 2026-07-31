import type {
  ArchiveTaskRequest,
  ChangeTaskFollowRequest,
  ChangeTaskOwnerRequest,
  CompleteTaskRequest,
  DeleteTaskRequest,
  MoveTaskRequest,
  ProjectMembershipResource,
  ReopenTaskRequest,
  TaskDeletionResponse,
  TaskImpactResponse,
  TaskMutationResponse,
  TaskResource,
} from "@ngapd/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { apiRequest } from "../api.js";
import { ErrorNotice } from "../m1/ErrorNotice.js";
import {
  impactHasWorkspaceRisk,
  taskFactsForImpact,
  taskKeyIsValid,
  type ImpactTaskFacts,
} from "./operations.js";
import { m3QueryKeys } from "./query-keys.js";
import { fetchCompleteTaskScope, resolveImpactTaskResources } from "./task-api.js";
import { invalidateProjectTaskQueries, useIntentKeyManager } from "./use-intent.js";

interface PreparedImpact {
  preview: TaskImpactResponse;
  resources: TaskResource[];
  facts: ImpactTaskFacts;
  taskVersion: number;
  graphVersion: number;
  workspaceSyncVersion: number;
  signature: string;
  targetGraphVersion?: number;
}

type ExplicitSafety = "" | "clean" | "unsafe";

export function TaskImpactOperations({
  userId,
  projectKey,
  task,
  sourceParentTaskKey,
  scopeTasks,
  members,
  adminModeId,
  projectReopenPolicy,
  predecessorKeys,
  memberName,
  onDirtyChange,
  onMoved,
  onRemoved,
}: {
  userId: string;
  projectKey: string;
  task: TaskResource;
  sourceParentTaskKey: string | null;
  scopeTasks: readonly TaskResource[];
  members: readonly ProjectMembershipResource[];
  adminModeId: string | null;
  projectReopenPolicy: "deny" | "cascade";
  predecessorKeys: readonly string[];
  memberName: (membershipId: string) => string;
  onDirtyChange: (dirty: boolean) => void;
  onMoved: (targetParentTaskKey: string | null) => void;
  onRemoved: (operation: "archive" | "delete") => void;
}) {
  const queryClient = useQueryClient();
  const activeMembers = useMemo(
    () => members.filter((member) => member.status === "active"),
    [members],
  );
  const [ownerNext, setOwnerNext] = useState(task.explicitOwnerMembershipId ?? "");
  const [ownerSafety, setOwnerSafety] = useState<ExplicitSafety>("");
  const [ownerImpact, setOwnerImpact] = useState<PreparedImpact | null>(null);
  const [followTarget, setFollowTarget] = useState("");
  const [followAction, setFollowAction] = useState<"add" | "remove">("add");
  const [followImpact, setFollowImpact] = useState<PreparedImpact | null>(null);
  const [completeFinal, setCompleteFinal] = useState<"" | "yes" | "no">("");
  const [completeSafety, setCompleteSafety] = useState<ExplicitSafety>("");
  const [completeBase, setCompleteBase] = useState<{
    task: number;
    graph: number;
    workspace: number;
  } | null>(null);
  const [reopenImpact, setReopenImpact] = useState<PreparedImpact | null>(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [moveImpact, setMoveImpact] = useState<PreparedImpact | null>(null);
  const [destructiveImpact, setDestructiveImpact] = useState<PreparedImpact | null>(null);
  const [destructiveOperation, setDestructiveOperation] = useState<"archive" | "delete" | null>(
    null,
  );
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const parentTask = useQuery({
    queryKey: m3QueryKeys.task(
      userId,
      projectKey,
      sourceParentTaskKey ?? "PROJECT_ROOT",
      adminModeId,
    ),
    queryFn: ({ signal }) =>
      apiRequest<TaskResource>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(sourceParentTaskKey!)}`,
        { signal, adminModeId },
      ),
    enabled: Boolean(sourceParentTaskKey),
  });

  const dirty =
    ownerNext !== (task.explicitOwnerMembershipId ?? "") ||
    ownerSafety !== "" ||
    ownerImpact !== null ||
    followTarget !== "" ||
    followImpact !== null ||
    completeFinal !== "" ||
    completeSafety !== "" ||
    reopenImpact !== null ||
    moveTarget !== "" ||
    moveImpact !== null ||
    destructiveImpact !== null ||
    deleteConfirmation !== "";

  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    setOwnerNext(task.explicitOwnerMembershipId ?? "");
    setOwnerSafety("");
    setOwnerImpact(null);
    setFollowTarget("");
    setFollowImpact(null);
    setCompleteFinal("");
    setCompleteSafety("");
    setCompleteBase(null);
    setReopenImpact(null);
    setMoveTarget("");
    setMoveImpact(null);
    setDestructiveImpact(null);
    setDestructiveOperation(null);
    setDeleteConfirmation("");
  }, [task.id]);

  const prepare = async (
    preview: TaskImpactResponse,
    signature: string,
    targetGraphVersion?: number,
    extraResources: readonly TaskResource[] = [],
  ): Promise<PreparedImpact> => {
    const resolvedResources = await resolveImpactTaskResources({
      preview,
      projectKey,
      sourceParentTaskKey,
      selectedTask: task,
      adminModeId,
    });
    const resources = [
      ...new Map(
        [...resolvedResources, ...extraResources].map((resource) => [resource.id, resource]),
      ).values(),
    ];
    return {
      preview,
      resources,
      facts: taskFactsForImpact(preview, resources),
      taskVersion: task.version,
      graphVersion: task.graphVersion,
      workspaceSyncVersion: task.workspace.syncVersion,
      signature,
      ...(targetGraphVersion === undefined ? {} : { targetGraphVersion }),
    };
  };

  const invalidate = () => invalidateProjectTaskQueries(queryClient, userId, projectKey);

  const ownerPreview = useMutation({
    mutationFn: async (nextOwnerMembershipId: string | null) => {
      const preview = await apiRequest<TaskImpactResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/owner/impact`,
        { method: "POST", json: {}, adminModeId },
      );
      return prepare(preview, nextOwnerMembershipId ?? "inherit");
    },
    onSuccess: setOwnerImpact,
    onError: invalidate,
  });
  const ownerIntent = useIntentKeyManager();
  const ownerCommit = useMutation({
    mutationFn: (payload: ChangeTaskOwnerRequest) =>
      apiRequest<TaskMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/owner`,
        {
          method: "POST",
          json: payload,
          adminModeId,
          headers: { "idempotency-key": ownerIntent.keyFor(payload) },
        },
      ),
    onSuccess: async () => {
      ownerIntent.complete();
      setOwnerImpact(null);
      setOwnerSafety("");
      await invalidate();
    },
    onError: invalidate,
  });

  const followPreview = useMutation({
    mutationFn: async ({ action, target }: { action: "add" | "remove"; target: string }) => {
      const [preview, targetResource] = await Promise.all([
        apiRequest<TaskImpactResponse>(
          `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/follows/impact`,
          {
            method: "POST",
            json: { targetTaskKey: target },
            adminModeId,
          },
        ),
        apiRequest<TaskResource>(
          `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(target)}`,
          { adminModeId },
        ),
      ]);
      return prepare(preview, `${action}:${target}`, undefined, [targetResource]);
    },
    onSuccess: setFollowImpact,
    onError: invalidate,
  });
  const followIntent = useIntentKeyManager();
  const followCommit = useMutation({
    mutationFn: (payload: ChangeTaskFollowRequest) =>
      apiRequest<TaskMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/follows`,
        {
          method: "POST",
          json: payload,
          adminModeId,
          headers: { "idempotency-key": followIntent.keyFor(payload) },
        },
      ),
    onSuccess: async () => {
      followIntent.complete();
      setFollowTarget("");
      setFollowImpact(null);
      await invalidate();
    },
    onError: invalidate,
  });

  const completeIntent = useIntentKeyManager();
  const completeCommit = useMutation({
    mutationFn: (payload: CompleteTaskRequest) =>
      apiRequest<TaskMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/complete`,
        {
          method: "POST",
          json: payload,
          adminModeId,
          headers: { "idempotency-key": completeIntent.keyFor(payload) },
        },
      ),
    onSuccess: async () => {
      completeIntent.complete();
      setCompleteFinal("");
      setCompleteSafety("");
      setCompleteBase(null);
      await invalidate();
    },
    onError: invalidate,
  });

  const reopenPreview = useMutation({
    mutationFn: async () => {
      const preview = await apiRequest<TaskImpactResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/reopen/impact`,
        { method: "POST", json: { policy: "cascade" }, adminModeId },
      );
      return prepare(preview, projectReopenPolicy);
    },
    onSuccess: setReopenImpact,
    onError: invalidate,
  });
  const reopenIntent = useIntentKeyManager();
  const reopenCommit = useMutation({
    mutationFn: (payload: ReopenTaskRequest) =>
      apiRequest<TaskMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/reopen`,
        {
          method: "POST",
          json: payload,
          adminModeId,
          headers: { "idempotency-key": reopenIntent.keyFor(payload) },
        },
      ),
    onSuccess: async () => {
      reopenIntent.complete();
      setReopenImpact(null);
      await invalidate();
    },
    onError: invalidate,
  });

  const movePreview = useMutation({
    mutationFn: async (target: string) => {
      const targetParentTaskKey = target === "root" ? null : target;
      const [preview, targetScope] = await Promise.all([
        apiRequest<TaskImpactResponse>(
          `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/move/impact`,
          {
            method: "POST",
            json: { targetParentTaskKey },
            adminModeId,
          },
        ),
        fetchCompleteTaskScope({
          projectKey,
          parentTaskKey: targetParentTaskKey,
          adminModeId,
        }),
      ]);
      return prepare(preview, target, targetScope.graphVersion);
    },
    onSuccess: setMoveImpact,
    onError: invalidate,
  });
  const moveIntent = useIntentKeyManager();
  const moveCommit = useMutation({
    mutationFn: (payload: MoveTaskRequest) =>
      apiRequest<TaskMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/move`,
        {
          method: "POST",
          json: payload,
          adminModeId,
          headers: { "idempotency-key": moveIntent.keyFor(payload) },
        },
      ),
    onSuccess: async (_, payload) => {
      moveIntent.complete();
      setMoveTarget("");
      setMoveImpact(null);
      await invalidate();
      onMoved(payload.targetParentTaskKey);
    },
    onError: invalidate,
  });

  const destructivePreview = useMutation({
    mutationFn: async (operation: "archive" | "delete") => {
      const preview = await apiRequest<TaskImpactResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/${operation}/impact`,
        { method: "POST", json: {}, adminModeId },
      );
      return prepare(preview, operation);
    },
    onSuccess: (prepared, operation) => {
      setDestructiveOperation(operation);
      setDestructiveImpact(prepared);
    },
    onError: invalidate,
  });
  const archiveIntent = useIntentKeyManager();
  const archiveCommit = useMutation({
    mutationFn: (payload: ArchiveTaskRequest) =>
      apiRequest<TaskMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/archive`,
        {
          method: "POST",
          json: payload,
          adminModeId,
          headers: { "idempotency-key": archiveIntent.keyFor(payload) },
        },
      ),
    onSuccess: async () => {
      archiveIntent.complete();
      await invalidate();
      onRemoved("archive");
    },
    onError: invalidate,
  });
  const deleteIntent = useIntentKeyManager();
  const deleteCommit = useMutation({
    mutationFn: (payload: DeleteTaskRequest) =>
      apiRequest<TaskDeletionResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}`,
        {
          method: "DELETE",
          json: payload,
          adminModeId,
          headers: { "idempotency-key": deleteIntent.keyFor(payload) },
        },
      ),
    onSuccess: async () => {
      deleteIntent.complete();
      await invalidate();
      onRemoved("delete");
    },
    onError: invalidate,
  });

  const ownerChanged = ownerNext !== (task.explicitOwnerMembershipId ?? "");
  const ownerPreviewCurrent =
    ownerImpact?.signature === (ownerNext || "inherit") &&
    ownerImpact.taskVersion === task.version &&
    ownerImpact.workspaceSyncVersion === task.workspace.syncVersion;
  const followPreviewCurrent =
    followImpact?.signature === `${followAction}:${followTarget}` &&
    followImpact.taskVersion === task.version;
  const completeConflict =
    completeBase !== null &&
    (completeBase.task !== task.version ||
      completeBase.graph !== task.graphVersion ||
      completeBase.workspace !== task.workspace.syncVersion);
  const reopenPreviewCurrent =
    reopenImpact?.signature === projectReopenPolicy && reopenImpact.taskVersion === task.version;
  const normalizedMoveTarget = moveTarget.trim().toUpperCase();
  const moveTargetValid = normalizedMoveTarget === "ROOT" || taskKeyIsValid(normalizedMoveTarget);
  const moveSignature = normalizedMoveTarget === "ROOT" ? "root" : normalizedMoveTarget;
  const movePreviewCurrent =
    moveImpact?.signature === moveSignature &&
    moveImpact.taskVersion === task.version &&
    moveImpact.graphVersion === task.graphVersion;
  const destructivePreviewCurrent =
    destructiveImpact !== null &&
    destructiveOperation === destructiveImpact.signature &&
    destructiveImpact.taskVersion === task.version &&
    destructiveImpact.graphVersion === task.graphVersion;

  const captureCompleteBase = () =>
    setCompleteBase(
      (current) =>
        current ?? {
          task: task.version,
          graph: task.graphVersion,
          workspace: task.workspace.syncVersion,
        },
    );

  return (
    <>
      {task.actions.includes("change_owner") && (
        <details className="m3-operation-card">
          <summary>更改 Owner（影响确认）</summary>
          <div className="m3-operation-form">
            <label>
              新显式 Owner
              <select
                value={ownerNext}
                onChange={(event) => {
                  setOwnerNext(event.target.value);
                  setOwnerImpact(null);
                  setOwnerSafety("");
                  ownerCommit.reset();
                }}
              >
                <option disabled={task.parentTaskId === null} value="">
                  {task.parentTaskId === null
                    ? "顶层 Task 不能清空 Owner"
                    : `继承父级 Owner${
                        parentTask.data
                          ? `：${memberName(parentTask.data.effectiveOwner.membershipId)}`
                          : "（正在核对）"
                      }`}
                </option>
                {activeMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary compact"
              disabled={
                !ownerChanged ||
                (!ownerNext && task.parentTaskId === null) ||
                ownerPreview.isPending
              }
              type="button"
              onClick={() => {
                ownerCommit.reset();
                ownerPreview.mutate(ownerNext || null);
              }}
            >
              {ownerPreview.isPending ? "核对影响中…" : "获取 Owner 完整影响"}
            </button>
            {ownerImpact && <ImpactSummary prepared={ownerImpact} memberName={memberName} />}
            {ownerImpact && impactHasWorkspaceRisk(ownerImpact.preview) && (
              <p className="error" role="alert">
                影响集合包含活动租约或未同步 Workspace。M3 不处理同步冲突，已阻止 Owner
                提交；请先在后续 Workspace 流程安全收口。
              </p>
            )}
            {ownerImpact && (
              <ExplicitSafetyChoice
                value={ownerSafety}
                onChange={setOwnerSafety}
                label="当前浏览器或本地 Workspace 是否存在未提交版本？"
              />
            )}
            {!ownerPreviewCurrent && ownerImpact && <StalePreviewNotice />}
            <button
              className="primary compact"
              disabled={
                !ownerPreviewCurrent ||
                ownerSafety !== "clean" ||
                impactHasWorkspaceRisk(ownerImpact.preview) ||
                ownerCommit.isPending
              }
              type="button"
              onClick={() => {
                if (!ownerImpact) {
                  return;
                }
                ownerCommit.mutate({
                  nextOwnerMembershipId: ownerNext || null,
                  expectedTaskVersion: ownerImpact.taskVersion,
                  expectedWorkspaceSyncVersion: ownerImpact.workspaceSyncVersion,
                  hasUncommittedClientVersion: false,
                  confirmedTaskIds: ownerImpact.facts.confirmedTaskIds,
                  expectedAffectedTaskVersions: ownerImpact.facts.expectedTaskVersions,
                  expectedAffectedWorkspaceSyncVersions:
                    ownerImpact.facts.expectedWorkspaceSyncVersions,
                  uncommittedWorkspaceTaskIds: [],
                });
              }}
            >
              {ownerCommit.isPending ? "提交中…" : "确认同一影响并更改 Owner"}
            </button>
            <ErrorNotice
              error={ownerPreview.error ?? ownerCommit.error ?? parentTask.error}
              focus
            />
          </div>
        </details>
      )}

      {task.actions.includes("manage_follow") && (
        <details className="m3-operation-card">
          <summary>一跳关注</summary>
          <form
            className="m3-operation-form"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              const target = followTarget.trim().toUpperCase();
              if (taskKeyIsValid(target)) {
                setFollowTarget(target);
                followCommit.reset();
                followPreview.mutate({ action: followAction, target });
              }
            }}
          >
            <p className="field-help">关注不授予写权限，不参与状态、依赖或完成，也不会递归传播。</p>
            <div className="m3-form-grid">
              <label>
                操作
                <select
                  value={followAction}
                  onChange={(event) => {
                    setFollowAction(event.target.value as "add" | "remove");
                    setFollowImpact(null);
                    followCommit.reset();
                  }}
                >
                  <option value="add">添加关注</option>
                  <option value="remove">移除关注</option>
                </select>
              </label>
              <label>
                目标 Task Key
                <input
                  placeholder={`${projectKey}-2`}
                  value={followTarget}
                  onChange={(event) => {
                    setFollowTarget(event.target.value);
                    setFollowImpact(null);
                    followCommit.reset();
                  }}
                />
              </label>
            </div>
            <p>
              当前关注：
              {task.follows?.length
                ? task.follows
                    .map(
                      (id) =>
                        scopeTasks.find((candidate) => candidate.id === id)?.key ??
                        `不可见引用 ${id.slice(0, 8)}`,
                    )
                    .join("、")
                : "无"}
            </p>
            <button
              className="secondary compact"
              disabled={
                !taskKeyIsValid(followTarget.trim().toUpperCase()) || followPreview.isPending
              }
              type="submit"
            >
              {followPreview.isPending ? "核对影响中…" : "获取关注影响"}
            </button>
            {followImpact && <ImpactSummary prepared={followImpact} memberName={memberName} />}
            {!followPreviewCurrent && followImpact && <StalePreviewNotice />}
            <button
              className="primary compact"
              disabled={!followPreviewCurrent || followCommit.isPending}
              type="button"
              onClick={() => {
                if (!followImpact) {
                  return;
                }
                followCommit.mutate({
                  action: followAction,
                  targetTaskKey: followTarget,
                  impactConfirmationToken: followImpact.preview.confirmationToken,
                });
              }}
            >
              {followCommit.isPending ? "提交中…" : "确认影响并提交关注"}
            </button>
            <ErrorNotice error={followPreview.error ?? followCommit.error} focus />
          </form>
        </details>
      )}

      {task.actions.includes("complete") && (
        <details className="m3-operation-card">
          <summary>显式完成</summary>
          <div className="m3-operation-form">
            <dl className="m3-confirmation-facts">
              <Fact label="完成就绪" value={task.completionReady ? "是" : "否"} />
              <Fact
                label="直接子任务"
                value={`${task.childSummary.done}/${task.childSummary.total} 已完成`}
              />
              <Fact
                label="未完成 predecessor"
                value={predecessorKeys.length ? predecessorKeys.join("、") : "无"}
              />
              <Fact
                label="活动人工 Blocker"
                value={String(task.blockers?.filter((item) => !item.resolvedAt).length ?? 0)}
              />
              <Fact
                label="Task / Graph / Workspace 版本"
                value={`${task.version} / ${task.graphVersion} / ${task.workspace.syncVersion}`}
              />
              <Fact
                label="活动写租约"
                value={task.workspace.hasActiveWriteLease ? "有（阻止完成）" : "无"}
              />
            </dl>
            <ExplicitYesNo
              label="是否已收到并核对上方最终服务端版本？"
              value={completeFinal}
              onChange={(value) => {
                captureCompleteBase();
                setCompleteFinal(value);
              }}
            />
            <ExplicitSafetyChoice
              value={completeSafety}
              onChange={(value) => {
                captureCompleteBase();
                setCompleteSafety(value);
              }}
              label="当前浏览器或本地 Workspace 是否存在未提交版本？"
            />
            {completeConflict && (
              <p className="error" role="alert">
                完成确认期间 Task、Graph 或 Workspace 版本已变化。旧确认已失效，请重新核对。
              </p>
            )}
            {!task.completionReady && (
              <p className="error" role="alert">
                服务端当前未判定 completion_ready，不能提交完成。
              </p>
            )}
            {completeSafety === "unsafe" && (
              <p className="error" role="alert">
                M3 不替用户解决本地/服务端 Workspace 冲突；请先安全同步。
              </p>
            )}
            <p className="field-help">
              完成会冻结 Task 与 Workspace；摘要和 Wiki 属于 M6，本界面不会伪造摘要或调用模型。
            </p>
            <button
              className="primary compact"
              disabled={
                !completeBase ||
                completeConflict ||
                completeFinal !== "yes" ||
                completeSafety !== "clean" ||
                !task.completionReady ||
                task.workspace.hasActiveWriteLease ||
                completeCommit.isPending
              }
              type="button"
              onClick={() => {
                if (!completeBase) {
                  return;
                }
                completeCommit.mutate({
                  expectedTaskVersion: completeBase.task,
                  expectedGraphVersion: completeBase.graph,
                  expectedWorkspaceSyncVersion: completeBase.workspace,
                  finalServerVersionReceived: true,
                  hasUncommittedClientVersion: false,
                });
              }}
            >
              {completeCommit.isPending ? "完成中…" : "确认最终版本并完成"}
            </button>
            <ErrorNotice error={completeCommit.error} focus />
          </div>
        </details>
      )}

      {task.actions.includes("reopen") && (
        <details className="m3-operation-card">
          <summary>
            显式重开（{projectReopenPolicy === "cascade" ? "级联策略" : "拒绝策略"}）
          </summary>
          <div className="m3-operation-form">
            <p>
              项目策略为 <strong>{projectReopenPolicy === "cascade" ? "cascade" : "deny"}</strong>
              。旧确认不会自动重放。
            </p>
            <button
              className="secondary compact"
              disabled={reopenPreview.isPending}
              type="button"
              onClick={() => {
                reopenCommit.reset();
                reopenPreview.mutate();
              }}
            >
              {reopenPreview.isPending ? "核对影响中…" : "获取重开完整影响"}
            </button>
            {reopenImpact && <ImpactSummary prepared={reopenImpact} memberName={memberName} />}
            {!reopenPreviewCurrent && reopenImpact && <StalePreviewNotice />}
            <button
              className="primary compact"
              disabled={!reopenPreviewCurrent || reopenCommit.isPending}
              type="button"
              onClick={() => {
                if (!reopenImpact) {
                  return;
                }
                reopenCommit.mutate({
                  policy: projectReopenPolicy,
                  expectedTaskVersions: reopenImpact.facts.expectedTaskVersions,
                  expectedOwnerMembershipIds: reopenImpact.facts.expectedOwnerMembershipIds,
                  confirmedTaskIds: reopenImpact.facts.confirmedTaskIds,
                });
              }}
            >
              {reopenCommit.isPending ? "重开中…" : "确认同一闭包并重开"}
            </button>
            <ErrorNotice error={reopenPreview.error ?? reopenCommit.error} focus />
          </div>
        </details>
      )}

      {task.actions.includes("move") && (
        <details className="m3-operation-card">
          <summary>移动 Task（双图版本）</summary>
          <form
            className="m3-operation-form"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              if (moveTargetValid) {
                setMoveTarget(moveSignature);
                moveCommit.reset();
                movePreview.mutate(moveSignature);
              }
            }}
          >
            <label>
              目标父级（输入完整 Task Key，或 root）
              <input
                value={moveTarget}
                onChange={(event) => {
                  setMoveTarget(event.target.value);
                  setMoveImpact(null);
                  moveCommit.reset();
                }}
              />
            </label>
            <p className="field-help">
              源父级：{sourceParentTaskKey ?? "项目根"}；移动只以服务端提交为准，不使用拖放结果。
            </p>
            <button
              className="secondary compact"
              disabled={!moveTargetValid || movePreview.isPending}
              type="submit"
            >
              {movePreview.isPending ? "核对影响中…" : "获取移动完整影响"}
            </button>
            {moveImpact && <ImpactSummary prepared={moveImpact} memberName={memberName} />}
            {moveImpact && (
              <p>
                源图版本 {moveImpact.graphVersion}；目标图版本{" "}
                {moveImpact.targetGraphVersion ?? "未解析"}。
              </p>
            )}
            {!movePreviewCurrent && moveImpact && <StalePreviewNotice />}
            <button
              className="primary compact"
              disabled={
                !movePreviewCurrent ||
                moveImpact.targetGraphVersion === undefined ||
                moveCommit.isPending
              }
              type="button"
              onClick={() => {
                if (!moveImpact || moveImpact.targetGraphVersion === undefined) {
                  return;
                }
                moveCommit.mutate({
                  targetParentTaskKey:
                    moveImpact.signature === "root" ? null : moveImpact.signature,
                  expectedTaskVersion: moveImpact.taskVersion,
                  expectedSourceGraphVersion: moveImpact.graphVersion,
                  expectedTargetGraphVersion: moveImpact.targetGraphVersion,
                  impactConfirmationToken: moveImpact.preview.confirmationToken,
                });
              }}
            >
              {moveCommit.isPending ? "移动中…" : "确认同一影响并移动"}
            </button>
            <ErrorNotice error={movePreview.error ?? moveCommit.error} focus />
          </form>
        </details>
      )}

      {(task.actions.includes("archive") || task.actions.includes("delete")) && (
        <details className="m3-operation-card m3-operation-card--danger">
          <summary>归档或不可恢复删除</summary>
          <div className="m3-operation-form">
            <p className="error">归档不承诺可恢复；删除没有回收站、撤销或单任务恢复。</p>
            <div className="actions">
              {task.actions.includes("archive") && (
                <button
                  className="secondary compact"
                  disabled={destructivePreview.isPending}
                  type="button"
                  onClick={() => {
                    archiveCommit.reset();
                    deleteCommit.reset();
                    destructivePreview.mutate("archive");
                  }}
                >
                  预览顶层归档影响
                </button>
              )}
              {task.actions.includes("delete") && (
                <button
                  className="danger-link"
                  disabled={destructivePreview.isPending}
                  type="button"
                  onClick={() => {
                    archiveCommit.reset();
                    deleteCommit.reset();
                    destructivePreview.mutate("delete");
                  }}
                >
                  预览不可恢复删除影响
                </button>
              )}
            </div>
            {destructiveImpact && (
              <ImpactSummary prepared={destructiveImpact} memberName={memberName} />
            )}
            {!destructivePreviewCurrent && destructiveImpact && <StalePreviewNotice />}
            {destructiveOperation === "delete" && destructiveImpact && (
              <label>
                输入完整 Task Key “{task.key}”确认
                <input
                  autoComplete="off"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                />
              </label>
            )}
            {destructiveOperation === "archive" && destructiveImpact && (
              <button
                className="danger-button"
                disabled={!destructivePreviewCurrent || archiveCommit.isPending}
                type="button"
                onClick={() =>
                  archiveCommit.mutate({
                    expectedTaskVersion: destructiveImpact.taskVersion,
                    expectedGraphVersion: destructiveImpact.graphVersion,
                    impactConfirmationToken: destructiveImpact.preview.confirmationToken,
                  })
                }
              >
                {archiveCommit.isPending ? "归档中…" : "确认影响并归档（不承诺恢复）"}
              </button>
            )}
            {destructiveOperation === "delete" && destructiveImpact && (
              <button
                className="danger-button"
                disabled={
                  !destructivePreviewCurrent ||
                  deleteConfirmation !== task.key ||
                  deleteCommit.isPending
                }
                type="button"
                onClick={() =>
                  deleteCommit.mutate({
                    expectedTaskVersion: destructiveImpact.taskVersion,
                    expectedGraphVersion: destructiveImpact.graphVersion,
                    impactConfirmationToken: destructiveImpact.preview.confirmationToken,
                    confirmTaskKey: deleteConfirmation,
                  })
                }
              >
                {deleteCommit.isPending ? "删除中…" : "永久删除确认子树"}
              </button>
            )}
            <ErrorNotice
              error={destructivePreview.error ?? archiveCommit.error ?? deleteCommit.error}
              focus
            />
          </div>
        </details>
      )}
    </>
  );
}

function ImpactSummary({
  prepared,
  memberName,
}: {
  prepared: PreparedImpact;
  memberName: (membershipId: string) => string;
}) {
  const impact = prepared.preview.impact;
  return (
    <section className="m3-impact-summary" aria-label="服务端影响集合">
      <strong>服务端影响集合 · {impact.operation}</strong>
      <dl className="m3-confirmation-facts">
        <Fact label="受影响 Task" value={String(impact.affectedTaskIds.length)} />
        <Fact label="后代" value={String(impact.descendantTaskIds.length)} />
        <Fact label="依赖" value={String(impact.dependencyIds.length)} />
        <Fact label="有效状态重算" value={String(impact.effectiveStatusTaskIds.length)} />
        <Fact label="已完成祖先" value={String(impact.completedAncestorTaskIds.length)} />
        <Fact label="活动 Workspace 租约" value={String(impact.workspaceLeaseIds.length)} />
        <Fact label="未同步 Workspace" value={String(impact.unsyncedWorkspaceTaskIds.length)} />
        <Fact label="图作用域" value={String(impact.graphScopeIds.length)} />
      </dl>
      {prepared.resources.length > 0 && (
        <ul className="m3-impact-task-list">
          {prepared.resources.map((resource) => (
            <li key={resource.id}>
              <strong>{resource.key}</strong> {resource.title} · Task v{resource.version} /
              Workspace v{resource.workspace.syncVersion} · Owner{" "}
              {memberName(resource.effectiveOwner.membershipId)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ExplicitSafetyChoice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ExplicitSafety;
  onChange: (value: ExplicitSafety) => void;
}) {
  return (
    <fieldset className="m3-radio-group">
      <legend>{label}</legend>
      <label>
        <input
          checked={value === "clean"}
          name={label}
          type="radio"
          onChange={() => onChange("clean")}
        />
        没有；我已主动核对
      </label>
      <label>
        <input
          checked={value === "unsafe"}
          name={label}
          type="radio"
          onChange={() => onChange("unsafe")}
        />
        有或不确定（阻止提交）
      </label>
    </fieldset>
  );
}

function ExplicitYesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "" | "yes" | "no";
  onChange: (value: "" | "yes" | "no") => void;
}) {
  return (
    <fieldset className="m3-radio-group">
      <legend>{label}</legend>
      <label>
        <input
          checked={value === "yes"}
          name={label}
          type="radio"
          onChange={() => onChange("yes")}
        />
        是
      </label>
      <label>
        <input checked={value === "no"} name={label} type="radio" onChange={() => onChange("no")} />
        否（阻止提交）
      </label>
    </fieldset>
  );
}

function StalePreviewNotice() {
  return (
    <p className="error" role="alert">
      输入、Task、Graph 或 Workspace 版本已变化；旧影响确认已失效，请重新预览。
    </p>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
