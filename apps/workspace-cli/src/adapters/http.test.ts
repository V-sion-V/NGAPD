import { describe, expect, it, vi } from "vitest";

import { WorkspaceRemoteError } from "@ngapd/workspace-core";

import { HttpWorkspaceApiAdapter } from "./http.js";

const workspaceId = "10000000-0000-4000-8000-000000000001";
const accessToken = "access-token-that-must-not-enter-the-url";
const pairingId = "30000000-0000-4000-8000-000000000001";
const deviceId = "40000000-0000-4000-8000-000000000001";

describe("HttpWorkspaceApiAdapter", () => {
  it("supports pairing and device-token exchange without putting credentials in URLs", async () => {
    const correlationSecret = "correlation-secret-which-is-at-least-32-bytes";
    const deviceCredential = "device-credential-which-is-at-least-32-bytes";
    const issuedAccessToken = "issued-access-token-which-is-at-least-32-bytes";
    const expiresAt = "2026-07-25T01:00:00.000Z";
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            pairingId,
            code: "ABCD1234",
            verificationPath: "/pair/ABCD1234",
            expiresAt,
          },
          201,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ pairingId, status: "approved", expiresAt }))
      .mockResolvedValueOnce(
        jsonResponse({
          deviceId,
          accessToken: issuedAccessToken,
          deviceCredential,
          accessTokenExpiresAt: expiresAt,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            deviceId,
            accessToken: issuedAccessToken,
            accessTokenExpiresAt: expiresAt,
          },
          201,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const adapter = new HttpWorkspaceApiAdapter(
      "https://workspace.example.test",
      fetchImplementation,
    );

    await adapter.createPairing({
      deviceName: "test-mac",
      platform: "macos",
      correlationSecret,
    });
    await adapter.pairingStatus({ pairingId, correlationSecret });
    await adapter.consumePairing({ pairingId, correlationSecret });
    await adapter.issueDeviceAccessToken({ deviceId, deviceCredential });
    await adapter.revokeCurrentDevice(issuedAccessToken);

    const calls = fetchImplementation.mock.calls;
    expect(calls).toHaveLength(5);
    for (const [url] of calls) {
      expect(String(url)).not.toContain(correlationSecret);
      expect(String(url)).not.toContain(deviceCredential);
      expect(String(url)).not.toContain(issuedAccessToken);
    }
    expect(requestJson(calls[0]!)).toMatchObject({ correlationSecret });
    expect(requestJson(calls[1]!)).toEqual({ correlationSecret });
    expect(requestJson(calls[2]!)).toEqual({ correlationSecret });
    expect(requestJson(calls[3]!)).toEqual({ deviceId, deviceCredential });
    expect(new Headers(calls[0]![1]?.headers).has("authorization")).toBe(false);
    expect(new Headers(calls[3]![1]?.headers).has("authorization")).toBe(false);
    expect(new Headers(calls[4]![1]?.headers).get("authorization")).toBe(
      `Bearer ${issuedAccessToken}`,
    );
  });

  it("uses only the configured origin and validates successful responses at runtime", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        workspace: {
          id: workspaceId,
          scopeType: "user",
          scopeId: "20000000-0000-4000-8000-000000000001",
          lifecycle: "active",
          workCycle: 1,
          syncVersion: 0,
        },
        currentVersion: {
          workspaceId,
          syncVersion: 0,
          manifest: {
            hash: "0".repeat(64),
            entries: [],
          },
          createdAt: "2026-07-25T00:00:00.000Z",
        },
      }),
    );
    const adapter = new HttpWorkspaceApiAdapter(
      "https://workspace.example.test",
      fetchImplementation,
    );

    const result = await adapter.getMetadata(workspaceId, accessToken);

    expect(result.workspace.id).toBe(workspaceId);
    const [url, options] = fetchImplementation.mock.calls[0]!;
    expect(String(url)).toBe(`https://workspace.example.test/api/v1/workspaces/${workspaceId}`);
    expect(String(url)).not.toContain(accessToken);
    expect(new Headers(options?.headers).get("authorization")).toBe(`Bearer ${accessToken}`);
  });

  it("keeps lease secrets out of URLs and verifies object upload acknowledgements", async () => {
    const content = Buffer.from("object", "utf8");
    const sha256 = "a".repeat(64);
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ sha256, size: content.byteLength }));
    const adapter = new HttpWorkspaceApiAdapter("http://127.0.0.1:3000", fetchImplementation);

    await adapter.uploadObject({
      workspaceId,
      sha256,
      content,
      accessToken,
      leaseId: "30000000-0000-4000-8000-000000000001",
      connectionId: "40000000-0000-4000-8000-000000000001",
      leaseToken: "lease-token-that-must-stay-in-a-header",
    });

    const [url, options] = fetchImplementation.mock.calls[0]!;
    expect(String(url)).not.toContain("lease-token");
    const headers = new Headers(options?.headers);
    expect(headers.get("x-ngapd-lease-token")).toBe("lease-token-that-must-stay-in-a-header");
    expect(headers.get("content-type")).toBe("application/octet-stream");
  });

  it("rejects malformed success and error payloads without reflecting secrets", async () => {
    const malformedSuccess = new HttpWorkspaceApiAdapter(
      "https://workspace.example.test",
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ unexpected: true })),
    );
    await expect(malformedSuccess.getMetadata(workspaceId, accessToken)).rejects.toMatchObject({
      code: "REMOTE_RESPONSE_INVALID",
    });

    const remoteFailure = new HttpWorkspaceApiAdapter(
      "https://workspace.example.test",
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          {
            code: "BASE_VERSION_CONFLICT",
            message: `Base version changed; rejected ${accessToken}`,
            requestId: "request-conflict",
            currentVersion: 2,
            recovery: `Refresh the Workspace without ${accessToken}`,
          },
          409,
        ),
      ),
    );
    let observed: unknown;
    try {
      await remoteFailure.getMetadata(workspaceId, accessToken);
    } catch (error) {
      observed = error;
    }
    expect(observed).toBeInstanceOf(WorkspaceRemoteError);
    expect(observed).toMatchObject({
      remoteCode: "BASE_VERSION_CONFLICT",
      requestId: "request-conflict",
      currentVersion: 2,
    });
    expect(String(observed)).not.toContain(accessToken);
    expect((observed as WorkspaceRemoteError).recovery).not.toContain(accessToken);

    const deviceCredential = "device-credential-which-is-at-least-32-bytes";
    const credentialFailure = new HttpWorkspaceApiAdapter(
      "https://workspace.example.test",
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          {
            code: "DEVICE_CREDENTIAL_INVALID",
            message: `Rejected ${deviceCredential}`,
            requestId: "request-device-credential",
            recovery: `Replace ${deviceCredential}`,
          },
          401,
        ),
      ),
    );
    let credentialError: unknown;
    try {
      await credentialFailure.issueDeviceAccessToken({ deviceId, deviceCredential });
    } catch (error) {
      credentialError = error;
    }
    expect(String(credentialError)).not.toContain(deviceCredential);
    expect((credentialError as WorkspaceRemoteError).recovery).not.toContain(deviceCredential);

    const leaseToken = "lease-token-that-must-stay-in-a-header";
    const leaseFailure = new HttpWorkspaceApiAdapter(
      "https://workspace.example.test",
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          {
            code: "LEASE_INVALID",
            message: `Rejected ${leaseToken}`,
            requestId: "request-lease",
            recovery: `Replace ${leaseToken}`,
          },
          409,
        ),
      ),
    );
    let leaseError: unknown;
    try {
      await leaseFailure.uploadObject({
        workspaceId,
        sha256: "b".repeat(64),
        content: Buffer.from("content"),
        accessToken,
        leaseId: "50000000-0000-4000-8000-000000000001",
        connectionId: "60000000-0000-4000-8000-000000000001",
        leaseToken,
      });
    } catch (error) {
      leaseError = error;
    }
    expect(String(leaseError)).not.toContain(leaseToken);
    expect((leaseError as WorkspaceRemoteError).recovery).not.toContain(leaseToken);
  });

  it("allows plain HTTP only for explicit loopback development origins", () => {
    expect(() => new HttpWorkspaceApiAdapter("http://[::1]:3000")).not.toThrow();
    expect(() => new HttpWorkspaceApiAdapter("http://workspace.example.test")).toThrow(
      "Plain HTTP",
    );
    expect(() => new HttpWorkspaceApiAdapter("https://user@example.test")).toThrow(
      "without credentials",
    );
  });
});

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requestJson(call: Parameters<typeof fetch>): unknown {
  const body = call[1]?.body;
  if (typeof body !== "string") {
    throw new Error("expected JSON request body");
  }
  return JSON.parse(body) as unknown;
}
