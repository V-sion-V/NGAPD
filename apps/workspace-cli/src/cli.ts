import { WorkspaceCoreError, WorkspaceRemoteError, WorkspaceService } from "@ngapd/workspace-core";

import type {
  WorkspaceCliCommand,
  WorkspaceCliResult,
  WorkspaceCommandRuntime,
} from "./commands.js";
import { NodePlatformAdapter } from "./node-platform.js";
import { renderDoctor, renderJson, renderStatus, renderWorkspaceResult } from "./presentation.js";
import { startStdioServer } from "./stdio-server.js";
import { createDefaultWorkspaceCommandRuntime } from "./workspace-runtime.js";

export const APPLICATION_VERSION = "0.1.0";

const HELP_TEXT = `ngapd-workspace — Workspace synchronization CLI

Usage:
  ngapd-workspace --help
  ngapd-workspace --version
  ngapd-workspace status [--json]
  ngapd-workspace doctor [--json]
  ngapd-workspace serve --stdio
  ngapd-workspace pair --device-name <name> [--json]
  ngapd-workspace auth status|logout [--json]
  ngapd-workspace connect <workspace-id> --path <registered-relative-path> [--alias <alias>] [--json]
  ngapd-workspace workspace status <workspace-id-or-alias> [--json]
  ngapd-workspace lease acquire|renew|hold|release <workspace-id-or-alias> [--json]
  ngapd-workspace lease takeover <workspace-id-or-alias> --confirm [--json]
  ngapd-workspace sync <workspace-id-or-alias> [--json]
  ngapd-workspace conflict use-local|use-server <workspace-id-or-alias> --confirm [--json]

Configuration:
  NGAPD_WORKSPACE_API_ORIGIN   Canonical HTTP(S) API origin.
  NGAPD_WORKSPACE_ROOT         Absolute configured NGAPD root.

Passwords, access tokens, device credentials, and lease tokens are never accepted as CLI arguments.
Only connect registers a relative path; later commands resolve a Workspace ID or alias through the root registry.
The MCP stdio server remains read-only and exposes only status and doctor.`;

export type CliCommand =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "status"; json: boolean }
  | { kind: "doctor"; json: boolean }
  | { kind: "serve-stdio" }
  | WorkspaceCliCommand;

export interface CliIo {
  stdout: { write(value: string): unknown };
  stderr: { write(value: string): unknown };
}

export interface CliRuntime {
  startServer(service: WorkspaceService): Promise<void>;
  workspace?: WorkspaceCommandRuntime;
}

const defaultRuntime: CliRuntime = {
  startServer: startStdioServer,
};

