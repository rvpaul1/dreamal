import { useState, useCallback } from "react";
import {
  type EditorState,
  hasSelection as checkHasSelection,
  moveCursorLeft,
  moveCursorRight,
  moveCursorUp,
  moveCursorDown,
  backspace,
  deleteForward,
  insertTab,
  insertNewline,
  insertCharacter,
  createInitialState,
} from "./editorActions";
import { type Document, createDocument } from "./documentModel";
import { expandMacro } from "./macros";

export { posEqual, posBefore, getSelectionBounds } from "./editorActions";
export type { CursorPosition, EditorState } from "./editorActions";
export type { Document, DocumentMetadata } from "./documentModel";

function tryExpandMacro(state: EditorState): EditorState {
  const result = expandMacro(state.lines, state.cursor.line, state.cursor.col);
  if (result) {
    return {
      ...state,
      lines: result.lines,
      cursor: { line: state.cursor.line, col: result.newCol },
    };
  }
  return state;
}

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
      if (e.metaKey || e.ctrlKey || e.altKey) {
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
          updateEditor((s) => {
            const expanded = tryExpandMacro(s);
            if (expanded !== s) {
              return expanded;
            }
            return insertTab(s);
          });
          break;
        case "Enter":
          e.preventDefault();
          updateEditor((s) => {
            const expanded = tryExpandMacro(s);
            if (expanded !== s) {
              return expanded;
            }
            return insertNewline(s);
          });
          break;
        case "Shift":
          break;
        default:
          if (e.key === " ") {
            e.preventDefault();
            updateEditor((s) => {
              const expanded = tryExpandMacro(s);
              if (expanded !== s) {
                return insertCharacter(expanded, " ");
              }
              return insertCharacter(s, " ");
            });
          } else if (e.key.length === 1) {
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

  return {
    document,
    lines: document.editor.lines,
    cursor: document.editor.cursor,
    selectionAnchor: document.editor.selectionAnchor,
    hasSelection,
    handleKeyDown,
    updateDocument,
  };
}
