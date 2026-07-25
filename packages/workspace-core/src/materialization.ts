import { WorkspaceCoreError, asWorkspaceCoreError } from "./errors.js";
import { DEFAULT_WORKSPACE_LIMITS, createWorkspaceManifest, sha256 } from "./manifest.js";
import { withoutRevision } from "./state-machine.js";
import type {
  LocalWorkspaceState,
  MaterializationFilePort,
  MaterializationJournal,
  MaterializationOperation,
  MaterializationRequest,
  MaterializationResult,
  PreservedConflict,
  WorkspaceControlPort,
  WorkspaceLimits,
  WorkspaceManifest,
  WorkspaceObjectReaderPort,
} from "./types.js";

export async function materializeWorkspace(input: {
  request: MaterializationRequest;
  transactionId: string;
  control: WorkspaceControlPort;
  files: MaterializationFilePort;
  objects: WorkspaceObjectReaderPort;
  limits?: WorkspaceLimits;
}): Promise<MaterializationResult> {
  const release = await input.control.acquireLock();
  try {
    const recovered = await recoverMaterializationLocked(input.control, input.files);
    const state = await input.control.readState();
    if (!state || state.workspaceId !== input.request.workspaceId) {
      throw new WorkspaceCoreError(
        "STATE_INVALID",
        "The registered Workspace state is missing or mismatched.",
      );
    }
    if (
      input.request.expectedStateRevision !== undefined &&
      state.revision !== input.request.expectedStateRevision
    ) {
      throw new WorkspaceCoreError(
        "STATE_CONFLICT",
        "Local Workspace state changed before materialization; retry.",
        true,
      );
    }
    const targetManifest = validateTargetManifest(
      input.request.manifest,
      input.limits ?? DEFAULT_WORKSPACE_LIMITS,
    );
    const objects = await loadObjects(targetManifest, input.objects);
    const operations = await planOperations(state, targetManifest, input.files);
    const journal: MaterializationJournal = {
      schemaVersion: 1,
      transactionId: input.transactionId,
      workspaceId: input.request.workspaceId,
      targetSyncVersion: input.request.syncVersion,
      targetManifestHash: targetManifest.hash,
      phase: "prepared",
      priorState: state,
      operations,
    };
    await input.control.writeJournal(journal);

    try {
      let activeJournal: MaterializationJournal = { ...journal, phase: "applying" };
      await input.control.writeJournal(activeJournal);
      for (let index = 0; index < activeJournal.operations.length; index += 1) {
        const operation = activeJournal.operations[index]!;
        if (operation.previousExisted) {
          await input.files.backup(activeJournal.transactionId, operation.path);
        }
        if (operation.kind === "write") {
          const target = targetManifest.entries.find((entry) => entry.path === operation.path)!;
          await input.files.writeFileAtomically(operation.path, objects.get(target.sha256)!);
        }
        activeJournal = markApplied(activeJournal, index);
        await input.control.writeJournal(activeJournal);
      }
      await input.files.syncWorkspace();
      const nextState = await input.control.writeState(
        {
          ...withoutRevision(state),
          baseSyncVersion: input.request.syncVersion,
          baseManifest: targetManifest,
          replicaStatus: "clean",
          lastErrorCode: null,
        },
        state.revision,
      );
      const preservedConflicts = await input.files.finishRecovery(
        activeJournal.transactionId,
        activeJournal.operations
          .filter((operation) => operation.preserveConflict)
          .map((operation) => operation.path),
      );
      await input.control.clearJournal();
      return {
        state: nextState,
        preservedConflicts,
        recoveredInterruptedTransaction: recovered.recovered,
      };
    } catch (error) {
      const recovery = await recoverMaterializationLocked(input.control, input.files);
      if (recovery.committedState) {
        return {
          state: recovery.committedState,
          preservedConflicts: recovery.preservedConflicts,
          recoveredInterruptedTransaction: true,
        };
      }
      throw asWorkspaceCoreError(
        error,
        "MATERIALIZATION_FAILED",
        "Workspace materialization failed and was rolled back.",
      );
    }
  } finally {
    await release();
  }
}

export async function recoverMaterialization(input: {
  control: WorkspaceControlPort;
  files: MaterializationFilePort;
}): Promise<boolean> {
  const release = await input.control.acquireLock();
  try {
    return (await recoverMaterializationLocked(input.control, input.files)).recovered;
  } finally {
    await release();
  }
}

