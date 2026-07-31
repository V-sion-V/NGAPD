import type {
  AddTaskBlockerRequest,
  ChangeTaskDependencyRequest,
  ChangeTaskStatusRequest,
  ResolveTaskBlockerRequest,
  TaskDependencyMutationResponse,
  TaskMutationResponse,
  TaskResource,
} from "@ngapd/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../api.js";
import { ErrorNotice } from "../m1/ErrorNotice.js";
import { invalidateProjectTaskQueries, useIntentKeyManager } from "./use-intent.js";

export function TaskSimpleOperations({
  userId,
  projectKey,
  task,
  scopeTasks,
  graphVersion,
  adminModeId,
  memberName,
  onDirtyChange,
}: {
  userId: string;
  projectKey: string;
  task: TaskResource;
  scopeTasks: readonly TaskResource[];
  graphVersion: number;
  adminModeId: string | null;
  memberName: (membershipId: string) => string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [status, setStatus] = useState<"not_started" | "in_progress">(
    task.baseStatus === "in_progress" ? "in_progress" : "not_started",
  );
  const [statusBaseVersion, setStatusBaseVersion] = useState<number | null>(null);
  const [blockerReason, setBlockerReason] = useState("");
  const [blockerBaseVersion, setBlockerBaseVersion] = useState<number | null>(null);
  const [dependencyTarget, setDependencyTarget] = useState("");
  const [dependencyAction, setDependencyAction] = useState<"add" | "remove">("add");
  const [dependencyDirection, setDependencyDirection] = useState<
    "selected_predecessor" | "selected_successor"
  >("selected_predecessor");
  const [dependencyGraphVersion, setDependencyGraphVersion] = useState<number | null>(null);
  const dirty =
    blockerReason.length > 0 ||
    dependencyTarget.length > 0 ||
    (statusBaseVersion !== null && status !== task.baseStatus);

  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    setStatus(task.baseStatus === "in_progress" ? "in_progress" : "not_started");
    setStatusBaseVersion(null);
    setBlockerReason("");
    setBlockerBaseVersion(null);
    setDependencyTarget("");
    setDependencyGraphVersion(null);
  }, [task.id]);

  const statusConflict =
    statusBaseVersion !== null && statusBaseVersion !== task.version && status !== task.baseStatus;
  const blockerConflict =
    blockerBaseVersion !== null && blockerBaseVersion !== task.version && blockerReason.length > 0;
  const dependencyConflict =
    dependencyGraphVersion !== null &&
    dependencyGraphVersion !== graphVersion &&
    dependencyTarget.length > 0;

  return (
    <>
      {task.actions.includes("change_status") && (
        <StatusOperation
          adminModeId={adminModeId}
          baseVersion={statusBaseVersion ?? task.version}
          conflict={statusConflict}
          projectKey={projectKey}
          status={status}
          task={task}
          userId={userId}
          onReset={() => {
            setStatus(task.baseStatus === "in_progress" ? "in_progress" : "not_started");
            setStatusBaseVersion(null);
          }}
          onStatus={(next) => {
            setStatusBaseVersion((current) => current ?? task.version);
            setStatus(next);
          }}
        />
      )}

      {task.actions.includes("manage_blocker") && (
        <BlockerOperation
          adminModeId={adminModeId}
          baseVersion={blockerBaseVersion ?? task.version}
          conflict={blockerConflict}
          memberName={memberName}
          projectKey={projectKey}
          reason={blockerReason}
          task={task}
          userId={userId}
          onReason={(next) => {
            setBlockerBaseVersion((current) => current ?? task.version);
            setBlockerReason(next);
          }}
          onReset={() => {
            setBlockerReason("");
            setBlockerBaseVersion(null);
          }}
        />
      )}

      {task.actions.includes("manage_dependency") && (
        <DependencyOperation
          action={dependencyAction}
          adminModeId={adminModeId}
          baseGraphVersion={dependencyGraphVersion ?? graphVersion}
          conflict={dependencyConflict}
          direction={dependencyDirection}
          graphVersion={graphVersion}
          projectKey={projectKey}
          scopeTasks={scopeTasks}
          targetKey={dependencyTarget}
          task={task}
          userId={userId}
          onAction={setDependencyAction}
          onDirection={setDependencyDirection}
          onReset={() => {
            setDependencyTarget("");
            setDependencyGraphVersion(null);
          }}
          onTarget={(next) => {
            setDependencyGraphVersion((current) => current ?? graphVersion);
            setDependencyTarget(next);
          }}
        />
      )}
    </>
  );
}

