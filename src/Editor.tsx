import { useEffect, useRef, useCallback } from "react";
import { useEditorState } from "./useEditorState";
import { usePersistence } from "./usePersistence";
import { useEntryNavigation } from "./useEntryNavigation";
import { useMacroAutocomplete } from "./useMacroAutocomplete";
import { useMarkdown } from "./useMarkdown";
import { useMouseSelection } from "./useMouseSelection";
import { useCursorBehavior } from "./useCursorBehavior";
import { useBlockManipulation } from "./useBlockManipulation";
import { useKeyboardHandling } from "./useKeyboardHandling";
import { useFindReplace } from "./useFindReplace";
import { useMacroModal } from "./useMacroModal";
import { MacroAutocomplete } from "./MacroAutocomplete";
import { ClaudeDelegateModal } from "./components/ClaudeDelegateModal";
import { FindReplace } from "./FindReplace";
import { RenderedLine } from "./RenderedLine";
import { LineGutter } from "./LineGutter";

function Editor() {
  const {
    document,
    lines,
    cursor,
    selectionAnchor,
    hasSelection,
    hiddenLines,
    collapsedHeadings,
    allHiddenLines,
    toggleHeadingCollapse,
    handleKeyDown: handleEditorKeyDown,
    handleKeyUp: handleEditorKeyUp,
    handleClickAt,
    handleDragTo,
    handlePaste,
    handleCopy,
    updateDocument,
    updateMetadata,
    applyMacro,
  } = useEditorState();

  const editorRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const { saveState, flushSave, journalDir } = usePersistence(document, updateMetadata);

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
    hiddenLines,
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

  const { navigatePrev, navigateNext, hasPrev, hasNext } = useEntryNavigation(
    document,
    journalDir,
    updateDocument,
    flushSave
  );

  const {
    findReplaceOpen,
    findReplaceShowReplace,
    handleFindReplaceClose,
    handleFindReplaceNavigate,
    handleFindReplaceReplace,
    handleFindReplaceAll,
    handleToggleFindReplaceReplace,
    openFind,
    openReplace,
  } = useFindReplace({ lines, document, updateDocument, editorRef });

  const {
    claudeModal,
    handleSelectMacro,
    handleClaudeConfirm,
    handleClaudeCancel,
  } = useMacroModal({ lines, cursor, document, updateDocument, applyMacro });

  const {
    isOpen: showAutocomplete,
    matchingMacros,
    selectedIndex: autocompleteIndex,
    handleKeyDown: handleMacroKeyDown,
    position: autocompletePosition,
  } = useMacroAutocomplete({
    lines,
    cursorLine: cursor.line,
    cursorCol: cursor.col,
    onSelectMacro: handleSelectMacro,
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
    currentCursorLine: cursor.line,
    getBulletInfo,
    getHeadingInfo,
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

  const { handleKeyDown, handlePasteEvent, handleCopyEvent } = useKeyboardHandling({
    cursor,
    hasSelection,
    hiddenLines,
    selectedBlockRange,
    handleEditorKeyDown,
    handlePaste,
    handleCopy,
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
    onOpenFind: openFind,
    onOpenReplace: openReplace,
  });

  useEffect(() => {
    editorRef.current?.focus();
  }, []);

  return (
    <div
      ref={editorRef}
      className="editor"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleEditorKeyUp}
      onPaste={handlePasteEvent}
      onCopy={handleCopyEvent}
      onBlur={flushSave}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {saveState.status === "error" && (
        <div className="save-error">Save failed: {saveState.error}</div>
      )}
      <div className="editor-content">
        {lines.map((lineText, lineIndex) => {
          if (allHiddenLines.has(lineIndex)) {
            return null;
          }
          const headingInfo = getHeadingInfo(lineIndex);
          return (
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
              <LineGutter
                headingInfo={headingInfo}
                isCollapsed={collapsedHeadings.has(lineIndex)}
                onToggleCollapse={() => toggleHeadingCollapse(lineIndex)}
              />
              <div className="line-content">
                <RenderedLine
                  lineText={lineText}
                  lineIndex={lineIndex}
                  cursor={cursor}
                  selectionAnchor={selectionAnchor}
                  hasSelection={hasSelection}
                  cursorVisible={cursorVisible}
                  headingInfo={headingInfo}
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
            </div>
          );
        })}
      </div>
      {showAutocomplete && (
        <MacroAutocomplete
          macros={matchingMacros}
          selectedIndex={autocompleteIndex}
          position={autocompletePosition}
        />
      )}
      {claudeModal && (
        <ClaudeDelegateModal
          instructions={claudeModal.instructions}
          onConfirm={handleClaudeConfirm}
          onCancel={handleClaudeCancel}
        />
      )}
      {findReplaceOpen && (
        <FindReplace
          lines={lines}
          showReplace={findReplaceShowReplace}
          onClose={handleFindReplaceClose}
          onNavigateToMatch={handleFindReplaceNavigate}
          onReplace={handleFindReplaceReplace}
          onReplaceAll={handleFindReplaceAll}
          onToggleReplace={handleToggleFindReplaceReplace}
        />
      )}
    </div>
  );
}

export default Editor;
