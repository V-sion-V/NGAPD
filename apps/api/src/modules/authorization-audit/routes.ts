import { createHash } from "node:crypto";

import {
  AdminModeMutationResponseSchema,
  AdminModeParamsSchema,
  ApiErrorSchema,
  CloseAdminModeRequestSchema,
  OpenAdminModeRequestSchema,
  type AdminModeParams,
  type CloseAdminModeRequest,
  type OpenAdminModeRequest,
} from "@ngapd/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { ApplicationError } from "../../application-errors.js";
import type { IdentityService } from "../identity/service.js";
import type { AdminModeService, AuthenticatedM1Actor, M1ApplicationContext } from "./service.js";

export interface M1RouteOptions {
  identity: IdentityService;
  publicOrigin: string;
  now: () => Date;
}

export interface AdminModeHeaders {
  "x-ngapd-admin-mode-id"?: string;
}

export const AdminModeHeadersSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    "x-ngapd-admin-mode-id": { type: "string", format: "uuid" },
  },
} as const;

export const m1ErrorResponses = {
  400: ApiErrorSchema,
  401: ApiErrorSchema,
  403: ApiErrorSchema,
  404: ApiErrorSchema,
  409: ApiErrorSchema,
  410: ApiErrorSchema,
  422: ApiErrorSchema,
  500: ApiErrorSchema,
};

export async function registerAdminModeRoutes(
  app: FastifyInstance,
  options: M1RouteOptions & { service: AdminModeService },
): Promise<void> {
  app.post<{ Body: OpenAdminModeRequest }>(
    "/api/v1/admin-mode/sessions",
    {
      schema: {
        body: OpenAdminModeRequestSchema,
        response: { 201: AdminModeMutationResponseSchema, ...m1ErrorResponses },
      },
    },
    async (request, reply) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveM1Request(request, options);
      return reply
        .code(201)
        .send(await options.service.open(request.body, resolved.actor, resolved.context));
    },
  );

  app.get<{ Params: AdminModeParams }>(
    "/api/v1/admin-mode/sessions/:adminModeId",
    {
      schema: {
        params: AdminModeParamsSchema,
        response: { 200: AdminModeMutationResponseSchema, ...m1ErrorResponses },
      },
    },
    async (request) => {
      const resolved = await resolveM1Request(request, options);
      return options.service.read(request.params.adminModeId, resolved.actor, resolved.context);
    },
  );

  app.post<{ Params: AdminModeParams; Body: CloseAdminModeRequest }>(
    "/api/v1/admin-mode/sessions/:adminModeId/close",
    {
      schema: {
        params: AdminModeParamsSchema,
        body: CloseAdminModeRequestSchema,
        response: { 200: AdminModeMutationResponseSchema, ...m1ErrorResponses },
      },
    },
    async (request) => {
      assertM1SameOrigin(request, options.publicOrigin);
      const resolved = await resolveM1Request(request, options);
      return options.service.close(
        request.params.adminModeId,
        request.body,
        resolved.actor,
        resolved.context,
      );
    },
  );
}

export async function resolveM1Request(
  request: FastifyRequest,
  options: M1RouteOptions,
): Promise<{ actor: AuthenticatedM1Actor; context: M1ApplicationContext }> {
  const now = options.now();
  const session = await options.identity.resolveSession(readSessionToken(request), now);
  return {
    actor: {
      userId: session.userId,
      webSessionId: session.sessionId,
      actorType: "human",
    },
    context: {
      requestId: request.id,
      requestSha256: requestSha256(request),
      now,
    },
  };
}

export function assertM1SameOrigin(request: FastifyRequest, publicOrigin: string): void {
  if (request.headers.origin !== publicOrigin) {
    throw new ApplicationError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "请求来源不受信任",
      "请从 NGAPD Web 页面重试",
    );
  }
}

function requestSha256(request: FastifyRequest): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        body: request.body ?? null,
        method: request.method,
        path: request.url.split("?")[0],
      }),
    )
    .digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function readSessionToken(request: FastifyRequest): string | undefined {
  const cookie = request.headers.cookie;
  if (!cookie) {
    return undefined;
  }
  for (const entry of cookie.split(";")) {
    const [name, ...rawValue] = entry.trim().split("=");
    if (name === "ngapd_session") {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return undefined;
}
