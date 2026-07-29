import type { ApiErrorCode } from "@ngapd/contracts";

interface ErrorDescriptor {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  recovery: string;
}

const M1_ERROR_DESCRIPTORS = {
  user_not_found: {
    statusCode: 404,
    code: "USER_PROFILE_NOT_FOUND",
    message: "用户资料不存在",
    recovery: "请重新登录后重试",
  },
  user_inactive: {
    statusCode: 403,
    code: "ACCOUNT_INACTIVE",
    message: "账号当前不可用",
    recovery: "请联系管理员恢复账号",
  },
  version_conflict: {
    statusCode: 409,
    code: "USER_PROFILE_VERSION_CONFLICT",
    message: "用户资料版本已经变化",
    recovery: "请刷新资料和版本后重试",
  },
  template_not_found: {
    statusCode: 422,
    code: "ROLE_TEMPLATE_NOT_FOUND",
    message: "系统角色模板不存在",
    recovery: "请刷新系统角色模板后重试",
  },
  account_inactive: {
    statusCode: 403,
    code: "ACCOUNT_INACTIVE",
    message: "账号当前不可用",
    recovery: "请重新登录或联系管理员恢复账号",
  },
  project_not_found: {
    statusCode: 404,
    code: "PROJECT_NOT_FOUND",
    message: "项目不存在或当前用户无权访问",
    recovery: "请刷新项目列表或核对精确 Project Key",
  },
  project_key_taken: {
    statusCode: 409,
    code: "PROJECT_KEY_TAKEN",
    message: "Project Key 已被使用",
    recovery: "请使用其他 Project Key",
  },
  project_archived: {
    statusCode: 409,
    code: "PROJECT_ARCHIVED",
    message: "项目已归档",
    recovery: "请由 Project Owner 先解除归档",
  },
  membership_required: {
    statusCode: 403,
    code: "MEMBERSHIP_NOT_FOUND",
    message: "当前用户不是该项目成员",
    recovery: "请先申请加入项目",
  },
  membership_not_found: {
    statusCode: 404,
    code: "MEMBERSHIP_NOT_FOUND",
    message: "项目成员不存在",
    recovery: "请刷新成员列表后重试",
  },
  membership_inactive: {
    statusCode: 403,
    code: "MEMBERSHIP_NOT_ACTIVE",
    message: "项目成员当前不是活动状态",
    recovery: "请完成加入审批或重新申请加入",
  },
  membership_project_mismatch: {
    statusCode: 403,
    code: "FORBIDDEN",
    message: "成员不属于目标项目",
    recovery: "请刷新项目与成员数据",
  },
  membership_already_active: {
    statusCode: 409,
    code: "MEMBERSHIP_ALREADY_ACTIVE",
    message: "当前用户已经是活动成员",
    recovery: "请直接打开项目",
  },
  join_request_already_pending: {
    statusCode: 409,
    code: "JOIN_REQUEST_ALREADY_PENDING",
    message: "已有待处理加入申请",
    recovery: "请等待 Project Owner 处理当前申请",
  },
  join_request_not_found: {
    statusCode: 404,
    code: "JOIN_REQUEST_NOT_FOUND",
    message: "加入申请不存在",
    recovery: "请刷新申请列表后重试",
  },
  join_request_not_pending: {
    statusCode: 409,
    code: "JOIN_REQUEST_STALE",
    message: "加入申请已经处理或失效",
    recovery: "请刷新申请与成员状态",
  },
  ownership_transfer_not_found: {
    statusCode: 404,
    code: "OWNERSHIP_TRANSFER_NOT_FOUND",
    message: "所有权转移请求不存在",
    recovery: "请刷新所有权转移列表",
  },
  ownership_transfer_not_pending: {
    statusCode: 409,
    code: "OWNERSHIP_TRANSFER_STALE",
    message: "所有权转移请求已经处理",
    recovery: "请刷新项目和转移状态",
  },
  ownership_transfer_stale: {
    statusCode: 409,
    code: "OWNERSHIP_TRANSFER_STALE",
    message: "所有权转移参与者状态已经变化",
    recovery: "请刷新项目、成员和转移状态",
  },
  project_owner_required: {
    statusCode: 403,
    code: "FORBIDDEN",
    message: "该操作仅允许当前 Project Owner 执行",
    recovery: "请由当前 Project Owner 执行",
  },
  owner_or_admin_required: {
    statusCode: 403,
    code: "FORBIDDEN",
    message: "该操作需要 Project Owner 或 Admin 资格",
    recovery: "请确认当前项目资格",
  },
  admin_mode_required: {
    statusCode: 403,
    code: "ADMIN_MODE_REQUIRED",
    message: "该操作需要活动管理员模式",
    recovery: "请为当前项目显式开启管理员模式",
  },
  admin_mode_not_found: {
    statusCode: 404,
    code: "ADMIN_MODE_NOT_FOUND",
    message: "管理员模式会话不存在",
    recovery: "请重新开启管理员模式",
  },
  admin_mode_not_active: {
    statusCode: 409,
    code: "ADMIN_MODE_NOT_ACTIVE",
    message: "管理员模式当前不可用",
    recovery: "请重新开启管理员模式",
  },
  admin_mode_expired: {
    statusCode: 409,
    code: "ADMIN_MODE_EXPIRED",
    message: "管理员模式已经过期",
    recovery: "请重新开启管理员模式",
  },
  admin_mode_scope_mismatch: {
    statusCode: 403,
    code: "ADMIN_MODE_SCOPE_MISMATCH",
    message: "管理员模式不属于当前会话或项目",
    recovery: "请为当前会话和项目重新开启管理员模式",
  },
  web_session_inactive: {
    statusCode: 401,
    code: "AUTHENTICATION_REQUIRED",
    message: "当前登录会话已经失效",
    recovery: "请重新登录",
  },
  self_membership_required: {
    statusCode: 403,
    code: "FORBIDDEN",
    message: "只能直接编辑自己的项目资料",
    recovery: "编辑他人资料需要合格管理员模式",
  },
  target_is_current_owner: {
    statusCode: 409,
    code: "OWNERSHIP_TRANSFER_STALE",
    message: "目标已经是当前 Project Owner",
    recovery: "请选择其他活动成员",
  },
  target_membership_inactive: {
    statusCode: 409,
    code: "MEMBERSHIP_NOT_ACTIVE",
    message: "目标成员不是活动状态",
    recovery: "请选择活动成员",
  },
  ownership_transfer_already_pending: {
    statusCode: 409,
    code: "OWNERSHIP_TRANSFER_ALREADY_PENDING",
    message: "项目已有待处理所有权转移",
    recovery: "请先处理当前转移请求",
  },
  target_membership_required: {
    statusCode: 404,
    code: "MEMBERSHIP_NOT_FOUND",
    message: "目标成员不存在",
    recovery: "请刷新成员列表",
  },
  owner_removal_forbidden: {
    statusCode: 409,
    code: "MEMBERSHIP_OWNER_REMOVAL_FORBIDDEN",
    message: "不能移除当前 Project Owner",
    recovery: "请先完成所有权转移",
  },
  active_task_ownership_blocked: {
    statusCode: 409,
    code: "MEMBERSHIP_REMOVAL_BLOCKED",
    message: "成员仍有效拥有启用态未完成任务",
    recovery: "请先处理返回的阻塞任务",
  },
  project_lifecycle_unchanged: {
    statusCode: 409,
    code: "CONFLICT",
    message: "项目已经处于请求的生命周期状态",
    recovery: "请刷新项目状态",
  },
  project_version_conflict: {
    statusCode: 409,
    code: "PROJECT_VERSION_CONFLICT",
    message: "项目版本已经变化",
    recovery: "请刷新项目和版本后重试",
  },
  membership_version_conflict: {
    statusCode: 409,
    code: "MEMBERSHIP_VERSION_CONFLICT",
    message: "成员版本已经变化",
    recovery: "请刷新成员和版本后重试",
  },
  request_version_conflict: {
    statusCode: 409,
    code: "JOIN_REQUEST_VERSION_CONFLICT",
    message: "加入申请版本已经变化",
    recovery: "请刷新申请和版本后重试",
  },
  transfer_version_conflict: {
    statusCode: 409,
    code: "OWNERSHIP_TRANSFER_VERSION_CONFLICT",
    message: "所有权转移版本已经变化",
    recovery: "请刷新转移请求和版本后重试",
  },
  admin_mode_version_conflict: {
    statusCode: 409,
    code: "ADMIN_MODE_VERSION_CONFLICT",
    message: "管理员模式版本已经变化",
    recovery: "请刷新管理员模式状态",
  },
  role_not_found: {
    statusCode: 404,
    code: "PROJECT_ROLE_NOT_FOUND",
    message: "项目角色不存在",
    recovery: "请刷新项目角色目录",
  },
  project_role_archived: {
    statusCode: 409,
    code: "PROJECT_ROLE_ARCHIVED",
    message: "项目角色已经归档",
    recovery: "请复制为新的活动角色",
  },
  idempotency_conflict: {
    statusCode: 409,
    code: "IDEMPOTENCY_CONFLICT",
    message: "幂等键已用于不同请求",
    recovery: "请使用原始请求重试或更换幂等键",
  },
  forbidden: {
    statusCode: 403,
    code: "FORBIDDEN",
    message: "无权执行该操作",
    recovery: "请刷新项目成员、所有权和管理员模式状态",
  },
} as const satisfies Record<string, ErrorDescriptor>;

