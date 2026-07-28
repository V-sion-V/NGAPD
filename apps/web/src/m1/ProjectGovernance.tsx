import type { ProjectDetail, ProjectMutationResponse } from "@ngapd/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { apiRequest } from "../api.js";
import { AdminModePanel } from "./AdminModePanel.js";
import { DangerousAction } from "./DangerousAction.js";
import { ErrorNotice } from "./ErrorNotice.js";
import { JoinRequestsPanel } from "./JoinRequestsPanel.js";
import { MembersPanel } from "./MembersPanel.js";
import {
  activeAdminMode,
  membershipStatusLabel,
  m1QueryKeys,
  newIdempotencyKey,
  projectStatusLabel,
  type CurrentProjectIdentity,
} from "./model.js";
import { OwnershipPanel } from "./OwnershipPanel.js";
import { RolesPanel } from "./RolesPanel.js";

type ProjectView = "overview" | "members" | "roles";

export function ProjectGovernance({
  userId,
  projectKey,
  onIdentity,
}: {
  userId: string;
  projectKey: string;
  onIdentity: (project: CurrentProjectIdentity | null) => void;
}) {
  const [view, setView] = useState<ProjectView>("overview");
  const project = useQuery({
    queryKey: m1QueryKeys.project(userId, projectKey),
    queryFn: ({ signal }) =>
      apiRequest<ProjectDetail>(`/api/v1/projects/${encodeURIComponent(projectKey)}`, { signal }),
  });

  useEffect(() => {
    onIdentity(
      project.data ? { id: project.data.project.id, key: project.data.project.key } : null,
    );
    return () => onIdentity(null);
  }, [onIdentity, project.data?.project.id, project.data?.project.key]);

  if (project.isPending) {
    return (
      <p className="notice" role="status">
        正在打开项目…
      </p>
    );
  }

  if (!project.data) {
    return <ErrorNotice error={project.error} focus />;
  }

  const adminMode = activeAdminMode(project.data, new Date());

  return (
    <section className="project-governance" aria-labelledby="current-project-title">
      <header className="panel project-banner">
        <div>
          <p className="eyebrow">{project.data.project.key}</p>
          <h3 id="current-project-title">{project.data.project.name}</h3>
          <p>{project.data.project.description || "暂无项目说明。"}</p>
        </div>
        <div className="status-cluster" aria-label="项目和成员状态">
          <span className="status-badge">{projectStatusLabel(project.data)}</span>
          <span className="status-badge">
            {membershipStatusLabel(project.data.currentMembership)}
          </span>
          {adminMode && (
            <span className="status-badge status-badge--admin">
              管理员模式已开启 · {projectKey}
            </span>
          )}
        </div>
      </header>

      <nav className="project-tabs" aria-label={`${projectKey} 项目页面`}>
        <ProjectTab active={view === "overview"} onClick={() => setView("overview")}>
          概览与治理
        </ProjectTab>
        <ProjectTab active={view === "members"} onClick={() => setView("members")}>
          成员与申请
        </ProjectTab>
        <ProjectTab active={view === "roles"} onClick={() => setView("roles")}>
          角色目录
        </ProjectTab>
      </nav>

      {view === "overview" && (
        <div className="content-stack">
          <ProjectOverview detail={project.data} projectKey={projectKey} userId={userId} />
          <AdminModePanel detail={project.data} projectKey={projectKey} userId={userId} />
          <OwnershipPanel detail={project.data} projectKey={projectKey} userId={userId} />
        </div>
      )}
      {view === "members" && (
        <div className="content-stack">
          <JoinRequestsPanel detail={project.data} projectKey={projectKey} userId={userId} />
          <MembersPanel
            adminModeId={adminMode?.id ?? null}
            detail={project.data}
            projectKey={projectKey}
            userId={userId}
          />
        </div>
      )}
      {view === "roles" && (
        <RolesPanel
          adminModeId={adminMode?.id ?? null}
          detail={project.data}
          projectKey={projectKey}
          userId={userId}
        />
      )}
    </section>
  );
}

function ProjectOverview({
  userId,
  projectKey,
  detail,
}: {
  userId: string;
  projectKey: string;
  detail: ProjectDetail;
}) {
  const queryClient = useQueryClient();
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const lifecycle = useMutation({
    mutationFn: async () => {
      const result = await apiRequest<ProjectMutationResponse>(
        `/api/v1/projects/${encodeURIComponent(projectKey)}/lifecycle`,
        {
          method: "POST",
          json: {
            expectedVersion: detail.project.version,
            lifecycle: detail.project.lifecycle === "active" ? "archived" : "active",
            idempotencyKey,
          },
        },
      );
      setIdempotencyKey(newIdempotencyKey());
      return result;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: m1QueryKeys.project(userId, projectKey),
        }),
        queryClient.invalidateQueries({
          queryKey: m1QueryKeys.projects(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: m1QueryKeys.root(userId),
        }),
      ]);
    },
    onError: () =>
      queryClient.invalidateQueries({
        queryKey: m1QueryKeys.project(userId, projectKey),
      }),
  });
  const canChangeLifecycle =
    detail.project.lifecycle === "active"
      ? detail.project.actions.includes("archive")
      : detail.project.actions.includes("unarchive");

  return (
    <section className="panel project-overview" aria-labelledby="overview-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Authoritative state</p>
          <h3 id="overview-title">项目状态</h3>
        </div>
        <span className="version-note">项目版本 {detail.project.version}</span>
      </div>
      <dl className="fact-grid">
        <div>
          <dt>生命周期</dt>
          <dd>{detail.project.lifecycle === "active" ? "活动" : "已归档"}</dd>
        </div>
        <div>
          <dt>当前身份</dt>
          <dd>{membershipStatusLabel(detail.currentMembership)}</dd>
        </div>
        <div>
          <dt>服务端 actions</dt>
          <dd>{detail.project.actions.join("、") || "仅查看"}</dd>
        </div>
      </dl>
      {canChangeLifecycle && (
        <DangerousAction
          confirmLabel={detail.project.lifecycle === "active" ? "确认归档项目" : "确认解除归档"}
          consequences={
            detail.project.lifecycle === "active"
              ? [
                  "项目对现有活动成员保持可读，但所有项目范围业务写入会被拒绝。",
                  "现有项目/Task Workspace 写租约与该项目管理员能力将被撤销。",
                  "Project Key、成员、任务、角色和历史不会删除。",
                ]
              : [
                  "项目恢复为活动状态。",
                  "旧 Workspace 租约和管理员模式不会自动恢复，成员必须重新申请。",
                  "已拒绝申请和已移除成员不会自动恢复。",
                ]
          }
          currentState={`${projectStatusLabel(detail)}，版本 ${detail.project.version}`}
          danger={detail.project.lifecycle === "active"}
          onConfirm={() => lifecycle.mutateAsync().then(() => undefined)}
          target={`${detail.project.key} · ${detail.project.name}`}
          title={detail.project.lifecycle === "active" ? "归档项目？" : "解除项目归档？"}
          triggerLabel={detail.project.lifecycle === "active" ? "归档项目" : "解除归档"}
        />
      )}
      <ErrorNotice error={lifecycle.error} focus />
    </section>
  );
}

function ProjectTab({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={active ? "project-tab project-tab--active" : "project-tab"}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
