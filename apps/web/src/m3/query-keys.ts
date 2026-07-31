export const m3QueryKeys = {
  root: (userId: string) => ["m3", userId] as const,
  project: (userId: string, projectKey: string) => ["m3", userId, "project", projectKey] as const,
  scope: (
    userId: string,
    projectKey: string,
    parentTaskKey: string | null,
    lifecycle: "active" | "history",
    adminModeId: string | null,
  ) =>
    [
      "m3",
      userId,
      "project",
      projectKey,
      "scope",
      lifecycle,
      parentTaskKey ?? "root",
      adminModeId ?? "member",
    ] as const,
  task: (userId: string, projectKey: string, taskKey: string, adminModeId: string | null) =>
    ["m3", userId, "project", projectKey, "task", taskKey, adminModeId ?? "member"] as const,
  location: (userId: string, projectKey: string, taskKey: string) =>
    ["m3", userId, "project", projectKey, "location", taskKey] as const,
  search: (
    userId: string,
    projectKey: string,
    query: string,
    lifecycle: "active" | "archived" | "all",
  ) => ["m3", userId, "project", projectKey, "search", lifecycle, query] as const,
  children: (
    userId: string,
    projectKey: string,
    taskKey: string,
    lifecycle: "active" | "history",
  ) => ["m3", userId, "project", projectKey, "children", lifecycle, taskKey] as const,
  comments: (userId: string, projectKey: string, taskKey: string, adminModeId: string | null) =>
    [
      "m3",
      userId,
      "project",
      projectKey,
      "task",
      taskKey,
      "comments",
      adminModeId ?? "member",
    ] as const,
  activity: (userId: string, projectKey: string, taskKey: string, adminModeId: string | null) =>
    [
      "m3",
      userId,
      "project",
      projectKey,
      "task",
      taskKey,
      "activity",
      adminModeId ?? "member",
    ] as const,
  workspaceFiles: (
    userId: string,
    projectKey: string,
    taskKey: string,
    adminModeId: string | null,
  ) =>
    [
      "m3",
      userId,
      "project",
      projectKey,
      "task",
      taskKey,
      "workspace-files",
      adminModeId ?? "member",
    ] as const,
  dependencyRequests: (userId: string, projectKey: string, adminModeId: string | null) =>
    ["m3", userId, "project", projectKey, "dependency-requests", adminModeId ?? "member"] as const,
  notifications: (userId: string) => ["m3", userId, "notifications"] as const,
  notificationPreference: (userId: string, eventType: string) =>
    ["m3", userId, "notifications", "preference", eventType] as const,
} as const;
