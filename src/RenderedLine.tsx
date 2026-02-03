import { getSelectionBounds, posBefore, type CursorPosition } from "./useEditorState";
import { parseLineSegments, type LineSegment, type InlineJSXBlock } from "./jsxBlocks";
import { RenderComponent } from "./componentRegistry";
import type { ParsedComponent } from "./jsxBlocks";
import type { BulletInfo } from "./useMarkdown";

interface RenderedLineProps {
  lineText: string;
  lineIndex: number;
  cursor: CursorPosition;
  selectionAnchor: CursorPosition | null;
  hasSelection: boolean;
  cursorVisible: boolean;
  headingInfo: { level: number; prefixLength: number } | null;
  bulletInfo: BulletInfo | null;
  onBlockSelect?: (startCol: number, endCol: number) => void;
  selectedBlockRange?: { startCol: number; endCol: number } | null;
  onBlockStateChange?: (startCol: number, endCol: number, newComponent: ParsedComponent) => void;
  onBlockDelete?: (startCol: number, endCol: number) => void;
}

function getBulletChar(indentLevel: number): string {
  return indentLevel % 2 === 1 ? "●" : "○";
}

export function RenderedLine({
  lineText,
  lineIndex,
  cursor,
  selectionAnchor,
  hasSelection,
  cursorVisible,
  headingInfo,
  bulletInfo,
  onBlockSelect,
  selectedBlockRange,
  onBlockStateChange,
  onBlockDelete,
}: RenderedLineProps) {
  const isCursorLine = lineIndex === cursor.line;
  const cursorInHeadingPrefix = isCursorLine && headingInfo && cursor.col < headingInfo.prefixLength;
  const cursorInBulletPrefix = isCursorLine && bulletInfo && cursor.col < bulletInfo.prefixLength;
  const hideHeadingPrefix = headingInfo && !isCursorLine;
  const hideBulletPrefix = !!bulletInfo;

  let prefixLen = 0;
  let displayText = lineText;

  if (hideHeadingPrefix) {
    prefixLen = headingInfo.prefixLength;
    displayText = lineText.slice(prefixLen);
  } else if (hideBulletPrefix) {
    prefixLen = bulletInfo.prefixLength;
    displayText = lineText.slice(prefixLen);
  }

  const segments = parseLineSegments(displayText);
  const adjustedCursorCol = cursorInHeadingPrefix
    ? cursor.col
    : cursorInBulletPrefix
      ? 0
      : cursor.col - prefixLen;

  const rawSelectionInfo = hasSelection
    ? getSelectionInfo(lineIndex, lineText, selectionAnchor!, cursor)
    : null;

  const selectionInfo = rawSelectionInfo && prefixLen > 0
    ? {
        ...rawSelectionInfo,
        selStart: Math.max(rawSelectionInfo.selStart - prefixLen, 0),
        selEnd: Math.max(rawSelectionInfo.selEnd - prefixLen, 0),
      }
    : rawSelectionInfo;

  return (
    <>
      {hideBulletPrefix && (
        <span className={`bullet-marker bullet-level-${bulletInfo.indentLevel}`}>
          {getBulletChar(bulletInfo.indentLevel)}
        </span>
      )}
      <span className="line-text">
        {segments.map((segment, idx) => (
          <SegmentRenderer
            key={idx}
            segment={segment}
            lineIndex={lineIndex}
            isCursorLine={isCursorLine}
            cursorCol={adjustedCursorCol}
            cursorVisible={cursorVisible}
            selectionInfo={selectionInfo}
            onBlockSelect={onBlockSelect}
            selectedBlockRange={selectedBlockRange}
            onBlockStateChange={onBlockStateChange}
            onBlockDelete={onBlockDelete}
          />
        ))}
        {displayText.length === 0 && <span>{"\u200B"}</span>}
      </span>
    </>
  );
}

interface SelectionInfo {
  selStart: number;
  selEnd: number;
  cursorAtStart: boolean;
  cursorAtEnd: boolean;
  showLineEndSelection: boolean;
}

function getSelectionInfo(
  lineIndex: number,
  lineText: string,
  anchor: CursorPosition,
  cursor: CursorPosition
): SelectionInfo | null {
  const { start, end } = getSelectionBounds(anchor, cursor);
  const isInSelection = lineIndex >= start.line && lineIndex <= end.line;

  if (!isInSelection) {
    return null;
  }

  const selStart = lineIndex === start.line ? start.col : 0;
  const selEnd = lineIndex === end.line ? end.col : lineText.length;
  const isCursorLine = lineIndex === cursor.line;

  return {
    selStart,
    selEnd,
    cursorAtStart: isCursorLine && cursor.col === selStart && posBefore(cursor, anchor),
    cursorAtEnd: isCursorLine && cursor.col === selEnd && posBefore(anchor, cursor),
    showLineEndSelection: lineIndex !== end.line,
  };
}

interface SegmentRendererProps {
  segment: LineSegment;
  lineIndex: number;
  isCursorLine: boolean;
  cursorCol: number;
  cursorVisible: boolean;
  selectionInfo: SelectionInfo | null;
  onBlockSelect?: (startCol: number, endCol: number) => void;
  selectedBlockRange?: { startCol: number; endCol: number } | null;
  onBlockStateChange?: (startCol: number, endCol: number, newComponent: ParsedComponent) => void;
  onBlockDelete?: (startCol: number, endCol: number) => void;
}

