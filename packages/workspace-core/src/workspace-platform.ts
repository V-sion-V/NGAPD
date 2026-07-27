import { WorkspaceCoreError } from "./errors.js";
import { assertNoPortablePathCollisions, normalizeWorkspacePath } from "./path-policy.js";
import type { MaterializationFilePort, WorkspaceControlPort } from "./types.js";

export type RawWorkspaceChange =
  | { kind: "added" | "modified" | "deleted"; path: string }
  | { kind: "renamed"; path: string; previousPath: string };

export interface RawWorkspaceChangeBatch {
  sequence: number;
  changes: readonly RawWorkspaceChange[];
}

export type WorkspaceChange =
  | {
      sequence: number;
      kind: "added" | "modified" | "deleted";
      path: string;
      authority: "local-replica-non-authoritative";
    }
  | {
      sequence: number;
      kind: "renamed";
      path: string;
      previousPath: string;
      authority: "local-replica-non-authoritative";
    };

export interface WorkspaceWatchSubscription {
  close(): Promise<void>;
}

export interface WorkspaceWatcherPort {
  subscribe(
    listener: (batch: RawWorkspaceChangeBatch) => Promise<void> | void,
  ): Promise<WorkspaceWatchSubscription>;
}

export interface WorkspacePlatformPorts {
  watcher: WorkspaceWatcherPort;
  control: WorkspaceControlPort;
  files: MaterializationFilePort;
}

export class WorkspaceChangeMonitor {
  private subscription: WorkspaceWatchSubscription | null = null;
  private lastSequence = 0;

  constructor(private readonly watcher: WorkspaceWatcherPort) {}

  async start(
    consumer: (changes: readonly WorkspaceChange[]) => Promise<void> | void,
  ): Promise<void> {
    if (this.subscription) {
      throw new WorkspaceCoreError("STATE_BUSY", "Workspace watcher is already active.");
    }
    this.subscription = await this.watcher.subscribe(async (batch) => {
      if (batch.sequence <= this.lastSequence) {
        throw new WorkspaceCoreError(
          "STATE_INVALID",
          "Workspace watcher sequence must increase monotonically.",
        );
      }
      const normalized = normalizeWorkspaceChangeBatch(batch);
      this.lastSequence = batch.sequence;
      if (normalized.length > 0) {
        await consumer(normalized);
      }
    });
  }

  async stop(): Promise<void> {
    const subscription = this.subscription;
    this.subscription = null;
    if (subscription) {
      await subscription.close();
    }
  }
}

export function normalizeWorkspaceChangeBatch(
  batch: RawWorkspaceChangeBatch,
): readonly WorkspaceChange[] {
  if (!Number.isSafeInteger(batch.sequence) || batch.sequence < 1) {
    throw new WorkspaceCoreError("STATE_INVALID", "Workspace watcher sequence is invalid.");
  }
  if (batch.changes.length > 2_000) {
    throw new WorkspaceCoreError(
      "FILE_LIMIT_EXCEEDED",
      "Workspace watcher batch exceeds the file soft limit.",
    );
  }

  const unique = new Map<string, RawWorkspaceChange>();
  for (const change of batch.changes) {
    const key =
      change.kind === "renamed"
        ? `${change.kind}\u0000${change.previousPath}\u0000${change.path}`
        : `${change.kind}\u0000${change.path}`;
    unique.set(key, change);
  }
  const activePaths = [
    ...new Set(
      [...unique.values()]
        .filter((change) => change.kind !== "deleted")
        .map((change) => change.path),
    ),
  ];
  assertNoPortablePathCollisions(activePaths);

  return [...unique.values()]
    .map((change): WorkspaceChange => {
      const path = normalizeWorkspacePath(change.path);
      if (change.kind === "renamed") {
        const previousPath = normalizeWorkspacePath(change.previousPath);
        if (previousPath === path) {
          throw new WorkspaceCoreError(
            "STATE_INVALID",
            "Workspace rename source and destination must differ.",
          );
        }
        return {
          sequence: batch.sequence,
          kind: "renamed",
          path,
          previousPath,
          authority: "local-replica-non-authoritative",
        };
      }
      return {
        sequence: batch.sequence,
        kind: change.kind,
        path,
        authority: "local-replica-non-authoritative",
      };
    })
    .sort((left, right) => {
      const pathOrder = left.path.localeCompare(right.path, "en");
      return pathOrder === 0 ? left.kind.localeCompare(right.kind, "en") : pathOrder;
    });
}
