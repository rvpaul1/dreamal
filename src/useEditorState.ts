import { useState, useCallback } from "react";
import {
  type EditorState,
  hasSelection as checkHasSelection,
  moveCursorLeft,
  moveCursorRight,
  moveCursorUp,
  moveCursorDown,
  moveCursorToLineStart,
  moveCursorToLineEnd,
  moveCursorToDocStart,
  moveCursorToDocEnd,
  backspace,
  deleteForward,
  insertTab,
  insertNewline,
  insertCharacter,
  createInitialState,
  swapLineUp,
  swapLineDown,
} from "./editorActions";
import { type Document, createDocument } from "./documentModel";
import { type Macro } from "./macros";

export { posEqual, posBefore, getSelectionBounds } from "./editorActions";
export type { CursorPosition, EditorState } from "./editorActions";
export type { Document, DocumentMetadata } from "./documentModel";

export function useEditorState() {
  const [document, setDocument] = useState<Document>(() =>
    createDocument(createInitialState())
  );

  const hasSelection = checkHasSelection(document.editor);

  const updateEditor = useCallback(
    (updater: (state: EditorState) => EditorState) => {
      setDocument((doc) => ({
        ...doc,
        editor: updater(doc.editor),
      }));
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.altKey && !e.shiftKey && !e.metaKey) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          updateEditor(swapLineUp);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          updateEditor(swapLineDown);
          return;
        }
        return;
      }

      if (e.metaKey && !e.altKey && !e.ctrlKey) {
        const isShift = e.shiftKey;
        switch (e.key) {
          case "ArrowLeft":
            e.preventDefault();
            updateEditor((s) => moveCursorToLineStart(s, isShift));
            return;
          case "ArrowRight":
            e.preventDefault();
            updateEditor((s) => moveCursorToLineEnd(s, isShift));
            return;
          case "ArrowUp":
            e.preventDefault();
            updateEditor((s) => moveCursorToDocStart(s, isShift));
            return;
          case "ArrowDown":
            e.preventDefault();
            updateEditor((s) => moveCursorToDocEnd(s, isShift));
            return;
        }
        return;
      }

      if (e.ctrlKey || e.altKey) {
        return;
      }

      const isShift = e.shiftKey;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          updateEditor((s) => moveCursorLeft(s, isShift));
          break;
        case "ArrowRight":
          e.preventDefault();
          updateEditor((s) => moveCursorRight(s, isShift));
          break;
        case "ArrowUp":
          e.preventDefault();
          updateEditor((s) => moveCursorUp(s, isShift));
          break;
        case "ArrowDown":
          e.preventDefault();
          updateEditor((s) => moveCursorDown(s, isShift));
          break;
        case "Backspace":
          e.preventDefault();
          updateEditor(backspace);
          break;
        case "Delete":
          e.preventDefault();
          updateEditor(deleteForward);
          break;
        case "Tab":
          e.preventDefault();
          updateEditor(insertTab);
          break;
        case "Enter":
          e.preventDefault();
          updateEditor(insertNewline);
          break;
        case "Shift":
          break;
        default:
          if (e.key.length === 1) {
            e.preventDefault();
            updateEditor((s) => insertCharacter(s, e.key));
          }
          break;
      }
    },
    [updateEditor]
  );

  const updateDocument = useCallback((doc: Document) => {
    setDocument(doc);
  }, []);

  const updateMetadata = useCallback((metadata: Document["metadata"]) => {
    setDocument((doc) => ({ ...doc, metadata }));
  }, []);

  const applyMacro = useCallback(
    (macro: Macro, inputLength: number) => {
      updateEditor((state) => {
        const { line, col } = state.cursor;
        const currentLine = state.lines[line];
        const expanded = macro.expand();

        const beforeMacro = currentLine.slice(0, col - inputLength);
        const afterCursor = currentLine.slice(col);

        const newLines = [...state.lines];
        newLines[line] = beforeMacro + expanded + afterCursor;

        return {
          ...state,
          lines: newLines,
          cursor: { line, col: beforeMacro.length + expanded.length },
        };
      });
    },
    [updateEditor]
  );

  return {
    document,
    lines: document.editor.lines,
    cursor: document.editor.cursor,
    selectionAnchor: document.editor.selectionAnchor,
    hasSelection,
    handleKeyDown,
    updateDocument,
    updateMetadata,
    applyMacro,
  };
}
