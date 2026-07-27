import { describe, expect, it } from "vitest";

import {
  createTaskKey,
  evaluateProjectKeyChange,
  parseProjectKey,
  parseTaskKey,
  parseTaskSequence,
} from "./identifiers.js";

describe("formal project and task identifiers", () => {
  it("accepts only canonical two-to-six character uppercase project keys", () => {
    for (const key of ["AB", "ZERO", "ABCDEF"]) {
      expect(parseProjectKey(key)).toEqual({ ok: true, value: key });
    }
    for (const key of ["A", "ABCDEFG", "A1", "ab", " AB", "AB "]) {
      expect(parseProjectKey(key)).toEqual({ ok: false, reason: "invalid_project_key" });
    }
  });

  it("creates and parses canonical positive task sequences without reuse aliases", () => {
    expect(createTaskKey("ZERO", 42)).toEqual({
      ok: true,
      value: "ZERO-42",
      projectKey: "ZERO",
      sequence: 42,
    });
    expect(parseTaskKey("ZERO-42")).toEqual({
      ok: true,
      value: "ZERO-42",
      projectKey: "ZERO",
      sequence: 42,
    });
    expect(parseTaskSequence(0)).toEqual({ ok: false, reason: "invalid_task_sequence" });
    expect(parseTaskSequence(1.5)).toEqual({ ok: false, reason: "invalid_task_sequence" });
    expect(parseTaskKey("ZERO-0042")).toEqual({ ok: false, reason: "invalid_task_key" });
    expect(parseTaskKey("zero-42")).toEqual({ ok: false, reason: "invalid_project_key" });
  });

  it("rejects attempts to change an established project key", () => {
    expect(evaluateProjectKeyChange("ZERO", "ZERO")).toEqual({
      ok: true,
      value: "ZERO",
      changed: false,
    });
    expect(evaluateProjectKeyChange("ZERO", "NEXT")).toEqual({
      ok: false,
      reason: "project_key_immutable",
    });
  });
});
