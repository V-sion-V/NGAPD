import type {
  ResolveTaskDependencyRequest,
  TaskDependencyChangeRequest,
  TaskDependencyChangeRequestCollection,
  TaskDependencyMutationResponse,
  TaskResource,
} from "@ngapd/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiRequest } from "../api.js";
import { ErrorNotice } from "../m1/ErrorNotice.js";
import { m3QueryKeys } from "./query-keys.js";
import { invalidateProjectTaskQueries, useIntentKeyManager } from "./use-intent.js";

export function TaskDependencyRequests({
  userId,
  projectKey,
  currentMembershipId,
  tasks,
  adminModeId,
  memberName,
}: {
  userId: string;
  projectKey: string;
  currentMembershipId: string;
  tasks: readonly TaskResource[];
  adminModeId: string | null;
  memberName: (membershipId: string) => string;
}) {
  const queryClient = useQueryClient();
  const intent = useIntentKeyManager();
  const [lastResult, setLastResult] = useState<string | null>(null);
  const requests = useQuery({
    queryKey: m3QueryKeys.dependencyRequests(userId, projectKey, adminModeId),
    queryFn: ({ signal }) =>
      apiRequest<TaskDependencyChangeRequestCollection>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/task-dependency-requests`,
        { signal, adminModeId },
      ),
  });
  const resolve = useMutation({
    mutationFn: ({
      request,
      payload,
    }: {
      request: TaskDependencyChangeRequest;
      payload: ResolveTaskDependencyRequest;
    }) =>
      apiRequest<TaskDependencyMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/task-dependency-requests/${encodeURIComponent(request.id)}/resolve`,
        {
          method: "POST",
          json: payload,
          adminModeId,
          headers: {
            "idempotency-key": intent.keyFor({ requestId: request.id, ...payload }),
          },
        },
      ),
    onSuccess: async (result, variables) => {
      intent.complete();
      setLastResult(
        `请求 ${variables.request.id.slice(0, 8)} 已${variables.payload.decision === "accept" ? "接受" : "拒绝"}；图版本 ${result.graphVersion}。`,
      );
      await invalidateProjectTaskQueries(queryClient, userId, projectKey);
    },
    onError: () => invalidateProjectTaskQueries(queryClient, userId, projectKey),
  });
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const taskLabel = (id: string) => {
    const task = taskById.get(id);
    return task ? `${task.key} · ${task.title}` : `当前层外 Task 引用 ${id.slice(0, 8)}`;
  };

  return (
    <details className="panel m3-dependency-requests">
      <summary>依赖变更请求（{requests.data?.requests.length ?? 0}）</summary>
      {requests.isPending ? (
        <p className="notice">正在读取项目依赖请求…</p>
      ) : requests.data?.requests.length ? (
        <ul className="m3-record-list">
          {requests.data.requests.map((request) => {
            const canResolve =
              request.status === "pending" &&
              request.requiredAcceptanceByMembershipId === currentMembershipId;
            return (
              <li key={request.id}>
                <strong>
                  {request.action === "add" ? "添加" : "移除"}：{" "}
                  {taskLabel(request.predecessorTaskId)} → {taskLabel(request.successorTaskId)}
                </strong>
                <small>
                  状态 {request.status} · 请求图版本 {request.expectedGraphVersion} · 需{" "}
                  {memberName(request.requiredAcceptanceByMembershipId)}处理
                </small>
                {request.status === "pending" && !canResolve && (
                  <span className="field-help">等待指定另一端 Owner；不会显示为已生效边。</span>
                )}
                {(request.status === "expired" || request.status === "stale") && (
                  <span className="field-help">旧请求不可重放；请从当前图版本重新发起。</span>
                )}
                {canResolve && (
                  <div className="actions">
                    <button
                      className="primary compact"
                      disabled={resolve.isPending}
                      type="button"
                      onClick={() =>
                        resolve.mutate({
                          request,
                          payload: {
                            decision: "accept",
                            expectedGraphVersion: request.expectedGraphVersion,
                          },
                        })
                      }
                    >
                      接受
                    </button>
                    <button
                      className="secondary compact"
                      disabled={resolve.isPending}
                      type="button"
                      onClick={() =>
                        resolve.mutate({
                          request,
                          payload: {
                            decision: "reject",
                            expectedGraphVersion: request.expectedGraphVersion,
                          },
                        })
                      }
                    >
                      拒绝
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-state">当前项目没有依赖变更请求。</p>
      )}
      {lastResult && (
        <p className="success" role="status">
          {lastResult}
        </p>
      )}
      <ErrorNotice error={requests.error ?? resolve.error} focus />
    </details>
  );
}
