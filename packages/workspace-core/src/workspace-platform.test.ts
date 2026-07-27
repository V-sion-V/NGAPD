import { describe, expect, it } from "vitest";

import { WorkspaceCoreError } from "./errors.js";
import {
  WorkspaceChangeMonitor,
  normalizeWorkspaceChangeBatch,
  type RawWorkspaceChangeBatch,
  type WorkspaceWatchSubscription,
  type WorkspaceWatcherPort,
} from "./workspace-platform.js";

describe("Workspace platform watcher ports", () => {
  it("normalizes and orders watcher changes while marking every event non-authoritative", async () => {
    const watcher = new FakeWatcher();
    const monitor = new WorkspaceChangeMonitor(watcher);
    const observed: unknown[] = [];
    await monitor.start((changes) => observed.push(changes));
    await watcher.emit({
      sequence: 1,
      changes: [
        { kind: "modified", path: "z.txt" },
        { kind: "added", path: "notes/e\u0301.txt" },
        { kind: "modified", path: "z.txt" },
      ],
    });
    expect(observed).toEqual([
      [
        {
          sequence: 1,
          kind: "added",
          path: "notes/é.txt",
          authority: "local-replica-non-authoritative",
        },
        {
          sequence: 1,
          kind: "modified",
          path: "z.txt",
          authority: "local-replica-non-authoritative",
        },
      ],
    ]);

    await monitor.stop();
    await watcher.emit({
      sequence: 2,
      changes: [{ kind: "deleted", path: "z.txt" }],
    });
    expect(observed).toHaveLength(1);
  });

  it("rejects path escape, protected paths, case collisions, and Unicode collisions", () => {
    for (const path of ["../outside.txt", "/absolute.txt", ".ngapd/state.json"]) {
      expect(() =>
        normalizeWorkspaceChangeBatch({
          sequence: 1,
          changes: [{ kind: "added", path }],
        }),
      ).toThrow(WorkspaceCoreError);
    }
    expect(() =>
      normalizeWorkspaceChangeBatch({
        sequence: 1,
        changes: [
          { kind: "added", path: "Readme.md" },
          { kind: "added", path: "README.md" },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "PATH_COLLISION" }));
    expect(() =>
      normalizeWorkspaceChangeBatch({
        sequence: 1,
        changes: [
          { kind: "added", path: "é.txt" },
          { kind: "added", path: "e\u0301.txt" },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: "PATH_COLLISION" }));
  });

  it("enforces monotonic batches and an explicit lifecycle without a real filesystem watcher", async () => {
    const watcher = new FakeWatcher();
    const monitor = new WorkspaceChangeMonitor(watcher);
    await monitor.start(() => undefined);
    await watcher.emit({
      sequence: 2,
      changes: [{ kind: "renamed", previousPath: "old.txt", path: "new.txt" }],
    });
    await expect(
      watcher.emit({
        sequence: 2,
        changes: [{ kind: "modified", path: "new.txt" }],
      }),
    ).rejects.toMatchObject({ code: "STATE_INVALID" });
    await expect(monitor.start(() => undefined)).rejects.toMatchObject({ code: "STATE_BUSY" });
    await monitor.stop();
  });
});

class FakeWatcher implements WorkspaceWatcherPort {
  private listener: ((batch: RawWorkspaceChangeBatch) => Promise<void> | void) | null = null;

  async subscribe(
    listener: (batch: RawWorkspaceChangeBatch) => Promise<void> | void,
  ): Promise<WorkspaceWatchSubscription> {
    this.listener = listener;
    return {
      close: async () => {
        this.listener = null;
      },
    };
  }

  async emit(batch: RawWorkspaceChangeBatch): Promise<void> {
    await this.listener?.(batch);
  }
}
