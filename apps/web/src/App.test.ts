import { describe, expect, it } from "vitest";

import { isTaskUiPrototype } from "./App.js";

describe("Web entry compatibility", () => {
  it("keeps the sealed Task UI prototype entry exact", () => {
    expect(isTaskUiPrototype("?prototype=task-ui")).toBe(true);
    expect(isTaskUiPrototype("?prototype=task-ui&code=ABC12345")).toBe(true);
    expect(isTaskUiPrototype("?prototype=m1")).toBe(false);
    expect(isTaskUiPrototype("")).toBe(false);
  });
});
