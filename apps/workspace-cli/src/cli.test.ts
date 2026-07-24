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
  });

  it("rejects unknown and write-like commands", () => {
    expect(() => parseCommand(["sync"])).toThrow("Unknown command");
    expect(() => parseCommand(["status", "--write"])).toThrow("accepts only");
    expect(() => parseCommand(["serve"])).toThrow("requires exactly");
  });
});

describe("runCli", () => {
  it("prints help and version without starting a server", async () => {
    const io = createIo();
    const runtime = { startServer: vi.fn() };

    await expect(runCli(["--help"], io, runtime)).resolves.toBe(0);
    expect(io.stdout.write).toHaveBeenCalledWith(
      expect.stringContaining("read-only Workspace status"),
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
    expect(io.stderr.write).toHaveBeenCalledWith(
      "Error: Unknown command or option: delete\nRun ngapd-workspace --help.\n",
    );
  });

  it("starts only the explicit stdio transport", async () => {
    const io = createIo();
    const runtime = { startServer: vi.fn().mockResolvedValue(undefined) };

    await expect(runCli(["serve", "--stdio"], io, runtime)).resolves.toBe(0);
    expect(runtime.startServer).toHaveBeenCalledOnce();
    expect(io.stdout.write).not.toHaveBeenCalled();
    expect(io.stderr.write).not.toHaveBeenCalled();
  });
});
