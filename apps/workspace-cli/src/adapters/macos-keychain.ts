import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { lstat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import {
  WorkspaceCoreError,
  type CredentialPort,
  type CredentialReference,
} from "@ngapd/workspace-core";

const SECURITY_TOOL = "/usr/bin/security";
const SAFE_INTERACTIVE_VALUE = /^[A-Za-z0-9._~:/+=@-]+$/u;
const MAX_OUTPUT_BYTES = 64 * 1024;

export class MacOsKeychainCredentialAdapter implements CredentialPort {
  readonly keychainPath: string | null;
  private readonly knownSecrets = new Set<string>();

  private constructor(
    keychainPath: string | null,
    private readonly keychainPassword: string | null,
    private readonly serviceNamespace: string,
  ) {
    if (process.platform !== "darwin") {
      throw new WorkspaceCoreError(
        "CREDENTIAL_UNAVAILABLE",
        "The macOS Keychain adapter is available only on macOS.",
      );
    }
    if (
      (keychainPath !== null &&
        (!isAbsolute(keychainPath) || !SAFE_INTERACTIVE_VALUE.test(keychainPath))) ||
      (keychainPassword !== null && !SAFE_INTERACTIVE_VALUE.test(keychainPassword)) ||
      (keychainPath === null) !== (keychainPassword === null) ||
      !/^[A-Za-z0-9._-]+$/u.test(serviceNamespace)
    ) {
      throw new WorkspaceCoreError(
        "CREDENTIAL_INVALID",
        "The isolated Keychain configuration is invalid.",
      );
    }
    this.keychainPath = keychainPath === null ? null : resolve(keychainPath);
    if (keychainPassword !== null) {
      this.knownSecrets.add(keychainPassword);
    }
  }

  static forLoginKeychain(serviceNamespace = "com.ngapd.workspace") {
    return new MacOsKeychainCredentialAdapter(null, null, serviceNamespace);
  }

  static async createIsolated(
    keychainPath: string,
    keychainPassword: string,
    serviceNamespace = "com.ngapd.workspace",
  ) {
    const adapter = new MacOsKeychainCredentialAdapter(
      keychainPath,
      keychainPassword,
      serviceNamespace,
    );
    if (adapter.keychainPath === null || (await pathExists(adapter.keychainPath))) {
      throw new WorkspaceCoreError(
        "CREDENTIAL_INVALID",
        "The isolated Keychain target already exists.",
      );
    }
    const searchList = await readUserSearchList();
    try {
      await adapter.runInteractive(
        `create-keychain -p ${keychainPassword} ${adapter.keychainPath}`,
      );
      await adapter.runInteractive(`set-keychain-settings -lut 3600 ${adapter.keychainPath}`);
    } finally {
      await restoreUserSearchList(searchList);
    }
    return adapter;
  }

  static async openIsolated(
    keychainPath: string,
    keychainPassword: string,
    serviceNamespace = "com.ngapd.workspace",
  ) {
    const adapter = new MacOsKeychainCredentialAdapter(
      keychainPath,
      keychainPassword,
      serviceNamespace,
    );
    if (adapter.keychainPath === null || !(await pathExists(adapter.keychainPath))) {
      throw new WorkspaceCoreError(
        "CREDENTIAL_UNAVAILABLE",
        "The isolated Keychain does not exist.",
      );
    }
    await adapter.unlock();
    return adapter;
  }

  async reopen(): Promise<MacOsKeychainCredentialAdapter> {
    if (this.keychainPath === null || this.keychainPassword === null) {
      return MacOsKeychainCredentialAdapter.forLoginKeychain(this.serviceNamespace);
    }
    const reopened = new MacOsKeychainCredentialAdapter(
      this.keychainPath,
      this.keychainPassword,
      this.serviceNamespace,
    );
    await reopened.unlock();
    return reopened;
  }

  async unlock(): Promise<void> {
    if (this.keychainPath !== null && this.keychainPassword !== null) {
      await this.runInteractive(`unlock-keychain -p ${this.keychainPassword} ${this.keychainPath}`);
    }
  }

  async put(reference: CredentialReference, value: string): Promise<void> {
    assertCredentialValue(value);
    this.knownSecrets.add(value);
    await this.unlock();
    const locator = credentialLocator(this.serviceNamespace, reference);
    await this.runInteractive(
      `add-generic-password -U -s ${locator.service} -a ${locator.account} -w ${value}${this.keychainSuffix()}`,
    );
  }

  async get(reference: CredentialReference): Promise<string | null> {
    await this.unlock();
    const locator = credentialLocator(this.serviceNamespace, reference);
    const result = await runSecurity([
      "find-generic-password",
      "-s",
      locator.service,
      "-a",
      locator.account,
      "-w",
      ...this.keychainArguments(),
    ]);
    if (result.code === 44) {
      return null;
    }
    if (result.code !== 0) {
      throw this.safeError(result);
    }
    const value = result.stdout.trim();
    if (value.length === 0) {
      throw new WorkspaceCoreError(
        "CREDENTIAL_UNAVAILABLE",
        "macOS Keychain returned an empty credential.",
      );
    }
    this.knownSecrets.add(value);
    return value;
  }

  async delete(reference: CredentialReference): Promise<void> {
    await this.unlock();
    const locator = credentialLocator(this.serviceNamespace, reference);
    const result = await runSecurity([
      "delete-generic-password",
      "-s",
      locator.service,
      "-a",
      locator.account,
      ...this.keychainArguments(),
    ]);
    if (result.code !== 0 && result.code !== 44) {
      throw this.safeError(result);
    }
  }

  async deleteIsolatedKeychain(): Promise<void> {
    if (this.keychainPath === null) {
      throw new WorkspaceCoreError(
        "CREDENTIAL_INVALID",
        "The login Keychain cannot be deleted by this adapter.",
      );
    }
    const searchList = await readUserSearchList();
    const result = await runSecurity(["delete-keychain", this.keychainPath]);
    await restoreUserSearchList(searchList.filter((path) => path !== this.keychainPath));
    if (result.code !== 0 && (await pathExists(this.keychainPath))) {
      throw this.safeError(result);
    }
  }

  private async runInteractive(command: string): Promise<void> {
    const result = await runSecurity(["-q", "-i"], `${command}\n`);
    if (result.code !== 0 || result.stderr.trim().length > 0) {
      throw this.safeError(result);
    }
  }

  private safeError(result: SecurityResult): WorkspaceCoreError {
    let diagnostic = `${result.stdout}\n${result.stderr}`;
    for (const secret of this.knownSecrets) {
      diagnostic = diagnostic.replaceAll(secret, "[REDACTED]");
    }
    diagnostic = diagnostic.trim().replaceAll(/\s+/gu, " ").slice(0, 500);
    return new WorkspaceCoreError(
      "CREDENTIAL_UNAVAILABLE",
      `macOS Keychain operation failed; retry or pair the device again.${
        diagnostic.length === 0 ? "" : ` (${diagnostic})`
      }`,
    );
  }

  private keychainArguments(): string[] {
    return this.keychainPath === null ? [] : [this.keychainPath];
  }

  private keychainSuffix(): string {
    return this.keychainPath === null ? "" : ` ${this.keychainPath}`;
  }
}

function credentialLocator(namespace: string, reference: CredentialReference) {
  let origin: URL;
  try {
    origin = new URL(reference.origin);
  } catch {
    throw new WorkspaceCoreError("CREDENTIAL_INVALID", "Credential origin is invalid.");
  }
  if (
    (origin.protocol !== "https:" && origin.protocol !== "http:") ||
    origin.origin !== reference.origin
  ) {
    throw new WorkspaceCoreError(
      "CREDENTIAL_INVALID",
      "Credential origin must be a canonical HTTP(S) origin.",
    );
  }
  if (
    !SAFE_INTERACTIVE_VALUE.test(reference.account) ||
    (reference.workspaceId !== null && !SAFE_INTERACTIVE_VALUE.test(reference.workspaceId))
  ) {
    throw new WorkspaceCoreError("CREDENTIAL_INVALID", "Credential account is invalid.");
  }
  const originHash = createHash("sha256").update(origin.origin, "utf8").digest("hex");
  const account = `${reference.kind}:${originHash}:${reference.account}:${reference.workspaceId ?? "-"}`;
  return {
    service: `${namespace}.${reference.kind}`,
    account,
  };
}

function assertCredentialValue(value: string): void {
  if (value.length < 1 || value.length > 4_096 || !SAFE_INTERACTIVE_VALUE.test(value)) {
    throw new WorkspaceCoreError(
      "CREDENTIAL_INVALID",
      "Credential contains unsupported characters or length.",
    );
  }
}

async function readUserSearchList(): Promise<string[]> {
  const result = await runSecurity(["list-keychains", "-d", "user"]);
  if (result.code !== 0) {
    throw new WorkspaceCoreError(
      "CREDENTIAL_UNAVAILABLE",
      "Unable to inspect the macOS Keychain search list.",
    );
  }
  return [...result.stdout.matchAll(/"([^"]+)"/gu)].map((match) => match[1]!);
}

async function restoreUserSearchList(paths: readonly string[]): Promise<void> {
  const result = await runSecurity(["list-keychains", "-d", "user", "-s", ...paths]);
  if (result.code !== 0) {
    throw new WorkspaceCoreError(
      "CREDENTIAL_UNAVAILABLE",
      "Unable to restore the macOS Keychain search list.",
    );
  }
}

interface SecurityResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runSecurity(args: readonly string[], input?: string): Promise<SecurityResult> {
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn(SECURITY_TOOL, args, {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = appendBounded(stdout, chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = appendBounded(stderr, chunk);
    });
    child.on("error", rejectResult);
    child.on("close", (code) => {
      resolveResult({ code: code ?? 1, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

function appendBounded(current: string, chunk: string): string {
  const next = `${current}${chunk}`;
  return Buffer.byteLength(next, "utf8") <= MAX_OUTPUT_BYTES
    ? next
    : next.slice(next.length - MAX_OUTPUT_BYTES);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}
