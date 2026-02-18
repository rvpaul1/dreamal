import { memo } from "react";
import { getSelectionBounds, posBefore, type CursorPosition } from "./useEditorState";
import { BrowserLink } from "./components/BrowserLink";
import { parseLineSegments, splitTextWithFormats, type LineSegment, type InlineJSXBlock, type MarkdownLinkSegment, type InlineFormatSegment } from "./jsxBlocks";
import { RenderComponent } from "./componentRegistry";
import type { ParsedComponent } from "./jsxBlocks";
import type { BulletInfo } from "./useMarkdown";

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

function getBulletChar(indentLevel: number): string {
  return indentLevel % 2 === 1 ? "●" : "○";
}

function Cursor({ visible }: { visible: boolean }) {
  return <span className={`cursor ${visible ? "visible" : ""}`} />;
}

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

function areRenderedLinePropsEqual(prev: RenderedLineProps, next: RenderedLineProps): boolean {
  if (prev.hasSelection || next.hasSelection) return false;

  if (prev.lineText !== next.lineText) return false;

  const prevIsCursorLine = prev.lineIndex === prev.cursor.line;
  const nextIsCursorLine = next.lineIndex === next.cursor.line;

  if (prevIsCursorLine !== nextIsCursorLine) return false;

  if (nextIsCursorLine) {
    if (prev.cursor.col !== next.cursor.col) return false;
    if (prev.cursorVisible !== next.cursorVisible) return false;
  }

  if (prev.headingInfo?.level !== next.headingInfo?.level ||
      prev.headingInfo?.prefixLength !== next.headingInfo?.prefixLength) return false;

  if (prev.bulletInfo?.prefixLength !== next.bulletInfo?.prefixLength ||
      prev.bulletInfo?.indentLevel !== next.bulletInfo?.indentLevel) return false;

  if (prev.selectedBlockRange?.startCol !== next.selectedBlockRange?.startCol ||
      prev.selectedBlockRange?.endCol !== next.selectedBlockRange?.endCol) return false;

  return true;
}

function RenderedLineInner({
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

  const adjustedSelectedBlockRange = selectedBlockRange && prefixLen > 0
    ? {
        startCol: selectedBlockRange.startCol - prefixLen,
        endCol: selectedBlockRange.endCol - prefixLen,
      }
    : selectedBlockRange;

  const handleAdjustedBlockSelect = onBlockSelect
    ? (startCol: number, endCol: number) => onBlockSelect(startCol + prefixLen, endCol + prefixLen)
    : undefined;

  const handleAdjustedBlockStateChange = onBlockStateChange
    ? (startCol: number, endCol: number, newComponent: ParsedComponent) =>
        onBlockStateChange(startCol + prefixLen, endCol + prefixLen, newComponent)
    : undefined;

  const handleAdjustedBlockDelete = onBlockDelete
    ? (startCol: number, endCol: number) => onBlockDelete(startCol + prefixLen, endCol + prefixLen)
    : undefined;

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
            isCursorLine={isCursorLine}
            cursorCol={adjustedCursorCol}
            cursorVisible={cursorVisible}
            selectionInfo={selectionInfo}
            onBlockSelect={handleAdjustedBlockSelect}
            selectedBlockRange={adjustedSelectedBlockRange}
            onBlockStateChange={handleAdjustedBlockStateChange}
            onBlockDelete={handleAdjustedBlockDelete}
          />
        ))}
        {displayText.length === 0 && <span>{"\u200B"}</span>}
      </span>
    </>
  );
}

export const RenderedLine = memo(RenderedLineInner, areRenderedLinePropsEqual);

interface SegmentRendererProps {
  segment: LineSegment;
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

  if (segment.type === "link") {
    return (
      <InlineLinkRenderer
        link={segment.link}
        startCol={segment.startCol}
        endCol={segment.endCol}
        isCursorLine={isCursorLine}
        cursorCol={cursorCol}
        cursorVisible={cursorVisible}
      />
    );
  }

  if (segment.type === "format") {
    return (
      <InlineFormatRenderer
        format={segment.format}
        startCol={segment.startCol}
        endCol={segment.endCol}
        isCursorLine={isCursorLine}
        cursorCol={cursorCol}
        cursorVisible={cursorVisible}
        selectionInfo={selectionInfo}
      />
    );
  }

  return (
    <TextSegmentRenderer
      content={segment.content}
      startCol={segment.startCol}
      endCol={segment.endCol}
      isCursorLine={isCursorLine}
      cursorCol={cursorCol}
      cursorVisible={cursorVisible}
      selectionInfo={selectionInfo}
    />
  );
}

