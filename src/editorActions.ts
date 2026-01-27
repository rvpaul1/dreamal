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

export function getSelectedText(state: EditorState): string {
  if (!hasSelection(state) || !state.selectionAnchor) {
    return "";
  }
  const { start, end } = getSelectionBounds(state.selectionAnchor, state.cursor);

  if (start.line === end.line) {
    return state.lines[start.line].slice(start.col, end.col);
  }

  const lines: string[] = [];
  lines.push(state.lines[start.line].slice(start.col));
  for (let i = start.line + 1; i < end.line; i++) {
    lines.push(state.lines[i]);
  }
  lines.push(state.lines[end.line].slice(0, end.col));
  return lines.join("\n");
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

export function insertText(state: EditorState, text: string): EditorState {
  let workingState = state;
  if (hasSelection(state)) {
    workingState = deleteSelection(state);
  }

  const { line, col } = workingState.cursor;
  const currentLine = workingState.lines[line];
  const before = currentLine.slice(0, col);
  const after = currentLine.slice(col);

  const textLines = text.split("\n");

  if (textLines.length === 1) {
    const newLines = [...workingState.lines];
    newLines[line] = before + text + after;
    return {
      lines: newLines,
      cursor: { line, col: col + text.length },
      selectionAnchor: null,
    };
  }

  const newLines = [...workingState.lines];
  newLines[line] = before + textLines[0];

  const middleLines = textLines.slice(1, -1);
  const lastTextLine = textLines[textLines.length - 1];

  newLines.splice(line + 1, 0, ...middleLines, lastTextLine + after);

  return {
    lines: newLines,
    cursor: { line: line + textLines.length - 1, col: lastTextLine.length },
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

export function swapLineUp(state: EditorState): EditorState {
  const { line, col } = state.cursor;

  if (line === 0) {
    return state;
  }

  const newLines = [...state.lines];
  [newLines[line - 1], newLines[line]] = [newLines[line], newLines[line - 1]];

  const newCol = Math.min(col, newLines[line - 1].length);

  return {
    lines: newLines,
    cursor: { line: line - 1, col: newCol },
    selectionAnchor: null,
  };
}

export function swapLineDown(state: EditorState): EditorState {
  const { line, col } = state.cursor;

  if (line >= state.lines.length - 1) {
    return state;
  }

  const newLines = [...state.lines];
  [newLines[line], newLines[line + 1]] = [newLines[line + 1], newLines[line]];

  const newCol = Math.min(col, newLines[line + 1].length);

  return {
    lines: newLines,
    cursor: { line: line + 1, col: newCol },
    selectionAnchor: null,
  };
}

export function moveCursorToLineStart(state: EditorState, isShift: boolean): EditorState {
  const newPos: CursorPosition = { line: state.cursor.line, col: 0 };

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

export function moveCursorToLineEnd(state: EditorState, isShift: boolean): EditorState {
  const { line } = state.cursor;
  const newPos: CursorPosition = { line, col: state.lines[line].length };

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

export function moveCursorToDocStart(state: EditorState, isShift: boolean): EditorState {
  const { col } = state.cursor;
  const newCol = Math.min(col, state.lines[0].length);
  const newPos: CursorPosition = { line: 0, col: newCol };

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

export function moveCursorToDocEnd(state: EditorState, isShift: boolean): EditorState {
  const { col } = state.cursor;
  const lastLine = state.lines.length - 1;
  const newCol = Math.min(col, state.lines[lastLine].length);
  const newPos: CursorPosition = { line: lastLine, col: newCol };

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

export function setCursor(state: EditorState, pos: CursorPosition): EditorState {
  const line = Math.max(0, Math.min(pos.line, state.lines.length - 1));
  const col = Math.max(0, Math.min(pos.col, state.lines[line].length));
  return {
    ...state,
    cursor: { line, col },
    selectionAnchor: null,
  };
}

export function setCursorWithAnchor(
  state: EditorState,
  cursorPos: CursorPosition,
  anchorPos: CursorPosition
): EditorState {
  const cursorLine = Math.max(0, Math.min(cursorPos.line, state.lines.length - 1));
  const cursorCol = Math.max(0, Math.min(cursorPos.col, state.lines[cursorLine].length));
  const anchorLine = Math.max(0, Math.min(anchorPos.line, state.lines.length - 1));
  const anchorCol = Math.max(0, Math.min(anchorPos.col, state.lines[anchorLine].length));
  return {
    ...state,
    cursor: { line: cursorLine, col: cursorCol },
    selectionAnchor: { line: anchorLine, col: anchorCol },
  };
}

const BULLET_REGEX = /^(\t+)- /;
const MAX_BULLET_INDENT = 5;

export function getBulletInfo(line: string): { indentLevel: number; prefixLength: number } | null {
  const match = line.match(BULLET_REGEX);
  if (match) {
    return {
      indentLevel: match[1].length,
      prefixLength: match[0].length,
    };
  }
  return null;
}

export function isBulletLine(line: string): boolean {
  return BULLET_REGEX.test(line);
}

export function insertCharacterWithBulletCheck(state: EditorState, char: string): EditorState {
  let workingState = state;
  if (hasSelection(state)) {
    workingState = deleteSelection(state);
  }

  const { line, col } = workingState.cursor;
  const currentLine = workingState.lines[line];

  if (char === " ") {
    const beforeCursor = currentLine.slice(0, col);
    const potentialBulletMatch = beforeCursor.match(/^(\t*)-$/);
    if (potentialBulletMatch) {
      const existingTabs = potentialBulletMatch[1].length;
      const indentLevel = Math.min(existingTabs + 1, MAX_BULLET_INDENT);
      const afterCursor = currentLine.slice(col);
      const newLineContent = "\t".repeat(indentLevel) + "- " + afterCursor;

      const newLines = [...workingState.lines];
      newLines[line] = newLineContent;

      return {
        lines: newLines,
        cursor: { line, col: indentLevel + 2 },
        selectionAnchor: null,
      };
    }
  }

  return insertCharacter(workingState, char);
}

export function insertNewlineWithBullet(state: EditorState): EditorState {
  let workingState = state;
  if (hasSelection(state)) {
    workingState = deleteSelection(state);
  }

  const { line, col } = workingState.cursor;
  const currentLine = workingState.lines[line];
  const bulletInfo = getBulletInfo(currentLine);

  if (!bulletInfo) {
    return insertNewline(workingState);
  }

  const contentAfterPrefix = currentLine.slice(bulletInfo.prefixLength);
  if (contentAfterPrefix.trim() === "" && col <= bulletInfo.prefixLength) {
    const newLines = [...workingState.lines];
    newLines[line] = "";
    return {
      lines: newLines,
      cursor: { line, col: 0 },
      selectionAnchor: null,
    };
  }

  const before = currentLine.slice(0, col);
  const after = currentLine.slice(col);
  const bulletPrefix = "\t".repeat(bulletInfo.indentLevel) + "- ";

  const newLines = [...workingState.lines];
  newLines[line] = before;
  newLines.splice(line + 1, 0, bulletPrefix + after);

  return {
    lines: newLines,
    cursor: { line: line + 1, col: bulletPrefix.length },
    selectionAnchor: null,
  };
}

export function indentBullet(state: EditorState): EditorState {
  const { line, col } = state.cursor;
  const currentLine = state.lines[line];
  const bulletInfo = getBulletInfo(currentLine);

  if (!bulletInfo || bulletInfo.indentLevel >= MAX_BULLET_INDENT) {
    return insertTab(state);
  }

  const newLines = [...state.lines];
  newLines[line] = "\t" + currentLine;

  return {
    lines: newLines,
    cursor: { line, col: col + 1 },
    selectionAnchor: null,
  };
}

export function outdentBullet(state: EditorState): EditorState {
  const { line, col } = state.cursor;
  const currentLine = state.lines[line];
  const bulletInfo = getBulletInfo(currentLine);

  if (!bulletInfo || bulletInfo.indentLevel <= 1) {
    return state;
  }

  const newLines = [...state.lines];
  newLines[line] = currentLine.slice(1);

  return {
    lines: newLines,
    cursor: { line, col: Math.max(0, col - 1) },
    selectionAnchor: null,
  };
}
