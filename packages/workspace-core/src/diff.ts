import { canonicalizeManifestEntries } from "./path-policy.js";
import type { WorkspaceDiff, WorkspaceManifest, WorkspaceManifestEntry } from "./types.js";

export function diffWorkspaceManifests(
  base: WorkspaceManifest,
  current: WorkspaceManifest,
): WorkspaceDiff {
  const baseEntries = canonicalizeManifestEntries(base.entries);
  const currentEntries = canonicalizeManifestEntries(current.entries);
  const baseByPath = new Map(baseEntries.map((entry) => [entry.path, entry]));
  const currentByPath = new Map(currentEntries.map((entry) => [entry.path, entry]));
  const modified: string[] = [];
  const unchanged: string[] = [];
  const deletedCandidates: WorkspaceManifestEntry[] = [];
  const addedCandidates: WorkspaceManifestEntry[] = [];

  for (const baseEntry of baseEntries) {
    const currentEntry = currentByPath.get(baseEntry.path);
    if (!currentEntry) {
      deletedCandidates.push(baseEntry);
    } else if (sameContent(baseEntry, currentEntry)) {
      unchanged.push(baseEntry.path);
    } else {
      modified.push(baseEntry.path);
    }
  }
  for (const currentEntry of currentEntries) {
    if (!baseByPath.has(currentEntry.path)) {
      addedCandidates.push(currentEntry);
    }
  }

  const consumedDeleted = new Set<string>();
  const consumedAdded = new Set<string>();
  const renamed: Array<{ from: string; to: string }> = [];
  for (const added of addedCandidates) {
    const deleted = deletedCandidates.find(
      (candidate) => !consumedDeleted.has(candidate.path) && sameContent(candidate, added),
    );
    if (deleted) {
      consumedDeleted.add(deleted.path);
      consumedAdded.add(added.path);
      renamed.push({ from: deleted.path, to: added.path });
    }
  }

  return {
    added: addedCandidates
      .filter((entry) => !consumedAdded.has(entry.path))
      .map((entry) => entry.path),
    modified,
    deleted: deletedCandidates
      .filter((entry) => !consumedDeleted.has(entry.path))
      .map((entry) => entry.path),
    renamed,
    unchanged,
  };
}

export function hasWorkspaceChanges(diff: WorkspaceDiff): boolean {
  return (
    diff.added.length > 0 ||
    diff.modified.length > 0 ||
    diff.deleted.length > 0 ||
    diff.renamed.length > 0
  );
}

function sameContent(left: WorkspaceManifestEntry, right: WorkspaceManifestEntry): boolean {
  return left.size === right.size && left.sha256 === right.sha256;
}
