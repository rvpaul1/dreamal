import { getSelectionBounds, posBefore, type CursorPosition } from "./useEditorState";

interface RenderedLineProps {
  lineText: string;
  lineIndex: number;
  cursor: CursorPosition;
  selectionAnchor: CursorPosition | null;
  hasSelection: boolean;
  cursorVisible: boolean;
  headingInfo: { level: number; prefixLength: number } | null;
}

export function RenderedLine({
  lineText,
  lineIndex,
  cursor,
  selectionAnchor,
  hasSelection,
  cursorVisible,
  headingInfo,
}: RenderedLineProps) {
  const isCursorLine = lineIndex === cursor.line;
  const cursorInPrefix = isCursorLine && headingInfo && cursor.col < headingInfo.prefixLength;
  const hidePrefix = headingInfo && !isCursorLine && !hasSelection;
  const prefixLen = hidePrefix ? headingInfo.prefixLength : 0;
  const displayText = hidePrefix ? lineText.slice(prefixLen) : lineText;

  if (!hasSelection) {
    if (isCursorLine) {
      const adjustedCol = cursorInPrefix ? cursor.col : cursor.col - prefixLen;
      return (
        <>
          <span>{displayText.slice(0, adjustedCol)}</span>
          <span className={`cursor ${cursorVisible ? "visible" : ""}`} />
          <span>{displayText.slice(adjustedCol)}</span>
        </>
      );
    }
    return <span>{displayText || "\u200B"}</span>;
  }

  const { start, end } = getSelectionBounds(selectionAnchor!, cursor);
  const isInSelection = lineIndex >= start.line && lineIndex <= end.line;

  if (!isInSelection) {
    return <span>{displayText || "\u200B"}</span>;
  }

  const selStart = lineIndex === start.line ? start.col : 0;
  const selEnd = lineIndex === end.line ? end.col : lineText.length;

  const beforeSel = lineText.slice(0, selStart);
  const selected = lineText.slice(selStart, selEnd);
  const afterSel = lineText.slice(selEnd);

  const cursorAtStart =
    isCursorLine && cursor.col === selStart && posBefore(cursor, selectionAnchor!);
  const cursorAtEnd =
    isCursorLine && cursor.col === selEnd && posBefore(selectionAnchor!, cursor);

  const showLineEndSelection = lineIndex !== end.line;

  return (
    <>
      <span>{beforeSel}</span>
      {cursorAtStart && (
        <span className={`cursor ${cursorVisible ? "visible" : ""}`} />
      )}
      <span className="selection">
        {selected}
        {showLineEndSelection && <span className="selection-line-end" />}
      </span>
      {cursorAtEnd && (
        <span className={`cursor ${cursorVisible ? "visible" : ""}`} />
      )}
      <span>{afterSel}</span>
      {lineText.length === 0 && !showLineEndSelection && <span>{"\u200B"}</span>}
    </>
  );
}
