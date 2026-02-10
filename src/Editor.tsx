import { useEffect, useRef, useCallback, useMemo, useState } from "react";
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
import { ClaudeDelegateModal } from "./components/ClaudeDelegateModal";
import { FindReplace } from "./FindReplace";
import { RenderedLine } from "./RenderedLine";
import type { Macro, MacroContext } from "./macros";
import { LineGutter } from "./LineGutter";
import { isContentBlank, parseFromMDX } from "./documentModel";
import { getCollapsedHiddenLines } from "./editorActions";
import type { Document } from "./documentModel";

function Editor() {
  const {
    document,
    lines,
    cursor,
    selectionAnchor,
    hasSelection,
    hiddenLines,
    collapsedHeadings,
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

  // --- Find/Replace state ---
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findReplaceShowReplace, setFindReplaceShowReplace] = useState(false);

  const handleFindReplaceClose = useCallback(() => {
    setFindReplaceOpen(false);
    editorRef.current?.focus();
  }, []);

  const handleFindReplaceNavigate = useCallback(
    (line: number, col: number) => {
      updateDocument({
        ...document,
        editor: {
          ...document.editor,
          cursor: { line, col },
          selectionAnchor: null,
        },
      });
    },
    [document, updateDocument]
  );

  const handleFindReplaceReplace = useCallback(
    (match: FindReplaceMatch, replacement: string) => {
      const newLines = [...lines];
      const line = newLines[match.line];
      newLines[match.line] =
        line.slice(0, match.startCol) + replacement + line.slice(match.endCol);
      updateDocument({
        ...document,
        editor: {
          ...document.editor,
          lines: newLines,
          cursor: { line: match.line, col: match.startCol + replacement.length },
          selectionAnchor: null,
        },
      });
    },
    [lines, document, updateDocument]
  );

  const handleFindReplaceAll = useCallback(
    (searchText: string, replacement: string) => {
      const lowerSearch = searchText.toLowerCase();
      const newLines = lines.map((line) => {
        let result = "";
        const lowerLine = line.toLowerCase();
        let searchStart = 0;
        while (true) {
          const idx = lowerLine.indexOf(lowerSearch, searchStart);
          if (idx === -1) {
            result += line.slice(searchStart);
            break;
          }
          result += line.slice(searchStart, idx) + replacement;
          searchStart = idx + searchText.length;
        }
        return result;
      });
      updateDocument({
        ...document,
        editor: {
          ...document.editor,
          lines: newLines,
          selectionAnchor: null,
        },
      });
    },
    [lines, document, updateDocument]
  );

  const handleToggleFindReplaceReplace = useCallback(() => {
    setFindReplaceShowReplace((prev) => !prev);
  }, []);

  // --- Macro modal state ---
  // TODO: Genericize this pattern for other macros that need input
  const [claudeModal, setClaudeModal] = useState<{
    macro: Macro;
    instructions: string;
    macroInputLength: number;
  } | null>(null);

  const handleSelectMacro = useCallback(
    (macro: Macro, inputLength: number, context: MacroContext) => {
      if (macro.trigger === "/claude") {
        const lineText = context.lineRawText;
        const instructionsEndIndex = lineText.length - inputLength;
        const instructions = lineText.slice(0, instructionsEndIndex).trim();

        const { line, col } = cursor;
        const currentLine = lines[line];
        const beforeMacro = currentLine.slice(0, col - inputLength);
        const afterCursor = currentLine.slice(col);
        const triggerText = macro.trigger;
        const newLines = [...lines];
        newLines[line] = beforeMacro + triggerText + afterCursor;

        updateDocument({
          ...document,
          editor: {
            ...document.editor,
            lines: newLines,
            cursor: { line, col: beforeMacro.length + triggerText.length },
            selectionAnchor: null,
          },
        });

        setClaudeModal({ macro, instructions, macroInputLength: triggerText.length });
      } else if (macro.expand) {
        applyMacro(macro, inputLength);
      }
    },
    [applyMacro, cursor, lines, document, updateDocument]
  );

  const handleClaudeConfirm = useCallback(
    (sessionId: string) => {
      if (!claudeModal || !claudeModal.macro.expand) return;

      const { line, col } = cursor;
      const currentLine = lines[line];
      const lineBeforeMacro = currentLine.slice(0, col - claudeModal.macroInputLength);
      const lineAfterCursor = currentLine.slice(col);

      const expanded = claudeModal.macro.expand({ sessionId });
      const newLines = [...lines];
      newLines[line] = lineBeforeMacro + expanded + lineAfterCursor;

      updateDocument({
        ...document,
        editor: {
          ...document.editor,
          lines: newLines,
          cursor: { line, col: lineBeforeMacro.length + expanded.length },
          selectionAnchor: null,
        },
      });

      setClaudeModal(null);
    },
    [claudeModal, cursor, lines, document, updateDocument]
  );

  const handleClaudeCancel = useCallback(() => {
    setClaudeModal(null);
  }, []);
  // --- End macro modal state ---

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

  const collapsedHiddenLines = useMemo(
    () => getCollapsedHiddenLines(lines, collapsedHeadings),
    [lines, collapsedHeadings]
  );

  const allHiddenLines = useMemo(() => {
    const merged = new Set(hiddenLines);
    for (const line of collapsedHiddenLines) {
      merged.add(line);
    }
    return merged;
  }, [hiddenLines, collapsedHiddenLines]);

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

  const openFind = useCallback(() => {
    setFindReplaceOpen(true);
    setFindReplaceShowReplace(false);
  }, []);

  const openReplace = useCallback(() => {
    setFindReplaceOpen(true);
    setFindReplaceShowReplace(true);
  }, []);

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

  const prevHiddenLinesRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    const wasCollapsed = prevHiddenLinesRef.current.size > 0;
    const isExpanded = hiddenLines.size === 0;
    if (wasCollapsed && isExpanded) {
      const lineEl = lineRefs.current.get(cursor.line);
      if (lineEl) {
        lineEl.scrollIntoView({ block: "center" });
      }
    }
    prevHiddenLinesRef.current = hiddenLines;
  }, [hiddenLines, cursor.line, lineRefs]);

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
