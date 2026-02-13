import { useRef, useCallback } from "react";
import type { CursorPosition } from "./useEditorState";
import type { BulletInfo, HeadingInfo } from "./useMarkdown";
import { parseLineSegments } from "./jsxBlocks";

export function isWordChar(char: string): boolean {
  return /[a-zA-Z0-9]/.test(char);
}

export function getWordBoundsAt(line: string, col: number): { start: number; end: number } | null {
  if (col < 0 || col > line.length) return null;

  const charAtCol = line[col];
  const charBeforeCol = col > 0 ? line[col - 1] : undefined;

  const touchingWord = (charAtCol && isWordChar(charAtCol)) || (charBeforeCol && isWordChar(charBeforeCol));
  if (!touchingWord) return null;

  let start = col;
  let end = col;

  if (charAtCol && isWordChar(charAtCol)) {
    while (start > 0 && isWordChar(line[start - 1])) start--;
    while (end < line.length && isWordChar(line[end])) end++;
  } else {
    while (start > 0 && isWordChar(line[start - 1])) start--;
    end = col;
    while (end > start && !isWordChar(line[end - 1])) end--;
    end = start;
    while (end < line.length && isWordChar(line[end])) end++;
  }

  return { start, end };
}

function displayColToRawCol(lineText: string, displayCol: number): number {
  const segments = parseLineSegments(lineText);
  let displayOffset = 0;

  for (const seg of segments) {
    if (seg.type === "link") {
      const linkDisplayLen = seg.link.text.length;
      if (displayCol <= displayOffset + linkDisplayLen) {
        if (displayCol <= displayOffset) {
          return seg.startCol;
        }
        return seg.endCol;
      }
      displayOffset += linkDisplayLen;
    } else if (seg.type === "jsx") {
      displayOffset += 0;
    } else {
      const textLen = seg.content.length;
      if (displayCol <= displayOffset + textLen) {
        const offsetInSeg = displayCol - displayOffset;
        return seg.startCol + offsetInSeg;
      }
      displayOffset += textLen;
    }
  }

  return lineText.length;
}

interface UseMouseSelectionOptions {
  lines: string[];
  lineRefs: React.RefObject<Map<number, HTMLDivElement>>;
  currentCursorLine: number;
  getBulletInfo: (lineIndex: number) => BulletInfo | null;
  getHeadingInfo: (lineIndex: number) => HeadingInfo | null;
  onClickAt: (pos: CursorPosition) => void;
  onDragTo: (pos: CursorPosition, anchor: CursorPosition) => void;
}

export function useMouseSelection({
  lines,
  lineRefs,
  currentCursorLine,
  getBulletInfo,
  getHeadingInfo,
  onClickAt,
  onDragTo,
}: UseMouseSelectionOptions) {
  const dragAnchorRef = useRef<CursorPosition | null>(null);

  const getPositionFromPoint = useCallback(
    (clientX: number, clientY: number): CursorPosition | null => {
      const refs = lineRefs.current;
      if (!refs) return null;

      let targetLine = -1;
      for (const [lineIndex, el] of refs.entries()) {
        const rect = el.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
          targetLine = lineIndex;
          break;
        }
      }

      if (targetLine === -1) {
        let closestLine = 0;
        let closestDist = Infinity;
        for (const [lineIndex, el] of refs.entries()) {
          const rect = el.getBoundingClientRect();
          const dist = Math.min(
            Math.abs(clientY - rect.top),
            Math.abs(clientY - rect.bottom)
          );
          if (dist < closestDist) {
            closestDist = dist;
            closestLine = lineIndex;
          }
        }
        targetLine = closestLine;
      }

      const lineEl = refs.get(targetLine);
      if (!lineEl) {
        return { line: targetLine, col: 0 };
      }

      const bulletInfo = getBulletInfo(targetLine);
      const headingInfo = getHeadingInfo(targetLine);
      const hideBulletPrefix = !!bulletInfo;
      const hideHeadingPrefix = headingInfo && currentCursorLine !== targetLine;

      let prefixLen = 0;
      if (hideHeadingPrefix) {
        prefixLen = headingInfo.prefixLength;
      } else if (hideBulletPrefix) {
        prefixLen = bulletInfo.prefixLength;
      }

      const lineTextEl = lineEl.querySelector(".line-text");
      const ownerDoc = lineEl.ownerDocument;
      const range = ownerDoc.caretRangeFromPoint(clientX, clientY);

      if (!range || !lineEl.contains(range.startContainer)) {
        const rect = lineEl.getBoundingClientRect();
        if (clientX <= rect.left) {
          return { line: targetLine, col: 0 };
        }
        return { line: targetLine, col: lines[targetLine]?.length ?? 0 };
      }

      const rangeRect = range.getBoundingClientRect();
      if (clientX > rangeRect.right + 4) {
        return { line: targetLine, col: lines[targetLine]?.length ?? 0 };
      }

      if (lineTextEl && !lineTextEl.contains(range.startContainer)) {
        const lineTextRect = lineTextEl.getBoundingClientRect();
        if (clientX < lineTextRect.left) {
          return { line: targetLine, col: prefixLen };
        }
        return { line: targetLine, col: lines[targetLine]?.length ?? 0 };
      }

      const walkRoot = lineTextEl || lineEl;
      let displayCol = 0;
      const walker = ownerDoc.createTreeWalker(walkRoot, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        if (node === range.startContainer) {
          displayCol += range.startOffset;
          break;
        }
        displayCol += node.textContent?.length ?? 0;
      }

      const displayText = lines[targetLine] ?? "";
      const rawDisplayText = hideHeadingPrefix
        ? displayText.slice(prefixLen)
        : hideBulletPrefix
          ? displayText.slice(prefixLen)
          : displayText;
      const col = displayColToRawCol(rawDisplayText, displayCol);

      return { line: targetLine, col: col + prefixLen };
    },
    [lines, lineRefs, currentCursorLine, getBulletInfo, getHeadingInfo]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const pos = getPositionFromPoint(e.clientX, e.clientY);
      if (!pos) return;

      if (e.detail === 2) {
        const line = lines[pos.line];
        const bounds = getWordBoundsAt(line, pos.col);
        if (bounds) {
          const anchor = { line: pos.line, col: bounds.start };
          const cursor = { line: pos.line, col: bounds.end };
          dragAnchorRef.current = anchor;
          onDragTo(cursor, anchor);
          return;
        }
      }

      dragAnchorRef.current = pos;
      onClickAt(pos);
    },
    [getPositionFromPoint, onClickAt, onDragTo, lines]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragAnchorRef.current || e.buttons !== 1) return;
      const pos = getPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        onDragTo(pos, dragAnchorRef.current);
      }
    },
    [getPositionFromPoint, onDragTo]
  );

  const handleMouseUp = useCallback(() => {
    dragAnchorRef.current = null;
  }, []);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