export function parseCommand(args: readonly string[]): CliCommand {
  const normalizedArgs = args[0] === "--" ? args.slice(1) : args;
  rejectSecretArguments(normalizedArgs);
  if (
    normalizedArgs.length === 0 ||
    isExact(normalizedArgs, "--help") ||
    isExact(normalizedArgs, "-h")
  ) {
    return { kind: "help" };
  }
  if (isExact(normalizedArgs, "--version") || isExact(normalizedArgs, "-V")) {
    return { kind: "version" };
  }

  const [command, ...rawOptions] = normalizedArgs;
  if (command === "status" || command === "doctor") {
    const { values, json } = takeJson(rawOptions);
    if (values.length !== 0) {
      throw new UsageError(`${command} accepts only the optional --json argument.`);
    }
    return { kind: command, json };
  }
  if (command === "serve") {
    if (isExact(rawOptions, "--stdio")) {
      return { kind: "serve-stdio" };
    }
    throw new UsageError("serve requires exactly the --stdio argument.");
  }

  const { values: options, json } = takeJson(rawOptions);
  if (command === "pair") {
    const parsed = takeNamedOption(options, "--device-name", true);
    assertNoRemaining(parsed.remaining, "pair");
    return { kind: "pair", deviceName: parsed.value!, json };
  }
  if (command === "auth") {
    if (options.length !== 1 || (options[0] !== "status" && options[0] !== "logout")) {
      throw new UsageError("auth requires exactly status or logout.");
    }
    return { kind: options[0] === "status" ? "auth-status" : "auth-logout", json };
  }
  if (command === "connect") {
    const workspace = requireTarget(options[0], "connect");
    const path = takeNamedOption(options.slice(1), "--path", true);
    const alias = takeNamedOption(path.remaining, "--alias", false);
    assertNoRemaining(alias.remaining, "connect");
    return {
      kind: "connect",
      workspace,
      registeredPath: path.value!,
      alias: alias.value,
      json,
    };
  }
  if (command === "workspace") {
    if (options[0] !== "status" || options.length !== 2) {
      throw new UsageError("workspace requires status and a registered Workspace ID or alias.");
    }
    return { kind: "workspace-status", workspace: requireTarget(options[1], "workspace"), json };
  }
  if (command === "lease") {
    const action = options[0];
    if (
      action !== "acquire" &&
      action !== "renew" &&
      action !== "hold" &&
      action !== "release" &&
      action !== "takeover"
    ) {
      throw new UsageError("lease requires acquire, renew, hold, release, or takeover.");
    }
    const confirmed = options.includes("--confirm");
    const positional = options.slice(1).filter((value) => value !== "--confirm");
    if (positional.length !== 1 || (action !== "takeover" && confirmed)) {
      throw new UsageError(
        action === "takeover"
          ? "lease takeover requires a registered Workspace ID or alias and --confirm."
          : `lease ${action} requires exactly one registered Workspace ID or alias.`,
      );
    }
    if (action === "takeover" && !confirmed) {
      throw new UsageError("lease takeover requires explicit --confirm.");
    }
    return {
      kind: "lease",
      action,
      workspace: requireTarget(positional[0], "lease"),
      confirmed,
      json,
    };
  }
  if (command === "sync") {
    if (options.length !== 1) {
      throw new UsageError("sync requires exactly one registered Workspace ID or alias.");
    }
    return { kind: "sync", workspace: requireTarget(options[0], "sync"), json };
  }
  if (command === "conflict") {
    const choice = options[0];
    if (choice !== "use-local" && choice !== "use-server") {
      throw new UsageError("conflict requires use-local or use-server.");
    }
    const confirmed = options.includes("--confirm");
    const positional = options.slice(1).filter((value) => value !== "--confirm");
    if (!confirmed || positional.length !== 1) {
      throw new UsageError(
        `conflict ${choice} requires a registered Workspace ID or alias and explicit --confirm.`,
      );
    }
    return {
      kind: "conflict",
      choice: choice === "use-local" ? "use_local" : "use_server",
      workspace: requireTarget(positional[0], "conflict"),
      confirmed: true,
      json,
    };
  }

  throw new UsageError(`Unknown command or option: ${command ?? ""}`);
}

export async function runCli(
  args: readonly string[],
  io: CliIo,
  runtime: CliRuntime = defaultRuntime,
): Promise<number> {
  let command: CliCommand;
  try {
    command = parseCommand(args);
  } catch (error) {
    if (error instanceof UsageError) {
      const result = errorResult("usage", "USAGE_ERROR", error.message, null);
      writeResult(io.stderr, result, args.includes("--json"));
      if (!args.includes("--json")) {
        io.stderr.write("Run ngapd-workspace --help.\n");
      }
      return 2;
    }
    throw error;
  }

  if (command.kind === "help") {
    io.stdout.write(`${HELP_TEXT}\n`);
    return 0;
  }
  if (command.kind === "version") {
    io.stdout.write(`${APPLICATION_VERSION}\n`);
    return 0;
  }

  const service = new WorkspaceService(new NodePlatformAdapter(), {
    applicationVersion: APPLICATION_VERSION,
  });
  if (command.kind === "status") {
    const result = service.getStatus();
    io.stdout.write(`${command.json ? renderJson(result) : renderStatus(result)}\n`);
    return 0;
  }
  if (command.kind === "doctor") {
    const result = service.runDoctor();
    io.stdout.write(`${command.json ? renderJson(result) : renderDoctor(result)}\n`);
    return result.summary.ready ? 0 : 1;
  }
  if (command.kind === "serve-stdio") {
    await runtime.startServer(service);
    return 0;
  }

  try {
    const workspaceRuntime =
      runtime.workspace ?? (await createDefaultWorkspaceCommandRuntime(process.env));
    const result = await workspaceRuntime.execute(command, (event) => {
      writeResult(io.stdout, event, command.json);
    });
    writeResult(result.exitCode === 0 ? io.stdout : io.stderr, result, command.json);
    return result.exitCode;
  } catch (error) {
    const result = projectError(command.kind, error);
    writeResult(io.stderr, result, command.json);
    return result.exitCode;
  }
}

