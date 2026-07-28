import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError, apiRequest } from "./api.js";

describe("apiRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends same-origin JSON and scopes an admin capability to the explicit request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiRequest<{ ok: true }>("/api/v1/example", {
        method: "POST",
        json: { value: "safe" },
        adminModeId: "8b5e55f5-89a5-4698-b2b6-e5040933776d",
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/v1/example");
    expect(init.credentials).toBe("same-origin");
    expect(init.body).toBe('{"value":"safe"}');
    const headers = init.headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-ngapd-admin-mode-id")).toBe("8b5e55f5-89a5-4698-b2b6-e5040933776d");
  });

  it("preserves stable error recovery evidence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "PROJECT_VERSION_CONFLICT",
            message: "项目版本已变化",
            requestId: "request-1",
            currentVersion: 4,
            recovery: "请刷新项目后重试",
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const error = await apiRequest("/api/v1/projects/GAME", {
      method: "POST",
      json: {},
    }).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).detail).toMatchObject({
      code: "PROJECT_VERSION_CONFLICT",
      currentVersion: 4,
      recovery: "请刷新项目后重试",
    });
  });

  it("rejects cross-origin paths before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiRequest("https://example.com/api/v1/projects")).rejects.toThrow("同源");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
