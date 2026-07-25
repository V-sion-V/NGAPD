import { performance } from "node:perf_hooks";
import { mkdir, rm, truncate, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  createWorkspaceManifest,
  diffWorkspaceManifests,
  scanWorkspace,
} from "@ngapd/workspace-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { NodeWorkspaceFileAdapter } from "./adapters/filesystem.js";

const runPerformance = process.env.RUN_WORKSPACE_PERF === "1" ? describe : describe.skip;
const root = "/private/tmp/ngapd-workspace-sync-p003-performance";
const workspace = join(root, "workspace");

runPerformance("Workspace CLI macOS performance evidence", () => {
  beforeAll(async () => {
    await rm(root, { recursive: true, force: true });
    await mkdir(workspace, { recursive: true, mode: 0o700 });
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("scans and diffs 500 mostly-text files totaling exactly 100 MiB in under 5 seconds", async () => {
    const baseSize = Math.floor((100 * 1024 * 1024) / 500);
    await Promise.all(
      Array.from({ length: 500 }, async (_, index) => {
        const size = baseSize + (index < 100 ? 1 : 0);
        await writeFile(
          join(workspace, `text-${String(index).padStart(3, "0")}.txt`),
          Buffer.alloc(size, 0x61 + (index % 26)),
        );
      }),
    );
    const adapter = await NodeWorkspaceFileAdapter.open(root, "workspace");

    const startedAt = performance.now();
    const scan = await scanWorkspace(adapter);
    const diff = diffWorkspaceManifests(createWorkspaceManifest([]), scan.manifest);
    const elapsedMs = performance.now() - startedAt;

    expect(scan.manifest.entries).toHaveLength(500);
    expect(scan.totalBytes).toBe(100 * 1024 * 1024);
    expect(diff.added).toHaveLength(500);
    expect(elapsedMs).toBeLessThan(5_000);
    process.stdout.write(
      `${JSON.stringify({
        metric: "workspace_scan_diff_500_100mib",
        elapsedMs: Math.round(elapsedMs * 100) / 100,
        fileCount: scan.manifest.entries.length,
        totalBytes: scan.totalBytes,
        targetMs: 5_000,
      })}\n`,
    );
  }, 30_000);

  it("scans 2,000 real APFS files and enforces the 50 MiB per-file boundary", async () => {
    await rm(workspace, { recursive: true, force: true });
    await mkdir(workspace, { mode: 0o700 });
    for (let start = 0; start < 2_000; start += 200) {
      await Promise.all(
        Array.from({ length: 200 }, (_, offset) =>
          writeFile(join(workspace, `file-${String(start + offset).padStart(4, "0")}.txt`), "x"),
        ),
      );
    }
    let adapter = await NodeWorkspaceFileAdapter.open(root, "workspace");
    const startedAt = performance.now();
    const twoThousand = await scanWorkspace(adapter);
    const elapsedMs = performance.now() - startedAt;
    expect(twoThousand).toMatchObject({
      manifest: { entries: expect.any(Array) },
      totalBytes: 2_000,
    });
    expect(twoThousand.manifest.entries).toHaveLength(2_000);
    process.stdout.write(
      `${JSON.stringify({
        metric: "workspace_scan_2000_files",
        elapsedMs: Math.round(elapsedMs * 100) / 100,
        fileCount: twoThousand.manifest.entries.length,
        totalBytes: twoThousand.totalBytes,
      })}\n`,
    );

    await rm(workspace, { recursive: true, force: true });
    await mkdir(workspace, { mode: 0o700 });
    const boundary = join(workspace, "boundary.bin");
    await writeFile(boundary, "");
    await truncate(boundary, 50 * 1024 * 1024);
    adapter = await NodeWorkspaceFileAdapter.open(root, "workspace");
    await expect(scanWorkspace(adapter)).resolves.toMatchObject({
      totalBytes: 50 * 1024 * 1024,
    });
    await truncate(boundary, 50 * 1024 * 1024 + 1);
    await expect(scanWorkspace(adapter)).rejects.toMatchObject({
      code: "FILE_SIZE_LIMIT_EXCEEDED",
    });
  }, 30_000);
});
