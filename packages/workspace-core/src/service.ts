import type {
  DiagnosticCheck,
  DoctorResult,
  PlatformAdapter,
  WorkspaceCapability,
  WorkspaceStatus,
} from "./types.js";

export const WORKSPACE_CAPABILITIES = [
  "workspace_status",
  "workspace_doctor",
] as const satisfies readonly WorkspaceCapability[];

export interface WorkspaceServiceOptions {
  applicationVersion: string;
  protocolCapabilityVersion?: string;
  serviceName?: string;
}

export class WorkspaceService {
  readonly #platformAdapter: PlatformAdapter;
  readonly #applicationVersion: string;
  readonly #protocolCapabilityVersion: string;
  readonly #serviceName: string;

  constructor(platformAdapter: PlatformAdapter, options: WorkspaceServiceOptions) {
    this.#platformAdapter = platformAdapter;
    this.#applicationVersion = options.applicationVersion;
    this.#protocolCapabilityVersion = options.protocolCapabilityVersion ?? "1";
    this.#serviceName = options.serviceName ?? "ngapd-workspace";
  }

  getStatus(): WorkspaceStatus {
    return {
      serviceName: this.#serviceName,
      applicationVersion: this.#applicationVersion,
      protocolCapabilityVersion: this.#protocolCapabilityVersion,
      platform: this.#platformAdapter.getPlatformInformation(),
      capabilities: WORKSPACE_CAPABILITIES,
      configuration: {
        ready: false,
        workspaceRegistered: false,
        summary: "No Workspace is registered; read-only status and diagnostics remain available.",
      },
      accessMode: "read-only-diagnostics",
    };
  }

  runDoctor(): DoctorResult {
    const status = this.getStatus();
    const nodeMajor = parseNodeMajor(status.platform.nodeVersion);
    const checks: readonly DiagnosticCheck[] = [
      {
        id: "runtime.node-24",
        status: nodeMajor === 24 ? "pass" : "fail",
        summary:
          nodeMajor === 24
            ? "The CLI is running on the supported Node.js 24 release line."
            : "The CLI requires Node.js 24.",
      },
      {
        id: "runtime.offline",
        status: "pass",
        summary: "Status and diagnostics do not require a database or network connection.",
      },
      {
        id: "security.read-only",
        status: "pass",
        summary: "Only read-only status and diagnostic capabilities are enabled.",
      },
      {
        id: "workspace.configuration",
        status: "warning",
        summary: status.configuration.summary,
      },
    ];

    const passed = checks.filter((check) => check.status === "pass").length;
    const warnings = checks.filter((check) => check.status === "warning").length;
    const failed = checks.filter((check) => check.status === "fail").length;

    return {
      serviceName: status.serviceName,
      applicationVersion: status.applicationVersion,
      checks,
      summary: {
        passed,
        warnings,
        failed,
        ready: failed === 0,
      },
    };
  }
}

function parseNodeMajor(version: string): number | undefined {
  const match = /^v?(\d+)/u.exec(version);
  if (match === null) {
    return undefined;
  }

  return Number.parseInt(match[1] ?? "", 10);
}