async function recoverMaterializationLocked(
  control: WorkspaceControlPort,
  files: MaterializationFilePort,
): Promise<{
  recovered: boolean;
  committedState: LocalWorkspaceState | null;
  preservedConflicts: readonly PreservedConflict[];
}> {
  const journal = await control.readJournal();
  if (!journal) {
    return { recovered: false, committedState: null, preservedConflicts: [] };
  }
  const currentState = await control.readState();
  if (
    currentState &&
    currentState.workspaceId === journal.workspaceId &&
    currentState.baseSyncVersion === journal.targetSyncVersion &&
    currentState.baseManifest.hash === journal.targetManifestHash
  ) {
    const preservedConflicts = await files.finishRecovery(
      journal.transactionId,
      journal.operations
        .filter((operation) => operation.preserveConflict)
        .map((operation) => operation.path),
    );
    await control.clearJournal();
    return {
      recovered: true,
      committedState: currentState,
      preservedConflicts,
    };
  }

  for (const operation of [...journal.operations].reverse()) {
    await files.restore(journal.transactionId, operation.path, operation.previousExisted);
  }
  await files.syncWorkspace();
  const recoveryState = {
    ...withoutRevision(journal.priorState),
    replicaStatus: "materialization_failed" as const,
    lastErrorCode: "MATERIALIZATION_FAILED",
  };
  const expectedRevision = currentState?.revision ?? null;
  await control.writeState(recoveryState, expectedRevision);
  await files.finishRecovery(journal.transactionId, []);
  await control.clearJournal();
  return { recovered: true, committedState: null, preservedConflicts: [] };
}

function validateTargetManifest(
  manifest: WorkspaceManifest,
  limits: WorkspaceLimits,
): WorkspaceManifest {
  const canonical = createWorkspaceManifest(manifest.entries);
  if (canonical.hash !== manifest.hash) {
    throw new WorkspaceCoreError(
      "OBJECT_HASH_MISMATCH",
      "The authoritative manifest hash is invalid.",
    );
  }
  if (canonical.entries.length > limits.maxFiles) {
    throw new WorkspaceCoreError(
      "FILE_LIMIT_EXCEEDED",
      "The authoritative manifest exceeds the file soft limit.",
    );
  }
  let totalBytes = 0;
  for (const entry of canonical.entries) {
    if (entry.size > limits.maxFileBytes) {
      throw new WorkspaceCoreError(
        "FILE_SIZE_LIMIT_EXCEEDED",
        `Authoritative file '${entry.path}' exceeds the soft limit.`,
      );
    }
    totalBytes += entry.size;
    if (totalBytes > limits.maxWorkspaceBytes) {
      throw new WorkspaceCoreError(
        "WORKSPACE_SIZE_LIMIT_EXCEEDED",
        "The authoritative manifest exceeds the Workspace soft limit.",
      );
    }
  }
  return canonical;
}

async function loadObjects(
  manifest: WorkspaceManifest,
  objects: WorkspaceObjectReaderPort,
): Promise<Map<string, Uint8Array>> {
  const loaded = new Map<string, Uint8Array>();
  for (const entry of manifest.entries) {
    if (loaded.has(entry.sha256)) {
      continue;
    }
    let content: Uint8Array;
    try {
      content = await objects.readObject(entry.sha256);
    } catch (error) {
      if (error instanceof WorkspaceCoreError) {
        throw error;
      }
      throw new WorkspaceCoreError("OBJECT_MISSING", `Object '${entry.sha256}' is unavailable.`);
    }
    if (content.byteLength !== entry.size || sha256(content) !== entry.sha256) {
      throw new WorkspaceCoreError(
        "OBJECT_HASH_MISMATCH",
        `Object '${entry.sha256}' failed integrity verification.`,
      );
    }
    loaded.set(entry.sha256, content);
  }
  return loaded;
}

async function planOperations(
  state: LocalWorkspaceState,
  target: WorkspaceManifest,
  files: MaterializationFilePort,
): Promise<MaterializationOperation[]> {
  const baseByPath = new Map(state.baseManifest.entries.map((entry) => [entry.path, entry]));
  const targetByPath = new Map(target.entries.map((entry) => [entry.path, entry]));
  const allPaths = [...new Set([...baseByPath.keys(), ...targetByPath.keys()])].sort(
    (left, right) => left.localeCompare(right, "en"),
  );
  const operations: MaterializationOperation[] = [];

  for (const path of allPaths) {
    const targetEntry = targetByPath.get(path);
    const previousExisted = await files.exists(path);
    let currentHash: string | null = null;
    let currentSize: number | null = null;
    if (previousExisted) {
      const current = await files.readFile(path);
      currentHash = sha256(current);
      currentSize = current.byteLength;
    }
    if (targetEntry && currentHash === targetEntry.sha256 && currentSize === targetEntry.size) {
      continue;
    }
    const baseEntry = baseByPath.get(path);
    const preserveConflict =
      previousExisted &&
      (!baseEntry || currentHash !== baseEntry.sha256 || currentSize !== baseEntry.size);
    operations.push({
      path,
      kind: targetEntry ? "write" : "delete",
      previousExisted,
      preserveConflict,
      applied: false,
    });
  }
  return operations;
}

function markApplied(journal: MaterializationJournal, index: number): MaterializationJournal {
  return {
    ...journal,
    operations: journal.operations.map((operation, operationIndex) =>
      operationIndex === index ? { ...operation, applied: true } : operation,
    ),
  };
}
