import {
  buildTaskUiIndex,
  createTaskUiFixture,
  TASK_UI_DATASET_SPEC,
  type TaskEffectiveStatus,
  type TaskLogicalRole,
  type TaskProfileId,
  type TaskUiIndex,
  type TaskUiTask,
} from "@ngapd/test-fixtures/task-graph";
import {
  type ChangeEvent,
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { layoutTaskGraph, nextNodeForArrow, type ArrowDirection } from "./layout.js";
import {
  breadcrumbsForScope,
  closeTaskDrawer,
  createEmptyFilters,
  createInitialTaskUiState,
  enterSelectedTask,
  filterTaskScope,
  navigateToScope,
  returnFromSearch,
  searchTasks,
  selectSearchResult,
  selectTask,
  updateFilters,
  updateSearchQuery,
  updateViewport,
  type TaskUiState,
  type TaskUiViewport,
} from "./model.js";
import "./task-ui.css";

declare global {
  interface Window {
    __taskUiMetrics?: {
      interactiveAtMs: number;
      interactions: Array<{ name: string; durationMs: number }>;
    };
  }
}

const PROFILE_LABELS: Record<TaskProfileId, string> = {
  "deep-tree": "深层任务树",
  "wide-siblings": "200 节点宽层级",
  "dense-dag": "36 节点密集 DAG",
};

const ROLE_LABELS: Record<TaskLogicalRole, string> = {
  programming: "程序",
  art: "美术",
  design: "策划",
  music: "音乐",
};

const STATUS_LABELS: Record<TaskEffectiveStatus, string> = {
  pending: "未开始",
  in_progress: "进行中",
  blocked: "已阻塞",
  completed: "已完成",
};

const DISPLAY_LABELS = {
  normal: "普通",
  sprint: "冲刺",
  milestone: "里程碑",
} as const;

const DISPLAY_ICONS = {
  normal: "□",
  sprint: "⚡",
  milestone: "◆",
} as const;

export function TaskUiApp() {
  const initialProfile = readInitialProfile();
  const [state, setState] = useState<TaskUiState>(() => createInitialTaskUiState(initialProfile));
  const fixtureResult = useMemo(() => createFixtureResult(state.profileId), [state.profileId]);

  if (fixtureResult.error) {
    return <TaskUiError error={fixtureResult.error} profileId={state.profileId} />;
  }

  return (
    <TaskUiWorkspace
      fixture={fixtureResult.fixture}
      index={fixtureResult.index}
      state={state}
      setState={setState}
    />
  );
}

function TaskUiWorkspace({
  fixture,
  index,
  state,
  setState,
}: {
  fixture: ReturnType<typeof createTaskUiFixture>;
  index: TaskUiIndex;
  state: TaskUiState;
  setState: Dispatch<SetStateAction<TaskUiState>>;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const latestViewport = useRef<TaskUiViewport>(state.viewport);
  const pendingInteractions = useRef<Array<{ name: string; startedAt: number }>>([]);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  const scope = useMemo(
    () => filterTaskScope(index, state.parentTaskId, state.filters),
    [index, state.filters, state.parentTaskId],
  );
  const layout = useMemo(
    () => layoutTaskGraph(scope.tasks, scope.dependencies),
    [scope.dependencies, scope.tasks],
  );
  const selectedTask = state.selectedTaskId
    ? (index.tasksById.get(state.selectedTaskId) ?? null)
    : null;
  const selectedRelations = useMemo(() => {
    const predecessors = new Set<string>();
    const successors = new Set<string>();
    const dependencyIds = new Set<string>();
    if (state.selectedTaskId) {
      for (const dependency of scope.dependencies) {
        if (dependency.successorTaskId === state.selectedTaskId) {
          predecessors.add(dependency.predecessorTaskId);
          dependencyIds.add(dependency.id);
        }
        if (dependency.predecessorTaskId === state.selectedTaskId) {
          successors.add(dependency.successorTaskId);
          dependencyIds.add(dependency.id);
        }
      }
    }
    return { predecessors, successors, dependencyIds };
  }, [scope.dependencies, state.selectedTaskId]);
  const searchResults = useMemo(
    () => searchTasks(index, state.searchQuery),
    [index, state.searchQuery],
  );
  const breadcrumbs = useMemo(
    () => breadcrumbsForScope(index, state.parentTaskId),
    [index, state.parentTaskId],
  );
  const currentParent = state.parentTaskId ? index.tasksById.get(state.parentTaskId) : null;

  useEffect(() => {
    const interactiveAtMs = performance.now();
    window.__taskUiMetrics = { interactiveAtMs, interactions: [] };
    document.documentElement.dataset.taskUiReady = "true";
    document.documentElement.dataset.taskUiInteractiveMs = interactiveAtMs.toFixed(2);
    document.documentElement.dataset.taskUiMetrics = "[]";
  }, []);

  useLayoutEffect(() => {
    if (pendingInteractions.current.length === 0) {
      return;
    }

    const committedAt = performance.now();
    const completed = pendingInteractions.current.splice(0);
    for (const interaction of completed) {
      window.__taskUiMetrics?.interactions.push({
        name: interaction.name,
        durationMs: committedAt - interaction.startedAt,
      });
    }
    document.documentElement.dataset.taskUiMetrics = JSON.stringify(
      window.__taskUiMetrics?.interactions ?? [],
    );
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (viewport) {
        viewport.scrollLeft = state.viewport.left;
        viewport.scrollTop = state.viewport.top;
        latestViewport.current = state.viewport;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [state.parentTaskId, state.profileId, state.viewport]);

  useEffect(() => {
    if (focusedTaskId === null || !layout.nodes.some((node) => node.task.id === focusedTaskId)) {
      setFocusedTaskId(layout.nodes[0]?.task.id ?? null);
    }
  }, [focusedTaskId, layout.nodes]);

  const commit = (name: string, update: (current: TaskUiState) => TaskUiState): void => {
    pendingInteractions.current.push({ name, startedAt: performance.now() });
    setState((current) => update(updateViewport(current, latestViewport.current)));
  };

  const focusNode = (taskId: string): void => {
    setFocusedTaskId(taskId);
    requestAnimationFrame(() => nodeRefs.current.get(taskId)?.focus());
  };

  const closeDrawer = (): void => {
    const taskId = state.selectedTaskId;
    commit("close-drawer", closeTaskDrawer);
    if (taskId) {
      focusNode(taskId);
    }
  };

  const handleNodeKeyDown = (event: KeyboardEvent<HTMLButtonElement>, taskId: string): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commit("select", (current) => selectTask(current, taskId, index));
      return;
    }
    const direction = arrowDirection(event.key);
    if (direction) {
      event.preventDefault();
      focusNode(nextNodeForArrow(layout, taskId, direction));
    }
  };

  const changeProfile = (event: ChangeEvent<HTMLSelectElement>): void => {
    const profileId = event.target.value as TaskProfileId;
    latestViewport.current = { left: 0, top: 0 };
    setState(createInitialTaskUiState(profileId));
  };

  return (
    <main className="task-ui">
      <header className="task-ui__header">
        <div>
          <p className="task-ui__eyebrow">NGAPD · Task UI Prototype</p>
          <h1>平铺树状任务界面</h1>
          <p>当前父级只显示一幅同级 DAG。选择节点查看详情，通过抽屉中的专用按钮进入下一层。</p>
        </div>
        <label className="task-ui__profile">
          数据场景
          <select value={state.profileId} onChange={changeProfile}>
            {TASK_UI_DATASET_SPEC.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {PROFILE_LABELS[profile.id]}
              </option>
            ))}
          </select>
        </label>
      </header>

      <nav className="task-ui__breadcrumbs" aria-label="任务层级">
        <button
          type="button"
          aria-current={state.parentTaskId === null ? "page" : undefined}
          onClick={() => commit("breadcrumb", (current) => navigateToScope(current, null, index))}
        >
          项目 ZERO
        </button>
        {breadcrumbs.map((task) => (
          <span key={task.id}>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              aria-current={task.id === state.parentTaskId ? "page" : undefined}
              onClick={() =>
                commit("breadcrumb", (current) => navigateToScope(current, task.id, index))
              }
            >
              {task.key}
            </button>
          </span>
        ))}
        <button
          className="task-ui__back"
          type="button"
          disabled={state.parentTaskId === null}
          onClick={() => {
            const parentId = currentParent?.parentTaskId ?? null;
            commit("navigate-up", (current) => navigateToScope(current, parentId, index));
          }}
        >
          ← 返回上一级
        </button>
      </nav>

      <section className="task-ui__controls" aria-label="搜索和筛选">
        <div className="task-ui__search">
          <label>
            项目级搜索
            <input
              value={state.searchQuery}
              placeholder="输入 Task Key 或标题"
              onChange={(event) => {
                const searchQuery = event.target.value;
                commit("search", (current) => updateSearchQuery(current, searchQuery));
              }}
            />
          </label>
          {state.searchQuery.trim() && (
            <div className="task-ui__search-results" aria-live="polite">
              {searchResults.length > 0 ? (
                searchResults.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() =>
                      commit("search-locate", (current) => selectSearchResult(current, task))
                    }
                  >
                    <strong>{task.key}</strong>
                    <span>{task.title}</span>
                  </button>
                ))
              ) : (
                <p>
                  未找到匹配任务。
                  <button
                    type="button"
                    onClick={() =>
                      commit("search-clear", (current) => updateSearchQuery(current, ""))
                    }
                  >
                    清除搜索
                  </button>
                </p>
              )}
            </div>
          )}
          {state.searchBefore && (
            <button
              className="task-ui__restore"
              type="button"
              onClick={() => commit("search-restore", returnFromSearch)}
            >
              返回搜索前位置
            </button>
          )}
        </div>

        <FilterSelect
          label="有效 Owner"
          value={state.filters.ownerId}
          options={fixture.owners.map((owner) => ({ value: owner.id, label: owner.name }))}
          onChange={(ownerId) =>
            commit("filter-owner", (current) => updateFilters(current, index, { ownerId }))
          }
        />
        <FilterSelect
          label="逻辑角色"
          value={state.filters.role}
          options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(role) =>
            commit("filter-role", (current) =>
              updateFilters(current, index, { role: role as TaskLogicalRole | "" }),
            )
          }
        />
        <FilterSelect
          label="有效状态"
          value={state.filters.status}
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(status) =>
            commit("filter-status", (current) =>
              updateFilters(current, index, { status: status as TaskEffectiveStatus | "" }),
            )
          }
        />
        <FilterSelect
          label="截止时间"
          value={state.filters.due}
          showAll={false}
          options={[
            { value: "all", label: "全部" },
            { value: "scheduled", label: "有截止时间" },
            { value: "overdue", label: "已逾期" },
            { value: "none", label: "无截止时间" },
          ]}
          onChange={(due) =>
            commit("filter-due", (current) =>
              updateFilters(current, index, {
                due: due as "all" | "scheduled" | "overdue" | "none",
              }),
            )
          }
        />
        <FilterSelect
          label="标签"
          value={state.filters.label}
          options={TASK_UI_DATASET_SPEC.requiredLabels.map((label) => ({
            value: label,
            label,
          }))}
          onChange={(label) =>
            commit("filter-label", (current) => updateFilters(current, index, { label }))
          }
        />
        <button
          className="task-ui__clear"
          type="button"
          onClick={() =>
            commit("filter-clear", (current) => ({
              ...updateFilters(current, index, createEmptyFilters()),
              filters: createEmptyFilters(),
            }))
          }
        >
          清除筛选
        </button>
      </section>

      <section className="task-ui__stage">
        <div className="task-ui__scope-summary">
          <div>
            <span>当前作用域</span>
            <strong>
              {currentParent ? `${currentParent.key} · ${currentParent.title}` : "项目根"}
            </strong>
          </div>
          <p>
            显示 {scope.tasks.length} /{" "}
            {index.childrenByParentId.get(state.parentTaskId)?.length ?? 0} 个节点 ·{" "}
            {scope.dependencies.length} 条 predecessor → successor 依赖
          </p>
          {scope.hiddenDependencyCount > 0 && (
            <p className="task-ui__hidden-edges" role="status">
              ⤫ 有 {scope.hiddenDependencyCount} 条依赖连接到已隐藏节点
            </p>
          )}
          {selectedTask && (
            <p className="task-ui__relations" role="status">
              直接前置 {selectedRelations.predecessors.size} · 直接后续{" "}
              {selectedRelations.successors.size}
            </p>
          )}
        </div>

        <div className="task-ui__canvas-wrap">
          {scope.tasks.length === 0 ? (
            <EmptyScope
              hasFilters={Object.values(state.filters).some((value) => value && value !== "all")}
              onClear={() =>
                commit("filter-clear-empty", (current) =>
                  updateFilters(current, index, createEmptyFilters()),
                )
              }
            />
          ) : (
            <div
              ref={viewportRef}
              className="task-ui__viewport"
              aria-label="当前父级任务依赖图"
              onScroll={(event) => {
                latestViewport.current = {
                  left: event.currentTarget.scrollLeft,
                  top: event.currentTarget.scrollTop,
                };
              }}
            >
              <div
                className="task-ui__canvas"
                style={{ width: layout.width, height: layout.height }}
              >
                <svg
                  className="task-ui__edges"
                  width={layout.width}
                  height={layout.height}
                  aria-label="有向依赖，箭头从前置任务指向后续任务"
                >
                  <defs>
                    <marker
                      id="task-ui-arrow"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" />
                    </marker>
                  </defs>
                  {layout.edges.map((edge) => (
                    <path
                      key={edge.dependency.id}
                      className={
                        selectedTask
                          ? selectedRelations.dependencyIds.has(edge.dependency.id)
                            ? "task-ui__edge task-ui__edge--related"
                            : "task-ui__edge task-ui__edge--muted"
                          : "task-ui__edge"
                      }
                      d={edge.path}
                      markerEnd="url(#task-ui-arrow)"
                    />
                  ))}
                </svg>
                {layout.nodes.map((node) => {
                  const task = node.task;
                  const isSelected = task.id === state.selectedTaskId;
                  const relation = selectedRelations.predecessors.has(task.id)
                    ? "predecessor"
                    : selectedRelations.successors.has(task.id)
                      ? "successor"
                      : null;
                  return (
                    <button
                      key={task.id}
                      ref={(element) => {
                        if (element) {
                          nodeRefs.current.set(task.id, element);
                        } else {
                          nodeRefs.current.delete(task.id);
                        }
                      }}
                      className={`task-ui__node task-ui__node--${task.displayType}${isSelected ? " task-ui__node--selected" : ""}${relation ? ` task-ui__node--${relation}` : ""}`}
                      style={{
                        left: node.x,
                        top: node.y,
                        width: node.width,
                        height: node.height,
                      }}
                      type="button"
                      tabIndex={task.id === focusedTaskId ? 0 : -1}
                      aria-pressed={isSelected}
                      aria-label={`${task.key}，${DISPLAY_LABELS[task.displayType]}，${STATUS_LABELS[task.effectiveStatus]}，${task.title}${relation === "predecessor" ? "，当前选中任务的直接前置" : relation === "successor" ? "，当前选中任务的直接后续" : ""}`}
                      onClick={() => {
                        setFocusedTaskId(task.id);
                        commit("select", (current) => selectTask(current, task.id, index));
                      }}
                      onFocus={() => setFocusedTaskId(task.id)}
                      onKeyDown={(event) => handleNodeKeyDown(event, task.id)}
                    >
                      <span className="task-ui__node-type">
                        <span aria-hidden="true">{DISPLAY_ICONS[task.displayType]}</span>
                        {DISPLAY_LABELS[task.displayType]}
                      </span>
                      <strong>{task.key}</strong>
                      <span title={task.title}>{task.title}</span>
                      <small>
                        {STATUS_LABELS[task.effectiveStatus]} · 子任务 {task.directChildCount}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedTask && (
            <TaskDrawer
              task={selectedTask}
              index={index}
              onClose={closeDrawer}
              onEnter={() => {
                commit("navigate-down", (current) => enterSelectedTask(current, index));
                setFocusedTaskId(index.childrenByParentId.get(selectedTask.id)?.[0]?.id ?? null);
              }}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function TaskDrawer({
  task,
  index,
  onClose,
  onEnter,
}: {
  task: TaskUiTask;
  index: TaskUiIndex;
  onClose: () => void;
  onEnter: () => void;
}) {
  const children = index.childrenByParentId.get(task.id) ?? [];
  const explicitOwner = task.explicitOwnerId
    ? taskOwnerName(task.explicitOwnerId, index)
    : "未显式指定";
  const effectiveOwner = taskOwnerName(task.effectiveOwnerId, index);
  const ownerSource = index.tasksById.get(task.ownerSourceTaskId);

  return (
    <aside className="task-ui__drawer" aria-label={`${task.key} 任务详情`}>
      <header>
        <div>
          <span>
            {DISPLAY_ICONS[task.displayType]} {DISPLAY_LABELS[task.displayType]}
          </span>
          <h2>{task.key}</h2>
        </div>
        <button type="button" aria-label="收回任务详情" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="task-ui__drawer-scroll">
        <h3>{task.title}</h3>
        <p>{task.body}</p>
        <dl>
          <Detail label="有效状态">{STATUS_LABELS[task.effectiveStatus]}</Detail>
          <Detail label="显式 Owner">{explicitOwner}</Detail>
          <Detail label="有效 Owner">{effectiveOwner}</Detail>
          <Detail label="继承来源">{ownerSource?.key ?? task.key}</Detail>
          <Detail label="逻辑角色">{ROLE_LABELS[task.logicalRole]}</Detail>
          <Detail label="截止时间">{formatDueAt(task.dueAtUtc)}</Detail>
          <Detail label="标签">{task.labels.join(" · ")}</Detail>
          <Detail label="直接子任务">
            {task.directChildCount} 个（未开始 {task.childStatusCounts.pending} / 进行中{" "}
            {task.childStatusCounts.inProgress} / 阻塞 {task.childStatusCounts.blocked} / 完成{" "}
            {task.childStatusCounts.completed}）
          </Detail>
        </dl>
        <section className="task-ui__children">
          <h3>直接子任务列表</h3>
          {children.length > 0 ? (
            <ul>
              {children.map((child) => (
                <li key={child.id}>
                  <strong>{child.key}</strong>
                  <span>{child.title}</span>
                  <small>{STATUS_LABELS[child.effectiveStatus]}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>此任务没有直接子任务。列表为空，不会进入其他层级。</p>
          )}
        </section>
      </div>
      <footer>
        <button
          className="task-ui__enter"
          type="button"
          disabled={children.length === 0}
          title={children.length === 0 ? "没有直接子任务，无法进入" : undefined}
          onClick={onEnter}
        >
          {children.length === 0 ? "没有子任务可进入" : "进入子任务视图 →"}
        </button>
      </footer>
    </aside>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  showAll = true,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  showAll?: boolean;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {showAll && <option value="">全部</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyScope({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="task-ui__empty" role="status">
      <span aria-hidden="true">◇</span>
      <h2>{hasFilters ? "当前筛选没有匹配任务" : "当前作用域没有直接子任务"}</h2>
      <p>
        {hasFilters
          ? "清除筛选即可恢复此作用域的完整确定性数据。"
          : "返回上一级或使用面包屑继续浏览。"}
      </p>
      {hasFilters && (
        <button type="button" onClick={onClear}>
          清除筛选
        </button>
      )}
    </div>
  );
}

function TaskUiError({ error, profileId }: { error: Error; profileId: TaskProfileId }) {
  return (
    <main className="task-ui task-ui__error">
      <p className="task-ui__eyebrow">NGAPD · Task UI Prototype</p>
      <h1>原型数据被拒绝</h1>
      <p role="alert">
        profile <strong>{profileId}</strong> 未通过展示前校验：{error.message}
      </p>
      <p>为避免产生误导性的部分 DAG，当前没有渲染任何任务节点或依赖。</p>
    </main>
  );
}

function taskOwnerName(ownerId: string, index: TaskUiIndex): string {
  const ownerLabels: Record<string, string> = {
    "owner-lin": "林岚",
    "owner-chen": "陈澈",
    "owner-zhao": "赵野",
    "owner-he": "何星",
  };
  return ownerLabels[ownerId] ?? index.tasksById.get(ownerId)?.key ?? ownerId;
}

function formatDueAt(dueAtUtc: string | null): string {
  if (!dueAtUtc) {
    return "未设置";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dueAtUtc));
}

function arrowDirection(key: string): ArrowDirection | null {
  if (key === "ArrowLeft") return "left";
  if (key === "ArrowRight") return "right";
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  return null;
}

function readInitialProfile(): TaskProfileId {
  const profile = new URLSearchParams(window.location.search).get("profile");
  return TASK_UI_DATASET_SPEC.profiles.some((candidate) => candidate.id === profile)
    ? (profile as TaskProfileId)
    : "deep-tree";
}

function createFixtureResult(profileId: TaskProfileId):
  | {
      fixture: ReturnType<typeof createTaskUiFixture>;
      index: TaskUiIndex;
      error: null;
    }
  | {
      fixture: null;
      index: null;
      error: Error;
    } {
  try {
    const fixture = createTaskUiFixture(profileId);
    return { fixture, index: buildTaskUiIndex(fixture), error: null };
  } catch (error) {
    return {
      fixture: null,
      index: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
