import { Readable } from "node:stream";

import { ApiErrorSchema, EventCursorSchema } from "@ngapd/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";

import type { IdentityService } from "../identity/service.js";
import type { EventService } from "./service.js";

interface EventQuery {
  cursor?: string;
}

interface EventHeaders {
  authorization?: string;
  cookie?: string;
  "last-event-id"?: string;
}

const EventQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    cursor: EventCursorSchema,
  },
} as const;

const EventHeadersSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    authorization: { type: "string" },
    cookie: { type: "string" },
    "last-event-id": EventCursorSchema,
  },
} as const;

export async function registerEventRoutes(
  app: FastifyInstance,
  options: {
    identity: IdentityService;
    events: EventService;
    now: () => Date;
    pollIntervalMs?: number;
    streamDurationMs?: number;
  },
): Promise<void> {
  app.get<{ Querystring: EventQuery; Headers: EventHeaders }>(
    "/api/v1/events",
    {
      schema: {
        querystring: EventQuerySchema,
        headers: EventHeadersSchema,
        produces: ["text/event-stream"],
        response: {
          200: { type: "string" },
          400: ApiErrorSchema,
          401: ApiErrorSchema,
          403: ApiErrorSchema,
          409: ApiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const actor = await resolveActor(options.identity, request, options.now());
      const requestedCursor = request.headers["last-event-id"] ?? request.query.cursor ?? "0";
      const initial = await options.events.replay(actor.userId, requestedCursor);
      const controller = new AbortController();
      const onClose = () => controller.abort();
      reply.raw.once("close", onClose);

      const stream = Readable.from(
        streamEvents({
          service: options.events,
          userId: actor.userId,
          initial,
          initialCursor: requestedCursor,
          pollIntervalMs: options.pollIntervalMs ?? 1_000,
          streamDurationMs: options.streamDurationMs ?? 30_000,
          signal: controller.signal,
          onFinally: () => reply.raw.off("close", onClose),
        }),
      );

      return reply
        .header("content-type", "text/event-stream; charset=utf-8")
        .header("cache-control", "no-cache, no-store")
        .header("connection", "keep-alive")
        .header("x-accel-buffering", "no")
        .send(stream);
    },
  );
}

async function* streamEvents(input: {
  service: EventService;
  userId: string;
  initial: Awaited<ReturnType<EventService["replay"]>>;
  initialCursor: string;
  pollIntervalMs: number;
  streamDurationMs: number;
  signal: AbortSignal;
  onFinally: () => void;
}): AsyncGenerator<string> {
  const deadline = Date.now() + Math.max(0, input.streamDurationMs);
  let cursor = input.initialCursor;
  let events = input.initial;

  try {
    while (!input.signal.aborted) {
      for (const event of events) {
        cursor = event.cursor;
        yield encodeSseEvent(event.cursor, "resource-invalidated", event);
      }
      if (input.streamDurationMs <= 0 || Date.now() >= deadline) {
        return;
      }

      yield `: heartbeat ${new Date().toISOString()}\n\n`;
      await abortableDelay(
        Math.min(Math.max(input.pollIntervalMs, 10), Math.max(deadline - Date.now(), 0)),
        input.signal,
      );
      if (input.signal.aborted || Date.now() >= deadline) {
        return;
      }
      events = await input.service.replay(input.userId, cursor);
    }
  } finally {
    input.onFinally();
  }
}

function encodeSseEvent(id: string, event: string, data: unknown): string {
  return `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function resolveActor(
  identity: IdentityService,
  request: FastifyRequest,
  now: Date,
): Promise<{ userId: string }> {
  const session = readSessionToken(request);
  if (session) {
    return identity.resolveSession(session, now);
  }
  return identity.resolveAccessToken(readBearerToken(request), now);
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

function readBearerToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (!authorization) {
    return undefined;
  }
  const [scheme, token, ...rest] = authorization.trim().split(/\s+/);
  return scheme?.toLowerCase() === "bearer" && token && rest.length === 0 ? token : undefined;
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted || milliseconds <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(done, milliseconds);
    signal.addEventListener("abort", done, { once: true });

    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
  });
}
