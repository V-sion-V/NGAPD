import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("health endpoints", () => {
  it("reports liveness without touching the database", async () => {
    const app = await buildApp();
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/health/live",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: "ngapd-api",
      status: "ok",
    });
  });

  it("reports readiness only after the database check passes", async () => {
    const readyApp = await buildApp({ databaseCheck: async () => true });
    const unavailableApp = await buildApp({ databaseCheck: async () => false });
    apps.push(readyApp, unavailableApp);

    expect((await readyApp.inject({ method: "GET", url: "/health/ready" })).statusCode).toBe(200);
    expect((await unavailableApp.inject({ method: "GET", url: "/health/ready" })).statusCode).toBe(
      503,
    );
  });
});