function StatusOperation({
  userId,
  projectKey,
  task,
  adminModeId,
  status,
  baseVersion,
  conflict,
  onStatus,
  onReset,
}: {
  userId: string;
  projectKey: string;
  task: TaskResource;
  adminModeId: string | null;
  status: "not_started" | "in_progress";
  baseVersion: number;
  conflict: boolean;
  onStatus: (status: "not_started" | "in_progress") => void;
  onReset: () => void;
}) {
  const queryClient = useQueryClient();
  const intent = useIntentKeyManager();
  const mutation = useMutation({
    mutationFn: (payload: ChangeTaskStatusRequest) =>
      apiRequest<TaskMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/status`,
        {
          method: "POST",
          json: payload,
          adminModeId,
          headers: { "idempotency-key": intent.keyFor(payload) },
        },
      ),
    onSuccess: async () => {
      intent.complete();
      onReset();
      await invalidateProjectTaskQueries(queryClient, userId, projectKey);
    },
    onError: () => invalidateProjectTaskQueries(queryClient, userId, projectKey),
  });
  return (
    <details className="m3-operation-card">
      <summary>基础状态</summary>
      <div className="m3-operation-form">
        <label>
          基础状态（派生 blocked 仍单独显示）
          <select
            value={status}
            onChange={(event) => onStatus(event.target.value as "not_started" | "in_progress")}
          >
            <option value="not_started">未开始</option>
            <option value="in_progress">进行中</option>
          </select>
        </label>
        {conflict && <ConflictNotice kind="Task" from={baseVersion} to={task.version} />}
        <button
          className="primary compact"
          disabled={status === task.baseStatus || conflict || mutation.isPending}
          type="button"
          onClick={() => mutation.mutate({ status, expectedTaskVersion: baseVersion })}
        >
          {mutation.isPending ? "提交中…" : "更新基础状态"}
        </button>
        {conflict && (
          <button className="secondary compact" type="button" onClick={onReset}>
            采用服务器状态
          </button>
        )}
        <ErrorNotice error={mutation.error} focus />
      </div>
    </details>
  );
}

function BlockerOperation({
  userId,
  projectKey,
  task,
  adminModeId,
  reason,
  baseVersion,
  conflict,
  memberName,
  onReason,
  onReset,
}: {
  userId: string;
  projectKey: string;
  task: TaskResource;
  adminModeId: string | null;
  reason: string;
  baseVersion: number;
  conflict: boolean;
  memberName: (membershipId: string) => string;
  onReason: (value: string) => void;
  onReset: () => void;
}) {
  const queryClient = useQueryClient();
  const addIntent = useIntentKeyManager();
  const resolveIntent = useIntentKeyManager();
  const add = useMutation({
    mutationFn: (payload: AddTaskBlockerRequest) =>
      apiRequest<TaskMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/blockers`,
        {
          method: "POST",
          json: payload,
          adminModeId,
          headers: { "idempotency-key": addIntent.keyFor(payload) },
        },
      ),
    onSuccess: async () => {
      addIntent.complete();
      onReset();
      await invalidateProjectTaskQueries(queryClient, userId, projectKey);
    },
    onError: () => invalidateProjectTaskQueries(queryClient, userId, projectKey),
  });
  const resolve = useMutation({
    mutationFn: ({
      blockerId,
      payload,
    }: {
      blockerId: string;
      payload: ResolveTaskBlockerRequest;
    }) =>
      apiRequest<TaskMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/blockers/${encodeURIComponent(blockerId)}/resolve`,
        {
          method: "POST",
          json: payload,
          adminModeId,
          headers: { "idempotency-key": resolveIntent.keyFor({ blockerId, ...payload }) },
        },
      ),
    onSuccess: async () => {
      resolveIntent.complete();
      await invalidateProjectTaskQueries(queryClient, userId, projectKey);
    },
    onError: () => invalidateProjectTaskQueries(queryClient, userId, projectKey),
  });
  const activeBlockers = task.blockers?.filter((blocker) => blocker.resolvedAt === null) ?? [];

  return (
    <details className="m3-operation-card">
      <summary>人工 Blocker（{activeBlockers.length} 个活动）</summary>
      <div className="m3-operation-form">
        <ul className="m3-record-list">
          {activeBlockers.map((blocker) => (
            <li key={blocker.id}>
              <span>{blocker.reason}</span>
              <small>
                {memberName(blocker.createdByMembershipId)} ·{" "}
                {new Date(blocker.createdAt).toLocaleString()}
              </small>
              <button
                className="secondary compact"
                disabled={resolve.isPending}
                type="button"
                onClick={() =>
                  resolve.mutate({
                    blockerId: blocker.id,
                    payload: { expectedTaskVersion: task.version },
                  })
                }
              >
                解决
              </button>
            </li>
          ))}
        </ul>
        <label>
          新 Blocker 原因
          <textarea
            maxLength={2_000}
            rows={3}
            value={reason}
            onChange={(event) => onReason(event.target.value)}
          />
        </label>
        {conflict && <ConflictNotice kind="Task" from={baseVersion} to={task.version} />}
        <button
          className="primary compact"
          disabled={!reason.trim() || conflict || add.isPending}
          type="button"
          onClick={() => add.mutate({ expectedTaskVersion: baseVersion, reason: reason.trim() })}
        >
          {add.isPending ? "添加中…" : "添加人工 Blocker"}
        </button>
        {conflict && (
          <button className="secondary compact" type="button" onClick={onReset}>
            放弃旧版本草稿
          </button>
        )}
        <ErrorNotice error={add.error ?? resolve.error} focus />
      </div>
    </details>
  );
}

function DependencyOperation({
  userId,
  projectKey,
  task,
  scopeTasks,
  graphVersion,
  adminModeId,
  targetKey,
  action,
  direction,
  baseGraphVersion,
  conflict,
  onTarget,
  onAction,
  onDirection,
  onReset,
}: {
  userId: string;
  projectKey: string;
  task: TaskResource;
  scopeTasks: readonly TaskResource[];
  graphVersion: number;
  adminModeId: string | null;
  targetKey: string;
  action: "add" | "remove";
  direction: "selected_predecessor" | "selected_successor";
  baseGraphVersion: number;
  conflict: boolean;
  onTarget: (value: string) => void;
  onAction: (value: "add" | "remove") => void;
  onDirection: (value: "selected_predecessor" | "selected_successor") => void;
  onReset: () => void;
}) {
  const queryClient = useQueryClient();
  const intent = useIntentKeyManager();
  const [result, setResult] = useState<TaskDependencyMutationResponse | null>(null);
  const mutation = useMutation({
    mutationFn: (payload: ChangeTaskDependencyRequest) =>
      apiRequest<TaskDependencyMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/task-dependencies`,
        {
          method: "POST",
          json: payload,
          adminModeId,
          headers: { "idempotency-key": intent.keyFor(payload) },
        },
      ),
    onSuccess: async (next) => {
      intent.complete();
      setResult(next);
      onReset();
      await invalidateProjectTaskQueries(queryClient, userId, projectKey);
    },
    onError: () => invalidateProjectTaskQueries(queryClient, userId, projectKey),
  });
  const payload = (): ChangeTaskDependencyRequest => ({
    action,
    predecessorTaskKey: direction === "selected_predecessor" ? task.key : targetKey,
    successorTaskKey: direction === "selected_predecessor" ? targetKey : task.key,
    expectedGraphVersion: baseGraphVersion,
  });

  return (
    <details className="m3-operation-card">
      <summary>同级依赖</summary>
      <form
        className="m3-operation-form"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (targetKey && !conflict) {
            setResult(null);
            mutation.mutate(payload());
          }
        }}
      >
        <p className="field-help">
          当前图版本 {graphVersion}；箭头始终为 predecessor → successor。请求模式不会提前显示为边。
        </p>
        <div className="m3-form-grid">
          <label>
            操作
            <select
              value={action}
              onChange={(event) => onAction(event.target.value as "add" | "remove")}
            >
              <option value="add">添加</option>
              <option value="remove">移除</option>
            </select>
          </label>
          <label>
            方向
            <select
              value={direction}
              onChange={(event) =>
                onDirection(event.target.value as "selected_predecessor" | "selected_successor")
              }
            >
              <option value="selected_predecessor">{task.key} → 目标</option>
              <option value="selected_successor">目标 → {task.key}</option>
            </select>
          </label>
          <label>
            同级目标
            <select value={targetKey} onChange={(event) => onTarget(event.target.value)}>
              <option value="">请选择已加载同级 Task</option>
              {scopeTasks
                .filter((candidate) => candidate.id !== task.id)
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.key}>
                    {candidate.key} · {candidate.title}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {conflict && <ConflictNotice kind="Graph" from={baseGraphVersion} to={graphVersion} />}
        <button
          className="primary compact"
          disabled={!targetKey || conflict || mutation.isPending}
          type="submit"
        >
          {mutation.isPending ? "提交中…" : `${action === "add" ? "添加" : "移除"}依赖`}
        </button>
        {conflict && (
          <button className="secondary compact" type="button" onClick={onReset}>
            采用服务器图版本
          </button>
        )}
        {result && (
          <p className={result.mode === "direct" ? "success" : "notice"} role="status">
            {result.mode === "direct"
              ? `依赖已提交；新图版本 ${result.graphVersion}。`
              : "已创建依赖变更请求；必须由另一端 Owner 接受后才会成为有效边。"}
          </p>
        )}
        <ErrorNotice error={mutation.error} focus />
      </form>
    </details>
  );
}

function ConflictNotice({ kind, from, to }: { kind: "Task" | "Graph"; from: number; to: number }) {
  return (
    <p className="error" role="alert">
      {kind} 已从版本 {from} 变为 {to}；草稿保留但旧版本提交已禁用。
    </p>
  );
}
