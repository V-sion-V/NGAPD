export const API_MODULE_NAMES = [
  "identity",
  "projects-membership",
  "roles",
  "tasks",
  "dependency-graph",
  "authorization-audit",
  "workspaces",
  "agent-operations",
  "knowledge-notifications",
] as const;

export type ApiModuleName = (typeof API_MODULE_NAMES)[number];

export const API_MODULE_BOUNDARIES = {
  identity: [],
  "projects-membership": ["identity", "authorization-audit"],
  roles: ["projects-membership", "authorization-audit"],
  tasks: ["projects-membership", "roles", "dependency-graph", "authorization-audit", "workspaces"],
  "dependency-graph": ["tasks", "authorization-audit"],
  "authorization-audit": ["identity", "projects-membership"],
  workspaces: ["identity", "projects-membership", "tasks", "authorization-audit"],
  "agent-operations": ["identity", "tasks", "authorization-audit", "workspaces"],
  "knowledge-notifications": ["projects-membership", "authorization-audit"],
} as const satisfies Record<ApiModuleName, readonly ApiModuleName[]>;

export function canModuleCall(from: ApiModuleName, to: ApiModuleName): boolean {
  return from === to || (API_MODULE_BOUNDARIES[from] as readonly ApiModuleName[]).includes(to);
}
