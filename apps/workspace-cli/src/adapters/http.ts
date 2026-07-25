import { randomUUID } from "node:crypto";

import {
  ApiErrorSchema,
  CommitWorkspaceResponseSchema,
  DeviceAccessTokenSchema,
  EmptySuccessSchema,
  PairingCliStatusSchema,
  PairingCreatedSchema,
  PairingCredentialSchema,
  ResolveWorkspaceConflictResponseSchema,
  WorkspaceLeaseGrantSchema,
  WorkspaceLeaseSchema,
  WorkspaceMetadataResponseSchema,
  WorkspaceObjectSchema,
} from "@ngapd/contracts";
import {
  WorkspaceCoreError,
  WorkspaceRemoteError,
  type WorkspaceApiPort,
} from "@ngapd/workspace-core";
import { FormatRegistry } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { Static, TSchema } from "@sinclair/typebox";

if (!FormatRegistry.Has("uuid")) {
  FormatRegistry.Set("uuid", (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value),
  );
}
if (!FormatRegistry.Has("date-time")) {
  FormatRegistry.Set(
    "date-time",
    (value) => /^\d{4}-\d{2}-\d{2}T/u.test(value) && Number.isFinite(Date.parse(value)),
  );
}

export class HttpWorkspaceApiAdapter implements WorkspaceApiPort {
  readonly origin: string;

