import type {
  ProjectLogicalRoleResource,
  ProjectMembershipResource,
  TaskCollection,
  TaskResource,
} from "@ngapd/contracts";
import { useEffect, useRef } from "react";

import { ErrorNotice } from "../m1/ErrorNotice.js";
import { TaskCollaboration } from "./TaskCollaboration.js";
import { TaskCreatePanel } from "./TaskCreatePanel.js";
import { TaskEditPanel } from "./TaskEditPanel.js";
import { TaskImpactOperations } from "./TaskImpactOperations.js";
import { TaskSimpleOperations } from "./TaskSimpleOperations.js";

const STATUS_LABEL = {
  not_started: "未开始",
  in_progress: "进行中",
  blocked: "已阻塞",
  done: "已完成",
} as const;

const DISPLAY_LABEL = {
  normal: "普通",
  sprint: "冲刺",
  milestone: "里程碑",
} as const;

export function TaskDrawer({
  task,
  children,
  childrenError,
  roleName,
  memberName,
  predecessorKeys,
  successorKeys,
  history,
  userId,
  projectKey,
  sourceParentTaskKey,
  scopeTasks,
  scopeGraphVersion,
  members,
  roles,
  adminModeId,
  projectReopenPolicy,
  onClose,
  onEnterChildren,
  onDirtyChange,
  onMoved,
  onRemoved,
}: {
  task: TaskResource;
  children: TaskCollection | null;
  childrenError: Error | null;
  roleName: (roleId: string | null) => string;
  memberName: (membershipId: string) => string;
  predecessorKeys: readonly string[];
  successorKeys: readonly string[];
  history: boolean;
  userId: string;
  projectKey: string;
  sourceParentTaskKey: string | null;
  scopeTasks: readonly TaskResource[];
  scopeGraphVersion: number;
  members: readonly ProjectMembershipResource[];
  roles: readonly ProjectLogicalRoleResource[];
  adminModeId: string | null;
  projectReopenPolicy: "deny" | "cascade";
  onClose: () => void;
  onEnterChildren: () => void;
  onDirtyChange: (source: string, dirty: boolean) => void;
  onMoved: (targetParentTaskKey: string | null) => void;
  onRemoved: (operation: "archive" | "delete") => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [task.key]);

  return (
    <aside
      aria-labelledby="m3-task-drawer-title"
      className="m3-task-drawer"
      data-task-key={task.key}
    >
      <header className="m3-task-drawer__header">
        <div>
          <p className="eyebrow">
            {task.key} · {DISPLAY_LABEL[task.displayType]}
          </p>
          <h2 id="m3-task-drawer-title" ref={heading} tabIndex={-1}>
            {task.title}
          </h2>
        </div>
        <button
          aria-label={`关闭 ${task.key} 详情`}
          className="secondary compact"
          type="button"
          onClick={onClose}
        >
          关闭
        </button>
      </header>

      {history && (
        <p className="m3-history-notice" role="status">
          归档历史只读；历史节点和边不参与当前活动计算。
        </p>
      )}

      <section aria-labelledby="m3-task-facts-title">
        <h3 id="m3-task-facts-title">权威任务事实</h3>
        <dl className="m3-fact-grid">
          <Fact label="基础状态" value={STATUS_LABEL[task.baseStatus]} />
          <Fact label="有效状态" value={STATUS_LABEL[task.effectiveStatus]} />
          <Fact
            label="显式 Owner"
            value={
              task.explicitOwnerMembershipId ? memberName(task.explicitOwnerMembershipId) : "继承"
            }
          />
          <Fact
            label="有效 Owner"
            value={`${memberName(task.effectiveOwner.membershipId)}${
              task.effectiveOwner.inherited ? "（继承）" : ""
            }`}
          />
          <Fact label="逻辑角色" value={roleName(task.logicalRoleId)} />
          <Fact
            label="截止时间"
            value={task.dueAt ? new Date(task.dueAt).toLocaleString() : "未设置"}
          />
          <Fact label="完成就绪" value={task.completionReady ? "是" : "否"} />
          <Fact
            label="直接子任务"
            value={`${task.childSummary.total} 个；${task.childSummary.done} 已完成，${task.childSummary.blocked} 已阻塞`}
          />
          <Fact label="Task / Graph 版本" value={`${task.version} / ${task.graphVersion}`} />
          <Fact
            label="Workspace"
            value={`${workspaceLabel(task.workspace.lifecycle)} · 工作周期 ${task.workspace.workCycle} · 同步版本 ${task.workspace.syncVersion}`}
          />
        </dl>
      </section>

      <section aria-labelledby="m3-task-content-title">
        <h3 id="m3-task-content-title">任务正文</h3>
        <pre className="m3-safe-markdown">{task.content || "暂无正文。"}</pre>
        <p className="field-help">Markdown 以安全文本呈现；不会执行 HTML、脚本或正文中的 URL。</p>
      </section>

      <section aria-labelledby="m3-task-labels-title">
        <h3 id="m3-task-labels-title">标签与关系</h3>
        <p>{task.labels.length ? task.labels.join("、") : "无标签"}</p>
        <dl className="m3-relation-list">
          <Fact
            label="前置任务"
            value={predecessorKeys.length ? predecessorKeys.join("、") : "无"}
          />
          <Fact label="后继任务" value={successorKeys.length ? successorKeys.join("、") : "无"} />
        </dl>
      </section>

      <section aria-labelledby="m3-task-children-title">
        <div className="m3-inline-heading">
          <h3 id="m3-task-children-title">直接子任务</h3>
          <button
            className="primary compact"
            disabled={task.childSummary.total === 0}
            title={task.childSummary.total === 0 ? "当前任务没有直接子任务" : undefined}
            type="button"
            onClick={onEnterChildren}
          >
            进入子任务视图
          </button>
        </div>
        {children?.tasks.length ? (
          <ul className="m3-child-list">
            {children.tasks.map((child) => (
              <li key={child.id}>
                <span className="project-key">{child.key}</span>
                <span>
                  <strong>{child.title}</strong>
                  <small>
                    {STATUS_LABEL[child.effectiveStatus]} ·{" "}
                    {memberName(child.effectiveOwner.membershipId)}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">
            {task.childSummary.total > 0 ? "正在读取直接子任务…" : "没有直接子任务。"}
          </p>
        )}
        {children?.nextCursor && (
          <p className="notice">
            直接子任务超过当前摘要页；进入子任务视图后可继续按 Task Key 加载。
          </p>
        )}
        <ErrorNotice error={childrenError} />
      </section>

      <section aria-labelledby="m3-task-actions-title">
        <h3 id="m3-task-actions-title">服务端允许的操作</h3>
        <p>{history ? "历史视图不呈现写入操作。" : task.actions.join("、") || "仅查看"}</p>
        {!history && (
          <div className="m3-task-operations">
            <TaskCreatePanel
              adminModeId={adminModeId}
              disabled={task.baseStatus === "done" || task.archiveLifecycle !== "active"}
              members={members}
              parentTaskKey={task.key}
              projectKey={projectKey}
              roles={roles}
              userId={userId}
              onDirtyChange={(dirty) => onDirtyChange("child-create", dirty)}
            />
            {task.actions.includes("update") && (
              <TaskEditPanel
                adminModeId={adminModeId}
                projectKey={projectKey}
                roles={roles}
                task={task}
                userId={userId}
                onDirtyChange={(dirty) => onDirtyChange("edit", dirty)}
              />
            )}
            <TaskSimpleOperations
              adminModeId={adminModeId}
              graphVersion={scopeGraphVersion}
              memberName={memberName}
              projectKey={projectKey}
              scopeTasks={scopeTasks}
              task={task}
              userId={userId}
              onDirtyChange={(dirty) => onDirtyChange("simple", dirty)}
            />
            <TaskImpactOperations
              adminModeId={adminModeId}
              memberName={memberName}
              members={members}
              predecessorKeys={predecessorKeys}
              projectKey={projectKey}
              projectReopenPolicy={projectReopenPolicy}
              scopeTasks={scopeTasks}
              sourceParentTaskKey={sourceParentTaskKey}
              task={task}
              userId={userId}
              onDirtyChange={(dirty) => onDirtyChange("impact", dirty)}
              onMoved={onMoved}
              onRemoved={onRemoved}
            />
          </div>
        )}
      </section>

      <TaskCollaboration
        adminModeId={adminModeId}
        members={members}
        projectKey={projectKey}
        task={task}
        userId={userId}
        onDirtyChange={(dirty) => onDirtyChange("collaboration", dirty)}
      />
    </aside>
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

function workspaceLabel(lifecycle: TaskResource["workspace"]["lifecycle"]): string {
  switch (lifecycle) {
    case "active":
      return "活动 Workspace";
    case "frozen":
      return "已冻结 Workspace";
    case "archived":
      return "已归档 Workspace";
    case "deleted":
      return "已删除 Workspace";
  }
}
