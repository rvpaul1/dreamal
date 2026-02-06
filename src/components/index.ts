import { registerComponent } from "../componentRegistry";
import { Timer } from "./Timer";
import { TaskStatus } from "./TaskStatus";
import { ClaudeStatus } from "./ClaudeStatus";

export function registerBuiltinComponents() {
  registerComponent("Timer", Timer as React.ComponentType<Record<string, unknown>>);
  registerComponent("TaskStatus", TaskStatus as React.ComponentType<Record<string, unknown>>);
  registerComponent("ClaudeStatus", ClaudeStatus as unknown as React.ComponentType<Record<string, unknown>>);
}
