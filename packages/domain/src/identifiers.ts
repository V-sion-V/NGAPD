export const PROJECT_KEY_PATTERN = /^[A-Z]{2,6}$/;

declare const projectKeyBrand: unique symbol;
declare const taskKeyBrand: unique symbol;
declare const taskSequenceBrand: unique symbol;

export type ProjectKey = string & { readonly [projectKeyBrand]: true };
export type TaskKey = string & { readonly [taskKeyBrand]: true };
export type TaskSequence = number & { readonly [taskSequenceBrand]: true };

export type ProjectKeyValidation =
  { ok: true; value: ProjectKey } | { ok: false; reason: "invalid_project_key" };

export type TaskSequenceValidation =
  { ok: true; value: TaskSequence } | { ok: false; reason: "invalid_task_sequence" };

export type TaskKeyValidation =
  | {
      ok: true;
      value: TaskKey;
      projectKey: ProjectKey;
      sequence: TaskSequence;
    }
  | {
      ok: false;
      reason: "invalid_project_key" | "invalid_task_sequence" | "invalid_task_key";
    };

export function parseProjectKey(input: string): ProjectKeyValidation {
  return PROJECT_KEY_PATTERN.test(input)
    ? { ok: true, value: input as ProjectKey }
    : { ok: false, reason: "invalid_project_key" };
}

export function parseTaskSequence(input: number): TaskSequenceValidation {
  return Number.isSafeInteger(input) && input >= 1
    ? { ok: true, value: input as TaskSequence }
    : { ok: false, reason: "invalid_task_sequence" };
}

export function createTaskKey(projectKeyInput: string, sequenceInput: number): TaskKeyValidation {
  const projectKey = parseProjectKey(projectKeyInput);
  if (!projectKey.ok) {
    return projectKey;
  }
  const sequence = parseTaskSequence(sequenceInput);
  if (!sequence.ok) {
    return sequence;
  }
  return {
    ok: true,
    value: `${projectKey.value}-${sequence.value}` as TaskKey,
    projectKey: projectKey.value,
    sequence: sequence.value,
  };
}

export function parseTaskKey(input: string): TaskKeyValidation {
  const separator = input.lastIndexOf("-");
  if (separator < 0) {
    return { ok: false, reason: "invalid_task_key" };
  }

  const projectKeyInput = input.slice(0, separator);
  const sequenceInput = input.slice(separator + 1);
  if (!/^[1-9]\d*$/.test(sequenceInput)) {
    return { ok: false, reason: "invalid_task_key" };
  }

  const parsedSequence = Number(sequenceInput);
  const result = createTaskKey(projectKeyInput, parsedSequence);
  if (!result.ok) {
    return result;
  }
  return result.value === input ? result : { ok: false, reason: "invalid_task_key" };
}

export function evaluateProjectKeyChange(
  currentProjectKey: string,
  requestedProjectKey: string,
):
  | { ok: true; value: ProjectKey; changed: false }
  | { ok: false; reason: "invalid_project_key" | "project_key_immutable" } {
  const current = parseProjectKey(currentProjectKey);
  const requested = parseProjectKey(requestedProjectKey);
  if (!current.ok || !requested.ok) {
    return { ok: false, reason: "invalid_project_key" };
  }
  if (current.value !== requested.value) {
    return { ok: false, reason: "project_key_immutable" };
  }
  return { ok: true, value: current.value, changed: false };
}