export class UsageError extends Error {}

function takeJson(values: readonly string[]): { values: string[]; json: boolean } {
  const count = values.filter((value) => value === "--json").length;
  if (count > 1) {
    throw new UsageError("--json may be supplied at most once.");
  }
  return { values: values.filter((value) => value !== "--json"), json: count === 1 };
}

function takeNamedOption(
  values: readonly string[],
  name: string,
  required: boolean,
): { value: string | null; remaining: string[] } {
  const indexes = values.flatMap((value, index) => (value === name ? [index] : []));
  if (indexes.length > 1) {
    throw new UsageError(`${name} may be supplied at most once.`);
  }
  if (indexes.length === 0) {
    if (required) {
      throw new UsageError(`${name} is required.`);
    }
    return { value: null, remaining: [...values] };
  }
  const index = indexes[0]!;
  const value = values[index + 1];
  if (value === undefined || value.length === 0 || value.startsWith("--")) {
    throw new UsageError(`${name} requires a value.`);
  }
  return {
    value,
    remaining: values.filter((_, candidate) => candidate !== index && candidate !== index + 1),
  };
}

function assertNoRemaining(values: readonly string[], command: string): void {
  if (values.length !== 0) {
    throw new UsageError(`${command} received unsupported arguments.`);
  }
}

function requireTarget(value: string | undefined, command: string): string {
  if (value === undefined || value.length === 0 || value.startsWith("-") || /[/\\]/u.test(value)) {
    throw new UsageError(`${command} requires a registered Workspace ID or alias.`);
  }
  return value;
}

function rejectSecretArguments(args: readonly string[]): void {
  const forbidden = args.find(
    (value) =>
      value.startsWith("--") &&
      /(?:password|secret|credential|access[-_]?token|lease[-_]?token)/iu.test(value),
  );
  if (forbidden !== undefined) {
    throw new UsageError(
      `${forbidden} is forbidden; secrets are accepted only through OS storage.`,
    );
  }
}

function writeResult(
  stream: { write(value: string): unknown },
  result: WorkspaceCliResult,
  json: boolean,
): void {
  stream.write(`${renderWorkspaceResult(result, json)}\n`);
}

function projectError(action: string, error: unknown): WorkspaceCliResult {
  if (error instanceof WorkspaceRemoteError) {
    return errorResult(
      action,
      error.remoteCode,
      error.message,
      error.recovery,
      error.currentVersion === null
        ? { requestId: error.requestId, retryable: error.retryable }
        : {
            requestId: error.requestId,
            currentVersion: error.currentVersion,
            retryable: error.retryable,
          },
    );
  }
  if (error instanceof WorkspaceCoreError) {
    return errorResult(action, error.code, error.message, recoveryFor(error.code), {
      retryable: error.retryable,
    });
  }
  return errorResult(
    action,
    "UNEXPECTED_ERROR",
    "Workspace command failed without exposing sensitive details.",
    "Retry the command; run workspace status or doctor if it repeats.",
  );
}

function errorResult(
  action: string,
  code: string,
  message: string,
  recovery: string | null,
  data: Readonly<Record<string, unknown>> = {},
): WorkspaceCliResult {
  return {
    action,
    status: "error",
    message,
    workspaceId: null,
    data: { code, ...data },
    recovery,
    exitCode: 1,
  };
}

function recoveryFor(code: string): string | null {
  if (code === "CREDENTIAL_UNAVAILABLE") {
    return "Pair this device again with `ngapd-workspace pair`.";
  }
  if (code === "LEASE_OR_BASE_INVALID") {
    return "Inspect workspace status, then acquire or take over a valid lease.";
  }
  if (code === "SCAN_RETRY" || code === "STATE_BUSY" || code === "STATE_CONFLICT") {
    return "Retry after concurrent filesystem or CLI activity settles.";
  }
  return null;
}

function isExact(values: readonly string[], expected: string): boolean {
  return values.length === 1 && values[0] === expected;
}
