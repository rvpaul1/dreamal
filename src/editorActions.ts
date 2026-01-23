export interface CursorPosition {
  line: number;
  col: number;
}

export interface EditorState {
  lines: string[];
  cursor: CursorPosition;
  selectionAnchor: CursorPosition | null;
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

export function hasSelection(state: EditorState): boolean {
  return state.selectionAnchor !== null && !posEqual(state.selectionAnchor, state.cursor);
}

export function deleteSelection(state: EditorState): EditorState {
  if (!state.selectionAnchor) {
    return state;
  }
  const { start, end } = getSelectionBounds(state.selectionAnchor, state.cursor);
  const newLines = [...state.lines];
  const before = newLines[start.line].slice(0, start.col);
  const after = newLines[end.line].slice(end.col);
  newLines[start.line] = before + after;
  newLines.splice(start.line + 1, end.line - start.line);
  return {
    lines: newLines,
    cursor: start,
    selectionAnchor: null,
  };
}

export function moveCursorLeft(state: EditorState, isShift: boolean): EditorState {
  const { line, col } = state.cursor;
  let newPos: CursorPosition;

  if (col > 0) {
    newPos = { line, col: col - 1 };
  } else if (line > 0) {
    newPos = { line: line - 1, col: state.lines[line - 1].length };
  } else {
    newPos = state.cursor;
  }

  if (isShift) {
    return {
      ...state,
      cursor: newPos,
      selectionAnchor: state.selectionAnchor ?? state.cursor,
    };
  }

  if (hasSelection(state)) {
    const { start } = getSelectionBounds(state.selectionAnchor!, state.cursor);
    newPos = start;
  }

  return {
    ...state,
    cursor: newPos,
    selectionAnchor: null,
  };
}

export function moveCursorRight(state: EditorState, isShift: boolean): EditorState {
  const { line, col } = state.cursor;
  const currentLine = state.lines[line];
  let newPos: CursorPosition;

  if (col < currentLine.length) {
    newPos = { line, col: col + 1 };
  } else if (line < state.lines.length - 1) {
    newPos = { line: line + 1, col: 0 };
  } else {
    newPos = state.cursor;
  }

  if (isShift) {
    return {
      ...state,
      cursor: newPos,
      selectionAnchor: state.selectionAnchor ?? state.cursor,
    };
  }

  if (hasSelection(state)) {
    const { end } = getSelectionBounds(state.selectionAnchor!, state.cursor);
    newPos = end;
  }

  return {
    ...state,
    cursor: newPos,
    selectionAnchor: null,
  };
}

export function moveCursorUp(state: EditorState, isShift: boolean): EditorState {
  const { line, col } = state.cursor;
  let newPos: CursorPosition;

  if (line > 0) {
    const newCol = Math.min(col, state.lines[line - 1].length);
    newPos = { line: line - 1, col: newCol };
  } else {
    newPos = { line: 0, col: 0 };
  }

  if (isShift) {
    return {
      ...state,
      cursor: newPos,
      selectionAnchor: state.selectionAnchor ?? state.cursor,
    };
  }

  return {
    ...state,
    cursor: newPos,
    selectionAnchor: null,
  };
}

export function moveCursorDown(state: EditorState, isShift: boolean): EditorState {
  const { line, col } = state.cursor;
  const currentLine = state.lines[line];
  let newPos: CursorPosition;

  if (line < state.lines.length - 1) {
    const newCol = Math.min(col, state.lines[line + 1].length);
    newPos = { line: line + 1, col: newCol };
  } else {
    newPos = { line, col: currentLine.length };
  }

  if (isShift) {
    return {
      ...state,
      cursor: newPos,
      selectionAnchor: state.selectionAnchor ?? state.cursor,
    };
  }

  return {
    ...state,
    cursor: newPos,
    selectionAnchor: null,
  };
}

export function backspace(state: EditorState): EditorState {
  if (hasSelection(state)) {
    return deleteSelection(state);
  }

  const { line, col } = state.cursor;
  const currentLine = state.lines[line];

  if (col > 0) {
    const newLine = currentLine.slice(0, col - 1) + currentLine.slice(col);
    const newLines = [...state.lines];
    newLines[line] = newLine;
    return {
      lines: newLines,
      cursor: { line, col: col - 1 },
      selectionAnchor: null,
    };
  }

  if (line > 0) {
    const prevLine = state.lines[line - 1];
    const newCol = prevLine.length;
    const newLines = [...state.lines];
    newLines[line - 1] = prevLine + currentLine;
    newLines.splice(line, 1);
    return {
      lines: newLines,
      cursor: { line: line - 1, col: newCol },
      selectionAnchor: null,
    };
  }

  return state;
}

export function deleteForward(state: EditorState): EditorState {
  if (hasSelection(state)) {
    return deleteSelection(state);
  }

  const { line, col } = state.cursor;
  const currentLine = state.lines[line];

  if (col < currentLine.length) {
    const newLine = currentLine.slice(0, col) + currentLine.slice(col + 1);
    const newLines = [...state.lines];
    newLines[line] = newLine;
    return {
      ...state,
      lines: newLines,
    };
  }

  if (line < state.lines.length - 1) {
    const newLines = [...state.lines];
    newLines[line] = currentLine + state.lines[line + 1];
    newLines.splice(line + 1, 1);
    return {
      ...state,
      lines: newLines,
    };
  }

  return state;
}

export function insertTab(state: EditorState): EditorState {
  let workingState = state;
  if (hasSelection(state)) {
    workingState = deleteSelection(state);
  }

  const { line, col } = workingState.cursor;
  const targetLine = workingState.lines[line];
  const newLines = [...workingState.lines];
  newLines[line] = targetLine.slice(0, col) + "\t" + targetLine.slice(col);

  return {
    lines: newLines,
    cursor: { line, col: col + 1 },
    selectionAnchor: null,
  };
}

export function insertNewline(state: EditorState): EditorState {
  let workingState = state;
  if (hasSelection(state)) {
    workingState = deleteSelection(state);
  }

  const { line, col } = workingState.cursor;
  const targetLine = workingState.lines[line];
  const before = targetLine.slice(0, col);
  const after = targetLine.slice(col);
  const newLines = [...workingState.lines];
  newLines[line] = before;
  newLines.splice(line + 1, 0, after);

  return {
    lines: newLines,
    cursor: { line: line + 1, col: 0 },
    selectionAnchor: null,
  };
}

export function insertCharacter(state: EditorState, char: string): EditorState {
  let workingState = state;
  if (hasSelection(state)) {
    workingState = deleteSelection(state);
  }

  const { line, col } = workingState.cursor;
  const targetLine = workingState.lines[line];
  const newLines = [...workingState.lines];
  newLines[line] = targetLine.slice(0, col) + char + targetLine.slice(col);

  return {
    lines: newLines,
    cursor: { line, col: col + 1 },
    selectionAnchor: null,
  };
}

export function createInitialState(): EditorState {
  return {
    lines: [""],
    cursor: { line: 0, col: 0 },
    selectionAnchor: null,
  };
}