const TASK_ERROR_DESCRIPTORS = {
  project_not_found: {
    statusCode: 404,
    code: "PROJECT_NOT_FOUND",
    message: "项目不存在",
    recovery: "请刷新项目列表后重试",
  },
  task_not_found: {
    statusCode: 404,
    code: "TASK_NOT_FOUND",
    message: "任务不存在",
    recovery: "请刷新任务数据后重试",
  },
  task_archived: {
    statusCode: 409,
    code: "TASK_ARCHIVED",
    message: "任务已归档",
    recovery: "请刷新任务状态；归档任务不能执行该操作",
  },
  task_already_done: {
    statusCode: 409,
    code: "TASK_ALREADY_DONE",
    message: "任务已经完成",
    recovery: "请刷新任务状态；如需修改请先显式重新打开",
  },
  owner_unresolved: {
    statusCode: 409,
    code: "TASK_OWNER_UNRESOLVED",
    message: "无法解析任务 Owner",
    recovery: "请修复任务或祖先的活动 Owner 后重试",
  },
  owner_invalid: {
    statusCode: 409,
    code: "TASK_OWNER_INVALID",
    message: "目标 Owner 无效",
    recovery: "请选择同项目的活动成员",
  },
  task_ownership_invalid: {
    statusCode: 409,
    code: "TASK_OWNER_INVALID",
    message: "任务 Owner 关系无效",
    recovery: "请检查父任务与显式 Owner 后重试",
  },
  child_incomplete: {
    statusCode: 409,
    code: "TASK_CHILD_INCOMPLETE",
    message: "仍有未完成的直接子任务",
    recovery: "请先完成所有启用的直接子任务",
  },
  predecessor_incomplete: {
    statusCode: 409,
    code: "TASK_PREDECESSOR_INCOMPLETE",
    message: "仍有未完成的前置任务",
    recovery: "请先完成所有启用的 predecessor",
  },
  manual_blocker_active: {
    statusCode: 409,
    code: "TASK_BLOCKER_ACTIVE",
    message: "任务仍有未解除的人工阻塞",
    recovery: "请先解除人工阻塞",
  },
  completed_ancestor_exists: {
    statusCode: 409,
    code: "TASK_REOPEN_DENIED",
    message: "存在必须先处理的已完成祖先",
    recovery: "请刷新影响集合并先处理已完成祖先",
  },
  completed_successor_exists: {
    statusCode: 409,
    code: "TASK_REOPEN_DENIED",
    message: "存在已完成 successor",
    recovery: "请使用允许的 cascade 策略并确认完整影响集合",
  },
  task_not_done: {
    statusCode: 409,
    code: "CONFLICT",
    message: "任务当前不是已完成状态",
    recovery: "请刷新任务状态后重试",
  },
  completed_task_frozen: {
    statusCode: 409,
    code: "COMPLETED_TASK_FROZEN",
    message: "已完成任务已冻结",
    recovery: "如需修改，请先显式重新打开任务",
  },
  task_key_invalid: {
    statusCode: 422,
    code: "TASK_KEY_INVALID",
    message: "无法分配合法 Task Key",
    recovery: "请检查 Project Key 与项目序列状态",
  },
  task_parent_invalid: {
    statusCode: 409,
    code: "TASK_PARENT_INVALID",
    message: "目标父任务无效",
    recovery: "请刷新任务树后选择同项目的活动父任务",
  },
  parent_not_found: {
    statusCode: 404,
    code: "TASK_PARENT_INVALID",
    message: "目标父任务不存在",
    recovery: "请刷新任务树后重试",
  },
  parent_project_mismatch: {
    statusCode: 409,
    code: "TASK_PARENT_INVALID",
    message: "父子任务不属于同一项目",
    recovery: "请选择同项目父任务",
  },
  cycle: {
    statusCode: 409,
    code: "TASK_TREE_INVALID",
    message: "操作会形成任务树或依赖环",
    recovery: "请刷新结构并选择不会形成环的目标",
  },
  cross_project_dependency: {
    statusCode: 409,
    code: "TASK_DEPENDENCY_INVALID",
    message: "依赖端点不属于同一项目",
    recovery: "依赖只能连接同项目同级任务",
  },
  cross_parent_dependency: {
    statusCode: 409,
    code: "TASK_DEPENDENCY_INVALID",
    message: "依赖端点不属于同一父级作用域",
    recovery: "依赖只能连接同一直接父级下的任务",
  },
  self_dependency: {
    statusCode: 409,
    code: "TASK_DEPENDENCY_INVALID",
    message: "任务不能依赖自身",
    recovery: "请选择两个不同任务",
  },
  duplicate_dependency: {
    statusCode: 409,
    code: "TASK_DEPENDENCY_INVALID",
    message: "依赖已存在",
    recovery: "请刷新当前依赖图",
  },
  dependency_cycle: {
    statusCode: 409,
    code: "TASK_DEPENDENCY_CYCLE",
    message: "依赖会形成环",
    recovery: "请刷新依赖图并移除形成环的边",
  },
  task_has_active_dependencies: {
    statusCode: 409,
    code: "TASK_DEPENDENCY_INVALID",
    message: "任务仍有活动依赖",
    recovery: "请先处理活动依赖后再移动任务",
  },
  target_parent_done: {
    statusCode: 409,
    code: "TASK_PARENT_INVALID",
    message: "不能移动到已完成父任务",
    recovery: "请选择活动父任务",
  },
  same_parent: {
    statusCode: 409,
    code: "CONFLICT",
    message: "任务已经位于目标父级",
    recovery: "请刷新任务树",
  },
  request_stale: {
    statusCode: 409,
    code: "TASK_DEPENDENCY_REQUEST_STALE",
    message: "依赖变更请求已经过期",
    recovery: "请刷新依赖图并重新发起请求",
  },
  graph_scope_not_found: {
    statusCode: 409,
    code: "TASK_GRAPH_VERSION_CONFLICT",
    message: "图作用域不存在或已经变化",
    recovery: "请刷新图版本后重试",
  },
  graph_version_conflict: {
    statusCode: 409,
    code: "TASK_GRAPH_VERSION_CONFLICT",
    message: "图版本已经变化",
    recovery: "请刷新依赖图和 graph_version 后重试",
  },
  task_version_conflict: {
    statusCode: 409,
    code: "TASK_VERSION_CONFLICT",
    message: "任务版本已经变化",
    recovery: "请刷新任务和版本后重试",
  },
  impact_confirmation_stale: {
    statusCode: 409,
    code: "TASK_IMPACT_CONFIRMATION_STALE",
    message: "影响确认已经过期",
    recovery: "请重新获取并确认完整影响集合",
  },
  admin_mode_required: {
    statusCode: 403,
    code: "ADMIN_MODE_REQUIRED",
    message: "该操作需要管理员模式",
    recovery: "请由用户显式进入管理员模式并重新确认影响",
  },
  forbidden: {
    statusCode: 403,
    code: "FORBIDDEN",
    message: "无权执行该操作",
    recovery: "请确认当前项目成员、有效 Owner 与管理员会话",
  },
  idempotency_conflict: {
    statusCode: 409,
    code: "IDEMPOTENCY_CONFLICT",
    message: "幂等键已用于不同请求",
    recovery: "请使用原始请求重试或更换幂等键",
  },
  workspace_version_conflict: {
    statusCode: 409,
    code: "BASE_VERSION_CONFLICT",
    message: "Workspace 版本已经变化",
    recovery: "请重新获取 Workspace 权威版本后重试",
  },
  workspace_not_finalized: {
    statusCode: 409,
    code: "TASK_WORKSPACE_NOT_FINALIZED",
    message: "Workspace 最终版本尚未确认",
    recovery: "请先完成 Workspace 服务端同步",
  },
  workspace_not_active: {
    statusCode: 409,
    code: "WORKSPACE_LIFECYCLE_CONFLICT",
    message: "Workspace 当前不是活动状态",
    recovery: "请刷新 Workspace 生命周期后重试",
  },
  workspace_not_frozen: {
    statusCode: 409,
    code: "WORKSPACE_LIFECYCLE_CONFLICT",
    message: "Workspace 冻结状态不一致",
    recovery: "请刷新任务与 Workspace 权威状态",
  },
  workspace_has_uncommitted_client_version: {
    statusCode: 409,
    code: "TASK_WORKSPACE_NOT_FINALIZED",
    message: "Workspace 仍有未提交的客户端版本",
    recovery: "请先解决 Workspace 同步或冲突",
  },
  workspace_state_missing: {
    statusCode: 409,
    code: "WORKSPACE_LIFECYCLE_CONFLICT",
    message: "缺少任务 Workspace 状态",
    recovery: "请刷新任务与 Workspace 权威状态",
  },
  task_field_invalid: {
    statusCode: 422,
    code: "TASK_FIELD_INVALID",
    message: "Task fields are invalid",
    recovery: "Refresh the Task and correct the rejected field values",
  },
  task_role_invalid: {
    statusCode: 422,
    code: "TASK_ROLE_INVALID",
    message: "The selected logical role is not active in this project",
    recovery: "Choose an active role from the current project",
  },
  task_blocked: {
    statusCode: 409,
    code: "TASK_COMPLETION_BLOCKED",
    message: "The Task is blocked by a predecessor or manual blocker",
    recovery: "Resolve all active blocking facts and retry with the current version",
  },
  invalid_status_transition: {
    statusCode: 409,
    code: "TASK_STATUS_INVALID",
    message: "The requested Task status transition is not allowed",
    recovery: "Refresh the Task and use the next legal status transition",
  },
  blocker_not_found: {
    statusCode: 404,
    code: "TASK_BLOCKER_ACTIVE",
    message: "The active Task blocker was not found",
    recovery: "Refresh the Task blocker list",
  },
  archive_requires_top_level: {
    statusCode: 409,
    code: "TASK_STATUS_INVALID",
    message: "Only a top-level Task can be archived",
    recovery: "Archive the containing top-level Task instead",
  },
  delete_requires_non_top_level: {
    statusCode: 409,
    code: "TASK_DELETE_CONFIRMATION_REQUIRED",
    message: "A top-level Task cannot be deleted",
    recovery: "Archive the top-level Task instead",
  },
  completed_descendant_exists: {
    statusCode: 409,
    code: "COMPLETED_TASK_FROZEN",
    message: "The deletion subtree contains a completed Task",
    recovery: "Use archive; completed Task history cannot be deleted",
  },
  completed_external_dependency_exists: {
    statusCode: 409,
    code: "COMPLETED_TASK_FROZEN",
    message: "A completed external dependency endpoint protects this subtree",
    recovery: "Preserve the subtree or review the completed dependency history",
  },
  task_key_confirmation_mismatch: {
    statusCode: 409,
    code: "TASK_DELETE_CONFIRMATION_REQUIRED",
    message: "The full Task Key confirmation does not match",
    recovery: "Repeat the impact preview and enter the exact current Task Key",
  },
  comment_not_found: {
    statusCode: 404,
    code: "TASK_COMMENT_NOT_FOUND",
    message: "The Task comment was not found",
    recovery: "Refresh the comment list",
  },
  comment_version_conflict: {
    statusCode: 409,
    code: "TASK_COMMENT_VERSION_CONFLICT",
    message: "The Task comment has changed",
    recovery: "Refresh the comment and retry from its current version",
  },
  comment_immutable: {
    statusCode: 409,
    code: "TASK_COMMENT_IMMUTABLE",
    message: "This comment is append-only and cannot be changed",
    recovery: "Post a new comment instead",
  },
  comment_attachment_forbidden: {
    statusCode: 403,
    code: "TASK_COMMENT_ATTACHMENT_FORBIDDEN",
    message: "A comment attachment is not an authorized Workspace file reference",
    recovery: "Use a readable committed Workspace file reference",
  },
  notification_not_found: {
    statusCode: 404,
    code: "TASK_NOTIFICATION_NOT_FOUND",
    message: "The notification was not found",
    recovery: "Refresh notifications",
  },
  notification_version_conflict: {
    statusCode: 409,
    code: "TASK_NOTIFICATION_VERSION_CONFLICT",
    message: "The notification state has changed",
    recovery: "Refresh notifications and retry",
  },
  notification_preference_critical: {
    statusCode: 409,
    code: "TASK_NOTIFICATION_PREFERENCE_REQUIRED",
    message: "This critical notification category cannot be disabled",
    recovery: "Keep the critical category enabled",
  },
} as const satisfies Record<string, ErrorDescriptor>;

