import { useState, useEffect, useMemo, useCallback } from "react";
import { getCurrentMacroInput, getMatchingMacros, type Macro } from "./macros";

export interface AutocompletePosition {
  top: number;
  left: number;
  showAbove?: boolean;
}

interface UseMacroAutocompleteProps {
  lines: string[];
  cursorLine: number;
  cursorCol: number;
  onSelectMacro: (macro: Macro, inputLength: number) => void;
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

  const getPosition = useCallback((): AutocompletePosition => {
    const lineEl = lineRefs.current.get(cursorLine);
    if (!lineEl || !editorRef.current) {
      return { top: 0, left: 0 };
    }

    const lineRect = lineEl.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();

    const macroInputLength = macroInput?.length ?? 0;
    const triggerCol = cursorCol - macroInputLength;
    const lineText = lines[cursorLine] || "";
    const textBeforeTrigger = lineText.slice(0, triggerCol);

    const measureSpan = window.document.createElement("span");
    measureSpan.style.font = getComputedStyle(lineEl).font;
    measureSpan.style.visibility = "hidden";
    measureSpan.style.position = "absolute";
    measureSpan.style.whiteSpace = "pre";
    measureSpan.textContent = textBeforeTrigger;
    window.document.body.appendChild(measureSpan);
    const textWidth = measureSpan.getBoundingClientRect().width;
    window.document.body.removeChild(measureSpan);

    const left = lineRect.left - editorRect.left + textWidth;

    const windowMidpoint = window.innerHeight / 2;
    const isAboveEquator = lineRect.bottom < windowMidpoint;

    const top = isAboveEquator
      ? lineRect.bottom - editorRect.top
      : lineRect.top - editorRect.top;

    return { top, left, showAbove: !isAboveEquator };
  }, [cursorLine, cursorCol, macroInput, lines, lineRefs, editorRef]);

  return {
    isOpen,
    matchingMacros,
    selectedIndex,
    handleKeyDown,
    getPosition,
  };
}
