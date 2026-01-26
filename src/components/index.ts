import { registerComponent } from "../componentRegistry";
import { Timer } from "./Timer";

export function registerBuiltinComponents() {
  registerComponent("Timer", Timer as React.ComponentType<Record<string, unknown>>);
}
