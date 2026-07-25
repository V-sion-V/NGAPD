export type WorkspaceCoreErrorCode =
  | "PATH_NOT_RELATIVE"
  | "PATH_TRAVERSAL"
  | "PATH_USES_BACKSLASH"
  | "PATH_SEGMENT_INVALID"
  | "PATH_NOT_PORTABLE"
  | "PATH_PROTECTED"
  | "PATH_COLLISION"
  | "PATH_SYMLINK"
  | "PATH_OUTSIDE_ROOT"
  | "ROOT_INVALID"
  | "SCAN_RETRY"
  | "FILE_LIMIT_EXCEEDED"
  | "FILE_SIZE_LIMIT_EXCEEDED"
  | "WORKSPACE_SIZE_LIMIT_EXCEEDED"
  | "OBJECT_MISSING"
  | "OBJECT_HASH_MISMATCH"
  | "MATERIALIZATION_FAILED"
  | "STATE_CONFLICT"
  | "STATE_BUSY"
  | "STATE_INVALID"
  | "REGISTRATION_CONFLICT"
  | "CREDENTIAL_UNAVAILABLE"
  | "CREDENTIAL_INVALID"
  | "REMOTE_RESPONSE_INVALID"
  | "REMOTE_REQUEST_FAILED"
  | "LEASE_OR_BASE_INVALID";

export class WorkspaceCoreError extends Error {
  constructor(
    readonly code: WorkspaceCoreErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "WorkspaceCoreError";
  }
}

export class WorkspaceRemoteError extends WorkspaceCoreError {
  constructor(
    readonly remoteCode: string,
    message: string,
    readonly requestId: string,
    readonly currentVersion: number | null,
    readonly recovery: string | null,
    retryable = false,
  ) {
    super("REMOTE_REQUEST_FAILED", message, retryable);
    this.name = "WorkspaceRemoteError";
  }
}

export function asWorkspaceCoreError(
  error: unknown,
  fallbackCode: WorkspaceCoreErrorCode,
  fallbackMessage: string,
): WorkspaceCoreError {
  if (error instanceof WorkspaceCoreError) {
    return error;
  }
  return new WorkspaceCoreError(fallbackCode, fallbackMessage);
}
