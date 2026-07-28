import {
  ApiErrorSchema,
  DeviceAccessTokenRequestSchema,
  DeviceAccessTokenSchema,
  DeviceListSchema,
  EmptySuccessSchema,
  LoginRequestSchema,
  PairingCliStatusRequestSchema,
  PairingCliStatusSchema,
  PairingConsumeRequestSchema,
  PairingCreatedSchema,
  PairingCredentialSchema,
  PairingDecisionSchema,
  PairingRequestSchema,
  PairingWebSummarySchema,
  RegisterRequestSchema,
  SessionActorSchema,
  UpdateUserProfileRequestSchema,
  UserProfileSchema,
  type DeviceAccessTokenRequest,
  type LoginRequest,
  type PairingCliStatusRequest,
  type PairingConsumeRequest,
  type PairingDecision,
  type PairingRequest,
  type RegisterRequest,
  type UpdateUserProfileRequest,
} from "@ngapd/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";

import { ApplicationError } from "./errors.js";
import type { IdentityService } from "./service.js";

const sessionCookieName = "ngapd_session";
const cookieMaxAgeSeconds = 12 * 60 * 60;

export async function registerIdentityRoutes(
  app: FastifyInstance,
  options: {
    service: IdentityService;
    publicOrigin: string;
    now: () => Date;
  },
): Promise<void> {
  const context = (request: FastifyRequest) => ({
    requestId: request.id,
    now: options.now(),
  });
  const actor = async (request: FastifyRequest) =>
    options.service.resolveSession(readSessionToken(request), options.now());
  const deviceActor = async (request: FastifyRequest) =>
    options.service.resolveAccessToken(readBearerToken(request), options.now());

  app.post<{ Body: RegisterRequest }>(
    "/api/v1/auth/register",
    {
      schema: {
        body: RegisterRequestSchema,
        response: {
          201: SessionActorSchema,
          400: ApiErrorSchema,
          409: ApiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      assertSameOrigin(request, options.publicOrigin);
      const result = await options.service.register(request.body, context(request));
      return reply
        .header("set-cookie", serializeSessionCookie(result.token))
        .code(201)
        .send(result.actor);
    },
  );

  app.post<{ Body: LoginRequest }>(
    "/api/v1/auth/login",
    {
      schema: {
        body: LoginRequestSchema,
        response: {
          200: SessionActorSchema,
          400: ApiErrorSchema,
          401: ApiErrorSchema,
          403: ApiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      assertSameOrigin(request, options.publicOrigin);
      const result = await options.service.login(request.body, context(request));
      return reply.header("set-cookie", serializeSessionCookie(result.token)).send(result.actor);
    },
  );

  app.get(
    "/api/v1/auth/session",
    {
      schema: {
        response: {
          200: SessionActorSchema,
          401: ApiErrorSchema,
          403: ApiErrorSchema,
        },
      },
    },
    async (request) => {
      const session = await actor(request);
      return {
        userId: session.userId,
        loginName: session.loginName,
        expiresAt: session.expiresAt.toISOString(),
      };
    },
  );

  app.get(
    "/api/v1/users/me/profile",
    {
      schema: {
        response: {
          200: UserProfileSchema,
          401: ApiErrorSchema,
          403: ApiErrorSchema,
          404: ApiErrorSchema,
        },
      },
    },
    async (request) => {
      const session = await actor(request);
      return options.service.getProfile(session.userId, context(request));
    },
  );

  app.patch<{ Body: UpdateUserProfileRequest }>(
    "/api/v1/users/me/profile",
    {
      schema: {
        body: UpdateUserProfileRequestSchema,
        response: {
          200: UserProfileSchema,
          400: ApiErrorSchema,
          401: ApiErrorSchema,
          403: ApiErrorSchema,
          409: ApiErrorSchema,
          422: ApiErrorSchema,
        },
      },
    },
    async (request) => {
      assertSameOrigin(request, options.publicOrigin);
      const session = await actor(request);
      return options.service.updateProfile(request.body, session.userId, context(request));
    },
  );

  app.post(
    "/api/v1/auth/logout",
    {
      schema: {
        response: {
          200: EmptySuccessSchema,
          401: ApiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      assertSameOrigin(request, options.publicOrigin);
      await options.service.logout(readSessionToken(request), context(request));
      return reply.header("set-cookie", clearSessionCookie()).send({ ok: true });
    },
  );

  app.post<{ Body: PairingRequest }>(
    "/api/v1/pairing/requests",
    {
      schema: {
        body: PairingRequestSchema,
        response: {
          201: PairingCreatedSchema,
          400: ApiErrorSchema,
        },
      },
    },
    async (request, reply) =>
      reply.code(201).send(await options.service.createPairing(request.body, context(request))),
  );

  app.get<{ Params: { code: string } }>(
    "/api/v1/pairing/requests/:code",
    {
      schema: {
        params: {
          type: "object",
          additionalProperties: false,
          required: ["code"],
          properties: { code: { type: "string", minLength: 8, maxLength: 12 } },
        },
        response: {
          200: PairingWebSummarySchema,
          401: ApiErrorSchema,
          404: ApiErrorSchema,
          410: ApiErrorSchema,
        },
      },
    },
    async (request) => {
      await actor(request);
      return options.service.pairingSummary(request.params.code, options.now());
    },
  );

  app.post<{ Params: { code: string }; Body: PairingDecision }>(
    "/api/v1/pairing/requests/:code/decision",
    {
      schema: {
        params: {
          type: "object",
          additionalProperties: false,
          required: ["code"],
          properties: { code: { type: "string", minLength: 8, maxLength: 12 } },
        },
        body: PairingDecisionSchema,
        response: {
          200: PairingWebSummarySchema,
          401: ApiErrorSchema,
          403: ApiErrorSchema,
          404: ApiErrorSchema,
          409: ApiErrorSchema,
          410: ApiErrorSchema,
        },
      },
    },
    async (request) => {
      assertSameOrigin(request, options.publicOrigin);
      const session = await actor(request);
      return options.service.decidePairing(
        request.params.code,
        request.body.decision,
        session.userId,
        context(request),
      );
    },
  );

  app.post<{ Params: { pairingId: string }; Body: PairingCliStatusRequest }>(
    "/api/v1/pairing/requests/:pairingId/status",
    {
      schema: {
        params: {
          type: "object",
          additionalProperties: false,
          required: ["pairingId"],
          properties: { pairingId: { type: "string", format: "uuid" } },
        },
        body: PairingCliStatusRequestSchema,
        response: {
          200: PairingCliStatusSchema,
          400: ApiErrorSchema,
          403: ApiErrorSchema,
          404: ApiErrorSchema,
          410: ApiErrorSchema,
          429: ApiErrorSchema,
        },
      },
    },
    async (request) =>
      options.service.pairingStatus(
        request.params.pairingId,
        request.body.correlationSecret,
        context(request),
      ),
  );

  app.post<{ Params: { pairingId: string }; Body: PairingConsumeRequest }>(
    "/api/v1/pairing/requests/:pairingId/consume",
    {
      schema: {
        params: {
          type: "object",
          additionalProperties: false,
          required: ["pairingId"],
          properties: { pairingId: { type: "string", format: "uuid" } },
        },
        body: PairingConsumeRequestSchema,
        response: {
          200: PairingCredentialSchema,
          400: ApiErrorSchema,
          403: ApiErrorSchema,
          404: ApiErrorSchema,
          409: ApiErrorSchema,
          410: ApiErrorSchema,
          429: ApiErrorSchema,
        },
      },
    },
    async (request) =>
      options.service.consumePairing(
        request.params.pairingId,
        request.body.correlationSecret,
        context(request),
      ),
  );

  app.post<{ Body: DeviceAccessTokenRequest }>(
    "/api/v1/device-access-tokens",
    {
      schema: {
        body: DeviceAccessTokenRequestSchema,
        response: {
          201: DeviceAccessTokenSchema,
          400: ApiErrorSchema,
          401: ApiErrorSchema,
          403: ApiErrorSchema,
        },
      },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(await options.service.issueDeviceAccessToken(request.body, context(request))),
  );

  app.get(
    "/api/v1/devices",
    {
      schema: {
        response: {
          200: DeviceListSchema,
          401: ApiErrorSchema,
        },
      },
    },
    async (request) => {
      const session = await actor(request);
      return options.service.listDevices(session.userId);
    },
  );

  app.post<{ Params: { deviceId: string } }>(
    "/api/v1/devices/:deviceId/revoke",
    {
      schema: {
        params: {
          type: "object",
          additionalProperties: false,
          required: ["deviceId"],
          properties: { deviceId: { type: "string", format: "uuid" } },
        },
        response: {
          200: EmptySuccessSchema,
          401: ApiErrorSchema,
          403: ApiErrorSchema,
          404: ApiErrorSchema,
        },
      },
    },
    async (request) => {
      assertSameOrigin(request, options.publicOrigin);
      const session = await actor(request);
      await options.service.revokeDevice(request.params.deviceId, session.userId, context(request));
      return { ok: true };
    },
  );

  app.post(
    "/api/v1/devices/current/revoke",
    {
      schema: {
        response: {
          200: EmptySuccessSchema,
          401: ApiErrorSchema,
          403: ApiErrorSchema,
        },
      },
    },
    async (request) => {
      const identity = await deviceActor(request);
      await options.service.revokeCurrentDevice(identity, context(request));
      return { ok: true };
    },
  );
}

function assertSameOrigin(request: FastifyRequest, publicOrigin: string): void {
  if (request.headers.origin !== publicOrigin) {
    throw new ApplicationError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "请求来源不受信任",
      "请从 NGAPD Web 页面重试",
    );
  }
}

function readSessionToken(request: FastifyRequest): string | undefined {
  const cookie = request.headers.cookie;
  if (!cookie) {
    return undefined;
  }
  for (const entry of cookie.split(";")) {
    const [name, ...rawValue] = entry.trim().split("=");
    if (name === sessionCookieName) {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return undefined;
}

function readBearerToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (!authorization) {
    return undefined;
  }
  const [scheme, token, ...rest] = authorization.trim().split(/\s+/);
  return scheme?.toLowerCase() === "bearer" && token && rest.length === 0 ? token : undefined;
}

function serializeSessionCookie(token: string): string {
  return [
    `${sessionCookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${cookieMaxAgeSeconds}`,
  ].join("; ");
}

function clearSessionCookie(): string {
  return [
    `${sessionCookieName}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Max-Age=0",
  ].join("; ");
}
