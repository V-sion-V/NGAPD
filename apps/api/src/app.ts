import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { ApiErrorSchema, HealthStatusSchema, type HealthStatus } from "@ngapd/contracts";
import { WorkspaceRepository, type Database } from "@ngapd/database";
import type { ObjectStore } from "@ngapd/object-store";
import Fastify, { type FastifyInstance } from "fastify";

import { ApplicationError } from "./modules/identity/errors.js";
import { registerIdentityRoutes } from "./modules/identity/routes.js";
import { IdentityService } from "./modules/identity/service.js";
import { registerWorkspaceRoutes } from "./modules/workspaces/routes.js";
import { WorkspaceService } from "./modules/workspaces/service.js";

export interface AppOptions {
  database?: Database;
  databaseCheck?: () => Promise<boolean>;
  logger?: boolean;
  publicOrigin?: string;
  now?: () => Date;
  objectStore?: ObjectStore;
}

const serviceVersion = "0.0.0";

function healthStatus(status: "ok" | "error", checks?: Record<string, boolean>): HealthStatus {
  return {
    status,
    service: "ngapd-api",
    version: serviceVersion,
    timestamp: new Date().toISOString(),
    ...(checks ? { checks } : {}),
  };
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
    requestIdHeader: "x-request-id",
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "NGAPD API",
        version: serviceVersion,
      },
      openapi: "3.1.0",
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  app.get(
    "/health/live",
    {
      schema: {
        response: {
          200: HealthStatusSchema,
        },
      },
    },
    async () => healthStatus("ok"),
  );

  app.get(
    "/health/ready",
    {
      schema: {
        response: {
          200: HealthStatusSchema,
          503: HealthStatusSchema,
        },
      },
    },
    async (_request, reply) => {
      let database = false;

      try {
        database = (await options.databaseCheck?.()) ?? false;
      } catch {
        database = false;
      }

      if (!database) {
        return reply.code(503).send(healthStatus("error", { database }));
      }

      return healthStatus("ok", { database });
    },
  );

  app.get(
    "/api/v1/system/info",
    {
      schema: {
        response: {
          200: HealthStatusSchema,
        },
      },
    },
    async () => healthStatus("ok"),
  );

  if (options.database) {
    const identity = new IdentityService(options.database);
    await registerIdentityRoutes(app, {
      service: identity,
      publicOrigin: options.publicOrigin ?? "https://ngapd.local",
      now: options.now ?? (() => new Date()),
    });
    if (options.objectStore) {
      await registerWorkspaceRoutes(app, {
        identity,
        workspace: new WorkspaceService(
          new WorkspaceRepository(options.database),
          options.objectStore,
        ),
        now: options.now ?? (() => new Date()),
      });
    }
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApplicationError) {
      void reply.code(error.statusCode).send({
        code: error.code,
        message: error.message,
        requestId: request.id,
        ...(error.currentVersion === undefined ? {} : { currentVersion: error.currentVersion }),
        ...(error.recovery ? { recovery: error.recovery } : {}),
      });
      return;
    }
    if (typeof error === "object" && error !== null && "validation" in error && error.validation) {
      void reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: "请求格式不正确",
        requestId: request.id,
        recovery: "请检查输入字段后重试",
      });
      return;
    }
    request.log.error(error);
    void reply.code(500).send({
      code: "INTERNAL_ERROR",
      message: "服务暂时无法处理该请求",
      requestId: request.id,
      recovery: "请稍后重试；若问题持续，请携带 requestId 查看服务日志",
    });
  });

  app.addSchema(ApiErrorSchema);

  return app;
}
