import type {
  MarkTaskNotificationReadRequest,
  ProjectCollection,
  TaskNotificationCollection,
  TaskNotificationEventType,
  TaskNotificationPreference,
  TaskNotificationResource,
  TaskLocation,
  UpdateTaskNotificationPreferenceRequest,
} from "@ngapd/contracts";
import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { apiRequest } from "../api.js";
import { ErrorNotice } from "../m1/ErrorNotice.js";
import { m1QueryKeys } from "../m1/model.js";
import { taskKeyFromNotification } from "./operations.js";
import { m3QueryKeys } from "./query-keys.js";
import { useIntentKeyManager } from "./use-intent.js";

const EVENT_TYPES: readonly TaskNotificationEventType[] = [
  "task.owner.changed",
  "task.blocker.changed",
  "task.dependency.requested",
  "task.dependency.resolved",
  "task.comment.created",
  "task.comment.mentioned",
  "task.due.reminder",
  "task.completion_ready",
  "task.archived",
  "task.deleted",
  "task.permission.result",
];

export function NotificationsPanel({
  userId,
  onOpenTask,
}: {
  userId: string;
  onOpenTask: (
    projectKey: string,
    parentTaskKey: string | null,
    taskKey: string | null,
    lifecycle: "active" | "history",
  ) => void;
}) {
  const queryClient = useQueryClient();
  const readIntent = useIntentKeyManager();
  const preferenceIntent = useIntentKeyManager();
  const [status, setStatus] = useState<string | null>(null);
  const [openingNotificationId, setOpeningNotificationId] = useState<string | null>(null);
  const [navigationError, setNavigationError] = useState<Error | null>(null);
  const projects = useQuery({
    queryKey: m1QueryKeys.projects(userId),
    queryFn: ({ signal }) => apiRequest<ProjectCollection>("/api/v1/projects", { signal }),
  });
  const notifications = useInfiniteQuery({
    queryKey: m3QueryKeys.notifications(userId),
    queryFn: ({ pageParam, signal }) =>
      apiRequest<TaskNotificationCollection>(notificationPagePath(pageParam), { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchInterval: 5_000,
    refetchOnMount: "always",
  });
  const preferences = useQueries({
    queries: EVENT_TYPES.map((eventType) => ({
      queryKey: m3QueryKeys.notificationPreference(userId, eventType),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiRequest<TaskNotificationPreference>(
          `/api/v1/notification-preferences/${encodeURIComponent(eventType)}`,
          { signal },
        ),
    })),
  });
  const markRead = useMutation({
    mutationFn: ({
      notification,
      payload,
    }: {
      notification: TaskNotificationResource;
      payload: MarkTaskNotificationReadRequest;
    }) =>
      apiRequest<TaskNotificationResource>(
        `/api/v1/notifications/${encodeURIComponent(notification.id)}/read`,
        {
          method: "POST",
          json: payload,
          headers: {
            "idempotency-key": readIntent.keyFor({
              notificationId: notification.id,
              ...payload,
            }),
          },
        },
      ),
    onSuccess: async (_, variables) => {
      readIntent.complete();
      setStatus(variables.payload.read ? "通知已标记为已读。" : "通知已标记为未读。");
      await queryClient.invalidateQueries({ queryKey: m3QueryKeys.notifications(userId) });
    },
    onError: () => queryClient.invalidateQueries({ queryKey: m3QueryKeys.notifications(userId) }),
  });
  const updatePreference = useMutation({
    mutationFn: ({
      preference,
      payload,
    }: {
      preference: TaskNotificationPreference;
      payload: UpdateTaskNotificationPreferenceRequest;
    }) =>
      apiRequest<TaskNotificationPreference>(
        `/api/v1/notification-preferences/${encodeURIComponent(preference.eventType)}`,
        {
          method: "PUT",
          json: payload,
          headers: {
            "idempotency-key": preferenceIntent.keyFor({
              eventType: preference.eventType,
              ...payload,
            }),
          },
        },
      ),
    onSuccess: async (next) => {
      preferenceIntent.complete();
      setStatus(`${eventLabel(next.eventType)}偏好已更新。`);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: m3QueryKeys.notificationPreference(userId, next.eventType),
        }),
        queryClient.invalidateQueries({ queryKey: m3QueryKeys.notifications(userId) }),
      ]);
    },
    onError: (_, variables) =>
      queryClient.invalidateQueries({
        queryKey: m3QueryKeys.notificationPreference(userId, variables.preference.eventType),
      }),
  });
  const allNotifications = useMemo(
    () => notifications.data?.pages.flatMap((page) => page.notifications) ?? [],
    [notifications.data],
  );
  const projectById = useMemo(
    () => new Map(projects.data?.projects.map((project) => [project.id, project]) ?? []),
    [projects.data],
  );
  const openNotification = async (
    notification: TaskNotificationResource,
    projectKey: string,
    taskKey: string | null,
  ) => {
    setNavigationError(null);
    setOpeningNotificationId(notification.id);
    try {
      if (!taskKey) {
        onOpenTask(projectKey, null, null, "active");
        return;
      }
      const location = await apiRequest<TaskLocation>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(taskKey)}/ancestors`,
      );
      onOpenTask(
        projectKey,
        location.task.parentTaskKey,
        taskKey,
        location.task.archiveLifecycle === "archived" ? "history" : "active",
      );
    } catch (error) {
      setNavigationError(
        error instanceof Error ? error : new Error("目标已删除、失权或发生变化，无法安全导航。"),
      );
    } finally {
      setOpeningNotificationId(null);
    }
  };

  return (
    <div className="m3-notifications">
      <header className="panel">
        <p className="eyebrow">In-app notifications</p>
        <h2>站内通知</h2>
        <p>通知跨项目分页；Task 权限会在导航时重新验证，已删除或失权目标不会泄露正文。</p>
      </header>

      <section className="panel" aria-labelledby="m3-notification-list-title">
        <h3 id="m3-notification-list-title">通知</h3>
        {notifications.isPending ? (
          <p className="notice">正在读取通知…</p>
        ) : allNotifications.length ? (
          <ol className="m3-notification-list">
            {allNotifications.map((notification) => {
              const project = projectById.get(notification.projectId);
              const projectKey =
                project?.key === notification.projectKey ? notification.projectKey : null;
              const taskKey = taskKeyFromNotification(notification);
              return (
                <li
                  className={notification.read ? "" : "m3-notification--unread"}
                  key={notification.id}
                >
                  <div>
                    <strong>{eventLabel(notification.eventType)}</strong>
                    <span>
                      {notification.critical ? "关键通知" : "普通通知"} ·{" "}
                      {notification.read ? "已读" : "未读"} ·{" "}
                      {new Date(notification.createdAt).toLocaleString()}
                    </span>
                    <small>
                      {projectKey
                        ? `项目 ${projectKey}${taskKey ? ` · ${taskKey}` : ""}`
                        : "原项目当前不可访问"}
                    </small>
                  </div>
                  <div className="actions">
                    <button
                      className="secondary compact"
                      disabled={markRead.isPending}
                      type="button"
                      onClick={() =>
                        markRead.mutate({
                          notification,
                          payload: {
                            read: !notification.read,
                            expectedVersion: notification.version,
                          },
                        })
                      }
                    >
                      标记为{notification.read ? "未读" : "已读"}
                    </button>
                    {projectKey && notification.eventType !== "task.deleted" && (
                      <button
                        className="primary compact"
                        disabled={openingNotificationId === notification.id}
                        type="button"
                        onClick={() => void openNotification(notification, projectKey, taskKey)}
                      >
                        {openingNotificationId === notification.id
                          ? "重新授权中…"
                          : taskKey
                            ? "安全打开 Task"
                            : "打开项目任务根"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="empty-state">当前没有站内通知。</p>
        )}
        {notifications.hasNextPage && (
          <button
            className="secondary compact"
            disabled={notifications.isFetchingNextPage}
            type="button"
            onClick={() => void notifications.fetchNextPage()}
          >
            {notifications.isFetchingNextPage ? "加载中…" : "加载更多通知"}
          </button>
        )}
        {status && (
          <p className="success" role="status">
            {status}
          </p>
        )}
        <ErrorNotice
          error={notifications.error ?? projects.error ?? markRead.error ?? navigationError}
          focus
        />
      </section>

      <section className="panel" aria-labelledby="m3-notification-preferences-title">
        <h3 id="m3-notification-preferences-title">通知偏好</h3>
        <ul className="m3-preference-list">
          {preferences.map((preferenceQuery, index) => {
            const eventType = EVENT_TYPES[index]!;
            const preference = preferenceQuery.data;
            return (
              <li key={eventType}>
                <label>
                  <input
                    checked={preference?.enabled ?? true}
                    disabled={!preference || !preference.configurable || updatePreference.isPending}
                    type="checkbox"
                    onChange={(event) => {
                      if (!preference) {
                        return;
                      }
                      updatePreference.mutate({
                        preference,
                        payload: {
                          enabled: event.target.checked,
                          expectedVersion: preference.version,
                        },
                      });
                    }}
                  />
                  <span>
                    <strong>{eventLabel(eventType)}</strong>
                    <small>{preference?.configurable ? "可配置" : "关键偏好，不允许关闭"}</small>
                  </span>
                </label>
                <ErrorNotice error={preferenceQuery.error} />
              </li>
            );
          })}
        </ul>
        <ErrorNotice error={updatePreference.error} focus />
      </section>
    </div>
  );
}

function notificationPagePath(cursor: string | null): string {
  const query = new URLSearchParams({ limit: "50" });
  if (cursor) {
    query.set("cursor", cursor);
  }
  return `/api/v1/notifications?${query.toString()}`;
}

function eventLabel(eventType: TaskNotificationEventType): string {
  const labels: Record<TaskNotificationEventType, string> = {
    "task.owner.changed": "Task Owner 已变化",
    "task.blocker.changed": "Task Blocker 已变化",
    "task.dependency.requested": "收到依赖变更请求",
    "task.dependency.resolved": "依赖变更请求已处理",
    "task.comment.created": "Task 有新评论",
    "task.comment.mentioned": "评论提及了你",
    "task.due.reminder": "Task 截止提醒",
    "task.completion_ready": "Task 已满足完成条件",
    "task.archived": "Task 已归档",
    "task.deleted": "Task 已删除",
    "task.permission.result": "Task 权限操作结果",
  };
  return labels[eventType];
}
