import { useState, useEffect, useMemo, useCallback } from "react";
import { getCurrentMacroInput, getMatchingMacros, type Macro } from "./macros";

interface UseMacroAutocompleteProps {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
  onSelectMacro: (macro: Macro, inputLength: number) => void;
}

export function useMacroAutocomplete({
  lines,
  cursorLine,
  cursorCol,
  onSelectMacro,
}: UseMacroAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const macroInput = useMemo(
    () => getCurrentMacroInput(lines, cursorLine, cursorCol),
    [lines, cursorLine, cursorCol]
  );

  const matchingMacros = useMemo(
    () => (macroInput ? getMatchingMacros(macroInput, 10) : []),
    [macroInput]
  );

  const isOpen = matchingMacros.length > 0;

  useEffect(() => {
    setSelectedIndex(0);
  }, [macroInput]);

  const selectCurrent = useCallback(() => {
    if (isOpen && macroInput) {
      onSelectMacro(matchingMacros[selectedIndex], macroInput.length);
    }
  }, [isOpen, macroInput, matchingMacros, selectedIndex, onSelectMacro]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!isOpen) {
        return false;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i < matchingMacros.length - 1 ? i + 1 : i));
        return true;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i > 0 ? i - 1 : i));
        return true;
      }

      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        selectCurrent();
        return true;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedIndex(0);
        return true;
      }

      return false;
    },
    [isOpen, matchingMacros.length, selectCurrent]
  );

  return {
    isOpen,
    matchingMacros,
    selectedIndex,
    handleKeyDown,
  };
}
