import { describe, expect, it, vi } from "vitest";

import { APPLICATION_VERSION, parseCommand, runCli } from "./cli.js";

function createIo() {
  return {
    stdout: { write: vi.fn<(value: string) => boolean>(() => true) },
    stderr: { write: vi.fn<(value: string) => boolean>(() => true) },
  };
}

describe("parseCommand", () => {
  it("accepts the documented command surface", () => {
    expect(parseCommand([])).toEqual({ kind: "help" });
    expect(parseCommand(["--version"])).toEqual({ kind: "version" });
    expect(parseCommand(["status", "--json"])).toEqual({
      kind: "status",
      json: true,
    });
    expect(parseCommand(["doctor"])).toEqual({
      kind: "doctor",
      json: false,
    });
    expect(parseCommand(["serve", "--stdio"])).toEqual({
      kind: "serve-stdio",
    });
    expect(parseCommand(["pair", "--device-name", "Studio Mac", "--json"])).toEqual({
      kind: "pair",
      deviceName: "Studio Mac",
      json: true,
    });
    expect(parseCommand(["auth", "status"])).toEqual({
      kind: "auth-status",
      json: false,
    });
    expect(
      parseCommand([
        "connect",
        "10000000-0000-4000-8000-000000000001",
        "--path",
        "workspace-a",
        "--alias",
        "main",
      ]),
    ).toEqual({
      kind: "connect",
      workspace: "10000000-0000-4000-8000-000000000001",
      registeredPath: "workspace-a",
      alias: "main",
      json: false,
    });
    expect(parseCommand(["workspace", "status", "main", "--json"])).toEqual({
      kind: "workspace-status",
      workspace: "main",
      json: true,
    });
    expect(parseCommand(["lease", "hold", "main"])).toEqual({
      kind: "lease",
      action: "hold",
      workspace: "main",
      confirmed: false,
      json: false,
    });
    expect(parseCommand(["lease", "takeover", "main", "--confirm"])).toEqual({
      kind: "lease",
      action: "takeover",
      workspace: "main",
      confirmed: true,
      json: false,
    });
    expect(parseCommand(["sync", "main"])).toEqual({
      kind: "sync",
      workspace: "main",
      json: false,
    });
    expect(parseCommand(["conflict", "use-server", "main", "--confirm"])).toEqual({
      kind: "conflict",
      choice: "use_server",
      workspace: "main",
      confirmed: true,
      json: false,
    });
  });

  it("rejects ambiguous targets, missing confirmations, and secret arguments", () => {
    expect(() => parseCommand(["sync"])).toThrow("requires exactly one");
    expect(() => parseCommand(["status", "--write"])).toThrow("accepts only");
    expect(() => parseCommand(["serve"])).toThrow("requires exactly");
    expect(() => parseCommand(["lease", "takeover", "main"])).toThrow("explicit --confirm");
    expect(() => parseCommand(["conflict", "use-local", "main"])).toThrow("explicit --confirm");
    expect(() => parseCommand(["sync", "/tmp/arbitrary"])).toThrow("registered Workspace");
    expect(() => parseCommand(["auth", "status", "--access-token", "secret"])).toThrow(
      "is forbidden",
    );
  });
});

describe("runCli", () => {
  it("prints help and version without starting a server", async () => {
    const io = createIo();
    const runtime = { startServer: vi.fn() };

    await expect(runCli(["--help"], io, runtime)).resolves.toBe(0);
    expect(io.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining("Workspace synchronization CLI"),
    );
    expect(runtime.startServer).not.toHaveBeenCalled();

    io.stdout.write.mockClear();
    await expect(runCli(["--version"], io, runtime)).resolves.toBe(0);
    expect(io.stdout.write).toHaveBeenCalledWith(`${APPLICATION_VERSION}\n`);
  });

  it("projects status and doctor from stable JSON objects", async () => {
    const statusIo = createIo();
    const doctorIo = createIo();

    await expect(runCli(["status", "--json"], statusIo)).resolves.toBe(0);
    await expect(runCli(["doctor", "--json"], doctorIo)).resolves.toBe(0);

    const status = JSON.parse(String(statusIo.stdout.write.mock.calls[0]?.[0])) as {
      capabilities: string[];
      configuration: { ready: boolean };
      accessMode: string;
    };
    const doctor = JSON.parse(String(doctorIo.stdout.write.mock.calls[0]?.[0])) as {
      checks: Array<{ id: string; status: string }>;
      summary: { ready: boolean };
    };

    expect(status.capabilities).toEqual(["workspace_status", "workspace_doctor"]);
    expect(status.configuration.ready).toBe(false);
    expect(status.accessMode).toBe("read-only-diagnostics");
    expect(doctor.summary.ready).toBe(true);
    expect(doctor.checks).toContainEqual({
      id: "workspace.configuration",
      status: "warning",
      summary: "No Workspace is registered; read-only status and diagnostics remain available.",
    });
  });

  it("returns a stable non-zero usage result on invalid arguments", async () => {
    const io = createIo();

    await expect(runCli(["delete", "/tmp/example"], io)).resolves.toBe(2);
    expect(io.stdout.write).not.toHaveBeenCalled();
    expect(io.stderr.write).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("Code: USAGE_ERROR"),
    );
    expect(io.stderr.write).toHaveBeenNthCalledWith(2, "Run ngapd-workspace --help.\n");
  });

  it("starts only the explicit stdio transport", async () => {
    const io = createIo();
    const runtime = { startServer: vi.fn().mockResolvedValue(undefined) };

    await expect(runCli(["serve", "--stdio"], io, runtime)).resolves.toBe(0);
    expect(runtime.startServer).toHaveBeenCalledOnce();
    expect(io.stdout.write).not.toHaveBeenCalled();
    expect(io.stderr.write).not.toHaveBeenCalled();
  });

  it("projects workspace runtime events and results from the same structure", async () => {
    const io = createIo();
    const workspace = {
      execute: vi.fn(
        async (
          _command: unknown,
          emit: (value: {
            action: string;
            status: "pending";
            message: string;
            workspaceId: null;
            data: Record<string, unknown>;
            recovery: null;
            exitCode: number;
          }) => void,
        ) => {
          emit({
            action: "pair",
            status: "pending",
            message: "Waiting.",
            workspaceId: null,
            data: { code: "PAIR-123" },
            recovery: null,
            exitCode: 0,
          });
          return {
            action: "pair",
            status: "success" as const,
            message: "Paired.",
            workspaceId: null,
            data: { deviceId: "device-1" },
            recovery: null,
            exitCode: 0,
          };
        },
      ),
    };

    await expect(
      runCli(["pair", "--device-name", "Studio Mac", "--json"], io, {
        startServer: vi.fn(),
        workspace,
      }),
    ).resolves.toBe(0);

    const events = io.stdout.write.mock.calls.map(([value]) => JSON.parse(String(value)));
    expect(events).toEqual([
      expect.objectContaining({ status: "pending", data: { code: "PAIR-123" } }),
      expect.objectContaining({ status: "success", data: { deviceId: "device-1" } }),
    ]);
    expect(JSON.stringify(events)).not.toMatch(/credential|accessToken|leaseToken/u);
  });
});
