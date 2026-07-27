import { afterEach, describe, expect, it } from "vitest";

import { startWorkerHealthServer, type WorkerHealthServer } from "./health-server.js";

describe("worker health server", () => {
  const servers: WorkerHealthServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  it("separates process liveness from database and runner readiness", async () => {
    let ready = true;
    const server = await startWorkerHealthServer({
      host: "127.0.0.1",
      port: 0,
      isReady: () => ready,
    });
    servers.push(server);
    const origin = `http://${server.host}:${server.port}`;

    const live = await fetch(`${origin}/health/live`);
    expect(live.status).toBe(200);
    await expect(live.json()).resolves.toMatchObject({ service: "ngapd-worker", status: "ok" });

    const initialReady = await fetch(`${origin}/health/ready`);
    expect(initialReady.status).toBe(200);
    await expect(initialReady.json()).resolves.toMatchObject({
      status: "ok",
      checks: { databaseAndRunner: true },
    });

    ready = false;
    const unavailable = await fetch(`${origin}/health/ready`);
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toMatchObject({
      status: "error",
      checks: { databaseAndRunner: false },
    });

    expect((await fetch(`${origin}/not-found`)).status).toBe(404);
  });

  it("fails readiness closed when the dependency check throws", async () => {
    const server = await startWorkerHealthServer({
      host: "127.0.0.1",
      port: 0,
      isReady: () => {
        throw new Error("database unavailable");
      },
    });
    servers.push(server);

    expect((await fetch(`http://${server.host}:${server.port}/health/live`)).status).toBe(200);
    expect((await fetch(`http://${server.host}:${server.port}/health/ready`)).status).toBe(503);
  });
});
