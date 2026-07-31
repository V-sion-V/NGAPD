import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { ApiErrorSchema, HealthStatusSchema, type HealthStatus } from "@ngapd/contracts";
import { EventRepository, WorkspaceRepository, type Database } from "@ngapd/database";
import type { ObjectStore } from "@ngapd/object-store";
import Fastify, { type FastifyInstance } from "fastify";

import { registerAdminModeRoutes } from "./modules/authorization-audit/routes.js";
import {
  AdminModeService,
  AuthorizationAuditService,
} from "./modules/authorization-audit/service.js";
import { ApplicationError } from "./modules/identity/errors.js";
import { registerEventRoutes } from "./modules/events/routes.js";
import { EventService } from "./modules/events/service.js";
import { registerIdentityRoutes } from "./modules/identity/routes.js";
import { IdentityService } from "./modules/identity/service.js";
import { registerProjectsMembershipRoutes } from "./modules/projects-membership/routes.js";
import { ProjectsMembershipService } from "./modules/projects-membership/service.js";
import { registerRoleRoutes } from "./modules/roles/routes.js";
import { RolesService } from "./modules/roles/service.js";
import { registerTaskRoutes } from "./modules/tasks/routes.js";
import { TaskApplicationService } from "./modules/tasks/service.js";
import { registerWorkspaceRoutes } from "./modules/workspaces/routes.js";
import { WorkspaceService } from "./modules/workspaces/service.js";

export interface AppOptions {
  database?: Database;
  databaseCheck?: () => Promise<boolean>;
  logger?: boolean;
  publicOrigin?: string;
  now?: () => Date;
  objectStore?: ObjectStore;
  eventPollIntervalMs?: number;
  eventStreamDurationMs?: number;
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
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
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
    const now = options.now ?? (() => new Date());
    const publicOrigin = options.publicOrigin ?? "https://ngapd.local";
    await registerIdentityRoutes(app, {
      service: identity,
      publicOrigin,
      now,
    });
    await registerProjectsMembershipRoutes(app, {
      identity,
      service: new ProjectsMembershipService(options.database),
      publicOrigin,
      now,
    });
    await registerRoleRoutes(app, {
      identity,
      service: new RolesService(options.database),
      publicOrigin,
      now,
    });
    await registerAdminModeRoutes(app, {
      identity,
      service: new AdminModeService(options.database),
      publicOrigin,
      now,
    });
    await registerTaskRoutes(app, {
      identity,
      service: new TaskApplicationService(options.database, options.objectStore),
      authorization: new AuthorizationAuditService(options.database),
      publicOrigin,
      now,
    });
    await registerEventRoutes(app, {
      identity,
      events: new EventService(new EventRepository(options.database)),
      now,
      ...(options.eventPollIntervalMs === undefined
        ? {}
        : { pollIntervalMs: options.eventPollIntervalMs }),
      ...(options.eventStreamDurationMs === undefined
        ? {}
        : { streamDurationMs: options.eventStreamDurationMs }),
    });
    if (options.objectStore) {
      await registerWorkspaceRoutes(app, {
        identity,
        workspace: new WorkspaceService(
          new WorkspaceRepository(options.database),
          options.objectStore,
        ),
        now,
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
        ...(error.blockingTasks === undefined ? {} : { blockingTasks: error.blockingTasks }),
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
