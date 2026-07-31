import type {
  CreateTaskCommentRequest,
  DeleteTaskCommentRequest,
  HideTaskCommentRequest,
  ProjectMembershipResource,
  TaskActivityCollection,
  TaskCommentAttachment,
  TaskCommentCollection,
  TaskCommentMutationResponse,
  TaskCommentResource,
  TaskResource,
  TaskWorkspaceFileCollection,
  UpdateTaskCommentRequest,
} from "@ngapd/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { apiBinaryRequest, apiRequest, safeFilenamePart } from "../api.js";
import { ErrorNotice } from "../m1/ErrorNotice.js";
import { attachmentIsCurrent } from "./operations.js";
import { m3QueryKeys } from "./query-keys.js";
import { invalidateProjectTaskQueries, useIntentKeyManager } from "./use-intent.js";

export function TaskCollaboration({
  userId,
  projectKey,
  task,
  members,
  adminModeId,
  onDirtyChange,
}: {
  userId: string;
  projectKey: string;
  task: TaskResource;
  members: readonly ProjectMembershipResource[];
  adminModeId: string | null;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const createIntent = useIntentKeyManager();
  const updateIntent = useIntentKeyManager();
  const deleteIntent = useIntentKeyManager();
  const hideIntent = useIntentKeyManager();
  const [body, setBody] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [draftTaskVersion, setDraftTaskVersion] = useState<number | null>(null);
  const [editDirty, setEditDirty] = useState<Record<string, boolean>>({});
  const [attachmentError, setAttachmentError] = useState<Error | null>(null);
  const [openingPath, setOpeningPath] = useState<string | null>(null);

  const comments = useInfiniteQuery({
    queryKey: m3QueryKeys.comments(userId, projectKey, task.key, adminModeId),
    queryFn: ({ pageParam, signal }) =>
      apiRequest<TaskCommentCollection>(
        pagePath(
          `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/comments`,
          pageParam,
        ),
        { signal, adminModeId },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const activity = useInfiniteQuery({
    queryKey: m3QueryKeys.activity(userId, projectKey, task.key, adminModeId),
    queryFn: ({ pageParam, signal }) =>
      apiRequest<TaskActivityCollection>(
        pagePath(
          `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/activity`,
          pageParam,
        ),
        { signal, adminModeId },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const files = useQuery({
    queryKey: m3QueryKeys.workspaceFiles(userId, projectKey, task.key, adminModeId),
    queryFn: ({ signal }) =>
      apiRequest<TaskWorkspaceFileCollection>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/workspace/files`,
        { signal, adminModeId },
      ),
    enabled: task.actions.includes("read_workspace"),
    retry: false,
  });
  const allComments = useMemo(
    () => comments.data?.pages.flatMap((page) => page.comments) ?? [],
    [comments.data],
  );
  const allActivity = useMemo(
    () => activity.data?.pages.flatMap((page) => page.activities) ?? [],
    [activity.data],
  );
  const createDirty = body.length > 0 || selectedPaths.length > 0;
  const dirty = createDirty || Object.values(editDirty).some(Boolean);
  const createConflict =
    draftTaskVersion !== null && draftTaskVersion !== task.version && createDirty;
  const memberByUserId = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );
  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );

  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    setBody("");
    setSelectedPaths([]);
    setDraftTaskVersion(null);
    setEditDirty({});
    setAttachmentError(null);
  }, [task.id]);

  const invalidate = () => invalidateProjectTaskQueries(queryClient, userId, projectKey);
  const create = useMutation({
    mutationFn: (payload: CreateTaskCommentRequest) =>
      apiRequest<TaskCommentMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/comments`,
        {
          method: "POST",
          json: payload,
          adminModeId,
          headers: { "idempotency-key": createIntent.keyFor(payload) },
        },
      ),
    onSuccess: async () => {
      createIntent.complete();
      setBody("");
      setSelectedPaths([]);
      setDraftTaskVersion(null);
      await invalidate();
    },
    onError: invalidate,
  });
  const update = useMutation({
    mutationFn: ({
      commentId,
      payload,
    }: {
      commentId: string;
      payload: UpdateTaskCommentRequest;
    }) =>
      apiRequest<TaskCommentMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/comments/${encodeURIComponent(commentId)}`,
        {
          method: "PATCH",
          json: payload,
          adminModeId,
          headers: { "idempotency-key": updateIntent.keyFor({ commentId, ...payload }) },
        },
      ),
    onSuccess: async () => {
      updateIntent.complete();
      await invalidate();
    },
    onError: invalidate,
  });
  const remove = useMutation({
    mutationFn: ({
      commentId,
      payload,
    }: {
      commentId: string;
      payload: DeleteTaskCommentRequest;
    }) =>
      apiRequest<TaskCommentMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/comments/${encodeURIComponent(commentId)}`,
        {
          method: "DELETE",
          json: payload,
          adminModeId,
          headers: { "idempotency-key": deleteIntent.keyFor({ commentId, ...payload }) },
        },
      ),
    onSuccess: async () => {
      deleteIntent.complete();
      await invalidate();
    },
    onError: invalidate,
  });
  const hide = useMutation({
    mutationFn: ({ commentId, payload }: { commentId: string; payload: HideTaskCommentRequest }) =>
      apiRequest<TaskCommentMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/comments/${encodeURIComponent(commentId)}/hide`,
        {
          method: "POST",
          json: payload,
          adminModeId,
          headers: { "idempotency-key": hideIntent.keyFor({ commentId, ...payload }) },
        },
      ),
    onSuccess: async () => {
      hideIntent.complete();
      await invalidate();
    },
    onError: invalidate,
  });

  const selectFiles = (event: ChangeEvent<HTMLSelectElement>) => {
    setDraftTaskVersion((current) => current ?? task.version);
    setSelectedPaths([...event.target.selectedOptions].map((option) => option.value));
  };
  const submitComment = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim() || createConflict) {
      return;
    }
    const currentFiles = files.data;
    const attachments: TaskCommentAttachment[] = currentFiles
      ? selectedPaths.flatMap((path) => {
          const file = currentFiles.files.find((candidate) => candidate.path === path);
          return file
            ? [{ workspaceId: currentFiles.workspaceId, path: file.path, sha256: file.sha256 }]
            : [];
        })
      : [];
    if (attachments.length !== selectedPaths.length) {
      setAttachmentError(new Error("附件清单已变化；请重新选择当前授权文件。"));
      return;
    }
    create.mutate({
      body: body.trim(),
      attachments,
      expectedTaskVersion: draftTaskVersion ?? task.version,
    });
  };

  const openAttachment = async (attachment: TaskCommentAttachment) => {
    setAttachmentError(null);
    if (!attachmentIsCurrent(attachment, files.data ?? null)) {
      setAttachmentError(new Error("附件已不属于当前授权 Workspace 清单，或内容哈希已经变化。"));
      return;
    }
    setOpeningPath(attachment.path);
    try {
      const query = new URLSearchParams({ path: attachment.path });
      if (attachment.sha256) {
        query.set("sha256", attachment.sha256);
      }
      const result = await apiBinaryRequest(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(task.key)}/workspace/files/content?${query.toString()}`,
        { adminModeId },
      );
      const objectUrl = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = safeAttachmentName(attachment.path, result.filename);
      anchor.rel = "noopener noreferrer";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error : new Error("无法打开附件"));
    } finally {
      setOpeningPath(null);
    }
  };
  const setCommentDirty = useCallback((commentId: string, value: boolean) => {
    setEditDirty((current) =>
      current[commentId] === value ? current : { ...current, [commentId]: value },
    );
  }, []);

  return (
    <>
      <section aria-labelledby="m3-comments-title">
        <h3 id="m3-comments-title">评论与 Workspace 附件</h3>
        {task.actions.includes("comment") && (
          <form className="m3-operation-form" onSubmit={submitComment}>
            <label>
              新评论（安全 Markdown 文本）
              <textarea
                maxLength={32_768}
                required
                rows={4}
                value={body}
                onChange={(event) => {
                  setDraftTaskVersion((current) => current ?? task.version);
                  setBody(event.target.value);
                }}
              />
            </label>
            {task.actions.includes("read_workspace") && (
              <label>
                选择当前 Workspace 已有文件（可多选；M3 不上传）
                <select
                  multiple
                  size={Math.min(Math.max(files.data?.files.length ?? 2, 2), 6)}
                  value={selectedPaths}
                  onChange={selectFiles}
                >
                  {files.data?.files.map((file) => (
                    <option key={`${file.path}:${file.sha256}`} value={file.path}>
                      {file.path} · {file.size} bytes
                    </option>
                  ))}
                </select>
              </label>
            )}
            {createConflict && (
              <p className="error" role="alert">
                评论草稿基于 Task 版本 {draftTaskVersion}，服务端现为 {task.version}
                。草稿保留；请重新核对附件和正文。
              </p>
            )}
            {createConflict && (
              <button
                className="secondary compact"
                type="button"
                onClick={() => setDraftTaskVersion(task.version)}
              >
                以当前版本重新核对
              </button>
            )}
            <button
              className="primary compact"
              disabled={!body.trim() || createConflict || create.isPending}
              type="submit"
            >
              {create.isPending ? "发布中…" : "发布评论"}
            </button>
          </form>
        )}
        <ErrorNotice error={files.error ?? create.error ?? attachmentError} focus />
        {comments.isPending ? (
          <p className="notice">正在读取评论…</p>
        ) : allComments.length ? (
          <ol className="m3-comment-list">
            {allComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                files={files.data ?? null}
                memberName={(id) => memberById.get(id)?.displayName ?? `历史成员 ${id.slice(0, 8)}`}
                openingPath={openingPath}
                pending={update.isPending || remove.isPending || hide.isPending}
                task={task}
                onDelete={(payload) =>
                  remove.mutateAsync({ commentId: comment.id, payload }).then(() => undefined)
                }
                onDirty={(value) => setCommentDirty(comment.id, value)}
                onHide={(payload) =>
                  hide.mutateAsync({ commentId: comment.id, payload }).then(() => undefined)
                }
                onOpenAttachment={openAttachment}
                onUpdate={(payload) =>
                  update.mutateAsync({ commentId: comment.id, payload }).then(() => undefined)
                }
              />
            ))}
          </ol>
        ) : (
          <p className="empty-state">还没有评论。</p>
        )}
        {comments.hasNextPage && (
          <button
            className="secondary compact"
            disabled={comments.isFetchingNextPage}
            type="button"
            onClick={() => void comments.fetchNextPage()}
          >
            {comments.isFetchingNextPage ? "加载中…" : "加载更多评论"}
          </button>
        )}
        <ErrorNotice error={comments.error ?? update.error ?? remove.error ?? hide.error} />
      </section>

      <section aria-labelledby="m3-activity-title">
        <h3 id="m3-activity-title">Task 活动</h3>
        {activity.isPending ? (
          <p className="notice">正在读取活动流…</p>
        ) : allActivity.length ? (
          <ol className="m3-activity-list">
            {allActivity.map((item) => (
              <li key={item.id}>
                <strong>{activityLabel(item.eventType)}</strong>
                <span>
                  {item.actorUserId
                    ? (memberByUserId.get(item.actorUserId)?.displayName ?? "历史操作者")
                    : "系统"}
                  {" · "}
                  {new Date(item.occurredAt).toLocaleString()}
                </span>
                <small>{friendlyResourceRefs(item.resourceRefs)}</small>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-state">还没有可见活动。</p>
        )}
        {activity.hasNextPage && (
          <button
            className="secondary compact"
            disabled={activity.isFetchingNextPage}
            type="button"
            onClick={() => void activity.fetchNextPage()}
          >
            {activity.isFetchingNextPage ? "加载中…" : "加载更多活动"}
          </button>
        )}
        <ErrorNotice error={activity.error} />
      </section>
    </>
  );
}

function CommentItem({
  comment,
  task,
  files,
  memberName,
  pending,
  openingPath,
  onDirty,
  onUpdate,
  onDelete,
  onHide,
  onOpenAttachment,
}: {
  comment: TaskCommentResource;
  task: TaskResource;
  files: TaskWorkspaceFileCollection | null;
  memberName: (membershipId: string) => string;
  pending: boolean;
  openingPath: string | null;
  onDirty: (dirty: boolean) => void;
  onUpdate: (payload: UpdateTaskCommentRequest) => Promise<void>;
  onDelete: (payload: DeleteTaskCommentRequest) => Promise<void>;
  onHide: (payload: HideTaskCommentRequest) => Promise<void>;
  onOpenAttachment: (attachment: TaskCommentAttachment) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body ?? "");
  const [baseCommentVersion, setBaseCommentVersion] = useState(comment.version);
  const [baseTaskVersion, setBaseTaskVersion] = useState(task.version);
  const [hideReason, setHideReason] = useState("");
  const [localError, setLocalError] = useState<Error | null>(null);
  const dirty = editing && draft !== (comment.body ?? "");
  const conflict =
    dirty && (comment.version !== baseCommentVersion || task.version !== baseTaskVersion);

  useEffect(() => {
    onDirty(dirty || hideReason.length > 0);
    return () => onDirty(false);
  }, [dirty, hideReason, onDirty]);

  useEffect(() => {
    if (!editing) {
      setDraft(comment.body ?? "");
      setBaseCommentVersion(comment.version);
      setBaseTaskVersion(task.version);
    }
  }, [comment.body, comment.version, editing, task.version]);

  const save = async () => {
    setLocalError(null);
    try {
      await onUpdate({
        body: draft.trim(),
        attachments: comment.attachments,
        expectedCommentVersion: baseCommentVersion,
        expectedTaskVersion: baseTaskVersion,
      });
      setEditing(false);
    } catch (error) {
      setLocalError(error instanceof Error ? error : new Error("评论更新失败"));
    }
  };
  const remove = async () => {
    setLocalError(null);
    try {
      await onDelete({
        expectedCommentVersion: comment.version,
        expectedTaskVersion: task.version,
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error : new Error("评论删除失败"));
    }
  };
  const hide = async () => {
    setLocalError(null);
    try {
      await onHide({ reason: hideReason.trim(), expectedCommentVersion: comment.version });
      setHideReason("");
    } catch (error) {
      setLocalError(error instanceof Error ? error : new Error("评论隐藏失败"));
    }
  };

  return (
    <li>
      <header>
        <strong>{memberName(comment.authorMembershipId)}</strong>
        <span>
          {new Date(comment.createdAt).toLocaleString()}
          {comment.editedAt ? " · 已编辑" : ""}
        </span>
      </header>
      {comment.hidden ? (
        <p className="notice">此评论已由管理员隐藏；审计事实仍保留。</p>
      ) : comment.deleted ? (
        <p className="notice">此评论已删除。</p>
      ) : editing ? (
        <div className="m3-operation-form">
          <textarea
            maxLength={32_768}
            rows={4}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          {conflict && (
            <p className="error" role="alert">
              评论或 Task 版本已变化；本地草稿保留，旧提交已禁用。
            </p>
          )}
          <div className="actions">
            <button
              className="primary compact"
              disabled={!draft.trim() || !dirty || conflict || pending}
              type="button"
              onClick={() => void save()}
            >
              保存评论
            </button>
            <button
              className="secondary compact"
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(comment.body ?? "");
              }}
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <pre className="m3-safe-markdown">{comment.body}</pre>
      )}

      {comment.attachments.length > 0 && (
        <ul className="m3-attachment-list">
          {comment.attachments.map((attachment) => {
            const available = attachmentIsCurrent(attachment, files);
            return (
              <li key={`${attachment.workspaceId}:${attachment.path}:${attachment.sha256 ?? ""}`}>
                <span>{attachment.path}</span>
                <button
                  className="secondary compact"
                  disabled={!available || openingPath === attachment.path}
                  title={available ? "重新授权后下载/打开" : "附件不在当前授权清单或哈希已变化"}
                  type="button"
                  onClick={() => void onOpenAttachment(attachment)}
                >
                  {openingPath === attachment.path ? "读取中…" : "安全下载/打开"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="actions">
        {comment.actions.includes("edit") && !editing && (
          <button
            className="secondary compact"
            type="button"
            onClick={() => {
              setEditing(true);
              setDraft(comment.body ?? "");
              setBaseCommentVersion(comment.version);
              setBaseTaskVersion(task.version);
            }}
          >
            编辑
          </button>
        )}
        {comment.actions.includes("delete") && (
          <details className="m3-inline-confirmation">
            <summary>删除本人评论</summary>
            <p>评论正文将删除且没有撤销；历史事实仍按服务端规则保留。</p>
            <button
              className="danger-button compact"
              disabled={pending}
              type="button"
              onClick={() => void remove()}
            >
              确认删除
            </button>
          </details>
        )}
        {comment.actions.includes("hide") && (
          <details className="m3-inline-confirmation">
            <summary>管理员隐藏</summary>
            <label>
              隐藏原因
              <input
                maxLength={2_000}
                value={hideReason}
                onChange={(event) => setHideReason(event.target.value)}
              />
            </label>
            <button
              className="danger-button compact"
              disabled={!hideReason.trim() || pending}
              type="button"
              onClick={() => void hide()}
            >
              带原因隐藏
            </button>
          </details>
        )}
      </div>
      <ErrorNotice error={localError} />
    </li>
  );
}

function pagePath(base: string, cursor: string | null): string {
  const query = new URLSearchParams({ limit: "50" });
  if (cursor) {
    query.set("cursor", cursor);
  }
  return `${base}?${query.toString()}`;
}

function safeAttachmentName(path: string, fallback: string): string {
  const basename = safeFilenamePart(path.split("/").at(-1) ?? "");
  return basename || fallback;
}

function activityLabel(eventType: string): string {
  const labels: Record<string, string> = {
    "task.created": "创建任务",
    "task.updated": "更新任务",
    "task.owner.changed": "更改 Owner",
    "task.dependency.changed": "更改依赖",
    "task.dependency.requested": "发起依赖请求",
    "task.dependency.resolved": "处理依赖请求",
    "task.blocker.changed": "更改 Blocker",
    "task.status.changed": "更改状态",
    "task.completed": "完成任务",
    "task.reopened": "重开任务",
    "task.moved": "移动任务",
    "task.archived": "归档任务",
    "task.deleted": "删除任务",
    "task.comment.created": "发布评论",
  };
  return labels[eventType] ?? eventType;
}

function friendlyResourceRefs(refs: Record<string, string>): string {
  const allowed = Object.entries(refs)
    .filter(([key]) => /(Key|Version|At)$/u.test(key))
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${value}`);
  return allowed.length ? allowed.join(" · ") : "资源引用已最小化";
}
