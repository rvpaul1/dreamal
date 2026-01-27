import { useState, useCallback } from "react";
import {
  type EditorState,
  type CursorPosition,
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
  insertText,
  createInitialState,
  swapLineUp,
  swapLineDown,
  setCursor,
  setCursorWithAnchor,
  insertCharacterWithBulletCheck,
  insertNewlineWithBullet,
  indentBullet,
  outdentBullet,
  isBulletLine,
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
          if (isShift) {
            updateEditor((s) => {
              if (isBulletLine(s.lines[s.cursor.line])) {
                return outdentBullet(s);
              }
              return s;
            });
          } else {
            updateEditor((s) => {
              if (isBulletLine(s.lines[s.cursor.line])) {
                return indentBullet(s);
              }
              return insertTab(s);
            });
          }
          break;
        case "Enter":
          e.preventDefault();
          updateEditor(insertNewlineWithBullet);
          break;
        case "Shift":
          break;
        default:
          if (e.key.length === 1) {
            e.preventDefault();
            updateEditor((s) => insertCharacterWithBulletCheck(s, e.key));
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

  const handleClickAt = useCallback(
    (pos: CursorPosition) => {
      updateEditor((s) => setCursor(s, pos));
    },
    [updateEditor]
  );

  const handleDragTo = useCallback(
    (pos: CursorPosition, anchor: CursorPosition) => {
      updateEditor((s) => setCursorWithAnchor(s, pos, anchor));
    },
    [updateEditor]
  );

  const handlePaste = useCallback(
    (text: string) => {
      updateEditor((s) => insertText(s, text));
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
    handleClickAt,
    handleDragTo,
    handlePaste,
    updateDocument,
    updateMetadata,
    applyMacro,
  };
}
