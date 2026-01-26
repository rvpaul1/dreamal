import { registerComponent } from "../componentRegistry";
import { Timer } from "./Timer";
import { TaskStatus } from "./TaskStatus";

export function registerBuiltinComponents() {
  registerComponent("Timer", Timer as React.ComponentType<Record<string, unknown>>);
  registerComponent("TaskStatus", TaskStatus as React.ComponentType<Record<string, unknown>>);
}
