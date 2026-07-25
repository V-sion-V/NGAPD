import { createHash } from "node:crypto";

import { hashManifest, type WorkspaceManifestEntry } from "@ngapd/domain";

const text = Buffer.from("# Combat\n\nUse deterministic fixtures.\n");
const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

function entry(path: string, content: Uint8Array): WorkspaceManifestEntry {
  return {
    path,
    kind: "file",
    size: content.byteLength,
    sha256: createHash("sha256").update(content).digest("hex"),
  };
}

export function createWorkspaceSyncFixture() {
  const ids = {
    ownerUser: "02000000-0000-4000-8000-000000000001",
    nextOwnerUser: "02000000-0000-4000-8000-000000000002",
    outsiderUser: "02000000-0000-4000-8000-000000000003",
    ownerDevice: "22000000-0000-4000-8000-000000000001",
    secondDevice: "22000000-0000-4000-8000-000000000002",
    nextOwnerDevice: "22000000-0000-4000-8000-000000000003",
    project: "32000000-0000-4000-8000-000000000001",
    ownerMembership: "42000000-0000-4000-8000-000000000001",
    nextOwnerMembership: "42000000-0000-4000-8000-000000000002",
    task: "52000000-0000-4000-8000-000000000001",
    workspace: "62000000-0000-4000-8000-000000000001",
  } as const;
  const objects = [
    { content: text, entry: entry("design/combat.md", text) },
    { content: image, entry: entry("references/hero.png", image) },
  ];
  const entries = objects.map((object) => object.entry);
  return {
    ids,
    objects,
    manifest: {
      hash: hashManifest(entries),
      entries,
    },
    scenarioIds: [
      "SYNC-001",
      "SYNC-002",
      "SYNC-003",
      "SYNC-004",
      "SYNC-005",
      "SYNC-006",
      "SYNC-007",
      "SYNC-008",
      "SYNC-009",
    ] as const,
  };
}
