import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { ApiErrorSchema, HealthStatusSchema, type HealthStatus } from "@ngapd/contracts";
import Fastify, { type FastifyInstance } from "fastify";

export interface AppOptions {
  databaseCheck?: () => Promise<boolean>;
  logger?: boolean;
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

  app.setErrorHandler((error, request, reply) => {
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
