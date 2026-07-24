import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readJson(relativePath: string): Promise<unknown> {
  const fileUrl = new URL(`../../../${relativePath}`, import.meta.url);
  return JSON.parse(await readFile(fileUrl, "utf8")) as unknown;
}

describe("repository prototype fixtures", () => {
  it("keeps the workspace sync scenario set and manifest contract usable", async () => {
    const scenarios = (await readJson("prototypes/workspace-sync/fixtures/scenarios.json")) as {
      scenarios: Array<{ id: string }>;
    };
    const manifest = (await readJson("prototypes/workspace-sync/fixtures/base-manifest.json")) as {
      entries: Array<{ path: string }>;
    };

    expect(scenarios.scenarios.map((scenario) => scenario.id)).toEqual([
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
    expect(
      manifest.entries.some((entry) =>
        [".ngapd/", "TASK.md", "SUMMARY.md"].some(
          (protectedPath) => entry.path === protectedPath || entry.path.startsWith(protectedPath),
        ),
      ),
    ).toBe(false);
  });

  it("keeps the UI and context fixtures aligned with prototype gates", async () => {
    const taskUi = (await readJson("prototypes/task-ui/fixtures/dataset.json")) as {
      profiles: Array<{ id: string; childrenPerLevel: number[] }>;
    };
    const context = (await readJson("prototypes/agent-context/fixtures/context-sources.json")) as {
      sources: Array<{ id: string; allowed: boolean }>;
    };

    const wideProfile = taskUi.profiles.find((profile) => profile.id === "wide-siblings");
    expect(wideProfile?.childrenPerLevel).toContain(200);
    expect(context.sources).toContainEqual(
      expect.objectContaining({
        id: "other-user-private-workspace",
        allowed: false,
      }),
    );
  });

  it("keeps every logical role template on the public JSON shape", async () => {
    const roles = (await readJson("docs/11-logical-role-templates.json")) as Array<
      Record<string, unknown>
    >;

    expect(roles.length).toBeGreaterThan(0);
    for (const role of roles) {
      expect(Object.keys(role).sort()).toEqual(["desc", "id", "title"]);
      expect(role.id).toEqual(expect.any(String));
      expect(role.title).toEqual(expect.any(String));
      expect(role.desc).toEqual(expect.any(String));
    }
  });
});
