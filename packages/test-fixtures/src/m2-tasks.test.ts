import { describe, expect, it } from "vitest";

import {
  createM2DepthFixture,
  createM2LocalDagFixture,
  createM2ProjectScaleFixture,
  createM2SiblingFixture,
} from "./m2-tasks.js";

describe("M2 deterministic Task fixtures", () => {
  it("covers every contracted scale without imposing a domain limit", () => {
    const depth = createM2DepthFixture();
    const siblings = createM2SiblingFixture();
    const scale = createM2ProjectScaleFixture();
    const dag = createM2LocalDagFixture(siblings.slice(1).map((task) => task.key));

    expect(depth).toHaveLength(20);
    expect(depth.at(-1)?.parentKey).toBe("DEPTH-19");
    expect(siblings.filter((task) => task.parentKey === "SIB-1")).toHaveLength(200);
    expect(scale).toHaveLength(5_000);
    expect(new Set(scale.map((task) => task.key)).size).toBe(5_000);
    expect(dag).toHaveLength(320);
    expect(
      dag.every(
        (edge) =>
          Number(edge.predecessorKey.split("-").at(-1)) <
          Number(edge.successorKey.split("-").at(-1)),
      ),
    ).toBe(true);
  });

  it("is byte-for-byte deterministic for a fixed seed", () => {
    const keys = createM2SiblingFixture()
      .slice(1)
      .map((task) => task.key);
    expect(createM2LocalDagFixture(keys, 200, 17)).toEqual(createM2LocalDagFixture(keys, 200, 17));
  });
});
