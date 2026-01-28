import { useRef, useCallback } from "react";
import type { CursorPosition } from "./useEditorState";

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

interface UseMouseSelectionOptions {
  lines: string[];
  lineRefs: React.RefObject<Map<number, HTMLDivElement>>;
  onClickAt: (pos: CursorPosition) => void;
  onDragTo: (pos: CursorPosition, anchor: CursorPosition) => void;
}

export function useMouseSelection({
  lines,
  lineRefs,
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

      let col = 0;
      const walker = ownerDoc.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        if (node === range.startContainer) {
          col += range.startOffset;
          break;
        }
        col += node.textContent?.length ?? 0;
      }

      return { line: targetLine, col };
    },
    [lines, lineRefs]
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
