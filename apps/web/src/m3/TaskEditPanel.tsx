import type {
  ProjectLogicalRoleResource,
  TaskMutationResponse,
  TaskResource,
  UpdateTaskRequest,
} from "@ngapd/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { apiRequest } from "../api.js";
import { ErrorNotice } from "../m1/ErrorNotice.js";
import { localDateTimeValue, parseLabelsInput, utcDateTimeValue } from "./operations.js";
import { invalidateProjectTaskQueries, useIntentKeyManager } from "./use-intent.js";

interface EditDraft {
  title: string;
  content: string;
  logicalRoleId: string;
  dueAt: string;
  labels: string;
  displayType: TaskResource["displayType"];
}

export function TaskEditPanel({
  userId,
  projectKey,
  task,
  roles,
  adminModeId,
  onDirtyChange,
}: {
  userId: string;
  projectKey: string;
  task: TaskResource;
  roles: readonly ProjectLogicalRoleResource[];
  adminModeId: string | null;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const intent = useIntentKeyManager();
  const [draft, setDraft] = useState<EditDraft>(() => draftFromTask(task));
  const [baseVersion, setBaseVersion] = useState(task.version);
  const [savedDraft, setSavedDraft] = useState<EditDraft>(() => draftFromTask(task));
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedDraft),
    [draft, savedDraft],
  );
  const versionConflict = dirty && task.version !== baseVersion;

  useEffect(() => {
    const next = draftFromTask(task);
    setDraft(next);
    setSavedDraft(next);
    setBaseVersion(task.version);
    intent.abandon();
  }, [intent, task.id]);

  useEffect(() => {
    if (!dirty && task.version !== baseVersion) {
      const next = draftFromTask(task);
      setDraft(next);
      setSavedDraft(next);
      setBaseVersion(task.version);
      intent.abandon();
    }
  }, [baseVersion, dirty, intent, task]);

  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  const mutation = useMutation({
    mutationFn: (payload: UpdateTaskRequest) =>
      apiRequest<TaskMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}`,
        {
          method: "PATCH",
          json: payload,
          adminModeId,
          headers: { "idempotency-key": intent.keyFor(payload) },
        },
      ),
    onSuccess: async (result) => {
      intent.complete();
      const next = draftFromTask(result.task);
      setDraft(next);
      setSavedDraft(next);
      setBaseVersion(result.task.version);
      await invalidateProjectTaskQueries(queryClient, userId, projectKey);
    },
    onError: () => invalidateProjectTaskQueries(queryClient, userId, projectKey),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!dirty || versionConflict || !draft.title.trim()) {
      return;
    }
    mutation.mutate({
      expectedTaskVersion: baseVersion,
      title: draft.title.trim(),
      content: draft.content,
      logicalRoleId: draft.logicalRoleId || null,
      dueAt: utcDateTimeValue(draft.dueAt),
      labels: parseLabelsInput(draft.labels),
      displayType: draft.displayType,
    });
  };

  return (
    <details className="m3-operation-card">
      <summary>编辑字段</summary>
      <form className="m3-operation-form" onSubmit={submit}>
        <label>
          标题
          <input
            maxLength={240}
            required
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </label>
        <label>
          正文（安全 Markdown 文本）
          <textarea
            maxLength={65_536}
            rows={5}
            value={draft.content}
            onChange={(event) => setDraft({ ...draft, content: event.target.value })}
          />
        </label>
        <div className="m3-form-grid">
          <label>
            逻辑角色
            <select
              value={draft.logicalRoleId}
              onChange={(event) => setDraft({ ...draft, logicalRoleId: event.target.value })}
            >
              <option value="">未指定</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                  {role.status === "active" ? "" : "（已归档）"}
                </option>
              ))}
            </select>
          </label>
          <label>
            截止时间（设备本地时区）
            <input
              type="datetime-local"
              value={draft.dueAt}
              onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })}
            />
          </label>
          <label>
            展示类型
            <select
              value={draft.displayType}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  displayType: event.target.value as TaskResource["displayType"],
                })
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
          <input
            value={draft.labels}
            onChange={(event) => setDraft({ ...draft, labels: event.target.value })}
          />
        </label>
        {versionConflict && (
          <p className="error" role="alert">
            服务端 Task 已从版本 {baseVersion} 变为 {task.version}
            。草稿仍保留；请复制需要的内容并点击 “采用服务器版本”后重新编辑。
          </p>
        )}
        {versionConflict && (
          <button
            className="secondary compact"
            type="button"
            onClick={() => {
              const next = draftFromTask(task);
              setDraft(next);
              setSavedDraft(next);
              setBaseVersion(task.version);
              intent.abandon();
            }}
          >
            采用服务器版本
          </button>
        )}
        <button
          className="primary compact"
          disabled={!dirty || versionConflict || mutation.isPending || !draft.title.trim()}
          type="submit"
        >
          {mutation.isPending ? "保存中…" : "保存字段"}
        </button>
        <ErrorNotice error={mutation.error} focus />
      </form>
    </details>
  );
}

function draftFromTask(task: TaskResource): EditDraft {
  return {
    title: task.title,
    content: task.content,
    logicalRoleId: task.logicalRoleId ?? "",
    dueAt: localDateTimeValue(task.dueAt),
    labels: task.labels.join("，"),
    displayType: task.displayType,
  };
}
