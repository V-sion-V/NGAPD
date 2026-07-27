import { describe, expect, it } from "vitest";

import { API_MODULE_BOUNDARIES, API_MODULE_NAMES, canModuleCall } from "./module-boundaries.js";

describe("API module boundaries", () => {
  it("declares every M0 module exactly once and rejects undeclared cross-module writes", () => {
    expect(Object.keys(API_MODULE_BOUNDARIES).sort()).toEqual([...API_MODULE_NAMES].sort());
    expect(canModuleCall("tasks", "workspaces")).toBe(true);
    expect(canModuleCall("workspaces", "dependency-graph")).toBe(false);
    expect(canModuleCall("knowledge-notifications", "tasks")).toBe(false);
  });
});
