export type WorkspaceCliCommand =
  | { kind: "pair"; deviceName: string; json: boolean }
  | { kind: "auth-status"; json: boolean }
  | { kind: "auth-logout"; json: boolean }
  | {
      kind: "connect";
      workspace: string;
      registeredPath: string;
      alias: string | null;
      json: boolean;
    }
  | { kind: "workspace-status"; workspace: string; json: boolean }
  | {
      kind: "lease";
      action: "acquire" | "renew" | "hold" | "release" | "takeover";
      workspace: string;
      confirmed: boolean;
      json: boolean;
    }
  | { kind: "sync"; workspace: string; json: boolean }
  | {
      kind: "conflict";
      choice: "use_local" | "use_server";
      workspace: string;
      confirmed: boolean;
      json: boolean;
    };

export type WorkspaceCliResultStatus =
  "success" | "pending" | "read_only" | "conflict" | "recovered" | "error";

export interface WorkspaceCliResult {
  action: string;
  status: WorkspaceCliResultStatus;
  message: string;
  workspaceId: string | null;
  data: Readonly<Record<string, unknown>>;
  recovery: string | null;
  exitCode: number;
}

export interface WorkspaceCommandRuntime {
  execute(
    command: WorkspaceCliCommand,
    emit: (result: WorkspaceCliResult) => void,
  ): Promise<WorkspaceCliResult>;
}
