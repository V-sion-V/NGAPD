import { Buffer } from "node:buffer";

import { WorkspaceCoreError } from "./errors.js";
import type { WorkspaceManifestEntry } from "./types.js";

const PROTECTED_ROOTS = new Set([".ngapd", "task.md", "summary.md"]);
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const WINDOWS_INVALID_CHARACTER = /[<>:"\\|?*]/u;
const DRIVE_PREFIX = /^[A-Za-z]:/u;
const MAX_PATH_BYTES = 1_024;
const MAX_SEGMENT_BYTES = 255;

export function normalizeWorkspacePath(input: string): string {
  if (input.length === 0 || input.startsWith("/") || DRIVE_PREFIX.test(input)) {
    throw new WorkspaceCoreError("PATH_NOT_RELATIVE", "Workspace paths must be relative.");
  }
  if (input.includes("\\")) {
    throw new WorkspaceCoreError("PATH_USES_BACKSLASH", "Workspace paths must use '/'.");
  }

  const normalized = input.normalize("NFC");
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "..")) {
    throw new WorkspaceCoreError("PATH_TRAVERSAL", "Workspace path traversal is not allowed.");
  }
  if (segments.some((segment) => segment.length === 0 || segment === ".")) {
    throw new WorkspaceCoreError("PATH_SEGMENT_INVALID", "Workspace path segments are invalid.");
  }

  for (const segment of segments) {
    assertPortableSegment(segment);
  }
  if (PROTECTED_ROOTS.has(caseFold(segments[0] ?? ""))) {
    throw new WorkspaceCoreError("PATH_PROTECTED", "Workspace control paths are protected.");
  }
  if (Buffer.byteLength(normalized, "utf8") > MAX_PATH_BYTES) {
    throw new WorkspaceCoreError("PATH_NOT_PORTABLE", "Workspace path exceeds the safe limit.");
  }
  return normalized;
}

export function normalizeRegistrationPath(input: string): string {
  return normalizeWorkspacePath(input.replace(/\/+$/u, ""));
}

export function assertNoPortablePathCollisions(paths: readonly string[]): void {
  const seen = new Map<string, string>();
  for (const candidate of paths) {
    const normalized = normalizeWorkspacePath(candidate);
    const key = collisionKey(normalized);
    const existing = seen.get(key);
    if (existing !== undefined) {
      throw new WorkspaceCoreError(
        "PATH_COLLISION",
        `Workspace paths '${existing}' and '${candidate}' collide across supported platforms.`,
      );
    }
    seen.set(key, candidate);
  }
}

export function canonicalizeManifestEntries(
  entries: readonly WorkspaceManifestEntry[],
): WorkspaceManifestEntry[] {
  const canonical = entries.map((entry) => ({
    ...entry,
    path: normalizeWorkspacePath(entry.path),
  }));
  assertNoPortablePathCollisions(canonical.map((entry) => entry.path));
  const exactPaths = new Set<string>();
  for (const entry of canonical) {
    if (exactPaths.has(entry.path)) {
      throw new WorkspaceCoreError("PATH_COLLISION", `Duplicate path '${entry.path}'.`);
    }
    exactPaths.add(entry.path);
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) {
      throw new WorkspaceCoreError("STATE_INVALID", `Invalid size for '${entry.path}'.`);
    }
    if (!/^[0-9a-f]{64}$/u.test(entry.sha256)) {
      throw new WorkspaceCoreError("STATE_INVALID", `Invalid SHA-256 for '${entry.path}'.`);
    }
  }
  return canonical.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

export function portablePathKey(path: string): string {
  return collisionKey(normalizeWorkspacePath(path));
}

function assertPortableSegment(segment: string): void {
  if (
    WINDOWS_INVALID_CHARACTER.test(segment) ||
    [...segment].some((character) => character.codePointAt(0)! <= 0x1f) ||
    segment.endsWith(".") ||
    segment.endsWith(" ") ||
    WINDOWS_RESERVED_NAME.test(segment)
  ) {
    throw new WorkspaceCoreError(
      "PATH_NOT_PORTABLE",
      `Workspace path segment '${segment}' is not portable.`,
    );
  }
  if (Buffer.byteLength(segment, "utf8") > MAX_SEGMENT_BYTES) {
    throw new WorkspaceCoreError(
      "PATH_NOT_PORTABLE",
      `Workspace path segment '${segment}' exceeds the safe limit.`,
    );
  }
}

function collisionKey(path: string): string {
  return path
    .split("/")
    .map((segment) => caseFold(segment.normalize("NFC")))
    .join("/");
}

function caseFold(value: string): string {
  return value.toLocaleLowerCase("en-US");
}
