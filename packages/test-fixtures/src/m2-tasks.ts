export interface M2TaskFixtureNode {
  sequence: number;
  key: string;
  parentKey: string | null;
  explicitOwnerSlot: number | null;
  status: "not_started" | "in_progress" | "done";
}

export interface M2TaskFixtureEdge {
  predecessorKey: string;
  successorKey: string;
}

export function createM2DepthFixture(projectKey = "DEPTH", depth = 20): M2TaskFixtureNode[] {
  return Array.from({ length: depth }, (_, index) => ({
    sequence: index + 1,
    key: `${projectKey}-${index + 1}`,
    parentKey: index === 0 ? null : `${projectKey}-${index}`,
    explicitOwnerSlot: index === 0 ? 0 : null,
    status: "not_started",
  }));
}

export function createM2SiblingFixture(projectKey = "SIB", count = 200): M2TaskFixtureNode[] {
  const parent: M2TaskFixtureNode = {
    sequence: 1,
    key: `${projectKey}-1`,
    parentKey: null,
    explicitOwnerSlot: 0,
    status: "not_started",
  };
  return [
    parent,
    ...Array.from({ length: count }, (_, index) => ({
      sequence: index + 2,
      key: `${projectKey}-${index + 2}`,
      parentKey: parent.key,
      explicitOwnerSlot: null,
      status: "not_started" as const,
    })),
  ];
}

export function createM2ProjectScaleFixture(
  projectKey = "SCALE",
  count = 5_000,
): M2TaskFixtureNode[] {
  return Array.from({ length: count }, (_, index) => ({
    sequence: index + 1,
    key: `${projectKey}-${index + 1}`,
    parentKey: null,
    explicitOwnerSlot: index % 17,
    status:
      index % 11 === 0
        ? ("done" as const)
        : index % 3 === 0
          ? ("in_progress" as const)
          : ("not_started" as const),
  }));
}

export function createM2LocalDagFixture(
  taskKeys: readonly string[],
  edgeCount = 320,
  seed = 2_026_073_0,
): M2TaskFixtureEdge[] {
  const candidates: Array<[number, number]> = [];
  for (let left = 0; left < taskKeys.length; left += 1) {
    for (let right = left + 1; right < taskKeys.length; right += 1) {
      candidates.push([left, right]);
    }
  }
  let state = seed >>> 0;
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const selected = state % (index + 1);
    [candidates[index], candidates[selected]] = [candidates[selected]!, candidates[index]!];
  }
  return candidates.slice(0, Math.min(edgeCount, candidates.length)).map(([left, right]) => ({
    predecessorKey: taskKeys[left]!,
    successorKey: taskKeys[right]!,
  }));
}
