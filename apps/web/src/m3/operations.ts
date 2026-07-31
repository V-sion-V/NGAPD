import type {
  TaskCommentAttachment,
  TaskImpactResponse,
  TaskNotificationResource,
  TaskResource,
  TaskWorkspaceFileCollection,
} from "@ngapd/contracts";

const TASK_KEY_PATTERN = /^[A-Z]{2,6}-[1-9][0-9]*$/u;

export class IntentKeyManager {
  private key: string;
  private payloadFingerprint: string | null = null;

  constructor(private readonly generate: () => string = () => crypto.randomUUID()) {
    this.key = generate();
  }

  keyFor(payload: unknown): string {
    const nextFingerprint = canonicalJson(payload);
    if (this.payloadFingerprint !== null && this.payloadFingerprint !== nextFingerprint) {
      this.key = this.generate();
    }
    this.payloadFingerprint = nextFingerprint;
    return this.key;
  }

  complete(): void {
    this.key = this.generate();
    this.payloadFingerprint = null;
  }

  abandon(): void {
    this.complete();
  }
}

export function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  throw new TypeError("写入意图只能包含可序列化 JSON 值");
}

export function parseLabelsInput(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,，\n]/u)
        .map((label) => label.trim())
        .filter(Boolean),
    ),
  ];
}

export function localDateTimeValue(utc: string | null): string {
  if (!utc) {
    return "";
  }
  const date = new Date(utc);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function utcDateTimeValue(local: string): string | null {
  if (!local) {
    return null;
  }
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("截止时间不是有效的设备本地时间");
  }
  return date.toISOString();
}

export interface ImpactTaskFacts {
  confirmedTaskIds: string[];
  expectedTaskVersions: Record<string, number>;
  expectedWorkspaceSyncVersions: Record<string, number>;
  expectedOwnerMembershipIds: Record<string, string>;
}

export function taskFactsForImpact(
  preview: TaskImpactResponse,
  resources: readonly TaskResource[],
): ImpactTaskFacts {
  const byId = new Map(resources.map((task) => [task.id, task]));
  const missing = preview.impact.affectedTaskIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new Error(
      `影响集合中有 ${missing.length} 个 Task 无法由当前授权事实解析；已阻止提交，请重新预览。`,
    );
  }

  return {
    confirmedTaskIds: [...preview.impact.affectedTaskIds],
    expectedTaskVersions: Object.fromEntries(
      preview.impact.affectedTaskIds.map((id) => [id, byId.get(id)!.version]),
    ),
    expectedWorkspaceSyncVersions: Object.fromEntries(
      preview.impact.affectedTaskIds.map((id) => [id, byId.get(id)!.workspace.syncVersion]),
    ),
    expectedOwnerMembershipIds: Object.fromEntries(
      preview.impact.affectedTaskIds.map((id) => [id, byId.get(id)!.effectiveOwner.membershipId]),
    ),
  };
}

export function impactHasWorkspaceRisk(preview: TaskImpactResponse): boolean {
  return (
    preview.impact.workspaceLeaseIds.length > 0 ||
    preview.impact.unsyncedWorkspaceTaskIds.length > 0
  );
}

export function attachmentIsCurrent(
  attachment: TaskCommentAttachment,
  files: TaskWorkspaceFileCollection | null,
): boolean {
  if (!files || attachment.workspaceId !== files.workspaceId) {
    return false;
  }
  const current = files.files.find((file) => file.path === attachment.path);
  return Boolean(
    current && (attachment.sha256 === undefined || attachment.sha256 === current.sha256),
  );
}

export function taskKeyFromNotification(notification: TaskNotificationResource): string | null {
  return notification.taskKey && TASK_KEY_PATTERN.test(notification.taskKey)
    ? notification.taskKey
    : null;
}

export function taskKeyIsValid(value: string): boolean {
  return TASK_KEY_PATTERN.test(value);
}