function SegmentRenderer({
  segment,
  isCursorLine,
  cursorCol,
  cursorVisible,
  selectionInfo,
  onBlockSelect,
  selectedBlockRange,
  onBlockStateChange,
  onBlockDelete,
}: SegmentRendererProps) {
  if (segment.type === "jsx") {
    return (
      <InlineJSXBlockRenderer
        block={segment.block}
        startCol={segment.startCol}
        endCol={segment.endCol}
        isCursorLine={isCursorLine}
        cursorCol={cursorCol}
        cursorVisible={cursorVisible}
        onBlockSelect={onBlockSelect}
        selectedBlockRange={selectedBlockRange}
        onBlockStateChange={onBlockStateChange}
        onBlockDelete={onBlockDelete}
      />
    );
  }

  const { content, startCol, endCol } = segment;
  const cursorInSegment = isCursorLine && cursorCol >= startCol && cursorCol <= endCol;
  const relativeCursorCol = cursorCol - startCol;

  if (!selectionInfo) {
    if (cursorInSegment) {
      return (
        <>
          <span>{content.slice(0, relativeCursorCol)}</span>
          <span className={`cursor ${cursorVisible ? "visible" : ""}`} />
          <span>{content.slice(relativeCursorCol)}</span>
        </>
      );
    }
    return <span>{content}</span>;
  }

  const { selStart, selEnd, cursorAtStart, cursorAtEnd, showLineEndSelection } = selectionInfo;

  const segSelStart = Math.max(selStart - startCol, 0);
  const segSelEnd = Math.min(selEnd - startCol, content.length);
  const hasSelectionInSegment = segSelEnd > segSelStart && selStart < endCol && selEnd > startCol;

  if (!hasSelectionInSegment) {
    return <span>{content}</span>;
  }

  const beforeSel = content.slice(0, segSelStart);
  const selected = content.slice(segSelStart, segSelEnd);
  const afterSel = content.slice(segSelEnd);

  const showCursorAtStart = cursorAtStart && selStart >= startCol && selStart <= endCol;
  const showCursorAtEnd = cursorAtEnd && selEnd >= startCol && selEnd <= endCol;
  const isLastSegmentInLine = showLineEndSelection && segSelEnd === content.length;

  return (
    <>
      <span>{beforeSel}</span>
      {showCursorAtStart && (
        <span className={`cursor ${cursorVisible ? "visible" : ""}`} />
      )}
      <span className="selection">
        {selected}
        {isLastSegmentInLine && <span className="selection-line-end" />}
      </span>
      {showCursorAtEnd && (
        <span className={`cursor ${cursorVisible ? "visible" : ""}`} />
      )}
      <span>{afterSel}</span>
    </>
  );
}

interface InlineJSXBlockRendererProps {
  block: InlineJSXBlock;
  startCol: number;
  endCol: number;
  isCursorLine: boolean;
  cursorCol: number;
  cursorVisible: boolean;
  onBlockSelect?: (startCol: number, endCol: number) => void;
  selectedBlockRange?: { startCol: number; endCol: number } | null;
  onBlockStateChange?: (startCol: number, endCol: number, newComponent: ParsedComponent) => void;
  onBlockDelete?: (startCol: number, endCol: number) => void;
}

function InlineJSXBlockRenderer({
  block,
  startCol,
  endCol,
  isCursorLine,
  cursorCol,
  cursorVisible,
  onBlockSelect,
  selectedBlockRange,
  onBlockStateChange,
  onBlockDelete,
}: InlineJSXBlockRendererProps) {
  const isSelected =
    selectedBlockRange?.startCol === startCol && selectedBlockRange?.endCol === endCol;
  const showCursorAfter = isCursorLine && cursorCol === endCol;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBlockSelect?.(startCol, endCol);
  };

  const handleStateChange = (newProps: Record<string, unknown>) => {
    if (block.component) {
      const newComponent: ParsedComponent = {
        ...block.component,
        props: newProps,
      };
      onBlockStateChange?.(startCol, endCol, newComponent);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isSelected && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      e.stopPropagation();
      onBlockDelete?.(startCol, endCol);
    }
  };

  if (block.error || !block.component) {
    return (
      <>
        <span
          className={`jsx-block jsx-block-error ${isSelected ? "jsx-block-selected" : ""}`}
          onClick={handleClick}
        >
          [Error: {block.error || "Parse failed"}]
        </span>
        {showCursorAfter && (
          <span className={`cursor ${cursorVisible ? "visible" : ""}`} />
        )}
      </>
    );
  }

  return (
    <>
      <span
        className={`jsx-block ${isSelected ? "jsx-block-selected" : ""}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={isSelected ? 0 : -1}
      >
        <RenderComponent
          parsed={block.component}
          onStateChange={handleStateChange}
          isSelected={isSelected}
          onSelect={() => onBlockSelect?.(startCol, endCol)}
        />
      </span>
      {showCursorAfter && (
        <span className={`cursor ${cursorVisible ? "visible" : ""}`} />
      )}
    </>
  );
}
