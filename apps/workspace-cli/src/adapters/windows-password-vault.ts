import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { isAbsolute, join, resolve } from "node:path";

import {
  WorkspaceCoreError,
  type CredentialPort,
  type CredentialReference,
} from "@ngapd/workspace-core";

const DEFAULT_NAMESPACE = "com.ngapd.workspace";
const MAX_OUTPUT_BYTES = 64 * 1024;
const MAX_CREDENTIAL_BYTES = 4_096;
const BRIDGE_TIMEOUT_MS = 15_000;
const POWERSHELL_ARGUMENTS = [
  "-NoLogo",
  "-NoProfile",
  "-NonInteractive",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  String.raw`
$ErrorActionPreference = "Stop"

function Write-BridgeResult([hashtable] $Value) {
  [Console]::Out.WriteLine(($Value | ConvertTo-Json -Compress))
}

function Get-ExactCredential($Vault, [string] $Resource, [string] $Account) {
  try {
    return $Vault.Retrieve($Resource, $Account)
  }
  catch {
    $exceptionCursor = $_.Exception
    while ($null -ne $exceptionCursor) {
      if (("{0:X8}" -f $exceptionCursor.HResult) -eq "80070490") {
        return $null
      }
      $exceptionCursor = $exceptionCursor.InnerException
    }
    throw
  }
}

try {
  [Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
  [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
  $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $null = [Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime]
  $vault = [Windows.Security.Credentials.PasswordVault]::new()

  switch ($request.action) {
    "put" {
      $existing = Get-ExactCredential $vault $request.resource $request.account
      if ($null -ne $existing) {
        $vault.Remove($existing)
      }
      $credential = [Windows.Security.Credentials.PasswordCredential]::new(
        $request.resource,
        $request.account,
        $request.value
      )
      $vault.Add($credential)
      Write-BridgeResult @{ ok = $true; found = $true }
      exit 0
    }
    "get" {
      $credential = Get-ExactCredential $vault $request.resource $request.account
      if ($null -eq $credential) {
        Write-BridgeResult @{ ok = $true; found = $false }
        exit 0
      }
      $credential.RetrievePassword()
      Write-BridgeResult @{ ok = $true; found = $true; value = $credential.Password }
      exit 0
    }
    "delete" {
      $credential = Get-ExactCredential $vault $request.resource $request.account
      if ($null -ne $credential) {
        $vault.Remove($credential)
      }
      Write-BridgeResult @{ ok = $true; found = ($null -ne $credential) }
      exit 0
    }
    default {
      Write-BridgeResult @{ ok = $false; error = "invalid_action" }
      exit 2
    }
  }
}
catch {
  Write-BridgeResult @{ ok = $false; error = "operation_failed" }
  exit 1
}
`,
] as const;

type BridgeRequest =
  | { action: "put"; resource: string; account: string; value: string }
  | { action: "get"; resource: string; account: string }
  | { action: "delete"; resource: string; account: string };

interface BridgeResult {
  ok: boolean;
  found?: boolean;
  value?: string;
  error?: string;
}

export class WindowsPasswordVaultCredentialAdapter implements CredentialPort {
  private readonly powershellPath: string;

