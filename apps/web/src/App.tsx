import { M1App } from "./m1/M1App.js";
import { TaskUiApp } from "./task-ui/TaskUiApp.js";

export function App() {
  if (isTaskUiPrototype(window.location.search)) {
    return <TaskUiApp />;
  }
  return <M1App />;
}

export function isTaskUiPrototype(search: string): boolean {
  return new URLSearchParams(search).get("prototype") === "task-ui";
}
