import type { SessionActor, UserProfile } from "@ngapd/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { apiRequest } from "../api.js";
import { AccessPanel } from "./AccessPanel.js";
import { AuthGate } from "./AuthGate.js";
import { firstVisibleGrapheme, m1QueryKeys, type CurrentProjectIdentity } from "./model.js";
import { ProfilePanel } from "./ProfilePanel.js";
import { ProjectsPanel } from "./ProjectsPanel.js";
import { useResourceEvents } from "./use-resource-events.js";

type AppView = "projects" | "profile" | "access";

export function M1App() {
  return (
    <AuthGate>
      {(actor, logout, logoutPending) => (
        <AuthenticatedWorkspace actor={actor} logout={logout} logoutPending={logoutPending} />
      )}
    </AuthGate>
  );
}

function AuthenticatedWorkspace({
  actor,
  logout,
  logoutPending,
}: {
  actor: SessionActor;
  logout: () => void;
  logoutPending: boolean;
}) {
  const [view, setView] = useState<AppView>("projects");
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<CurrentProjectIdentity | null>(null);
  const profile = useQuery({
    queryKey: m1QueryKeys.profile(actor.userId),
    queryFn: ({ signal }) => apiRequest<UserProfile>("/api/v1/users/me/profile", { signal }),
  });

  useResourceEvents(actor.userId, currentProject);

  const displayName = profile.data?.displayName ?? actor.loginName;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="NGAPD 首页">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          <span>
            <strong>NGAPD</strong>
            <small>AI 原生敏捷协作</small>
          </span>
        </a>
        <div className="account-menu">
          <span className="avatar" aria-hidden="true">
            {firstVisibleGrapheme(displayName)}
          </span>
          <span className="account-name">
            <strong>{displayName}</strong>
            <small>{actor.loginName}</small>
          </span>
          <button
            className="secondary compact"
            disabled={logoutPending}
            type="button"
            onClick={logout}
          >
            {logoutPending ? "退出中…" : "退出"}
          </button>
          <span className="sr-only">{displayName}的头像占位符</span>
        </div>
      </header>

      <div className="workspace-layout">
        <nav className="side-nav" aria-label="主要导航">
          <p className="side-nav-label">工作区</p>
          <NavButton active={view === "projects"} onClick={() => setView("projects")}>
            <span aria-hidden="true">◇</span>
            项目
          </NavButton>
          <NavButton active={view === "profile"} onClick={() => setView("profile")}>
            <span aria-hidden="true">◎</span>
            个人资料
          </NavButton>
          <NavButton active={view === "access"} onClick={() => setView("access")}>
            <span aria-hidden="true">⌁</span>
            设备与 Workspace
          </NavButton>
          <div className="side-note">
            <strong>服务端权限为准</strong>
            <p>页面按钮只反映最新 actions；每次写入仍会重新授权。</p>
          </div>
        </nav>

        <main className="main-content" id="main-content">
          {view === "projects" && (
            <ProjectsPanel
              onProjectIdentity={setCurrentProject}
              onSelectProject={setSelectedProjectKey}
              selectedProjectKey={selectedProjectKey}
              userId={actor.userId}
            />
          )}
          {view === "profile" && <ProfilePanel userId={actor.userId} />}
          {view === "access" && <AccessPanel />}
        </main>
      </div>
    </div>
  );
}

function NavButton({
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
      className={active ? "nav-button nav-button--active" : "nav-button"}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