  private constructor(
    private readonly serviceNamespace: string,
    powershellPath: string,
  ) {
    if (process.platform !== "win32") {
      throw new WorkspaceCoreError(
        "CREDENTIAL_UNAVAILABLE",
        "The Windows PasswordVault adapter is available only on Windows.",
      );
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,126}$/u.test(serviceNamespace)) {
      throw new WorkspaceCoreError(
        "CREDENTIAL_INVALID",
        "The Windows PasswordVault namespace is invalid.",
      );
    }
    if (!isAbsolute(powershellPath)) {
      throw new WorkspaceCoreError(
        "CREDENTIAL_UNAVAILABLE",
        "The Windows PowerShell bridge path is invalid.",
      );
    }
    this.powershellPath = resolve(powershellPath);
  }

  static forCurrentUser(serviceNamespace = DEFAULT_NAMESPACE) {
    return new WindowsPasswordVaultCredentialAdapter(serviceNamespace, windowsPowerShellPath());
  }

  reopen(): WindowsPasswordVaultCredentialAdapter {
    return WindowsPasswordVaultCredentialAdapter.forCurrentUser(this.serviceNamespace);
  }

  async put(reference: CredentialReference, value: string): Promise<void> {
    assertCredentialValue(value);
    const locator = credentialLocator(this.serviceNamespace, reference);
    await this.runBridge({
      action: "put",
      resource: locator.resource,
      account: locator.account,
      value,
    });
  }

  async get(reference: CredentialReference): Promise<string | null> {
    const locator = credentialLocator(this.serviceNamespace, reference);
    const result = await this.runBridge({
      action: "get",
      resource: locator.resource,
      account: locator.account,
    });
    if (result.found === false) {
      return null;
    }
    if (result.found !== true || typeof result.value !== "string" || result.value.length === 0) {
      throw safeCredentialError();
    }
    return result.value;
  }

  async delete(reference: CredentialReference): Promise<void> {
    const locator = credentialLocator(this.serviceNamespace, reference);
    await this.runBridge({
      action: "delete",
      resource: locator.resource,
      account: locator.account,
    });
  }

  private async runBridge(request: BridgeRequest): Promise<BridgeResult> {
    const result = await runPowerShellBridge(
      this.powershellPath,
      `${JSON.stringify(request)}\n`,
    ).catch(() => {
      throw safeCredentialError();
    });
    if (result.code !== 0) {
      throw safeCredentialError();
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout.trim()) as unknown;
    } catch {
      throw safeCredentialError();
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("ok" in parsed) ||
      (parsed as { ok?: unknown }).ok !== true
    ) {
      throw safeCredentialError();
    }
    return parsed as BridgeResult;
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
    !isLocatorPart(reference.account) ||
    (reference.workspaceId !== null && !isLocatorPart(reference.workspaceId))
  ) {
    throw new WorkspaceCoreError("CREDENTIAL_INVALID", "Credential account is invalid.");
  }
  const originHash = createHash("sha256").update(origin.origin, "utf8").digest("hex");
  return {
    resource: `${namespace}.${reference.kind}`,
    account: `${reference.kind}:${originHash}:${reference.account}:${reference.workspaceId ?? "-"}`,
  };
}

function assertCredentialValue(value: string): void {
  const byteLength = Buffer.byteLength(value, "utf8");
  if (byteLength < 1 || byteLength > MAX_CREDENTIAL_BYTES || value.includes("\0")) {
    throw new WorkspaceCoreError(
      "CREDENTIAL_INVALID",
      "Credential contains unsupported characters or length.",
    );
  }
}

function isLocatorPart(value: string): boolean {
  return value.length > 0 && value.length <= 128 && /^[A-Za-z0-9._~@-]+$/u.test(value);
}

function windowsPowerShellPath(): string {
  const systemRoot = process.env.SystemRoot ?? String.raw`C:\Windows`;
  if (!isAbsolute(systemRoot)) {
    throw new WorkspaceCoreError(
      "CREDENTIAL_UNAVAILABLE",
      "The Windows system root is unavailable.",
    );
  }
  return join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
}

function safeCredentialError(): WorkspaceCoreError {
  return new WorkspaceCoreError(
    "CREDENTIAL_UNAVAILABLE",
    "Windows PasswordVault operation failed; retry or pair the device again.",
  );
}

function runPowerShellBridge(
  powershellPath: string,
  input: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolveResult, rejectResult) => {
    const child = spawn(powershellPath, POWERSHELL_ARGUMENTS, {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let settled = false;
    let stdout = "";
    let stderr = "";
    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(() => rejectResult(new Error("Windows PasswordVault bridge timed out.")));
    }, BRIDGE_TIMEOUT_MS);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = appendBounded(stdout, chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = appendBounded(stderr, chunk);
    });
    child.stdin.on("error", (error) => {
      finish(() => rejectResult(error));
    });
    child.on("error", (error) => {
      finish(() => rejectResult(error));
    });
    child.on("close", (code) => {
      finish(() => resolveResult({ code: code ?? 1, stdout, stderr }));
    });
    child.stdin.end(input, "utf8");
  });
}

function appendBounded(current: string, chunk: string): string {
  const next = `${current}${chunk}`;
  return Buffer.byteLength(next, "utf8") <= MAX_OUTPUT_BYTES
    ? next
    : next.slice(next.length - MAX_OUTPUT_BYTES);
}