export class ApplicationError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly recovery?: string,
    readonly currentVersion?: number,
    readonly blockingTasks?: Array<{ id: string; key: string }>,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export function m1ApplicationError(
  reason: string,
  currentVersion?: number,
  blockingTasks?: Array<{ id: string; key: string }>,
): ApplicationError {
  const descriptor = M1_ERROR_DESCRIPTORS[reason as keyof typeof M1_ERROR_DESCRIPTORS];
  if (!descriptor) {
    return new ApplicationError(
      409,
      "CONFLICT",
      "操作与当前权威状态冲突",
      "请刷新相关资源后重试",
      currentVersion,
      blockingTasks,
    );
  }
  return new ApplicationError(
    descriptor.statusCode,
    descriptor.code,
    descriptor.message,
    descriptor.recovery,
    currentVersion,
    blockingTasks,
  );
}

export function m1ReasonCode(reason: string): ApiErrorCode {
  return m1ApplicationError(reason).code;
}

export function taskApplicationError(reason: string, currentVersion?: number): ApplicationError {
  const descriptor = TASK_ERROR_DESCRIPTORS[reason as keyof typeof TASK_ERROR_DESCRIPTORS];
  if (!descriptor) {
    return new ApplicationError(
      409,
      "CONFLICT",
      "任务操作与当前权威状态冲突",
      "请刷新任务、图和 Workspace 状态后重试",
      currentVersion,
    );
  }
  return new ApplicationError(
    descriptor.statusCode,
    descriptor.code,
    descriptor.message,
    descriptor.recovery,
    currentVersion,
  );
}

export function taskReasonCode(reason: string): ApiErrorCode {
  return taskApplicationError(reason).code;
}
