import type {
  CreateTaskRequest,
  ProjectLogicalRoleResource,
  ProjectMembershipResource,
  TaskMutationResponse,
} from "@ngapd/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { apiRequest } from "../api.js";
import { ErrorNotice } from "../m1/ErrorNotice.js";
import { parseLabelsInput, utcDateTimeValue } from "./operations.js";
import { invalidateProjectTaskQueries, useIntentKeyManager } from "./use-intent.js";

export function TaskCreatePanel({
  userId,
  projectKey,
  parentTaskKey,
  members,
  roles,
  adminModeId,
  disabled,
  onDirtyChange,
}: {
  userId: string;
  projectKey: string;
  parentTaskKey: string | null;
  members: readonly ProjectMembershipResource[];
  roles: readonly ProjectLogicalRoleResource[];
  adminModeId: string | null;
  disabled: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const intent = useIntentKeyManager();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [ownerMembershipId, setOwnerMembershipId] = useState("");
  const [logicalRoleId, setLogicalRoleId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [labels, setLabels] = useState("");
  const [displayType, setDisplayType] =
    useState<NonNullable<CreateTaskRequest["displayType"]>>("normal");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const activeMembers = useMemo(
    () => members.filter((member) => member.status === "active"),
    [members],
  );
  const activeRoles = useMemo(() => roles.filter((role) => role.status === "active"), [roles]);
  const dirty = Boolean(
    title ||
    content ||
    ownerMembershipId ||
    logicalRoleId ||
    dueAt ||
    labels ||
    displayType !== "normal",
  );
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  const mutation = useMutation({
    mutationFn: (payload: CreateTaskRequest) =>
      apiRequest<TaskMutationResponse>(`/api/v1/projects/${encodeURIComponent(projectKey)}/tasks`, {
        method: "POST",
        json: payload,
        adminModeId,
        headers: { "idempotency-key": intent.keyFor(payload) },
      }),
    onSuccess: async (result) => {
      intent.complete();
      setCreatedKey(result.task.key);
      setTitle("");
      setContent("");
      setOwnerMembershipId("");
      setLogicalRoleId("");
      setDueAt("");
      setLabels("");
      setDisplayType("normal");
      onDirtyChange(false);
      await invalidateProjectTaskQueries(queryClient, userId, projectKey);
    },
    onError: () => invalidateProjectTaskQueries(queryClient, userId, projectKey),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setCreatedKey(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle || (!parentTaskKey && !ownerMembershipId)) {
      return;
    }
    const payload: CreateTaskRequest = {
      parentTaskKey,
      explicitOwnerMembershipId: ownerMembershipId || null,
      title: trimmedTitle,
      content,
      logicalRoleId: logicalRoleId || null,
      dueAt: utcDateTimeValue(dueAt),
      labels: parseLabelsInput(labels),
      displayType,
    };
    mutation.mutate(payload);
  };

  return (
    <details className="m3-operation-card m3-create-panel">
      <summary>{parentTaskKey ? `在 ${parentTaskKey} 下创建子任务` : "创建顶层任务"}</summary>
      <form className="m3-operation-form" onSubmit={submit}>
        <label>
          标题
          <input
            maxLength={240}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          正文（安全 Markdown 文本）
          <textarea
            maxLength={65_536}
            rows={4}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
        <div className="m3-form-grid">
          <label>
            显式 Owner
            <select
              required={!parentTaskKey}
              value={ownerMembershipId}
              onChange={(event) => setOwnerMembershipId(event.target.value)}
            >
              <option value="">{parentTaskKey ? "继承当前父级 Owner" : "请选择活动 Owner"}</option>
              {activeMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            逻辑角色
            <select
              value={logicalRoleId}
              onChange={(event) => setLogicalRoleId(event.target.value)}
            >
              <option value="">未指定</option>
              {activeRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            截止时间（设备本地时区）
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </label>
          <label>
            展示类型
            <select
              value={displayType}
              onChange={(event) =>
                setDisplayType(event.target.value as NonNullable<CreateTaskRequest["displayType"]>)
              }
            >
              <option value="normal">普通</option>
              <option value="sprint">冲刺</option>
              <option value="milestone">里程碑</option>
            </select>
          </label>
        </div>
        <label>
          标签（逗号或换行分隔）
          <input value={labels} onChange={(event) => setLabels(event.target.value)} />
        </label>
        <p className="field-help">
          每次提交意图使用稳定幂等键；失败后未改变负载的重试会复用同一键。
        </p>
        <button
          className="primary compact"
          disabled={
            disabled ||
            mutation.isPending ||
            !title.trim() ||
            (!parentTaskKey && !ownerMembershipId)
          }
          type="submit"
        >
          {mutation.isPending ? "创建中…" : "创建任务"}
        </button>
        {createdKey && (
          <p className="success" role="status">
            已创建不可复用 Task Key：<strong>{createdKey}</strong>
          </p>
        )}
        <ErrorNotice error={mutation.error} focus />
      </form>
    </details>
  );
}
