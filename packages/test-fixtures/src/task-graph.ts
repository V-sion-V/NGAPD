export type TaskDisplayType = "normal" | "sprint" | "milestone";

export interface TaskFixture {
  key: string;
  parentKey: string | null;
  title: string;
  displayType: TaskDisplayType;
}

export function createWideTaskFixture(count = 200): TaskFixture[] {
  const parentKey = "ZERO-1";
  const displayTypes: TaskDisplayType[] = ["normal", "sprint", "milestone"];

  return [
    {
      key: parentKey,
      parentKey: null,
      title: "宽层级原型",
      displayType: "normal",
    },
    ...Array.from({ length: count }, (_, index) => ({
      key: `ZERO-${index + 2}`,
      parentKey,
      title: `原型任务 ${String(index + 1).padStart(3, "0")}`,
      displayType: displayTypes[index % displayTypes.length] ?? "normal",
    })),
  ];
}
