import { useState, useCallback } from "react";

export interface CursorPosition {
  line: number;
  col: number;
}

export function posEqual(a: CursorPosition, b: CursorPosition): boolean {
  return a.line === b.line && a.col === b.col;
}

export function posBefore(a: CursorPosition, b: CursorPosition): boolean {
  return a.line < b.line || (a.line === b.line && a.col < b.col);
}

export function getSelectionBounds(
  anchor: CursorPosition,
  focus: CursorPosition
): { start: CursorPosition; end: CursorPosition } {
  if (posBefore(anchor, focus)) {
    return { start: anchor, end: focus };
  }
  return { start: focus, end: anchor };
}

export interface EditorState {
  lines: string[];
  cursor: CursorPosition;
  selectionAnchor: CursorPosition | null;
  hasSelection: boolean;
}

export function useEditorState() {
  const [lines, setLines] = useState<string[]>([""]);
  const [cursor, setCursor] = useState<CursorPosition>({ line: 0, col: 0 });
  const [selectionAnchor, setSelectionAnchor] = useState<CursorPosition | null>(null);

  const hasSelection = selectionAnchor !== null && !posEqual(selectionAnchor, cursor);

  const deleteSelection = useCallback((): { newLines: string[]; newCursor: CursorPosition } => {
    if (!selectionAnchor) {
      return { newLines: [...lines], newCursor: cursor };
    }
    const { start, end } = getSelectionBounds(selectionAnchor, cursor);
    const newLines = [...lines];
    const before = newLines[start.line].slice(0, start.col);
    const after = newLines[end.line].slice(end.col);
    newLines[start.line] = before + after;
    newLines.splice(start.line + 1, end.line - start.line);
    return { newLines, newCursor: start };
  }, [lines, cursor, selectionAnchor]);

  const handleArrowLeft = useCallback((isShift: boolean) => {
    const { line, col } = cursor;
    let newPos: CursorPosition;
    if (col > 0) {
      newPos = { line, col: col - 1 };
    } else if (line > 0) {
      newPos = { line: line - 1, col: lines[line - 1].length };
    } else {
      newPos = cursor;
    }
    if (isShift) {
      if (!selectionAnchor) setSelectionAnchor(cursor);
    } else {
      if (hasSelection) {
        const { start } = getSelectionBounds(selectionAnchor!, cursor);
        newPos = start;
      }
      setSelectionAnchor(null);
    }
    setCursor(newPos);
  }, [cursor, lines, selectionAnchor, hasSelection]);

  const handleArrowRight = useCallback((isShift: boolean) => {
    const { line, col } = cursor;
    const currentLine = lines[line];
    let newPos: CursorPosition;
    if (col < currentLine.length) {
      newPos = { line, col: col + 1 };
    } else if (line < lines.length - 1) {
      newPos = { line: line + 1, col: 0 };
    } else {
      newPos = cursor;
    }
    if (isShift) {
      if (!selectionAnchor) setSelectionAnchor(cursor);
    } else {
      if (hasSelection) {
        const { end } = getSelectionBounds(selectionAnchor!, cursor);
        newPos = end;
      }
      setSelectionAnchor(null);
    }
    setCursor(newPos);
  }, [cursor, lines, selectionAnchor, hasSelection]);

  const handleArrowUp = useCallback((isShift: boolean) => {
    const { line, col } = cursor;
    let newPos: CursorPosition;
    if (line > 0) {
      const newCol = Math.min(col, lines[line - 1].length);
      newPos = { line: line - 1, col: newCol };
    } else {
      newPos = { line: 0, col: 0 };
    }
    if (isShift) {
      if (!selectionAnchor) setSelectionAnchor(cursor);
    } else {
      setSelectionAnchor(null);
    }
    setCursor(newPos);
  }, [cursor, lines, selectionAnchor]);

  const handleArrowDown = useCallback((isShift: boolean) => {
    const { line, col } = cursor;
    const currentLine = lines[line];
    let newPos: CursorPosition;
    if (line < lines.length - 1) {
      const newCol = Math.min(col, lines[line + 1].length);
      newPos = { line: line + 1, col: newCol };
    } else {
      newPos = { line, col: currentLine.length };
    }
    if (isShift) {
      if (!selectionAnchor) setSelectionAnchor(cursor);
    } else {
      setSelectionAnchor(null);
    }
    setCursor(newPos);
  }, [cursor, lines, selectionAnchor]);

  const handleBackspace = useCallback(() => {
    const { line, col } = cursor;
    const currentLine = lines[line];
    if (hasSelection) {
      const { newLines, newCursor } = deleteSelection();
      setLines(newLines);
      setCursor(newCursor);
      setSelectionAnchor(null);
    } else if (col > 0) {
      const newLine = currentLine.slice(0, col - 1) + currentLine.slice(col);
      const newLines = [...lines];
      newLines[line] = newLine;
      setLines(newLines);
      setCursor({ line, col: col - 1 });
    } else if (line > 0) {
      const prevLine = lines[line - 1];
      const newCol = prevLine.length;
      const newLines = [...lines];
      newLines[line - 1] = prevLine + currentLine;
      newLines.splice(line, 1);
      setLines(newLines);
      setCursor({ line: line - 1, col: newCol });
    }
  }, [cursor, lines, hasSelection, deleteSelection]);

  const handleDelete = useCallback(() => {
    const { line, col } = cursor;
    const currentLine = lines[line];
    if (hasSelection) {
      const { newLines, newCursor } = deleteSelection();
      setLines(newLines);
      setCursor(newCursor);
      setSelectionAnchor(null);
    } else if (col < currentLine.length) {
      const newLine = currentLine.slice(0, col) + currentLine.slice(col + 1);
      const newLines = [...lines];
      newLines[line] = newLine;
      setLines(newLines);
    } else if (line < lines.length - 1) {
      const newLines = [...lines];
      newLines[line] = currentLine + lines[line + 1];
      newLines.splice(line + 1, 1);
      setLines(newLines);
    }
  }, [cursor, lines, hasSelection, deleteSelection]);

  const handleTab = useCallback(() => {
    let newLines: string[];
    let newCursor: CursorPosition;
    if (hasSelection) {
      ({ newLines, newCursor } = deleteSelection());
    } else {
      newLines = [...lines];
      newCursor = cursor;
    }
    const targetLine = newLines[newCursor.line];
    newLines[newCursor.line] = targetLine.slice(0, newCursor.col) + "\t" + targetLine.slice(newCursor.col);
    setLines(newLines);
    setCursor({ line: newCursor.line, col: newCursor.col + 1 });
    setSelectionAnchor(null);
  }, [cursor, lines, hasSelection, deleteSelection]);

  const handleEnter = useCallback(() => {
    let newLines: string[];
    let newCursor: CursorPosition;
    if (hasSelection) {
      ({ newLines, newCursor } = deleteSelection());
    } else {
      newLines = [...lines];
      newCursor = cursor;
    }
    const targetLine = newLines[newCursor.line];
    const before = targetLine.slice(0, newCursor.col);
    const after = targetLine.slice(newCursor.col);
    newLines[newCursor.line] = before;
    newLines.splice(newCursor.line + 1, 0, after);
    setLines(newLines);
    setCursor({ line: newCursor.line + 1, col: 0 });
    setSelectionAnchor(null);
  }, [cursor, lines, hasSelection, deleteSelection]);

  const handleCharacter = useCallback((char: string) => {
    let newLines: string[];
    let newCursor: CursorPosition;
    if (hasSelection) {
      ({ newLines, newCursor } = deleteSelection());
    } else {
      newLines = [...lines];
      newCursor = cursor;
    }
    const targetLine = newLines[newCursor.line];
    newLines[newCursor.line] = targetLine.slice(0, newCursor.col) + char + targetLine.slice(newCursor.col);
    setLines(newLines);
    setCursor({ line: newCursor.line, col: newCursor.col + 1 });
    setSelectionAnchor(null);
  }, [cursor, lines, hasSelection, deleteSelection]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }

    const isShift = e.shiftKey;

    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        handleArrowLeft(isShift);
        break;
      case "ArrowRight":
        e.preventDefault();
        handleArrowRight(isShift);
        break;
      case "ArrowUp":
        e.preventDefault();
        handleArrowUp(isShift);
        break;
      case "ArrowDown":
        e.preventDefault();
        handleArrowDown(isShift);
        break;
      case "Backspace":
        e.preventDefault();
        handleBackspace();
        break;
      case "Delete":
        e.preventDefault();
        handleDelete();
        break;
      case "Tab":
        e.preventDefault();
        handleTab();
        break;
      case "Enter":
        e.preventDefault();
        handleEnter();
        break;
      case "Shift":
        break;
      default:
        if (e.key.length === 1) {
          e.preventDefault();
          handleCharacter(e.key);
        }
        break;
    }
  }, [handleArrowLeft, handleArrowRight, handleArrowUp, handleArrowDown, handleBackspace, handleDelete, handleTab, handleEnter, handleCharacter]);

  return {
    lines,
    cursor,
    selectionAnchor,
    hasSelection,
    handleKeyDown,
  };
}
