import type { ApiError } from "@ngapd/contracts";

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  json?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  adminModeId?: string | null;
}

export class ApiRequestError extends Error {
  override readonly name = "ApiRequestError";

  constructor(
    readonly detail: ApiError,
    readonly status: number,
  ) {
    super(detail.message);
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  if (!path.startsWith("/api/")) {
    throw new Error("API 请求必须使用同源 /api/ 路径");
  }

  const headers = new Headers(options.headers);
  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (options.adminModeId) {
    headers.set("x-ngapd-admin-mode-id", options.adminModeId);
  }

  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    headers,
    ...(options.json === undefined ? {} : { body: JSON.stringify(options.json) }),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!response.ok) {
    throw new ApiRequestError(await readApiError(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function readApiError(response: Response): Promise<ApiError> {
  try {
    const detail = (await response.json()) as Partial<ApiError>;
    if (
      typeof detail.code === "string" &&
      typeof detail.message === "string" &&
      typeof detail.requestId === "string"
    ) {
      return detail as ApiError;
    }
  } catch {
    // A malformed gateway response is normalized below without exposing its body.
  }

  return {
    code: "INTERNAL_ERROR",
    message: "服务暂时无法完成请求",
    requestId: response.headers.get("x-request-id") ?? "unknown",
    recovery: "请稍后重试；若问题持续，请向管理员提供请求编号。",
  };
}
