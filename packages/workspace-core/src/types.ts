export type WorkspaceCapability = "workspace_status" | "workspace_doctor";

export interface PlatformInformation {
  platform: string;
  architecture: string;
  nodeVersion: string;
}

export interface PlatformAdapter {
  getPlatformInformation(): PlatformInformation;
}

export interface ConfigurationStatus {
  ready: boolean;
  workspaceRegistered: boolean;
  summary: string;
}

export interface WorkspaceStatus {
  serviceName: string;
  applicationVersion: string;
  protocolCapabilityVersion: string;
  platform: PlatformInformation;
  capabilities: readonly WorkspaceCapability[];
  configuration: ConfigurationStatus;
  accessMode: "read-only-diagnostics";
}

export type DiagnosticCheckStatus = "pass" | "warning" | "fail";

export interface DiagnosticCheck {
  id: string;
  status: DiagnosticCheckStatus;
  summary: string;
}

export interface DoctorResult {
  serviceName: string;
  applicationVersion: string;
  checks: readonly DiagnosticCheck[];
  summary: {
    passed: number;
    warnings: number;
    failed: number;
    ready: boolean;
  };
}
