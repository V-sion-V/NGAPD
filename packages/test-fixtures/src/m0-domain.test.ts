import { computeTaskImpactSet, validateTaskDependencyGraph, validateTaskTree } from "@ngapd/domain";
import { describe, expect, it } from "vitest";

import {
  M0_DOMAIN_FIXTURE_SPEC,
  createM0DepthTreeFixture,
  createM0ProjectScaleFixture,
  createM0SiblingDagFixture,
} from "./m0-domain.js";

describe("M0 production-domain input fixtures", () => {
  it("provides a deterministic depth-20 tree accepted by the production validator", () => {
    const first = createM0DepthTreeFixture();
    expect(first).toEqual(createM0DepthTreeFixture());
    expect(first).toHaveLength(M0_DOMAIN_FIXTURE_SPEC.treeDepth + 1);
    expect(validateTaskTree(first)).toEqual({ ok: true });
  });

  it("provides a deterministic 200-sibling DAG accepted by the production validator", () => {
    const fixture = createM0SiblingDagFixture();
    expect(fixture.tasks).toHaveLength(M0_DOMAIN_FIXTURE_SPEC.siblingCount);
    expect(validateTaskDependencyGraph(fixture.tasks, fixture.dependencies)).toEqual({
      ok: true,
    });
  });

  it("keeps 5,000 active tasks as a fixture target rather than a domain hard limit", () => {
    const tasks = createM0ProjectScaleFixture();
    expect(tasks).toHaveLength(M0_DOMAIN_FIXTURE_SPEC.activeTaskCount);
    const impact = computeTaskImpactSet({
      operation: "follow_change",
      targetTaskId: tasks[0]?.id ?? "",
      relatedTaskIds: [tasks.at(-1)?.id ?? ""],
      tasks,
      dependencies: [],
    });
    expect(impact.ok && impact.impact.affectedTaskIds).toHaveLength(2);
  });
});
