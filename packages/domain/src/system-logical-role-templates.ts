import templateData from "./system-logical-role-templates.json" with { type: "json" };

export interface SystemLogicalRoleTemplate {
  id: string;
  title: string;
  desc: string;
}

function validateTemplates(
  input: readonly Record<string, unknown>[],
): readonly SystemLogicalRoleTemplate[] {
  if (input.length !== 74) {
    throw new Error("SYSTEM_LOGICAL_ROLE_TEMPLATE_COUNT_INVALID");
  }
  const ids = new Set<string>();
  const templates = input.map((entry) => {
    if (
      Object.keys(entry).sort().join(",") !== "desc,id,title" ||
      typeof entry.id !== "string" ||
      entry.id.length === 0 ||
      typeof entry.title !== "string" ||
      entry.title.length === 0 ||
      typeof entry.desc !== "string" ||
      entry.desc.length === 0
    ) {
      throw new Error("SYSTEM_LOGICAL_ROLE_TEMPLATE_INVALID");
    }
    if (ids.has(entry.id)) {
      throw new Error("SYSTEM_LOGICAL_ROLE_TEMPLATE_DUPLICATE");
    }
    ids.add(entry.id);
    return Object.freeze({ id: entry.id, title: entry.title, desc: entry.desc });
  });
  return Object.freeze(templates);
}

export const SYSTEM_LOGICAL_ROLE_TEMPLATES = validateTemplates(templateData);
