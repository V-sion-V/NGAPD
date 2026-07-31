import type {
  AdminModeResource,
  ProjectDetail,
  ProjectLogicalRoleResource,
  ProjectMembershipResource,
  ResourceInvalidationEvent,
} from "@ngapd/contracts";
import type { QueryKey } from "@tanstack/react-query";

export const m1QueryKeys = {
  root: (userId: string) => ["m1", userId] as const,
  profile: (userId: string) => ["m1", userId, "profile"] as const,
  templates: (userId: string) => ["m1", userId, "templates"] as const,
  projects: (userId: string) => ["m1", userId, "projects"] as const,
  joinTarget: (userId: string, projectKey: string) =>
    ["m1", userId, "join-target", projectKey] as const,
  project: (userId: string, projectKey: string) => ["m1", userId, "project", projectKey] as const,
  members: (userId: string, projectKey: string) =>
    ["m1", userId, "project", projectKey, "members"] as const,
  joinRequests: (userId: string, projectKey: string) =>
    ["m1", userId, "project", projectKey, "join-requests"] as const,
  roles: (userId: string, projectKey: string) =>
    ["m1", userId, "project", projectKey, "roles"] as const,
  transfers: (userId: string, projectKey: string) =>
    ["m1", userId, "project", projectKey, "ownership-transfers"] as const,
} as const;

export interface CurrentProjectIdentity {
  id: string;
  key: string;
}

export function invalidationQueryKeys(
  userId: string,
  event: ResourceInvalidationEvent,
  currentProject?: CurrentProjectIdentity | null,
): QueryKey[] {
  const m3Root = ["m3", userId] as const;
  const m3Notifications = ["m3", userId, "notifications"] as const;
  if (event.resourceType === "user_profile") {
    return [m1QueryKeys.profile(userId), m3Root];
  }

  const projectKey =
    currentProject && event.projectId && currentProject.id === event.projectId
      ? currentProject.key
      : null;
  const m3Project = projectKey ? (["m3", userId, "project", projectKey] as const) : m3Root;
  switch (event.resourceType) {
    case "project":
      return projectKey
        ? [m1QueryKeys.projects(userId), m1QueryKeys.project(userId, projectKey), m3Project]
        : [m1QueryKeys.projects(userId), m3Root];
    case "membership":
      return projectKey
        ? [
            m1QueryKeys.projects(userId),
            m1QueryKeys.project(userId, projectKey),
            m1QueryKeys.members(userId, projectKey),
            m3Project,
          ]
        : [m1QueryKeys.projects(userId), m3Root];
    case "membership_join_request":
      return projectKey
        ? [
            m1QueryKeys.project(userId, projectKey),
            m1QueryKeys.joinRequests(userId, projectKey),
            m1QueryKeys.members(userId, projectKey),
            m3Project,
          ]
        : [m1QueryKeys.projects(userId), m3Root];
    case "project_role":
      return projectKey
        ? [
            m1QueryKeys.roles(userId, projectKey),
            m1QueryKeys.members(userId, projectKey),
            m3Project,
          ]
        : [m1QueryKeys.projects(userId), m3Root];
    case "ownership_transfer":
      return projectKey
        ? [
            m1QueryKeys.project(userId, projectKey),
            m1QueryKeys.transfers(userId, projectKey),
            m3Project,
          ]
        : [m1QueryKeys.projects(userId), m3Root];
    case "admin_mode":
      return projectKey
        ? [m1QueryKeys.project(userId, projectKey), m3Project]
        : [m1QueryKeys.projects(userId), m3Root];
    default:
      return [m1QueryKeys.root(userId), m3Project, m3Notifications];
  }
}

export function firstVisibleGrapheme(value: string): string {
  const normalized = value.normalize("NFC").trim();
  if (!normalized) {
    return "?";
  }

  const Segmenter = Intl.Segmenter;
  if (Segmenter) {
    for (const item of new Segmenter(undefined, { granularity: "grapheme" }).segment(normalized)) {
      if (hasVisibleCharacter(item.segment)) {
        return item.segment;
      }
    }
  }

  for (const character of normalized) {
    if (hasVisibleCharacter(character)) {
      return character;
    }
  }
  return "?";
}

function hasVisibleCharacter(value: string): boolean {
  return /[^\p{C}\p{Z}]/u.test(value);
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function membershipStatusLabel(membership: ProjectMembershipResource): string {
  const permissionText = membership.permissionLevel === "admin" ? "项目管理员" : "项目成员";
  return `${permissionText} · ${
    membership.status === "active" ? "活动" : membership.status === "pending" ? "待审批" : "已移除"
  }`;
}

export function projectStatusLabel(detail: ProjectDetail): string {
  return detail.project.lifecycle === "active" ? "活动项目" : "已归档项目";
}

export function remainingMinutes(expiresAt: string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 60_000));
}

export function activeAdminMode(detail: ProjectDetail, now: Date): AdminModeResource | null {
  const adminMode = detail.adminMode;
  return adminMode?.status === "active" &&
    adminMode.projectId === detail.project.id &&
    new Date(adminMode.expiresAt).getTime() > now.getTime()
    ? adminMode
    : null;
}

export function canChangeRoleBinding(
  role: ProjectLogicalRoleResource,
  currentlyBound: boolean,
  canEditMembership = false,
): boolean {
  return (
    currentlyBound ||
    (role.status === "active" && (canEditMembership || role.actions.includes("bind")))
  );
}
