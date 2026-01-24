import type { Macro } from "./macros";

interface MacroAutocompleteProps {
  macros: Macro[];
  selectedIndex: number;
  position: { top: number; left: number };
}

export function MacroAutocomplete({
  macros,
  selectedIndex,
  position,
}: MacroAutocompleteProps) {
  if (macros.length === 0) {
    return null;
  }

  return (
    <div
      className="macro-autocomplete"
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
      }}
    >
      {macros.map((macro, index) => (
        <div
          key={macro.trigger}
          className={`macro-autocomplete-item ${
            index === selectedIndex ? "selected" : ""
          }`}
        >
          <span className="macro-trigger">{macro.trigger}</span>
        </div>
      ))}
    </div>
  );
}
