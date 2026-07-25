import { describe, expect, it } from "vitest";

import { hashManifest } from "@ngapd/domain";

import { createWorkspaceSyncFixture } from "./workspace-sync.js";

describe("workspace sync fixture", () => {
  it("provides deterministic objects, manifest and complete prototype scenario IDs", () => {
    const first = createWorkspaceSyncFixture();
    const second = createWorkspaceSyncFixture();
    expect(first.manifest).toEqual(second.manifest);
    expect(first.manifest.hash).toBe(hashManifest(first.manifest.entries));
    expect(first.scenarioIds).toEqual([
      "SYNC-001",
      "SYNC-002",
      "SYNC-003",
      "SYNC-004",
      "SYNC-005",
      "SYNC-006",
      "SYNC-007",
      "SYNC-008",
      "SYNC-009",
    ]);
  });
});
