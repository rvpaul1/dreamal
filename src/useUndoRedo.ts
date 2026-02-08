import { useCallback, useRef } from "react";
import type { EditorState } from "./editorActions";

const MAX_HISTORY = 500;

function statesEqual(a: EditorState, b: EditorState): boolean {
  if (a === b) return true;
  if (a.lines.length !== b.lines.length) return false;
  for (let i = 0; i < a.lines.length; i++) {
    if (a.lines[i] !== b.lines[i]) return false;
  }
  return true;
}

export function useUndoRedo() {
  const undoStack = useRef<EditorState[]>([]);
  const redoStack = useRef<EditorState[]>([]);
  const lastPushedState = useRef<EditorState | null>(null);

  const pushState = useCallback((state: EditorState) => {
    if (lastPushedState.current && statesEqual(lastPushedState.current, state)) {
      return;
    }
    undoStack.current.push(state);
    if (undoStack.current.length > MAX_HISTORY) {
      undoStack.current.shift();
    }
    redoStack.current = [];
    lastPushedState.current = state;
  }, []);

  const undo = useCallback((currentState: EditorState): EditorState | null => {
    if (undoStack.current.length === 0) return null;
    const previous = undoStack.current.pop()!;
    redoStack.current.push(currentState);
    lastPushedState.current = previous;
    return previous;
  }, []);

  const redo = useCallback((currentState: EditorState): EditorState | null => {
    if (redoStack.current.length === 0) return null;
    const next = redoStack.current.pop()!;
    undoStack.current.push(currentState);
    lastPushedState.current = next;
    return next;
  }, []);

  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    lastPushedState.current = null;
  }, []);

  return { pushState, undo, redo, clear };
}
