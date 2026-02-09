import { useCallback } from "react";
import { createDocument } from "./documentModel";
import { createInitialState } from "./editorActions";
import type { CursorPosition, Document } from "./useEditorState";
import type { SelectedBlockRange } from "./useBlockManipulation";

interface UseKeyboardHandlingProps {
  cursor: CursorPosition;
  hasSelection: boolean;
  hiddenLines: Set<number>;
  selectedBlockRange: SelectedBlockRange | null;
  handleEditorKeyDown: (e: React.KeyboardEvent, hiddenLines: Set<number>) => void;
  handlePaste: (text: string) => void;
  handleCopy: () => string;
  handleBlockDelete: (lineIndex: number, startCol: number, endCol: number) => void;
  clearBlockSelection: () => void;
  getInlineBlockEndingBefore: (line: number, col: number) => { startCol: number; endCol: number } | null;
  getInlineBlockStartingAfter: (line: number, col: number) => { startCol: number; endCol: number } | null;
  handleMacroKeyDown: (e: React.KeyboardEvent) => boolean;
  markKeyInput: () => void;
  navigatePrev: () => void;
  navigateNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  flushSave: () => void;
  updateDocument: (doc: Document) => void;
  onOpenFind?: () => void;
  onOpenReplace?: () => void;
}

export function useKeyboardHandling({
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
  onOpenFind,
  onOpenReplace,
}: UseKeyboardHandlingProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      markKeyInput();

      if (e.metaKey && !e.shiftKey && e.key === "f") {
        e.preventDefault();
        onOpenFind?.();
        return;
      }

      if (e.metaKey && !e.shiftKey && e.key === "r") {
        e.preventDefault();
        onOpenReplace?.();
        return;
      }

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

      if (e.metaKey && !e.shiftKey && e.key === "n") {
        e.preventDefault();
        flushSave();
        updateDocument(createDocument(createInitialState()));
        return;
      }

      if (selectedBlockRange) {
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          handleBlockDelete(
            selectedBlockRange.line,
            selectedBlockRange.startCol,
            selectedBlockRange.endCol
          );
          return;
        }
        if (
          e.key === "Escape" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown"
        ) {
          clearBlockSelection();
        }
      }

      if (e.key === "Backspace" && !hasSelection) {
        const blockBefore = getInlineBlockEndingBefore(cursor.line, cursor.col);
        if (blockBefore) {
          e.preventDefault();
          handleBlockDelete(cursor.line, blockBefore.startCol, blockBefore.endCol);
          return;
        }
      }

      if (e.key === "Delete" && !hasSelection) {
        const blockAfter = getInlineBlockStartingAfter(cursor.line, cursor.col);
        if (blockAfter) {
          e.preventDefault();
          handleBlockDelete(cursor.line, blockAfter.startCol, blockAfter.endCol);
          return;
        }
      }

      if (handleMacroKeyDown(e)) {
        return;
      }

      handleEditorKeyDown(e, hiddenLines);
    },
    [
      markKeyInput,
      handleEditorKeyDown,
      hiddenLines,
      navigatePrev,
      navigateNext,
      hasPrev,
      hasNext,
      handleMacroKeyDown,
      selectedBlockRange,
      handleBlockDelete,
      clearBlockSelection,
      cursor,
      hasSelection,
      getInlineBlockEndingBefore,
      getInlineBlockStartingAfter,
      flushSave,
      updateDocument,
      onOpenFind,
      onOpenReplace,
    ]
  );

  const handlePasteEvent = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      if (text) {
        handlePaste(text);
      }
    },
    [handlePaste]
  );

  const handleCopyEvent = useCallback(
    (e: React.ClipboardEvent) => {
      const text = handleCopy();
      if (text) {
        e.preventDefault();
        e.clipboardData.setData("text/plain", text);
      }
    },
    [handleCopy]
  );

  return {
    handleKeyDown,
    handlePasteEvent,
    handleCopyEvent,
  };
}
