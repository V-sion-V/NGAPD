import { arch, platform } from "node:os";

import type { ClockPort, PlatformAdapter, PlatformInformation } from "@ngapd/workspace-core";

import { NodeWorkspaceFileAdapter } from "./adapters/filesystem.js";
import { HttpWorkspaceApiAdapter } from "./adapters/http.js";
import {
  NodeWorkspaceControlAdapter,
  NodeWorkspaceRegistryAdapter,
} from "./adapters/local-state.js";
import { MacOsKeychainCredentialAdapter } from "./adapters/macos-keychain.js";
import { WindowsPasswordVaultCredentialAdapter } from "./adapters/windows-password-vault.js";

export class NodePlatformAdapter implements PlatformAdapter {
  getPlatformInformation(): PlatformInformation {
    return {
      platform: platform(),
      architecture: arch(),
      nodeVersion: process.version,
    };
  }
}

export class NodeClockAdapter implements ClockPort {
  now(): Date {
    return new Date();
  }
}

export async function openNodeWorkspaceAdapters(input: {
  configuredRoot: string;
  registeredPath: string;
  apiOrigin: string;
  fetchImplementation?: typeof fetch;
}) {
  const files = await NodeWorkspaceFileAdapter.open(input.configuredRoot, input.registeredPath);
  const registry = await NodeWorkspaceRegistryAdapter.open(input.configuredRoot);
  const control = await NodeWorkspaceControlAdapter.open(files.workspaceRoot);
  const api = new HttpWorkspaceApiAdapter(input.apiOrigin, input.fetchImplementation);
  return {
    files,
    registry,
    control,
    api,
    clock: new NodeClockAdapter(),
  };
}

export async function openMacOsWorkspaceAdapters(
  input: Parameters<typeof openNodeWorkspaceAdapters>[0],
) {
  const adapters = await openNodeWorkspaceAdapters(input);
  return {
    ...adapters,
    credentials: MacOsKeychainCredentialAdapter.forLoginKeychain(),
  };
}

export async function openWindowsWorkspaceAdapters(
  input: Parameters<typeof openNodeWorkspaceAdapters>[0],
) {
  const adapters = await openNodeWorkspaceAdapters(input);
  return {
    ...adapters,
    credentials: WindowsPasswordVaultCredentialAdapter.forCurrentUser(),
  };
}
