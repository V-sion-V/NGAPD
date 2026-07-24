import type { DoctorResult, WorkspaceStatus } from "@ngapd/workspace-core";

export function renderStatus(status: WorkspaceStatus): string {
  return [
    "Workspace CLI status",
    `Service: ${status.serviceName}`,
    `Version: ${status.applicationVersion}`,
    `Protocol capabilities: ${status.protocolCapabilityVersion}`,
    `Platform: ${status.platform.platform} (${status.platform.architecture})`,
    `Node.js: ${status.platform.nodeVersion}`,
    `Capabilities: ${status.capabilities.join(", ")}`,
    `Access: ${status.accessMode}`,
    `Configuration: ${status.configuration.ready ? "ready" : "not configured"}`,
    `Details: ${status.configuration.summary}`,
  ].join("\n");
}

export function renderDoctor(result: DoctorResult): string {
  const checks = result.checks.map(
    (check) => `[${check.status.toUpperCase()}] ${check.id}: ${check.summary}`,
  );

  return [
    "Workspace CLI doctor",
    ...checks,
    `Summary: ${result.summary.passed} passed, ${result.summary.warnings} warning(s), ${result.summary.failed} failed`,
    `CLI ready: ${result.summary.ready ? "yes" : "no"}`,
  ].join("\n");
}

export function renderJson(value: unknown): string {
  return JSON.stringify(value, undefined, 2);
}
