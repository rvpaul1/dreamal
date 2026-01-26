import React from "react";
import type { ParsedComponent } from "./jsxBlocks";

export interface ComponentConfig {
  component: React.ComponentType<Record<string, unknown>>;
}

const registry: Map<string, ComponentConfig> = new Map();

export function registerComponent(
  name: string,
  component: React.ComponentType<Record<string, unknown>>
): void {
  registry.set(name, { component });
}

export function getComponent(name: string): ComponentConfig | undefined {
  return registry.get(name);
}

export function hasComponent(name: string): boolean {
  return registry.has(name);
}

interface RenderComponentProps {
  parsed: ParsedComponent;
  onStateChange?: (newProps: Record<string, unknown>) => void;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function RenderComponent({
  parsed,
  onStateChange,
  isSelected,
  onSelect,
}: RenderComponentProps): React.ReactElement {
  const config = getComponent(parsed.name);

  if (!config) {
    return (
      <span className="jsx-unknown-component" onClick={onSelect}>
        [Unknown: {parsed.name}]
      </span>
    );
  }

  const { component: Component } = config;

  const renderedChildren = parsed.children.map((child, index) => (
    <RenderComponent
      key={index}
      parsed={child}
      onStateChange={onStateChange}
    />
  ));

  const props: Record<string, unknown> = {
    ...parsed.props,
    __onStateChange: onStateChange,
    __isSelected: isSelected,
    __onSelect: onSelect,
  };

  if (renderedChildren.length > 0) {
    props.children = renderedChildren;
  }

  return <Component {...props} />;
}

export function Placeholder({ text }: { text?: string }): React.ReactElement {
  return (
    <span className="jsx-placeholder">
      {text || "Component"}
    </span>
  );
}

registerComponent("Placeholder", Placeholder as React.ComponentType<Record<string, unknown>>);
