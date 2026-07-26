import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";

const binPath = fileURLToPath(new URL("../dist/bin.js", import.meta.url));
const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("MCP stdio integration", () => {
  it("initializes, discovers only the read-only tools, and invokes both", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [binPath, "serve", "--stdio"],
      stderr: "pipe",
    });
    const client = new Client({
      name: "workspace-cli-integration-test",
      version: "0.1.0",
    });
    clients.push(client);

    await client.connect(transport);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "workspace_doctor",
      "workspace_status",
    ]);
    expect(tools.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "workspace_status",
          annotations: expect.objectContaining({
            readOnlyHint: true,
            destructiveHint: false,
          }),
        }),
      ]),
    );

    const status = await client.callTool({
      name: "workspace_status",
      arguments: {},
    });
    const doctor = await client.callTool({
      name: "workspace_doctor",
      arguments: {},
    });

    expect(readText(status.content)).toMatchObject({
      capabilities: ["workspace_status", "workspace_doctor"],
      accessMode: "read-only-diagnostics",
      configuration: { ready: false, workspaceRegistered: false },
    });
    expect(readText(doctor.content)).toMatchObject({
      summary: { ready: true, failed: 0 },
    });
  });

  it("keeps human output out of stdout for malformed protocol input", async () => {
    const child = spawn(process.execPath, [binPath, "serve", "--stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = collect(child.stdout);
    const stderr = collect(child.stderr);

    child.stdin.end("not-json\n");
    const exit = await exited(child);

    const protocolOutput = await stdout;
    const diagnosticOutput = await stderr;
    expect(protocolOutput).not.toContain("Workspace CLI");
    expect(protocolOutput).not.toContain("Error:");
    expect(
      exit.code !== 0 || protocolOutput.includes('"error"') || diagnosticOutput.length > 0,
    ).toBe(true);
  });

  it.each([
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ] as const)("closes cleanly on %s", async (signal, expectedCode) => {
    const child = spawn(process.execPath, [binPath, "serve", "--stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = collect(child.stdout);
    const stderr = collect(child.stderr);

    const initialized = initialize(child.stdout, child.stdin);
    await expect(initialized).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: expect.objectContaining({
        protocolVersion: LATEST_PROTOCOL_VERSION,
      }),
    });

    const exit = exited(child);
    child.kill(signal);

    await expect(exit).resolves.toEqual(
      process.platform === "win32" ? { code: null, signal } : { code: expectedCode, signal: null },
    );
    expect(await stdout).not.toContain("Workspace CLI");
    expect(await stderr).not.toContain("Workspace CLI failed");
  });
});

function readText(content: unknown): unknown {
  if (!Array.isArray(content)) {
    throw new Error("Expected MCP content array.");
  }
  const text = content.find(
    (item): item is { type: "text"; text: string } =>
      typeof item === "object" &&
      item !== null &&
      "type" in item &&
      item.type === "text" &&
      "text" in item &&
      typeof item.text === "string",
  );
  if (text === undefined) {
    throw new Error("Expected MCP text content.");
  }
  return JSON.parse(text.text) as unknown;
}

function collect(stream: NodeJS.ReadableStream | null): Promise<string> {
  if (stream === null) {
    return Promise.resolve("");
  }

  return new Promise((resolve, reject) => {
    let output = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      output += chunk;
    });
    stream.on("end", () => {
      resolve(output);
    });
    stream.on("error", reject);
  });
}

function exited(
  child: ReturnType<typeof spawn>,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolve({ code, signal });
    });
  });
}

function initialize(
  stdout: NodeJS.ReadableStream | null,
  stdin: NodeJS.WritableStream | null,
): Promise<unknown> {
  if (stdout === null || stdin === null) {
    return Promise.reject(new Error("Expected piped MCP stdio streams."));
  }

  const response = new Promise<unknown>((resolve, reject) => {
    let buffer = "";
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for MCP initialization."));
    }, 4_000);

    const cleanup = () => {
      clearTimeout(timeout);
      stdout.off("data", onData);
      stdout.off("error", onError);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString();
      const newline = buffer.indexOf("\n");
      if (newline === -1) {
        return;
      }

      cleanup();
      try {
        resolve(JSON.parse(buffer.slice(0, newline)) as unknown);
      } catch (error) {
        reject(error);
      }
    };

    stdout.on("data", onData);
    stdout.on("error", onError);
  });

  stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {
          name: "workspace-cli-signal-test",
          version: "0.1.0",
        },
      },
    })}\n`,
  );

  return response;
}
