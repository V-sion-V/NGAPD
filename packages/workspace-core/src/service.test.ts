import { describe, expect, it } from "vitest";

import { WORKSPACE_CAPABILITIES, WorkspaceService } from "./index.js";
import type { PlatformAdapter } from "./index.js";

const platformAdapter: PlatformAdapter = {
  getPlatformInformation: () => ({
    platform: "darwin",
    architecture: "arm64",
    nodeVersion: "v24.18.0",
  }),
};

describe("WorkspaceService", () => {
  it("reports the allow-listed read-only status without external dependencies", () => {
    const service = new WorkspaceService(platformAdapter, {
      applicationVersion: "0.1.0",
    });

    expect(service.getStatus()).toEqual({
      serviceName: "ngapd-workspace",
      applicationVersion: "0.1.0",
      protocolCapabilityVersion: "1",
      platform: {
        platform: "darwin",
        architecture: "arm64",
        nodeVersion: "v24.18.0",
      },
      capabilities: WORKSPACE_CAPABILITIES,
      configuration: {
        ready: false,
        workspaceRegistered: false,
        summary: "No Workspace is registered; read-only status and diagnostics remain available.",
      },
      accessMode: "read-only-diagnostics",
    });
  });

  it("distinguishes supported runtime checks from optional configuration", () => {
    const service = new WorkspaceService(platformAdapter, {
      applicationVersion: "0.1.0",
    });

    const result = service.runDoctor();

    expect(result.summary).toEqual({
      passed: 3,
      warnings: 1,
      failed: 0,
      ready: true,
    });
    expect(result.checks).toContainEqual({
      id: "workspace.configuration",
      status: "warning",
      summary: "No Workspace is registered; read-only status and diagnostics remain available.",
    });
  });

  it("fails the runtime check outside the supported Node.js release line", () => {
    const service = new WorkspaceService(
      {
        getPlatformInformation: () => ({
          platform: "win32",
          architecture: "x64",
          nodeVersion: "v22.22.1",
        }),
      },
      { applicationVersion: "0.1.0" },
    );

    const result = service.runDoctor();

    expect(result.summary.ready).toBe(false);
    expect(result.summary.failed).toBe(1);
    expect(result.checks[0]).toMatchObject({
      id: "runtime.node-24",
      status: "fail",
    });
  });
});
