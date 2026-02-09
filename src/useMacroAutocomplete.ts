import { useState, useEffect, useMemo, useCallback } from "react";
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

    const lineContent = lineEl.querySelector(".line-content");
    const measureEl = lineContent ?? lineEl;
    const measureStyle = getComputedStyle(measureEl);

    const measureSpan = window.document.createElement("span");
    measureSpan.style.font = measureStyle.font;
    measureSpan.style.visibility = "hidden";
    measureSpan.style.position = "absolute";
    measureSpan.style.whiteSpace = measureStyle.whiteSpace;
    measureSpan.style.wordWrap = measureStyle.wordWrap;
    measureSpan.style.overflowWrap = measureStyle.overflowWrap;
    measureSpan.style.width = measureEl.getBoundingClientRect().width + "px";
    measureSpan.textContent = textBeforeTrigger + "\u200B";
    window.document.body.appendChild(measureSpan);

    const rng = window.document.createRange();
    const textNode = measureSpan.firstChild!;
    rng.setStart(textNode, textNode.textContent!.length - 1);
    rng.setEnd(textNode, textNode.textContent!.length);
    const caretRect = rng.getBoundingClientRect();
    const spanRect = measureSpan.getBoundingClientRect();
    window.document.body.removeChild(measureSpan);

    const textLeft = caretRect.left - spanRect.left;
    const textTop = caretRect.top - spanRect.top;
    const lineContentRect = measureEl.getBoundingClientRect();

    const menuWidth = 200;
    const maxLeft = editorRect.width - menuWidth;
    const rawLeft = lineContentRect.left - editorRect.left + textLeft;
    const left = Math.max(0, Math.min(rawLeft, maxLeft));

    const windowMidpoint = window.innerHeight / 2;
    const wrappedTop = lineContentRect.top + textTop;
    const wrappedBottom = wrappedTop + caretRect.height;
    const isAboveEquator = wrappedBottom < windowMidpoint;

    const top = isAboveEquator
      ? wrappedBottom - editorRect.top
      : wrappedTop - editorRect.top;

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
