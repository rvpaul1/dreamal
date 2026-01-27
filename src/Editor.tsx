import { useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useEditorState } from "./useEditorState";
import { usePersistence } from "./usePersistence";
import { useEntryNavigation } from "./useEntryNavigation";
import { useMacroAutocomplete } from "./useMacroAutocomplete";
import { useMarkdown } from "./useMarkdown";
import { useMouseSelection } from "./useMouseSelection";
import { useCursorBehavior } from "./useCursorBehavior";
import { useBlockManipulation } from "./useBlockManipulation";
import { useKeyboardHandling } from "./useKeyboardHandling";
import { MacroAutocomplete } from "./MacroAutocomplete";
import { RenderedLine } from "./RenderedLine";
import { isContentBlank, parseFromMDX } from "./documentModel";
import type { Document } from "./documentModel";

function Editor() {
  const {
    document,
    lines,
    cursor,
    selectionAnchor,
    hasSelection,
    handleKeyDown: handleEditorKeyDown,
    handleClickAt,
    handleDragTo,
    handlePaste,
    updateDocument,
    updateMetadata,
    applyMacro,
  } = useEditorState();

  const { saveState, flushSave, journalDir } = usePersistence(document, updateMetadata);

  const hasCheckedInitialEntry = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const {
    cursorVisible,
    getInlineBlockEndingBefore,
    getInlineBlockStartingAfter,
    markClickInput,
    markKeyInput,
  } = useCursorBehavior({
    lines,
    cursor,
    document,
    updateDocument,
    lineRefs,
  });

  const {
    selectedBlockRange,
    handleBlockSelect,
    handleBlockStateChange,
    handleBlockDelete,
    clearBlockSelection,
  } = useBlockManipulation({
    lines,
    cursor,
    document,
    updateDocument,
  });

  useEffect(() => {
    if (!journalDir || hasCheckedInitialEntry.current) return;
    hasCheckedInitialEntry.current = true;

    async function checkLatestEntry() {
      try {
        const entries = await invoke<string[]>("list_entries");
        if (entries.length === 0) return;

        const latestEntry = entries[entries.length - 1];
        const content = await invoke<string>("read_entry", { filepath: latestEntry });

        if (isContentBlank(content)) {
          const doc = parseFromMDX(content, latestEntry);
          updateDocument(doc);
        }
      } catch (err) {
        console.error("Failed to check latest entry:", err);
      }
    }

    checkLatestEntry();
  }, [journalDir, updateDocument]);

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
    getPosition: getAutocompletePosition,
  } = useMacroAutocomplete({
    lines,
    cursorLine: cursor.line,
    cursorCol: cursor.col,
    onSelectMacro: applyMacro,
    lineRefs,
    editorRef,
  });

  const { getLineClass, getHeadingInfo, getBulletInfo } = useMarkdown(lines);

  const {
    handleMouseDown: baseHandleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useMouseSelection({
    lines,
    lineRefs,
    onClickAt: handleClickAt,
    onDragTo: handleDragTo,
  });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      markClickInput();
      baseHandleMouseDown(e);
    },
    [baseHandleMouseDown, markClickInput]
  );

  const { handleKeyDown, handlePasteEvent } = useKeyboardHandling({
    cursor,
    hasSelection,
    selectedBlockRange,
    handleEditorKeyDown,
    handlePaste,
    handleBlockDelete,
    clearBlockSelection,
    getInlineBlockEndingBefore,
    getInlineBlockStartingAfter,
    handleMacroKeyDown,
    markKeyInput,
    navigatePrev,
    navigateNext,
    hasPrev,
    hasNext,
    flushSave,
    updateDocument,
  });

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

  return (
    <div
      ref={editorRef}
      className="editor"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPaste={handlePasteEvent}
      onBlur={flushSave}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
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
              bulletInfo={getBulletInfo(lineIndex)}
              onBlockSelect={(startCol, endCol) =>
                handleBlockSelect(lineIndex, startCol, endCol)
              }
              selectedBlockRange={
                selectedBlockRange?.line === lineIndex
                  ? selectedBlockRange
                  : null
              }
              onBlockStateChange={(startCol, endCol, newComponent) =>
                handleBlockStateChange(lineIndex, startCol, endCol, newComponent)
              }
              onBlockDelete={(startCol, endCol) =>
                handleBlockDelete(lineIndex, startCol, endCol)
              }
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
