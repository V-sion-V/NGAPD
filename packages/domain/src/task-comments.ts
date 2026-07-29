export interface TaskCommentAttachmentFact {
  workspaceId: string;
  taskWorkspaceId: string;
  path: string;
  readable: boolean;
}

export type TaskCommentMutationDecision =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "membership_inactive"
        | "task_archived"
        | "comment_not_found"
        | "comment_deleted"
        | "comment_hidden"
        | "comment_immutable"
        | "forbidden"
        | "attachment_forbidden";
    };

export function evaluateTaskCommentMutation(input: {
  operation: "create" | "update" | "delete" | "hide";
  actorMembershipId: string;
  actorMembershipActive: boolean;
  taskBaseStatus: "not_started" | "in_progress" | "done";
  taskArchived: boolean;
  adminModeActive: boolean;
  comment: {
    authorMembershipId: string;
    deleted: boolean;
    hidden: boolean;
  } | null;
  attachments?: readonly TaskCommentAttachmentFact[];
}): TaskCommentMutationDecision {
  if (!input.actorMembershipActive) {
    return { ok: false, reason: "membership_inactive" };
  }
  if (input.operation !== "hide" && input.taskArchived) {
    return { ok: false, reason: "task_archived" };
  }
  if (
    input.attachments?.some(
      (attachment) =>
        !attachment.readable ||
        attachment.workspaceId !== attachment.taskWorkspaceId ||
        attachment.path.length < 1,
    )
  ) {
    return { ok: false, reason: "attachment_forbidden" };
  }
  if (input.operation === "create") {
    return { ok: true };
  }
  if (!input.comment) {
    return { ok: false, reason: "comment_not_found" };
  }
  if (input.comment.deleted) {
    return { ok: false, reason: "comment_deleted" };
  }
  if (input.comment.hidden) {
    return { ok: false, reason: "comment_hidden" };
  }
  if (input.operation === "hide") {
    return input.adminModeActive ? { ok: true } : { ok: false, reason: "forbidden" };
  }
  if (input.taskBaseStatus === "done") {
    return { ok: false, reason: "comment_immutable" };
  }
  if (input.comment.authorMembershipId !== input.actorMembershipId) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true };
}
