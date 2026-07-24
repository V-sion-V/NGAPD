import { WorkspaceService } from "@ngapd/workspace-core";

import { NodePlatformAdapter } from "./node-platform.js";
import { renderDoctor, renderJson, renderStatus } from "./presentation.js";
import { startStdioServer } from "./stdio-server.js";

export const APPLICATION_VERSION = "0.1.0";

const HELP_TEXT = `ngapd-workspace — read-only Workspace status and diagnostics

Usage:
  ngapd-workspace --help
  ngapd-workspace --version
  ngapd-workspace status [--json]
  ngapd-workspace doctor [--json]
  ngapd-workspace serve --stdio

Commands:
  status   Show allow-listed runtime and configuration status.
  doctor   Run read-only diagnostics.
  serve    Start the MCP server over stdio.

The first release does not scan, modify, or synchronize Workspace files or tasks.`;

export type CliCommand =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "status"; json: boolean }
  | { kind: "doctor"; json: boolean }
  | { kind: "serve-stdio" };

export interface CliIo {
  stdout: { write(value: string): unknown };
  stderr: { write(value: string): unknown };
}

export interface CliRuntime {
  startServer(service: WorkspaceService): Promise<void>;
}

const defaultRuntime: CliRuntime = {
  startServer: startStdioServer,
};

export function parseCommand(args: readonly string[]): CliCommand {
  if (args.length === 0 || isExact(args, "--help") || isExact(args, "-h")) {
    return { kind: "help" };
  }

  if (isExact(args, "--version") || isExact(args, "-V")) {
    return { kind: "version" };
  }

  const [command, ...options] = args;
  if (command === "status" || command === "doctor") {
    if (options.length === 0) {
      return { kind: command, json: false };
    }
    if (isExact(options, "--json")) {
      return { kind: command, json: true };
    }

    throw new UsageError(`${command} accepts only the optional --json argument.`);
  }

  if (command === "serve") {
    if (isExact(options, "--stdio")) {
      return { kind: "serve-stdio" };
    }

    throw new UsageError("serve requires exactly the --stdio argument.");
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
      io.stderr.write(`Error: ${error.message}\nRun ngapd-workspace --help.\n`);
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

  await runtime.startServer(service);
  return 0;
}

class UsageError extends Error {}

function isExact(values: readonly string[], expected: string): boolean {
  return values.length === 1 && values[0] === expected;
}
