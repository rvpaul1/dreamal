import { useState, useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useEditorState } from "./useEditorState";
import { usePersistence } from "./usePersistence";
import { useEntryNavigation } from "./useEntryNavigation";
import { useMacroAutocomplete } from "./useMacroAutocomplete";
import { useMarkdown } from "./useMarkdown";
import { MacroAutocomplete } from "./MacroAutocomplete";
import { RenderedLine } from "./RenderedLine";
import type { Document } from "./documentModel";

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

  const {
    isOpen: showAutocomplete,
    matchingMacros,
    selectedIndex: autocompleteIndex,
    handleKeyDown: handleMacroKeyDown,
  } = useMacroAutocomplete({
    lines,
    cursorLine: cursor.line,
    cursorCol: cursor.col,
    onSelectMacro: applyMacro,
  });

  const { getLineClass, getHeadingInfo } = useMarkdown(lines);

  const [cursorVisible, setCursorVisible] = useState(true);
  const editorRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

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

      if (handleMacroKeyDown(e)) {
        return;
      }

      handleEditorKeyDown(e);
    },
    [handleEditorKeyDown, navigatePrev, navigateNext, hasPrev, hasNext, handleMacroKeyDown]
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
        {lines.map((lineText, lineIndex) => (
          <div
            key={lineIndex}
            className={getLineClass(lineIndex)}
            ref={(el) => {
              if (el) {
                lineRefs.current.set(lineIndex, el);
              } else {
                lineRefs.current.delete(lineIndex);
              }
            }}
          >
            <RenderedLine
              lineText={lineText}
              lineIndex={lineIndex}
              cursor={cursor}
              selectionAnchor={selectionAnchor}
              hasSelection={hasSelection}
              cursorVisible={cursorVisible}
              headingInfo={getHeadingInfo(lineIndex)}
            />
          </div>
        ))}
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
