import {
  AcquireWorkspaceLeaseRequestSchema,
  ApiErrorSchema,
  CommitWorkspaceRequestSchema,
  CommitWorkspaceResponseSchema,
  ReleaseWorkspaceLeaseRequestSchema,
  RenewWorkspaceLeaseRequestSchema,
  ResolveWorkspaceConflictRequestSchema,
  ResolveWorkspaceConflictResponseSchema,
  TakeoverWorkspaceLeaseRequestSchema,
  WorkspaceIdParamsSchema,
  WorkspaceLeaseGrantSchema,
  WorkspaceLeaseSchema,
  WorkspaceMetadataResponseSchema,
  WorkspaceObjectParamsSchema,
  WorkspaceObjectSchema,
  WorkspaceVersionParamsSchema,
  WorkspaceVersionSchema,
  type AcquireWorkspaceLeaseRequest,
  type CommitWorkspaceRequest,
  type ReleaseWorkspaceLeaseRequest,
  type RenewWorkspaceLeaseRequest,
  type ResolveWorkspaceConflictRequest,
  type TakeoverWorkspaceLeaseRequest,
} from "@ngapd/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";

import type { IdentityService } from "../identity/service.js";
import type { WorkspaceService } from "./service.js";

interface WorkspaceIdParams {
  workspaceId: string;
}

interface WorkspaceObjectParams extends WorkspaceIdParams {
  sha256: string;
}

interface WorkspaceVersionParams extends WorkspaceIdParams {
  syncVersion: number;
}

interface LeaseHeaders {
  "x-ngapd-lease-id": string;
  "x-ngapd-connection-id": string;
  "x-ngapd-lease-token": string;
}

const LeaseHeadersSchema = {
  type: "object",
  additionalProperties: true,
  required: ["x-ngapd-lease-id", "x-ngapd-connection-id", "x-ngapd-lease-token"],
  properties: {
    "x-ngapd-lease-id": { type: "string", format: "uuid" },
    "x-ngapd-connection-id": { type: "string", format: "uuid" },
    "x-ngapd-lease-token": { type: "string", minLength: 32, maxLength: 256 },
  },
} as const;

const errorResponses = {
  400: ApiErrorSchema,
  401: ApiErrorSchema,
  403: ApiErrorSchema,
  404: ApiErrorSchema,
  409: ApiErrorSchema,
  422: ApiErrorSchema,
  500: ApiErrorSchema,
};