function TextSegmentRenderer({
  content,
  startCol,
  endCol,
  isCursorLine,
  cursorCol,
  cursorVisible,
  selectionInfo,
}: {
  content: string;
  startCol: number;
  endCol: number;
  isCursorLine: boolean;
  cursorCol: number;
  cursorVisible: boolean;
  selectionInfo: SelectionInfo | null;
}) {
  const cursorInSegment = isCursorLine && cursorCol >= startCol && cursorCol <= endCol;
  const relativeCursorCol = cursorCol - startCol;

  if (!selectionInfo) {
    if (cursorInSegment) {
      return (
        <>
          <span>{content.slice(0, relativeCursorCol)}</span>
          <Cursor visible={cursorVisible} />
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
      {showCursorAtStart && <Cursor visible={cursorVisible} />}
      <span className="selection">
        {selected}
        {isLastSegmentInLine && <span className="selection-line-end" />}
      </span>
      {showCursorAtEnd && <Cursor visible={cursorVisible} />}
      <span>{afterSel}</span>
    </>
  );
}

const FORMAT_CLASS_MAP: Record<InlineFormatSegment["format"], string> = {
  bold: "md-bold",
  italic: "md-italic",
  underline: "md-underline",
  strikethrough: "md-strikethrough",
};

function InlineFormatRenderer({
  format,
  startCol,
  endCol,
  isCursorLine,
  cursorCol,
  cursorVisible,
  selectionInfo,
}: {
  format: InlineFormatSegment;
  startCol: number;
  endCol: number;
  isCursorLine: boolean;
  cursorCol: number;
  cursorVisible: boolean;
  selectionInfo: SelectionInfo | null;
}) {
  const className = FORMAT_CLASS_MAP[format.format];
  const markerLen = format.markerLength;
  const contentStart = startCol + markerLen;
  const contentEnd = endCol - markerLen;

  const innerSegments = splitTextWithFormats({
    type: "text",
    content: format.content,
    startCol: contentStart,
    endCol: contentEnd,
  });

  const styledContent = (
    <span className={className}>
      {innerSegments.map((seg, idx) => {
        if (seg.type === "format") {
          return (
            <InlineFormatRenderer
              key={idx}
              format={seg.format}
              startCol={seg.startCol}
              endCol={seg.endCol}
              isCursorLine={isCursorLine}
              cursorCol={cursorCol}
              cursorVisible={cursorVisible}
              selectionInfo={selectionInfo}
            />
          );
        }
        if (seg.type === "text") {
          return (
            <TextSegmentRenderer
              key={idx}
              content={seg.content}
              startCol={seg.startCol}
              endCol={seg.endCol}
              isCursorLine={isCursorLine}
              cursorCol={cursorCol}
              cursorVisible={cursorVisible}
              selectionInfo={selectionInfo}
            />
          );
        }
        return null;
      })}
    </span>
  );

  if (!isCursorLine) {
    return styledContent;
  }

  const markerText = format.content.length > 0
    ? (format.format === "bold" ? "**" : format.format === "italic" ? "*" : format.format === "underline" ? "__" : "~~")
    : "";

  const renderMarker = (text: string, markerStart: number, markerEnd: number) => {
    const cursorInMarker = cursorCol >= markerStart && cursorCol <= markerEnd;
    const relativeCursor = cursorCol - markerStart;

    if (!selectionInfo) {
      if (cursorInMarker) {
        return (
          <span className="md-format-marker">
            <span>{text.slice(0, relativeCursor)}</span>
            <Cursor visible={cursorVisible} />
            <span>{text.slice(relativeCursor)}</span>
          </span>
        );
      }
      return <span className="md-format-marker">{text}</span>;
    }

    const { selStart, selEnd, cursorAtStart, cursorAtEnd, showLineEndSelection } = selectionInfo;
    const segSelStart = Math.max(selStart - markerStart, 0);
    const segSelEnd = Math.min(selEnd - markerStart, text.length);
    const hasSelInMarker = segSelEnd > segSelStart && selStart < markerEnd && selEnd > markerStart;

    if (!hasSelInMarker) {
      return <span className="md-format-marker">{text}</span>;
    }

    const beforeSel = text.slice(0, segSelStart);
    const selected = text.slice(segSelStart, segSelEnd);
    const afterSel = text.slice(segSelEnd);
    const showCursorAtStart = cursorAtStart && selStart >= markerStart && selStart <= markerEnd;
    const showCursorAtEnd = cursorAtEnd && selEnd >= markerStart && selEnd <= markerEnd;
    const isLastPart = showLineEndSelection && markerEnd === endCol && segSelEnd === text.length;

    return (
      <span className="md-format-marker">
        <span>{beforeSel}</span>
        {showCursorAtStart && <Cursor visible={cursorVisible} />}
        <span className="selection">
          {selected}
          {isLastPart && <span className="selection-line-end" />}
        </span>
        {showCursorAtEnd && <Cursor visible={cursorVisible} />}
        <span>{afterSel}</span>
      </span>
    );
  };

  return (
    <>
      {renderMarker(markerText, startCol, contentStart)}
      {styledContent}
      {renderMarker(markerText, contentEnd, endCol)}
    </>
  );
}

interface InlineLinkRendererProps {
  link: MarkdownLinkSegment;
  startCol: number;
  endCol: number;
  isCursorLine: boolean;
  cursorCol: number;
  cursorVisible: boolean;
}

function InlineLinkRenderer({
  link,
  startCol,
  endCol,
  isCursorLine,
  cursorCol,
  cursorVisible,
}: InlineLinkRendererProps) {
  const showCursorBefore = isCursorLine && cursorCol === startCol;
  const showCursorAfter = isCursorLine && cursorCol === endCol;

  return (
    <>
      {showCursorBefore && <Cursor visible={cursorVisible} />}
      <BrowserLink className="md-link" href={link.url}>
        {link.text}
      </BrowserLink>
      {showCursorAfter && <Cursor visible={cursorVisible} />}
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
        {showCursorAfter && <Cursor visible={cursorVisible} />}
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
      {showCursorAfter && <Cursor visible={cursorVisible} />}
    </>
  );
}
