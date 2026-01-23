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

export { posEqual, posBefore, getSelectionBounds } from "./editorActions";
export type { CursorPosition, EditorState } from "./editorActions";

export function useEditorState() {
  const [state, setState] = useState<EditorState>(createInitialState);

  const hasSelection = checkHasSelection(state);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }

    const isShift = e.shiftKey;

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        setState((s) => moveCursorLeft(s, isShift));
        break;
      case "ArrowRight":
        e.preventDefault();
        setState((s) => moveCursorRight(s, isShift));
        break;
      case "ArrowUp":
        e.preventDefault();
        setState((s) => moveCursorUp(s, isShift));
        break;
      case "ArrowDown":
        e.preventDefault();
        setState((s) => moveCursorDown(s, isShift));
        break;
      case "Backspace":
        e.preventDefault();
        setState(backspace);
        break;
      case "Delete":
        e.preventDefault();
        setState(deleteForward);
        break;
      case "Tab":
        e.preventDefault();
        setState(insertTab);
        break;
      case "Enter":
        e.preventDefault();
        setState(insertNewline);
        break;
      case "Shift":
        break;
      default:
        if (e.key.length === 1) {
          e.preventDefault();
          setState((s) => insertCharacter(s, e.key));
        }
        break;
    }
  }, []);

  return {
    lines: state.lines,
    cursor: state.cursor,
    selectionAnchor: state.selectionAnchor,
    hasSelection,
    handleKeyDown,
  };
}
