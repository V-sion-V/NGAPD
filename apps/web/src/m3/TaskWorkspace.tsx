import type {
  MembershipCollection,
  ProjectDetail,
  ProjectLogicalRoleCollection,
  TaskCollection,
  TaskLocation,
  TaskResource,
  TaskSearchCollection,
} from "@ngapd/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiRequest } from "../api.js";
import { AdminModePanel } from "../m1/AdminModePanel.js";
import { ErrorNotice } from "../m1/ErrorNotice.js";
import { activeAdminMode, m1QueryKeys, type CurrentProjectIdentity } from "../m1/model.js";
import { TaskCreatePanel } from "./TaskCreatePanel.js";
import { TaskDependencyRequests } from "./TaskDependencyRequests.js";
import { TaskDrawer } from "./TaskDrawer.js";
import { TaskGraph } from "./TaskGraph.js";
import {
  createTaskFilters,
  createTaskPageState,
  filterTaskScope,
  locateSearchResult,
  navigateTaskScope,
  parseTaskRoute,
  readTaskHistoryState,
  returnFromTaskSearch,
  selectTaskKey,
  type TaskFilters,
  type TaskPageState,
  type TaskRoute,
  taskRouteUrl,
  updateTaskFilters,
  updateTaskSearchQuery,
  updateTaskViewport,
  validateTaskScope,
} from "./model.js";
import { m3QueryKeys } from "./query-keys.js";
import { taskListPath, taskSearchPath } from "./task-api.js";
import "./task-workspace.css";

declare global {
  interface Window {
    __m3TaskMetrics?: {
      readyAtMs: number;
      visibleNodes: number;
    };
  }
}

