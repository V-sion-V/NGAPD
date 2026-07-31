import type { TaskResource } from "@ngapd/contracts";
import { type KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { layoutTaskGraph, nextNodeForArrow, type ArrowDirection } from "../task-ui/layout.js";
import type { TaskViewport, VisibleTaskScope } from "./model.js";

const DISPLAY_ICON = {
  normal: "□",
  sprint: "⚡",
  milestone: "◆",
} as const;

const DISPLAY_LABEL = {
  normal: "普通",
  sprint: "冲刺",
  milestone: "里程碑",
} as const;

const STATUS_LABEL = {
  not_started: "未开始",
  in_progress: "进行中",
  blocked: "已阻塞",
  done: "已完成",
} as const;

export function TaskGraph({
  scope,
  selectedTaskKey,
  viewport,
  ownerName,
  onSelect,
  onClose,
  onViewport,
}: {
  scope: VisibleTaskScope;
  selectedTaskKey: string | null;
  viewport: TaskViewport;
  ownerName: (membershipId: string) => string;
  onSelect: (task: TaskResource) => void;
  onClose: () => void;
  onViewport: (viewport: TaskViewport) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const scrollFrame = useRef<number | null>(null);
  const layout = useMemo(
    () => layoutTaskGraph(scope.tasks, scope.dependencies),
    [scope.dependencies, scope.tasks],
  );
  const selected = scope.tasks.find((task) => task.key === selectedTaskKey) ?? null;
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (viewportRef.current) {
        viewportRef.current.scrollLeft = viewport.left;
        viewportRef.current.scrollTop = viewport.top;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [scope.parentTaskId, viewport.left, viewport.top]);

  useEffect(() => {
    if (!focusedTaskId || !scope.tasks.some((task) => task.id === focusedTaskId)) {
      setFocusedTaskId(layout.nodes[0]?.task.id ?? null);
    }
  }, [focusedTaskId, layout.nodes, scope.tasks]);

  useEffect(
    () => () => {
      if (scrollFrame.current !== null) {
        cancelAnimationFrame(scrollFrame.current);
      }
    },
    [],
  );

  const focusNode = (taskId: string): void => {
    setFocusedTaskId(taskId);
    requestAnimationFrame(() => nodeRefs.current.get(taskId)?.focus());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, task: TaskResource): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      focusNode(task.id);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(task);
      return;
    }
    const direction = arrowDirection(event.key);
    if (direction) {
      event.preventDefault();
      focusNode(nextNodeForArrow(layout, task.id, direction));
    }
  };

  if (scope.tasks.length === 0) {
    return (
      <div className="m3-empty" role="status">
        当前层没有符合条件的任务。清除筛选，或在有权限时创建任务。
      </div>
    );
  }

  return (
    <div
      aria-label={`当前任务依赖图，共 ${scope.tasks.length} 个节点、${scope.dependencies.length} 条可见依赖`}
      className="m3-graph-viewport"
      ref={viewportRef}
      role="region"
      tabIndex={0}
      onScroll={(event) => {
        const target = event.currentTarget;
        if (scrollFrame.current !== null) {
          cancelAnimationFrame(scrollFrame.current);
        }
        scrollFrame.current = requestAnimationFrame(() => {
          onViewport({ left: target.scrollLeft, top: target.scrollTop });
          scrollFrame.current = null;
        });
      }}
    >
      <div
        className="m3-graph-canvas"
        style={{ width: `${layout.width}px`, height: `${layout.height}px` }}
      >
        <svg
          aria-hidden="true"
          className="m3-graph-edges"
          height={layout.height}
          width={layout.width}
        >
          <defs>
            <marker id="m3-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
              <path d="M 0 0 L 8 4 L 0 8 z" />
            </marker>
          </defs>
          {layout.edges.map((edge) => (
            <path
              className={
                selected &&
                (edge.dependency.predecessorTaskId === selected.id ||
                  edge.dependency.successorTaskId === selected.id)
                  ? "m3-edge m3-edge--related"
                  : "m3-edge"
              }
              d={edge.path}
              key={edge.dependency.id}
              markerEnd="url(#m3-arrow)"
            />
          ))}
        </svg>

        {layout.nodes.map((node) => {
          const task = node.task;
          const incoming = scope.dependencies.filter(
            (dependency) => dependency.successorTaskId === task.id,
          ).length;
          const outgoing = scope.dependencies.filter(
            (dependency) => dependency.predecessorTaskId === task.id,
          ).length;
          return (
            <button
              aria-label={`${task.key}，${task.title}，${DISPLAY_LABEL[task.displayType]}，${STATUS_LABEL[task.effectiveStatus]}，${incoming} 个前置、${outgoing} 个后继`}
              aria-pressed={selectedTaskKey === task.key}
              className={[
                "m3-task-node",
                `m3-task-node--${task.displayType}`,
                `m3-task-node--${task.effectiveStatus}`,
                selectedTaskKey === task.key ? "m3-task-node--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={task.id}
              ref={(element) => {
                if (element) {
                  nodeRefs.current.set(task.id, element);
                } else {
                  nodeRefs.current.delete(task.id);
                }
              }}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${node.width}px`,
                height: `${node.height}px`,
              }}
              tabIndex={focusedTaskId === task.id ? 0 : -1}
              type="button"
              onClick={() => onSelect(task)}
              onFocus={() => setFocusedTaskId(task.id)}
              onKeyDown={(event) => handleKeyDown(event, task)}
            >
              <span className="m3-task-node__key">
                <span aria-hidden="true">{DISPLAY_ICON[task.displayType]}</span> {task.key}
              </span>
              <strong>{task.title}</strong>
              <span className="m3-task-node__meta">
                {STATUS_LABEL[task.effectiveStatus]} · {ownerName(task.effectiveOwner.membershipId)}
              </span>
              <span className="sr-only">
                依赖方向为前置任务指向后继任务；本节点 {incoming} 个前置，{outgoing} 个后继。
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function arrowDirection(key: string): ArrowDirection | null {
  switch (key) {
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    default:
      return null;
  }
}
