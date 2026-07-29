export type TaskDisplayType = "normal" | "sprint" | "milestone";

export interface TaskEditableFields {
  title: string;
  content: string;
  logicalRoleId: string | null;
  dueAt: string | null;
  labels: readonly string[];
  displayType: TaskDisplayType;
}

export type TaskFieldValidation =
  | {
      ok: true;
      fields: {
        title: string;
        content: string;
        logicalRoleId: string | null;
        dueAt: string | null;
        labels: string[];
        displayType: TaskDisplayType;
      };
    }
  | {
      ok: false;
      reason:
        | "title_invalid"
        | "content_invalid"
        | "logical_role_invalid"
        | "due_at_invalid"
        | "labels_invalid"
        | "display_type_invalid";
    };

const UTC_RFC_3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;

export function validateTaskFields(
  fields: TaskEditableFields,
  role:
    | { required: false }
    | {
        required: true;
        exists: boolean;
        projectMatches: boolean;
        status: "active" | "archived" | null;
      },
): TaskFieldValidation {
  const title = fields.title.trim();
  if (title.length < 1 || title.length > 240) {
    return { ok: false, reason: "title_invalid" };
  }
  if (fields.content.length > 65_536) {
    return { ok: false, reason: "content_invalid" };
  }
  if (role.required && (!role.exists || !role.projectMatches || role.status !== "active")) {
    return { ok: false, reason: "logical_role_invalid" };
  }
  if (
    fields.dueAt !== null &&
    (!UTC_RFC_3339_PATTERN.test(fields.dueAt) ||
      Number.isNaN(Date.parse(fields.dueAt)) ||
      new Date(fields.dueAt).toISOString() !== normalizeUtc(fields.dueAt))
  ) {
    return { ok: false, reason: "due_at_invalid" };
  }
  if (
    fields.labels.length > 64 ||
    fields.labels.some((label) => label.trim().length < 1 || label.trim().length > 64)
  ) {
    return { ok: false, reason: "labels_invalid" };
  }
  const labels = fields.labels.map((label) => label.trim());
  if (new Set(labels).size !== labels.length) {
    return { ok: false, reason: "labels_invalid" };
  }
  if (!["normal", "sprint", "milestone"].includes(fields.displayType)) {
    return { ok: false, reason: "display_type_invalid" };
  }
  return {
    ok: true,
    fields: {
      title,
      content: fields.content,
      logicalRoleId: fields.logicalRoleId,
      dueAt: fields.dueAt === null ? null : normalizeUtc(fields.dueAt),
      labels,
      displayType: fields.displayType,
    },
  };
}

function normalizeUtc(value: string): string {
  return new Date(value).toISOString();
}

export function evaluateTaskStatusTransition(input: {
  current: "not_started" | "in_progress" | "done";
  next: "not_started" | "in_progress";
  blocked: boolean;
}):
  | { ok: true; next: "in_progress" }
  | {
      ok: false;
      reason: "completed_task_frozen" | "task_blocked" | "invalid_status_transition";
    } {
  if (input.current === "done") {
    return { ok: false, reason: "completed_task_frozen" };
  }
  if (input.current !== "not_started" || input.next !== "in_progress") {
    return { ok: false, reason: "invalid_status_transition" };
  }
  if (input.blocked) {
    return { ok: false, reason: "task_blocked" };
  }
  return { ok: true, next: "in_progress" };
}

export type DerivedTaskAction =
  | "read"
  | "update"
  | "change_owner"
  | "manage_dependency"
  | "manage_follow"
  | "manage_blocker"
  | "change_status"
  | "complete"
  | "reopen"
  | "move"
  | "archive"
  | "delete"
  | "comment"
  | "read_workspace"
  | "write_workspace";

export function deriveTaskActions(input: {
  activeMember: boolean;
  actorMembershipId: string;
  effectiveOwnerMembershipId: string;
  adminModeActive: boolean;
  baseStatus: "not_started" | "in_progress" | "done";
  archived: boolean;
  parentTaskId: string | null;
  completionReady: boolean;
}): DerivedTaskAction[] {
  if (!input.activeMember) {
    return [];
  }
  const actions: DerivedTaskAction[] = ["read", "read_workspace"];
  if (!input.archived) {
    actions.push("comment");
  }
  const ownsTask = input.actorMembershipId === input.effectiveOwnerMembershipId;
  const managesTask = ownsTask || input.adminModeActive;
  if (input.archived || !managesTask) {
    return actions;
  }
  if (input.baseStatus === "done") {
    actions.push("reopen");
    if (input.parentTaskId === null) {
      actions.push("archive");
    }
    return actions;
  }
  actions.push(
    "update",
    "change_owner",
    "manage_dependency",
    "manage_follow",
    "manage_blocker",
    "change_status",
    "move",
  );
  if (input.completionReady) {
    actions.push("complete");
  }
  if (input.parentTaskId === null) {
    actions.push("archive");
  } else {
    actions.push("delete");
  }
  if (ownsTask) {
    actions.push("write_workspace");
  }
  return actions;
}
