import { describe, expect, it } from "vitest";

import { createWideTaskFixture } from "./task-graph.js";

describe("createWideTaskFixture", () => {
  it("creates one parent and 200 stable direct children by default", () => {
    const tasks = createWideTaskFixture();

    expect(tasks).toHaveLength(201);
    expect(tasks.filter((task) => task.parentKey === "ZERO-1")).toHaveLength(200);
    expect(new Set(tasks.map((task) => task.key)).size).toBe(tasks.length);
  });
});
