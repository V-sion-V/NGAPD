import type { ApiErrorCode } from "@ngapd/contracts";

interface ErrorDescriptor {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  recovery: string;
}

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
} as const satisfies Record<string, ErrorDescriptor>;

export class ApplicationError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly recovery?: string,
    readonly currentVersion?: number,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
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