export async function registerWorkspaceRoutes(
  app: FastifyInstance,
  options: {
    identity: IdentityService;
    workspace: WorkspaceService;
    now: () => Date;
  },
): Promise<void> {
  if (!app.hasContentTypeParser("application/octet-stream")) {
    app.addContentTypeParser(
      "application/octet-stream",
      { parseAs: "buffer", bodyLimit: 50 * 1024 * 1024 },
      (_request, body, done) => done(null, body),
    );
  }

  const context = (request: FastifyRequest) => ({
    requestId: request.id,
    now: options.now(),
  });
  const actor = async (request: FastifyRequest) =>
    options.identity.resolveAccessToken(readBearerToken(request), options.now());

  app.get<{ Params: WorkspaceIdParams }>(
    "/api/v1/workspaces/:workspaceId",
    {
      schema: {
        params: WorkspaceIdParamsSchema,
        response: { 200: WorkspaceMetadataResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      const identity = await actor(request);
      return options.workspace.metadata(request.params.workspaceId, identity);
    },
  );

  app.get<{ Params: WorkspaceVersionParams }>(
    "/api/v1/workspaces/:workspaceId/versions/:syncVersion",
    {
      schema: {
        params: WorkspaceVersionParamsSchema,
        response: { 200: WorkspaceVersionSchema, ...errorResponses },
      },
    },
    async (request) => {
      const identity = await actor(request);
      return options.workspace.version(
        request.params.workspaceId,
        request.params.syncVersion,
        identity,
      );
    },
  );

  app.put<{ Params: WorkspaceObjectParams; Headers: LeaseHeaders; Body: Buffer }>(
    "/api/v1/workspaces/:workspaceId/objects/:sha256",
    {
      schema: {
        params: WorkspaceObjectParamsSchema,
        headers: LeaseHeadersSchema,
        consumes: ["application/octet-stream"],
        response: { 200: WorkspaceObjectSchema, ...errorResponses },
      },
    },
    async (request) => {
      const identity = await actor(request);
      return options.workspace.uploadObject(
        request.params.workspaceId,
        request.params.sha256,
        request.body,
        leaseCredentials(request.headers),
        identity,
        context(request),
      );
    },
  );

  app.get<{ Params: WorkspaceObjectParams }>(
    "/api/v1/workspaces/:workspaceId/objects/:sha256",
    {
      schema: {
        params: WorkspaceObjectParamsSchema,
        response: {
          200: { type: "string", format: "binary" },
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const identity = await actor(request);
      const content = await options.workspace.downloadObject(
        request.params.workspaceId,
        request.params.sha256,
        identity,
      );
      return reply.type("application/octet-stream").send(Buffer.from(content));
    },
  );

  app.post<{ Params: WorkspaceIdParams; Body: AcquireWorkspaceLeaseRequest }>(
    "/api/v1/workspaces/:workspaceId/lease/acquire",
    {
      schema: {
        params: WorkspaceIdParamsSchema,
        body: AcquireWorkspaceLeaseRequestSchema,
        response: { 201: WorkspaceLeaseGrantSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const identity = await actor(request);
      return reply
        .code(201)
        .send(
          await options.workspace.acquireLease(
            request.params.workspaceId,
            request.body,
            identity,
            context(request),
          ),
        );
    },
  );

  app.post<{ Params: WorkspaceIdParams; Body: RenewWorkspaceLeaseRequest }>(
    "/api/v1/workspaces/:workspaceId/lease/renew",
    {
      schema: {
        params: WorkspaceIdParamsSchema,
        body: RenewWorkspaceLeaseRequestSchema,
        response: { 200: WorkspaceLeaseSchema, ...errorResponses },
      },
    },
    async (request) => {
      const identity = await actor(request);
      return options.workspace.renewLease(
        request.params.workspaceId,
        request.body,
        identity,
        context(request),
      );
    },
  );

  app.post<{ Params: WorkspaceIdParams; Body: ReleaseWorkspaceLeaseRequest }>(
    "/api/v1/workspaces/:workspaceId/lease/release",
    {
      schema: {
        params: WorkspaceIdParamsSchema,
        body: ReleaseWorkspaceLeaseRequestSchema,
        response: { 200: WorkspaceLeaseSchema, ...errorResponses },
      },
    },
    async (request) => {
      const identity = await actor(request);
      return options.workspace.releaseLease(
        request.params.workspaceId,
        request.body,
        identity,
        context(request),
      );
    },
  );

  app.post<{ Params: WorkspaceIdParams; Body: TakeoverWorkspaceLeaseRequest }>(
    "/api/v1/workspaces/:workspaceId/lease/takeover",
    {
      schema: {
        params: WorkspaceIdParamsSchema,
        body: TakeoverWorkspaceLeaseRequestSchema,
        response: { 201: WorkspaceLeaseGrantSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const identity = await actor(request);
      return reply
        .code(201)
        .send(
          await options.workspace.takeoverLease(
            request.params.workspaceId,
            request.body,
            identity,
            context(request),
          ),
        );
    },
  );

  app.post<{ Params: WorkspaceIdParams; Body: CommitWorkspaceRequest }>(
    "/api/v1/workspaces/:workspaceId/commits",
    {
      schema: {
        params: WorkspaceIdParamsSchema,
        body: CommitWorkspaceRequestSchema,
        response: { 201: CommitWorkspaceResponseSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const identity = await actor(request);
      return reply
        .code(201)
        .send(
          await options.workspace.commit(
            request.params.workspaceId,
            request.body,
            identity,
            context(request),
          ),
        );
    },
  );

  app.post<{ Params: WorkspaceIdParams; Body: ResolveWorkspaceConflictRequest }>(
    "/api/v1/workspaces/:workspaceId/conflicts/resolve",
    {
      schema: {
        params: WorkspaceIdParamsSchema,
        body: ResolveWorkspaceConflictRequestSchema,
        response: { 200: ResolveWorkspaceConflictResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      const identity = await actor(request);
      return options.workspace.resolveConflict(
        request.params.workspaceId,
        request.body,
        identity,
        context(request),
      );
    },
  );
}

function readBearerToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (!authorization) {
    return undefined;
  }
  const [scheme, token, ...rest] = authorization.trim().split(/\s+/);
  return scheme?.toLowerCase() === "bearer" && token && rest.length === 0 ? token : undefined;
}

function leaseCredentials(headers: LeaseHeaders) {
  return {
    leaseId: headers["x-ngapd-lease-id"],
    connectionId: headers["x-ngapd-connection-id"],
    leaseToken: headers["x-ngapd-lease-token"],
  };
}