  constructor(
    origin: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new WorkspaceCoreError("REMOTE_REQUEST_FAILED", "Workspace API origin is invalid.");
    }
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.origin !== origin ||
      parsed.username.length > 0 ||
      parsed.password.length > 0
    ) {
      throw new WorkspaceCoreError(
        "REMOTE_REQUEST_FAILED",
        "Workspace API origin must be a canonical HTTP(S) origin without credentials.",
      );
    }
    if (
      parsed.protocol === "http:" &&
      parsed.hostname !== "127.0.0.1" &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "[::1]"
    ) {
      throw new WorkspaceCoreError(
        "REMOTE_REQUEST_FAILED",
        "Plain HTTP is allowed only for an explicit loopback development origin.",
      );
    }
    this.origin = parsed.origin;
  }

  createPairing(input: Parameters<WorkspaceApiPort["createPairing"]>[0]) {
    return this.requestJson("POST", "/api/v1/pairing/requests", PairingCreatedSchema, {
      jsonBody: input,
    });
  }

  pairingStatus(input: Parameters<WorkspaceApiPort["pairingStatus"]>[0]) {
    return this.requestJson(
      "POST",
      `/api/v1/pairing/requests/${encodeURIComponent(input.pairingId)}/status`,
      PairingCliStatusSchema,
      { jsonBody: { correlationSecret: input.correlationSecret } },
    );
  }

  consumePairing(input: Parameters<WorkspaceApiPort["consumePairing"]>[0]) {
    return this.requestJson(
      "POST",
      `/api/v1/pairing/requests/${encodeURIComponent(input.pairingId)}/consume`,
      PairingCredentialSchema,
      { jsonBody: { correlationSecret: input.correlationSecret } },
    );
  }

  issueDeviceAccessToken(input: Parameters<WorkspaceApiPort["issueDeviceAccessToken"]>[0]) {
    return this.requestJson("POST", "/api/v1/device-access-tokens", DeviceAccessTokenSchema, {
      jsonBody: input,
    });
  }

  async revokeCurrentDevice(accessToken: string): Promise<void> {
    const result = await this.requestJson(
      "POST",
      "/api/v1/devices/current/revoke",
      EmptySuccessSchema,
      { accessToken },
    );
    if (!result.ok) {
      throw new WorkspaceCoreError(
        "REMOTE_RESPONSE_INVALID",
        "Workspace API did not acknowledge device revocation.",
      );
    }
  }

  getMetadata(workspaceId: string, accessToken: string) {
    return this.requestJson(
      "GET",
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}`,
      WorkspaceMetadataResponseSchema,
      { accessToken },
    );
  }

  async readObject(workspaceId: string, sha256: string, accessToken: string): Promise<Uint8Array> {
    const response = await this.request(
      "GET",
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/objects/${encodeURIComponent(sha256)}`,
      { accessToken },
    );
    return new Uint8Array(await response.arrayBuffer());
  }

  async uploadObject(input: {
    workspaceId: string;
    sha256: string;
    content: Uint8Array;
    accessToken: string;
    leaseId: string;
    connectionId: string;
    leaseToken: string;
  }): Promise<void> {
    const result = await this.requestJson(
      "PUT",
      `/api/v1/workspaces/${encodeURIComponent(input.workspaceId)}/objects/${encodeURIComponent(input.sha256)}`,
      WorkspaceObjectSchema,
      {
        accessToken: input.accessToken,
        headers: leaseHeaders(input),
        body: input.content,
        contentType: "application/octet-stream",
      },
    );
    if (result.sha256 !== input.sha256 || result.size !== input.content.byteLength) {
      throw new WorkspaceCoreError(
        "REMOTE_RESPONSE_INVALID",
        "Workspace object response failed integrity checks.",
      );
    }
  }

  acquireLease(input: {
    workspaceId: string;
    connectionId: string;
    baseSyncVersion: number;
    accessToken: string;
  }) {
    return this.requestJson(
      "POST",
      `/api/v1/workspaces/${encodeURIComponent(input.workspaceId)}/lease/acquire`,
      WorkspaceLeaseGrantSchema,
      {
        accessToken: input.accessToken,
        jsonBody: {
          connectionId: input.connectionId,
          baseSyncVersion: input.baseSyncVersion,
        },
      },
    );
  }

  renewLease(input: {
    workspaceId: string;
    leaseId: string;
    connectionId: string;
    leaseToken: string;
    accessToken: string;
  }) {
    return this.leaseMutation("renew", input);
  }

  releaseLease(input: {
    workspaceId: string;
    leaseId: string;
    connectionId: string;
    leaseToken: string;
    accessToken: string;
  }) {
    return this.leaseMutation("release", input);
  }

  takeoverLease(input: {
    workspaceId: string;
    connectionId: string;
    accessToken: string;
    confirmed: true;
  }) {
    return this.requestJson(
      "POST",
      `/api/v1/workspaces/${encodeURIComponent(input.workspaceId)}/lease/takeover`,
      WorkspaceLeaseGrantSchema,
      {
        accessToken: input.accessToken,
        jsonBody: {
          connectionId: input.connectionId,
          confirmed: input.confirmed,
        },
      },
    );
  }

  commit(input: Parameters<WorkspaceApiPort["commit"]>[0]) {
    return this.requestJson(
      "POST",
      `/api/v1/workspaces/${encodeURIComponent(input.workspaceId)}/commits`,
      CommitWorkspaceResponseSchema,
      {
        accessToken: input.accessToken,
        jsonBody: {
          leaseId: input.leaseId,
          connectionId: input.connectionId,
          leaseToken: input.leaseToken,
          baseSyncVersion: input.baseSyncVersion,
          idempotencyKey: input.idempotencyKey,
          manifest: input.manifest,
        },
      },
    );
  }

  resolveConflict(input: Parameters<WorkspaceApiPort["resolveConflict"]>[0]) {
    return this.requestJson(
      "POST",
      `/api/v1/workspaces/${encodeURIComponent(input.workspaceId)}/conflicts/resolve`,
      ResolveWorkspaceConflictResponseSchema,
      {
        accessToken: input.accessToken,
        jsonBody:
          input.choice === "use_local"
            ? {
                choice: input.choice,
                leaseId: input.leaseId,
                connectionId: input.connectionId,
                leaseToken: input.leaseToken,
                baseSyncVersion: input.baseSyncVersion,
                idempotencyKey: input.idempotencyKey,
                manifest: input.manifest,
              }
            : {
                choice: input.choice,
                leaseId: input.leaseId,
                connectionId: input.connectionId,
                leaseToken: input.leaseToken,
              },
      },
    );
  }

  private leaseMutation(
    action: "renew" | "release",
    input: {
      workspaceId: string;
      leaseId: string;
      connectionId: string;
      leaseToken: string;
      accessToken: string;
    },
  ) {
    return this.requestJson(
      "POST",
      `/api/v1/workspaces/${encodeURIComponent(input.workspaceId)}/lease/${action}`,
      WorkspaceLeaseSchema,
      {
        accessToken: input.accessToken,
        jsonBody: {
          leaseId: input.leaseId,
          connectionId: input.connectionId,
          leaseToken: input.leaseToken,
        },
      },
    );
  }

  private async requestJson<TSchemaValue extends TSchema>(
    method: string,
    path: string,
    schema: TSchemaValue,
    options: RequestOptions,
  ): Promise<Static<TSchemaValue>> {
    const response = await this.request(method, path, options);
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new WorkspaceCoreError(
        "REMOTE_RESPONSE_INVALID",
        "Workspace API returned invalid JSON.",
      );
    }
    if (!Value.Check(schema, value)) {
      throw new WorkspaceCoreError(
        "REMOTE_RESPONSE_INVALID",
        "Workspace API response failed runtime schema validation.",
      );
    }
    return value;
  }

  private async request(method: string, path: string, options: RequestOptions): Promise<Response> {
    const requestId = randomUUID();
    const requestSecrets = collectRequestSecrets(options);
    const headers = new Headers({
      accept: "application/json",
      "x-request-id": requestId,
      ...options.headers,
    });
    if (options.accessToken !== undefined) {
      headers.set("authorization", `Bearer ${options.accessToken}`);
    }
    let body: string | Buffer | undefined;
    if (options.jsonBody !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(options.jsonBody);
    } else if (options.body !== undefined) {
      headers.set("content-type", options.contentType ?? "application/octet-stream");
      body = Buffer.from(options.body);
    }

    let response: Response;
    try {
      response = await this.fetchImplementation(`${this.origin}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body }),
      });
    } catch {
      throw new WorkspaceCoreError(
        "REMOTE_REQUEST_FAILED",
        "Workspace API request failed before a response was received.",
        true,
      );
    }
    if (response.ok) {
      return response;
    }

    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new WorkspaceCoreError(
        "REMOTE_RESPONSE_INVALID",
        "Workspace API error response failed runtime validation.",
      );
    }
    if (!Value.Check(ApiErrorSchema, value)) {
      throw new WorkspaceCoreError(
        "REMOTE_RESPONSE_INVALID",
        "Workspace API error response failed runtime validation.",
      );
    }
    throw new WorkspaceRemoteError(
      redact(value.code, requestSecrets),
      redact(value.message, requestSecrets),
      redact(value.requestId, requestSecrets),
      value.currentVersion ?? null,
      value.recovery === undefined ? null : redact(value.recovery, requestSecrets),
      response.status >= 500,
    );
  }
}

interface RequestOptions {
  accessToken?: string;
  headers?: Record<string, string>;
  jsonBody?: unknown;
  body?: Uint8Array;
  contentType?: string;
}

function leaseHeaders(input: {
  leaseId: string;
  connectionId: string;
  leaseToken: string;
}): Record<string, string> {
  return {
    "x-ngapd-lease-id": input.leaseId,
    "x-ngapd-connection-id": input.connectionId,
    "x-ngapd-lease-token": input.leaseToken,
  };
}

function collectRequestSecrets(options: RequestOptions): ReadonlySet<string> {
  const secrets = new Set<string>();
  if (options.accessToken !== undefined) {
    secrets.add(options.accessToken);
  }
  for (const [key, value] of Object.entries(options.headers ?? {})) {
    if (isSensitiveKey(key)) {
      secrets.add(value);
    }
  }
  collectSensitiveValues(options.jsonBody, null, secrets);
  return secrets;
}

function collectSensitiveValues(
  value: unknown,
  propertyName: string | null,
  secrets: Set<string>,
): void {
  if (typeof value === "string") {
    if (propertyName !== null && isSensitiveKey(propertyName) && value.length > 0) {
      secrets.add(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSensitiveValues(item, propertyName, secrets);
    }
    return;
  }
  if (typeof value !== "object" || value === null) {
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    collectSensitiveValues(nested, key, secrets);
  }
}

function isSensitiveKey(key: string): boolean {
  return /(?:authorization|password|secret|credential|access.?token|lease.?token)$/iu.test(key);
}

function redact(value: string, secrets: ReadonlySet<string>): string {
  let redacted = value;
  for (const secret of secrets) {
    redacted = redacted.replaceAll(secret, "[REDACTED]");
  }
  return redacted;
}
