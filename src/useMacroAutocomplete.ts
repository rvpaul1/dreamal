import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getCurrentMacroInput, getMatchingMacros, type Macro, type MacroContext } from "./macros";

export interface AutocompletePosition {
  top: number;
  left: number;
  showAbove?: boolean;
}

interface UseMacroAutocompleteProps {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
  onSelectMacro: (macro: Macro, inputLength: number, context: MacroContext) => void;
  lineRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
  editorRef: React.RefObject<HTMLDivElement | null>;
}

export function useMacroAutocomplete({
  lines,
  cursorLine,
  cursorCol,
  onSelectMacro,
  lineRefs,
  editorRef,
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
      const lineRawText = lines[cursorLine] || "";
      const context: MacroContext = { lineRawText };
      onSelectMacro(matchingMacros[selectedIndex], macroInput.length, context);
    }
  }, [isOpen, macroInput, matchingMacros, selectedIndex, onSelectMacro, lines, cursorLine]);

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

  const cachedPosition = useRef<AutocompletePosition | null>(null);
  const wasOpen = useRef(false);

  const computePosition = useCallback((): AutocompletePosition => {
    const lineEl = lineRefs.current.get(cursorLine);
    if (!lineEl || !editorRef.current) {
      return { top: 0, left: 0 };
    }

    const editorRect = editorRef.current.getBoundingClientRect();
    const cursorEl = lineEl.querySelector(".cursor");

    if (!cursorEl) {
      return { top: 0, left: 0 };
    }

    const cursorRect = cursorEl.getBoundingClientRect();

    const left = cursorRect.left - editorRect.left;

    const windowMidpoint = window.innerHeight / 2;
    const isAboveEquator = cursorRect.bottom < windowMidpoint;

    const top = isAboveEquator
      ? cursorRect.bottom - editorRect.top
      : cursorRect.top - editorRect.top;

    return { top, left, showAbove: !isAboveEquator };
  }, [cursorLine, lineRefs, editorRef]);

  if (!isOpen) {
    cachedPosition.current = null;
    wasOpen.current = false;
  } else if (!wasOpen.current) {
    cachedPosition.current = computePosition();
    wasOpen.current = true;
  }

  const position = cachedPosition.current ?? { top: 0, left: 0 };

  return {
    isOpen,
    matchingMacros,
    selectedIndex,
    handleKeyDown,
    position,
  };
}
