export interface ProjectLogicalRoleState {
  id: string;
  projectId: string;
  sourceTemplateId: string | null;
  name: string;
  capability: string;
  status: "active" | "archived";
  version: number;
}

export type LogicalRoleOperation = "edit" | "copy" | "archive" | "bind";

export function resolveLogicalRoleOperation(input: {
  role: ProjectLogicalRoleState;
  operation: LogicalRoleOperation;
}): { allowed: true; reason: "allowed" } | { allowed: false; reason: "project_role_archived" } {
  if (input.role.status === "active" || input.operation === "copy") {
    return { allowed: true, reason: "allowed" };
  }
  return { allowed: false, reason: "project_role_archived" };
}

export function logicalRoleGrantsAuthorization(input: {
  roleIds: readonly string[];
  names: readonly string[];
  capabilities: readonly string[];
}): false {
  void input;
  return false;
}
