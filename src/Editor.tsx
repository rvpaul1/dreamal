import { useState, useEffect, useRef, useCallback } from "react";

interface CursorPosition {
  line: number;
  col: number;
}

function posEqual(a: CursorPosition, b: CursorPosition): boolean {
  return a.line === b.line && a.col === b.col;
}

function posBefore(a: CursorPosition, b: CursorPosition): boolean {
  return a.line < b.line || (a.line === b.line && a.col < b.col);
}

function getSelectionBounds(
  anchor: CursorPosition,
  focus: CursorPosition
): { start: CursorPosition; end: CursorPosition } {
  if (posBefore(anchor, focus)) {
    return { start: anchor, end: focus };
  }
  return { start: focus, end: anchor };
}

function Editor() {
  const [lines, setLines] = useState<string[]>([""]);
  const [cursor, setCursor] = useState<CursorPosition>({ line: 0, col: 0 });
  const [selectionAnchor, setSelectionAnchor] = useState<CursorPosition | null>(null);
  const [cursorVisible, setCursorVisible] = useState(true);
  const editorRef = useRef<HTMLDivElement>(null);

  const hasSelection = selectionAnchor !== null && !posEqual(selectionAnchor, cursor);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCursorVisible(true);
  }, [cursor, lines]);

  useEffect(() => {
    editorRef.current?.focus();
  }, []);

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const isShift = e.shiftKey;
      const { line, col } = cursor;
      const currentLine = lines[line];

      if (e.key === "ArrowLeft") {
        e.preventDefault();
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
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
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
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
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
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
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
        return;
      }

      if (e.key === "Shift") {
        return;
      }

      e.preventDefault();

      if (e.key === "Backspace") {
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
        return;
      }

      if (e.key === "Delete") {
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
        return;
      }

      if (e.key === "Tab") {
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
        return;
      }

      if (e.key === "Enter") {
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
        return;
      }

      if (e.key.length === 1) {
        let newLines: string[];
        let newCursor: CursorPosition;
        if (hasSelection) {
          ({ newLines, newCursor } = deleteSelection());
        } else {
          newLines = [...lines];
          newCursor = cursor;
        }
        const targetLine = newLines[newCursor.line];
        newLines[newCursor.line] = targetLine.slice(0, newCursor.col) + e.key + targetLine.slice(newCursor.col);
        setLines(newLines);
        setCursor({ line: newCursor.line, col: newCursor.col + 1 });
        setSelectionAnchor(null);
      }
    },
    [cursor, lines, selectionAnchor, hasSelection, deleteSelection]
  );

  const renderLine = (lineText: string, lineIndex: number) => {
    const isCursorLine = lineIndex === cursor.line;

    if (!hasSelection) {
      if (isCursorLine) {
        return (
          <>
            <span>{lineText.slice(0, cursor.col)}</span>
            <span className={`cursor ${cursorVisible ? "visible" : ""}`} />
            <span>{lineText.slice(cursor.col)}</span>
          </>
        );
      }
      return <span>{lineText || "\u200B"}</span>;
    }

    const { start, end } = getSelectionBounds(selectionAnchor!, cursor);
    const isInSelection = lineIndex >= start.line && lineIndex <= end.line;

    if (!isInSelection) {
      return <span>{lineText || "\u200B"}</span>;
    }

    const selStart = lineIndex === start.line ? start.col : 0;
    const selEnd = lineIndex === end.line ? end.col : lineText.length;

    const beforeSel = lineText.slice(0, selStart);
    const selected = lineText.slice(selStart, selEnd);
    const afterSel = lineText.slice(selEnd);

    const cursorAtStart = isCursorLine && cursor.col === selStart && posBefore(cursor, selectionAnchor!);
    const cursorAtEnd = isCursorLine && cursor.col === selEnd && posBefore(selectionAnchor!, cursor);

    return (
      <>
        <span>{beforeSel}</span>
        {cursorAtStart && <span className={`cursor ${cursorVisible ? "visible" : ""}`} />}
        <span className="selection">{selected || (lineIndex !== end.line ? "\n" : "")}</span>
        {cursorAtEnd && <span className={`cursor ${cursorVisible ? "visible" : ""}`} />}
        <span>{afterSel}</span>
        {!cursorAtStart && !cursorAtEnd && lineText.length === 0 && <span>{"\u200B"}</span>}
      </>
    );
  };

  return (
    <div
      ref={editorRef}
      className="editor"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="editor-content">
        {lines.map((lineText, lineIndex) => (
          <div key={lineIndex} className="editor-line">
            {renderLine(lineText, lineIndex)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Editor;
