import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  useEditorState,
  getSelectionBounds,
  posBefore,
} from "./useEditorState";
import { usePersistence } from "./usePersistence";
import { useEntryNavigation } from "./useEntryNavigation";
import { MacroAutocomplete } from "./MacroAutocomplete";
import { getCurrentMacroInput, getMatchingMacros, type Macro } from "./macros";
import type { Document } from "./documentModel";

function getHeadingInfo(line: string): { level: number; prefixLength: number } | null {
  const match = line.match(/^(#{1,6}) /);
  if (match) {
    return {
      level: match[1].length,
      prefixLength: match[0].length,
    };
  }
  return null;
}

function Editor() {
  const {
    document,
    lines,
    cursor,
    selectionAnchor,
    hasSelection,
    handleKeyDown: handleEditorKeyDown,
    updateDocument,
    applyMacro,
  } = useEditorState();

  const { saveState, flushSave, journalDir } = usePersistence(document, updateDocument);

  const handleLoadEntry = useCallback(
    (doc: Document, _filepath: string) => {
      updateDocument(doc);
    },
    [updateDocument]
  );

  const { navigatePrev, navigateNext, hasPrev, hasNext } = useEntryNavigation(
    document,
    journalDir,
    handleLoadEntry,
    flushSave
  );

  const [cursorVisible, setCursorVisible] = useState(true);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const macroInput = useMemo(
    () => getCurrentMacroInput(lines, cursor.line, cursor.col),
    [lines, cursor.line, cursor.col]
  );

  const matchingMacros = useMemo(
    () => (macroInput ? getMatchingMacros(macroInput, 10) : []),
    [macroInput]
  );

  const showAutocomplete = matchingMacros.length > 0;

  useEffect(() => {
    setAutocompleteIndex(0);
  }, [macroInput]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCursorVisible(true);
  }, [cursor, lines]);

  useEffect(() => {
    editorRef.current?.focus();
  }, []);

  useEffect(() => {
    const unlisten = listen("tauri://close-requested", () => {
      flushSave();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [flushSave]);

  const selectMacro = useCallback(
    (macro: Macro) => {
      if (macroInput) {
        applyMacro(macro, macroInput.length);
      }
    },
    [applyMacro, macroInput]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === "[") {
        e.preventDefault();
        if (hasPrev) {
          navigatePrev();
        }
        return;
      }

      if (e.metaKey && e.shiftKey && e.key === "]") {
        e.preventDefault();
        if (hasNext) {
          navigateNext();
        }
        return;
      }

      if (showAutocomplete) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setAutocompleteIndex((i) =>
            i < matchingMacros.length - 1 ? i + 1 : i
          );
          return;
        }

        if (e.key === "ArrowUp") {
          e.preventDefault();
          setAutocompleteIndex((i) => (i > 0 ? i - 1 : i));
          return;
        }

        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          selectMacro(matchingMacros[autocompleteIndex]);
          return;
        }

        if (e.key === "Escape") {
          e.preventDefault();
          setAutocompleteIndex(0);
          return;
        }
      }

      handleEditorKeyDown(e);
    },
    [
      handleEditorKeyDown,
      navigatePrev,
      navigateNext,
      hasPrev,
      hasNext,
      showAutocomplete,
      matchingMacros,
      autocompleteIndex,
      selectMacro,
    ]
  );

  const getAutocompletePosition = useCallback(() => {
    const lineEl = lineRefs.current.get(cursor.line);
    if (!lineEl || !editorRef.current) {
      return { top: 0, left: 0 };
    }

    const lineRect = lineEl.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();

    return {
      top: lineRect.bottom - editorRect.top,
      left: lineRect.left - editorRect.left,
    };
  }, [cursor.line]);

  const renderLine = (lineText: string, lineIndex: number, headingInfo: { level: number; prefixLength: number } | null) => {
    const isCursorLine = lineIndex === cursor.line;
    const cursorInPrefix = isCursorLine && headingInfo && cursor.col < headingInfo.prefixLength;
    const hidePrefix = headingInfo && !isCursorLine && !hasSelection;
    const prefixLen = hidePrefix ? headingInfo.prefixLength : 0;
    const displayText = hidePrefix ? lineText.slice(prefixLen) : lineText;

    if (!hasSelection) {
      if (isCursorLine) {
        const adjustedCol = cursorInPrefix ? cursor.col : cursor.col - prefixLen;
        return (
          <>
            <span>{displayText.slice(0, adjustedCol)}</span>
            <span className={`cursor ${cursorVisible ? "visible" : ""}`} />
            <span>{displayText.slice(adjustedCol)}</span>
          </>
        );
      }
      return <span>{displayText || "\u200B"}</span>;
    }

    const { start, end } = getSelectionBounds(selectionAnchor!, cursor);
    const isInSelection = lineIndex >= start.line && lineIndex <= end.line;

    if (!isInSelection) {
      return <span>{displayText || "\u200B"}</span>;
    }

    const selStart = lineIndex === start.line ? start.col : 0;
    const selEnd = lineIndex === end.line ? end.col : lineText.length;

    const beforeSel = lineText.slice(0, selStart);
    const selected = lineText.slice(selStart, selEnd);
    const afterSel = lineText.slice(selEnd);

    const cursorAtStart =
      isCursorLine && cursor.col === selStart && posBefore(cursor, selectionAnchor!);
    const cursorAtEnd =
      isCursorLine && cursor.col === selEnd && posBefore(selectionAnchor!, cursor);

    const showLineEndSelection = lineIndex !== end.line;

    return (
      <>
        <span>{beforeSel}</span>
        {cursorAtStart && (
          <span className={`cursor ${cursorVisible ? "visible" : ""}`} />
        )}
        <span className="selection">
          {selected}
          {showLineEndSelection && <span className="selection-line-end" />}
        </span>
        {cursorAtEnd && (
          <span className={`cursor ${cursorVisible ? "visible" : ""}`} />
        )}
        <span>{afterSel}</span>
        {lineText.length === 0 && !showLineEndSelection && <span>{"\u200B"}</span>}
      </>
    );
  };

  return (
    <div
      ref={editorRef}
      className="editor"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onBlur={flushSave}
    >
      {saveState.status === "error" && (
        <div className="save-error">Save failed: {saveState.error}</div>
      )}
      <div className="editor-content">
        {lines.map((lineText, lineIndex) => {
          const headingInfo = getHeadingInfo(lineText);
          const lineClass = headingInfo
            ? `editor-line md-h${headingInfo.level}`
            : "editor-line";

          return (
            <div
              key={lineIndex}
              className={lineClass}
              ref={(el) => {
                if (el) {
                  lineRefs.current.set(lineIndex, el);
                } else {
                  lineRefs.current.delete(lineIndex);
                }
              }}
            >
              {renderLine(lineText, lineIndex, headingInfo)}
            </div>
          );
        })}
      </div>
      {showAutocomplete && (
        <MacroAutocomplete
          macros={matchingMacros}
          selectedIndex={autocompleteIndex}
          position={getAutocompletePosition()}
        />
      )}
    </div>
  );
}

export default Editor;
