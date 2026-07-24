import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
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
    const exitCode = await exited(child);

    const protocolOutput = await stdout;
    const diagnosticOutput = await stderr;
    expect(protocolOutput).not.toContain("Workspace CLI");
    expect(protocolOutput).not.toContain("Error:");
    expect(
      exitCode !== 0 || protocolOutput.includes('"error"') || diagnosticOutput.length > 0,
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

    await new Promise((resolve) => {
      setTimeout(resolve, 150);
    });
    child.kill(signal);

    await expect(exited(child)).resolves.toBe(expectedCode);
    expect(await stdout).toBe("");
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

function exited(child: ReturnType<typeof spawn>): Promise<number | null> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      resolve(code);
    });
  });
}
