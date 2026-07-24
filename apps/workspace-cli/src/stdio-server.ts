import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { WorkspaceService } from "@ngapd/workspace-core";
import { z } from "zod";

const EMPTY_INPUT = z.object({}).strict();

export function createWorkspaceMcpServer(service: WorkspaceService): McpServer {
  const status = service.getStatus();
  const server = new McpServer(
    {
      name: status.serviceName,
      version: status.applicationVersion,
    },
    {
      instructions:
        "This server exposes read-only Workspace status and diagnostics. It cannot scan, modify, or synchronize files or tasks.",
    },
  );

  server.registerTool(
    "workspace_status",
    {
      description:
        "Return allow-listed runtime and configuration status for the local Workspace service.",
      inputSchema: EMPTY_INPUT,
      annotations: {
        title: "Workspace status",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const result = service.getStatus();
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    },
  );

  server.registerTool(
    "workspace_doctor",
    {
      description: "Run read-only diagnostics for the Workspace CLI runtime and configuration.",
      inputSchema: EMPTY_INPUT,
      annotations: {
        title: "Workspace doctor",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const result = service.runDoctor();
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    },
  );

  return server;
}

export async function startStdioServer(service: WorkspaceService): Promise<void> {
  const server = createWorkspaceMcpServer(service);
  const transport = new StdioServerTransport();
  let closing = false;

  const close = async (exitCode: number): Promise<void> => {
    if (closing) {
      return;
    }

    closing = true;
    process.exitCode = exitCode;
    await server.close();
  };

  server.server.onerror = () => {
    process.stderr.write("MCP protocol input error.\n");
    void close(2);
  };

  process.once("SIGINT", () => {
    void close(130);
  });
  process.once("SIGTERM", () => {
    void close(143);
  });
  process.stdin.once("end", () => {
    void close(0);
  });

  await server.connect(transport);
}