export function TaskWorkspace({
  userId,
  projectKey,
  onProjectIdentity,
}: {
  userId: string;
  projectKey: string;
  onProjectIdentity: (project: CurrentProjectIdentity | null) => void;
}) {
  const initialRoute = useMemo(() => routeForProject(projectKey), [projectKey]);
  const [page, setPage] = useState<TaskPageState>(() => {
    return (
      readTaskHistoryState(window.history.state, initialRoute) ?? createTaskPageState(initialRoute)
    );
  });
  const viewportRef = useRef(page.viewport);
  const pageRef = useRef(page);
  const dirtySources = useRef(new Map<string, boolean>());
  const [dirtyRevision, setDirtyRevision] = useState(0);
  pageRef.current = page;

  const setDirtySource = useCallback((source: string, dirty: boolean) => {
    if (dirtySources.current.get(source) === dirty) {
      return;
    }
    if (dirty) {
      dirtySources.current.set(source, true);
    } else {
      dirtySources.current.delete(source);
    }
    setDirtyRevision((revision) => revision + 1);
  }, []);
  const createDirty = useCallback(
    (dirty: boolean) => setDirtySource("scope-create", dirty),
    [setDirtySource],
  );
  const drawerDirty = useCallback(
    (source: string, dirty: boolean) => setDirtySource(`drawer:${source}`, dirty),
    [setDirtySource],
  );
  const clearDirtySources = useCallback(() => {
    if (dirtySources.current.size > 0) {
      dirtySources.current.clear();
      setDirtyRevision((revision) => revision + 1);
    }
  }, []);
  const confirmDraftDiscard = useCallback(() => {
    return (
      dirtySources.current.size === 0 ||
      window.confirm("当前有未提交草稿或尚未提交的影响确认。离开会丢弃这些本地内容，是否继续？")
    );
  }, []);

  const project = useQuery({
    queryKey: m1QueryKeys.project(userId, projectKey),
    queryFn: ({ signal }) =>
      apiRequest<ProjectDetail>(`/api/v1/projects/${encodeURIComponent(projectKey)}`, {
        signal,
      }),
  });
  const members = useQuery({
    queryKey: m1QueryKeys.members(userId, projectKey),
    queryFn: ({ signal }) =>
      apiRequest<MembershipCollection>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/members`,
        { signal },
      ),
  });
  const roles = useQuery({
    queryKey: m1QueryKeys.roles(userId, projectKey),
    queryFn: ({ signal }) =>
      apiRequest<ProjectLogicalRoleCollection>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/roles`,
        { signal },
      ),
  });

  const adminModeId = project.data ? (activeAdminMode(project.data, new Date())?.id ?? null) : null;
  const parentLocation = useQuery({
    queryKey: m3QueryKeys.location(userId, projectKey, page.parentTaskKey ?? "PROJECT_ROOT"),
    queryFn: ({ signal }) =>
      apiRequest<TaskLocation>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(page.parentTaskKey!)}/ancestors`,
        { signal, adminModeId },
      ),
    enabled: Boolean(page.parentTaskKey && project.data),
    retry: false,
  });
  const expectedParentTaskId = page.parentTaskKey ? (parentLocation.data?.task.id ?? null) : null;
  const scope = useInfiniteQuery({
    queryKey: m3QueryKeys.scope(
      userId,
      projectKey,
      page.parentTaskKey,
      page.lifecycle,
      adminModeId,
    ),
    queryFn: ({ pageParam, signal }) =>
      apiRequest<TaskCollection>(
        taskListPath(
          projectKey,
          page.parentTaskKey,
          page.lifecycle === "history" ? "archived" : "active",
          pageParam,
        ),
        { signal, adminModeId },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(project.data) && (page.parentTaskKey === null || Boolean(parentLocation.data)),
  });
  const selectedTask = useQuery({
    queryKey: m3QueryKeys.task(
      userId,
      projectKey,
      page.selectedTaskKey ?? "NO_SELECTION",
      adminModeId,
    ),
    queryFn: ({ signal }) =>
      apiRequest<TaskResource>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/tasks/${encodeURIComponent(page.selectedTaskKey!)}`,
        { signal, adminModeId },
      ),
    enabled: Boolean(page.selectedTaskKey && project.data),
    retry: false,
  });
  const selectedChildren = useQuery({
    queryKey: m3QueryKeys.children(
      userId,
      projectKey,
      page.selectedTaskKey ?? "NO_SELECTION",
      page.lifecycle,
    ),
    queryFn: ({ signal }) =>
      apiRequest<TaskCollection>(
        taskListPath(
          projectKey,
          page.selectedTaskKey,
          page.lifecycle === "history" ? "archived" : "active",
          null,
        ),
        { signal, adminModeId },
      ),
    enabled: Boolean(selectedTask.data && selectedTask.data.childSummary.total > 0),
  });
  const search = useInfiniteQuery({
    queryKey: m3QueryKeys.search(userId, projectKey, page.searchQuery.trim(), "all"),
    queryFn: ({ pageParam, signal }) =>
      apiRequest<TaskSearchCollection>(
        taskSearchPath(projectKey, page.searchQuery.trim(), pageParam),
        { signal, adminModeId },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: page.searchQuery.trim().length > 0,
    retry: false,
  });

  useEffect(() => {
    onProjectIdentity(
      project.data ? { id: project.data.project.id, key: project.data.project.key } : null,
    );
    return () => onProjectIdentity(null);
  }, [onProjectIdentity, project.data?.project.id, project.data?.project.key]);

  useEffect(() => {
    if (page.projectKey === projectKey) {
      return;
    }
    const next = createTaskPageState(routeForProject(projectKey));
    setPage(next);
    window.history.pushState({ m3TaskState: next }, "", taskRouteUrl(next));
  }, [page.projectKey, projectKey]);

  useEffect(() => {
    window.history.replaceState({ m3TaskState: page }, "", taskRouteUrl(page));
    const onPopState = (event: PopStateEvent) => {
      const route = parseTaskRoute(window.location.search);
      if (!route || route.projectKey !== projectKey) {
        return;
      }
      const next = readTaskHistoryState(event.state, route) ?? createTaskPageState(route);
      const current = pageRef.current;
      if (navigationDiscardsDraft(current, next) && !confirmDraftDiscard()) {
        window.history.pushState({ m3TaskState: current }, "", taskRouteUrl(current));
        return;
      }
      clearDirtySources();
      setPage(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // The initial History entry is normalized once; later page changes use commit helpers.
  }, [clearDirtySources, confirmDraftDiscard, projectKey]);

  useEffect(() => {
    if (dirtyRevision === 0 || dirtySources.current.size === 0) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyRevision]);

  const scopeProjection = useMemo(() => {
    if (!scope.data || !project.data) {
      return { data: null, error: null };
    }
    try {
      return {
        data: validateTaskScope(scope.data.pages, project.data.project.id, expectedParentTaskId),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error("任务图完整性校验失败"),
      };
    }
  }, [expectedParentTaskId, project.data, scope.data]);
  const visibleScope = useMemo(
    () => (scopeProjection.data ? filterTaskScope(scopeProjection.data, page.filters) : null),
    [page.filters, scopeProjection.data],
  );
  const searchResults = useMemo(
    () => search.data?.pages.flatMap((result) => result.results) ?? [],
    [search.data],
  );
  const memberById = useMemo(
    () => new Map(members.data?.members.map((member) => [member.id, member]) ?? []),
    [members.data],
  );
  const roleById = useMemo(
    () => new Map(roles.data?.roles.map((role) => [role.id, role]) ?? []),
    [roles.data],
  );
  const ownerName = useCallback(
    (membershipId: string) => {
      const member = memberById.get(membershipId);
      return member
        ? `${member.displayName}${member.status === "active" ? "" : "（历史成员）"}`
        : `成员 ${membershipId.slice(0, 8)}`;
    },
    [memberById],
  );
  const roleName = useCallback(
    (roleId: string | null) => {
      if (!roleId) {
        return "未指定";
      }
      const role = roleById.get(roleId);
      return role
        ? `${role.name}${role.status === "active" ? "" : "（已归档）"}`
        : `角色 ${roleId.slice(0, 8)}`;
    },
    [roleById],
  );

  const commitPage = useCallback(
    (next: TaskPageState, mode: "push" | "replace", force = false) => {
      const current = pageRef.current;
      if (!force && navigationDiscardsDraft(current, next) && !confirmDraftDiscard()) {
        return false;
      }
      if (navigationDiscardsDraft(current, next)) {
        clearDirtySources();
      }
      viewportRef.current = next.viewport;
      pageRef.current = next;
      setPage(next);
      window.history[mode === "push" ? "pushState" : "replaceState"](
        { m3TaskState: next },
        "",
        taskRouteUrl(next),
      );
      return true;
    },
    [clearDirtySources, confirmDraftDiscard],
  );
  const pushPage = useCallback((next: TaskPageState) => commitPage(next, "push"), [commitPage]);
  const replacePage = useCallback(
    (next: TaskPageState) => commitPage(next, "replace"),
    [commitPage],
  );

  useEffect(() => {
    if (
      page.selectedTaskKey &&
      scopeProjection.data &&
      !scopeProjection.data.tasks.some((task) => task.key === page.selectedTaskKey) &&
      scope.hasNextPage &&
      !scope.isFetchingNextPage
    ) {
      void scope.fetchNextPage();
    }
  }, [
    page.selectedTaskKey,
    scope,
    scope.hasNextPage,
    scope.isFetchingNextPage,
    scopeProjection.data,
  ]);

  useEffect(() => {
    if (!visibleScope || scope.isPending) {
      return;
    }
    const readyAtMs = performance.now();
    window.__m3TaskMetrics = { readyAtMs, visibleNodes: visibleScope.tasks.length };
    document.documentElement.dataset.m3TaskReady = "true";
    document.documentElement.dataset.m3TaskVisibleNodes = String(visibleScope.tasks.length);
    return () => {
      delete document.documentElement.dataset.m3TaskReady;
      delete document.documentElement.dataset.m3TaskVisibleNodes;
    };
  }, [scope.isPending, visibleScope]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(".m3-graph-viewport");
      if (element) {
        element.scrollLeft = page.viewport.left;
        element.scrollTop = page.viewport.top;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [page.lifecycle, page.parentTaskKey, page.viewport.left, page.viewport.top]);

  if (project.isPending) {
    return (
      <p className="notice" role="status">
        正在验证项目和 Task 权限…
      </p>
    );
  }
  if (!project.data) {
    return <ErrorNotice error={project.error} focus />;
  }

  const breadcrumbs = page.parentTaskKey
    ? [
        ...(parentLocation.data?.ancestors ?? []),
        ...(parentLocation.data ? [parentLocation.data.task] : []),
      ]
    : [];
  const selected = selectedTask.data;
  const selectedInScope =
    !selected ||
    (selected.projectId === project.data.project.id &&
      selected.parentTaskId === expectedParentTaskId &&
      (page.lifecycle === "history"
        ? selected.archiveLifecycle === "archived"
        : selected.archiveLifecycle === "active"));
  const taskById = new Map(scopeProjection.data?.tasks.map((task) => [task.id, task]) ?? []);
  const predecessorKeys =
    selected && scopeProjection.data
      ? scopeProjection.data.dependencies
          .filter((dependency) => dependency.successorTaskId === selected.id)
          .map((dependency) => taskById.get(dependency.predecessorTaskId)?.key)
          .filter((key): key is string => Boolean(key))
      : [];
  const successorKeys =
    selected && scopeProjection.data
      ? scopeProjection.data.dependencies
          .filter((dependency) => dependency.predecessorTaskId === selected.id)
          .map((dependency) => taskById.get(dependency.successorTaskId)?.key)
          .filter((key): key is string => Boolean(key))
      : [];

  return (
    <div className="m3-task-workspace">
      <header className="panel m3-project-header">
        <div>
          <p className="eyebrow">{project.data.project.key} · Production Task UI</p>
          <h2>{project.data.project.name} / 任务</h2>
          <p>当前父级只显示一幅同级 DAG。依赖方向始终为 predecessor → successor。</p>
        </div>
        <div className="status-cluster">
          <span className="status-badge">
            {page.lifecycle === "active" ? "活动任务" : "归档历史 · 只读"}
          </span>
          <span className="status-badge">图版本 {scopeProjection.data?.graphVersion ?? "—"}</span>
          {adminModeId && (
            <span className="status-badge status-badge--admin">管理员模式已生效</span>
          )}
        </div>
      </header>

      <AdminModePanel detail={project.data} projectKey={projectKey} userId={userId} />

      <nav className="m3-breadcrumbs" aria-label="任务层级">
        <button
          aria-current={page.parentTaskKey === null ? "page" : undefined}
          type="button"
          onClick={() => pushPage(navigateTaskScope(page, null))}
        >
          {projectKey} 项目根
        </button>
        {breadcrumbs.map((ancestor) => (
          <span key={ancestor.id}>
            <span aria-hidden="true">/</span>
            <button
              aria-current={ancestor.key === page.parentTaskKey ? "page" : undefined}
              type="button"
              onClick={() => pushPage(navigateTaskScope(page, ancestor.key))}
            >
              {ancestor.key}
            </button>
          </span>
        ))}
        <button
          className="m3-back"
          disabled={page.parentTaskKey === null}
          type="button"
          onClick={() =>
            pushPage(navigateTaskScope(page, parentLocation.data?.task.parentTaskKey ?? null))
          }
        >
          ← 返回上一级
        </button>
      </nav>

      <section className="panel m3-controls" aria-label="任务搜索和筛选">
        {page.lifecycle === "active" && (
          <TaskCreatePanel
            adminModeId={adminModeId}
            disabled={project.data.project.lifecycle !== "active"}
            members={members.data?.members ?? []}
            parentTaskKey={page.parentTaskKey}
            projectKey={projectKey}
            roles={roles.data?.roles ?? []}
            userId={userId}
            onDirtyChange={createDirty}
          />
        )}
        <div className="m3-control-row">
          <label className="m3-search-field">
            项目级 Task Key / 标题搜索
            <input
              maxLength={240}
              placeholder="例如 GAME-42 或“角色移动”"
              value={page.searchQuery}
              onChange={(event) => replacePage(updateTaskSearchQuery(page, event.target.value))}
            />
          </label>
          {page.searchBefore && (
            <button
              className="secondary"
              type="button"
              onClick={() => pushPage(returnFromTaskSearch(page))}
            >
              返回搜索前位置
            </button>
          )}
          <button
            className="secondary"
            type="button"
            onClick={() =>
              pushPage(
                navigateTaskScope(page, null, page.lifecycle === "active" ? "history" : "active"),
              )
            }
          >
            {page.lifecycle === "active" ? "查看归档历史" : "返回活动任务"}
          </button>
        </div>

        {page.searchQuery.trim() && (
          <div className="m3-search-results" aria-live="polite">
            {search.isPending ? (
              <p className="notice">正在搜索当前项目…</p>
            ) : searchResults.length ? (
              <>
                <ul>
                  {searchResults.map((result) => (
                    <li key={result.task.id}>
                      <button
                        type="button"
                        onClick={() => pushPage(locateSearchResult(page, result))}
                      >
                        <strong>{result.task.key}</strong>
                        <span>{result.task.title}</span>
                        <small>
                          {result.task.archiveLifecycle === "archived" ? "归档" : "活动"} ·{" "}
                          {[...result.ancestors.map((item) => item.key), result.task.key].join(
                            " / ",
                          )}
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
                {search.hasNextPage && (
                  <button
                    className="secondary compact"
                    disabled={search.isFetchingNextPage}
                    type="button"
                    onClick={() => void search.fetchNextPage()}
                  >
                    {search.isFetchingNextPage ? "加载中…" : "加载更多搜索结果"}
                  </button>
                )}
              </>
            ) : (
              <p className="empty-state">没有可访问的匹配任务。</p>
            )}
            <ErrorNotice error={search.error} />
          </div>
        )}

        <TaskFiltersForm
          filters={page.filters}
          labels={[
            ...new Set(scopeProjection.data?.tasks.flatMap((task) => task.labels) ?? []),
          ].sort()}
          members={members.data?.members ?? []}
          roles={roles.data?.roles ?? []}
          onChange={(patch) => {
            if (!scopeProjection.data) {
              return;
            }
            replacePage(updateTaskFilters(page, patch, scopeProjection.data.tasks));
          }}
          onClear={() => {
            if (!scopeProjection.data) {
              return;
            }
            replacePage(updateTaskFilters(page, createTaskFilters(), scopeProjection.data.tasks));
          }}
        />
      </section>

      <TaskDependencyRequests
        adminModeId={adminModeId}
        currentMembershipId={project.data.currentMembership.id}
        memberName={ownerName}
        projectKey={projectKey}
        tasks={scopeProjection.data?.tasks ?? []}
        userId={userId}
      />

      <ErrorNotice error={parentLocation.error} focus />
      <ErrorNotice error={scope.error} focus />
      <ErrorNotice error={scopeProjection.error} focus />
      <ErrorNotice error={members.error} />
      <ErrorNotice error={roles.error} />

      {scope.isPending || !visibleScope ? (
        <p className="notice" role="status">
          正在读取当前层任务和依赖…
        </p>
      ) : (
        <>
          <div className="m3-scope-summary" aria-live="polite">
            <span>
              已加载 {scopeProjection.data?.tasks.length ?? 0} 个节点；当前筛选显示{" "}
              {visibleScope.tasks.length} 个。
            </span>
            {visibleScope.hiddenDependencyCount > 0 && (
              <span>
                {visibleScope.hiddenDependencyCount}{" "}
                条同级关系因筛选或分页隐藏；只绘制两端可见的边。
              </span>
            )}
            {scope.hasNextPage && (
              <button
                className="secondary compact"
                disabled={scope.isFetchingNextPage}
                type="button"
                onClick={() => void scope.fetchNextPage()}
              >
                {scope.isFetchingNextPage ? "加载中…" : "按 Task Key 加载下一页"}
              </button>
            )}
          </div>
          <div className={selected ? "m3-stage m3-stage--drawer" : "m3-stage"}>
            <TaskGraph
              ownerName={ownerName}
              scope={visibleScope}
              selectedTaskKey={page.selectedTaskKey}
              viewport={page.viewport}
              onClose={() => pushPage(selectTaskKey(page, null))}
              onSelect={(task) => pushPage(selectTaskKey(page, task.key))}
              onViewport={(viewport) => {
                viewportRef.current = viewport;
                setPage((current) => {
                  const next = updateTaskViewport(current, viewport);
                  window.history.replaceState({ m3TaskState: next }, "", taskRouteUrl(next));
                  return next;
                });
              }}
            />
            {page.selectedTaskKey && selectedTask.isPending && (
              <p className="notice m3-drawer-loading" role="status">
                正在读取任务详情…
              </p>
            )}
            <ErrorNotice error={selectedTask.error} focus />
            {selected && selectedInScope && (
              <TaskDrawer
                adminModeId={adminModeId}
                children={selectedChildren.data ?? null}
                childrenError={selectedChildren.error}
                history={page.lifecycle === "history"}
                memberName={ownerName}
                members={members.data?.members ?? []}
                predecessorKeys={predecessorKeys}
                projectKey={projectKey}
                projectReopenPolicy={project.data.project.completedSuccessorReopenPolicy}
                roleName={roleName}
                roles={roles.data?.roles ?? []}
                scopeGraphVersion={scopeProjection.data?.graphVersion ?? selected.graphVersion}
                scopeTasks={scopeProjection.data?.tasks ?? []}
                sourceParentTaskKey={page.parentTaskKey}
                successorKeys={successorKeys}
                task={selected}
                userId={userId}
                onClose={() => pushPage(selectTaskKey(page, null))}
                onDirtyChange={drawerDirty}
                onEnterChildren={() => pushPage(navigateTaskScope(page, selected.key))}
                onMoved={(targetParentTaskKey) => {
                  commitPage(
                    selectTaskKey(navigateTaskScope(page, targetParentTaskKey), selected.key),
                    "push",
                    true,
                  );
                }}
                onRemoved={(operation) => {
                  const next =
                    operation === "archive"
                      ? selectTaskKey(navigateTaskScope(page, null, "history"), selected.key)
                      : selectTaskKey(page, null);
                  commitPage(next, "push", true);
                }}
              />
            )}
            {selected && !selectedInScope && (
              <div className="error m3-drawer-loading" role="alert">
                <strong>任务不属于当前层或生命周期已变化。</strong>
                <span>请刷新搜索结果或返回当前层；系统不会跨作用域显示该任务。</span>
                <button
                  className="secondary compact"
                  type="button"
                  onClick={() => pushPage(selectTaskKey(page, null))}
                >
                  返回当前层
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TaskFiltersForm({
  filters,
  members,
  roles,
  labels,
  onChange,
  onClear,
}: {
  filters: TaskFilters;
  members: MembershipCollection["members"];
  roles: ProjectLogicalRoleCollection["roles"];
  labels: readonly string[];
  onChange: (patch: Partial<TaskFilters>) => void;
  onClear: () => void;
}) {
  const change =
    <TKey extends keyof TaskFilters>(key: TKey) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ [key]: event.target.value } as Pick<TaskFilters, TKey>);

  return (
    <div className="m3-filter-grid">
      <label>
        有效 Owner
        <select value={filters.ownerMembershipId} onChange={change("ownerMembershipId")}>
          <option value="">全部</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
              {member.status === "active" ? "" : "（历史）"}
            </option>
          ))}
        </select>
      </label>
      <label>
        逻辑角色
        <select value={filters.logicalRoleId} onChange={change("logicalRoleId")}>
          <option value="">全部</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
              {role.status === "active" ? "" : "（已归档）"}
            </option>
          ))}
        </select>
      </label>
      <label>
        有效状态
        <select value={filters.effectiveStatus} onChange={change("effectiveStatus")}>
          <option value="">全部</option>
          <option value="not_started">未开始</option>
          <option value="in_progress">进行中</option>
          <option value="blocked">已阻塞</option>
          <option value="done">已完成</option>
        </select>
      </label>
      <label>
        截止时间
        <select value={filters.due} onChange={change("due")}>
          <option value="all">全部</option>
          <option value="overdue">已逾期</option>
          <option value="scheduled">已设置</option>
          <option value="none">未设置</option>
        </select>
      </label>
      <label>
        标签
        <input list="m3-label-options" value={filters.label} onChange={change("label")} />
        <datalist id="m3-label-options">
          {labels.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
      </label>
      <button className="secondary compact" type="button" onClick={onClear}>
        清除筛选
      </button>
    </div>
  );
}

function routeForProject(projectKey: string): TaskRoute {
  const route = parseTaskRoute(window.location.search);
  return route?.projectKey === projectKey
    ? route
    : {
        projectKey,
        parentTaskKey: null,
        selectedTaskKey: null,
        lifecycle: "active",
      };
}

function navigationDiscardsDraft(current: TaskPageState, next: TaskPageState): boolean {
  return (
    current.projectKey !== next.projectKey ||
    current.parentTaskKey !== next.parentTaskKey ||
    current.selectedTaskKey !== next.selectedTaskKey ||
    current.lifecycle !== next.lifecycle
  );
}
