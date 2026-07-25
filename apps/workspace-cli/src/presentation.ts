import type { DoctorResult, WorkspaceStatus } from "@ngapd/workspace-core";

import type { WorkspaceCliResult } from "./commands.js";

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

export function renderWorkspaceResult(result: WorkspaceCliResult, json: boolean): string {
  if (json) {
    return JSON.stringify(result);
  }
  const details = Object.entries(result.data).map(
    ([key, value]) => `${humanizeKey(key)}: ${formatValue(value)}`,
  );
  return [
    result.message,
    `Status: ${result.status}`,
    ...(result.workspaceId === null ? [] : [`Workspace: ${result.workspaceId}`]),
    ...details,
    ...(result.recovery === null ? [] : [`Recovery: ${result.recovery}`]),
  ].join("\n");
}

function humanizeKey(key: string): string {
  return key
    .replaceAll(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/^./u, (character) => character.toUpperCase());
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (value === null) {
    return "none";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
