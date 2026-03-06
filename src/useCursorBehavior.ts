import { useState, useEffect, useRef, useCallback } from "react";
import { parseLineSegments } from "./jsxBlocks";
import type { CursorPosition, Document } from "./useEditorState";
import { getBulletInfo } from "./editorActions";
import { displayColToRawCol } from "./useMouseSelection";

interface UseCursorBehaviorProps {
  lines: string[];
  cursor: CursorPosition;
  document: Document;
  updateDocument: (doc: Document) => void;
  lineRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
  hiddenLines: Set<number>;
}

export function useCursorBehavior({
  lines,
  cursor,
  document,
  updateDocument,
  lineRefs,
  hiddenLines,
}: UseCursorBehaviorProps) {
  const [cursorVisible, setCursorVisible] = useState(true);
  const prevCursorRef = useRef(cursor);
  const lastInputWasClickRef = useRef(false);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const documentRef = useRef(document);
  documentRef.current = document;

  const isBlockSegment = useCallback(
    (seg: ReturnType<typeof parseLineSegments>[number]) =>
      seg.type === "jsx" || seg.type === "link",
    []
  );

  const getInlineBlockAt = useCallback(
    (line: number, col: number): { startCol: number; endCol: number } | null => {
      const lineText = linesRef.current[line];
      if (!lineText) return null;

      const segments = parseLineSegments(lineText);
      for (const seg of segments) {
        if (isBlockSegment(seg) && col > seg.startCol && col < seg.endCol) {
          return { startCol: seg.startCol, endCol: seg.endCol };
        }
      }
      return null;
    },
    []
  );

  const getInlineBlockEndingBefore = useCallback(
    (line: number, col: number): { startCol: number; endCol: number } | null => {
      const lineText = linesRef.current[line];
      if (!lineText) return null;

      const segments = parseLineSegments(lineText);
      for (const seg of segments) {
        if (isBlockSegment(seg) && seg.endCol === col) {
          return { startCol: seg.startCol, endCol: seg.endCol };
        }
      }
      return null;
    },
    []
  );

  const getInlineBlockStartingAfter = useCallback(
    (line: number, col: number): { startCol: number; endCol: number } | null => {
      const lineText = linesRef.current[line];
      if (!lineText) return null;

      const segments = parseLineSegments(lineText);
      for (const seg of segments) {
        if (isBlockSegment(seg) && seg.startCol === col) {
          return { startCol: seg.startCol, endCol: seg.endCol };
        }
      }
      return null;
    },
    []
  );

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
    const lineEl = lineRefs.current.get(cursor.line);
    if (lineEl) {
      lineEl.scrollIntoView({ block: "nearest" });
    }
  }, [cursor.line, lineRefs]);

  const prevHiddenLinesRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    const wasCollapsed = prevHiddenLinesRef.current.size > 0;
    const isExpanded = hiddenLines.size === 0;
    if (wasCollapsed && isExpanded) {
      const lineEl = lineRefs.current.get(cursor.line);
      if (lineEl) {
        lineEl.scrollIntoView({ block: "center" });
      }
    }
    prevHiddenLinesRef.current = hiddenLines;
  }, [hiddenLines, cursor.line, lineRefs]);

  useEffect(() => {
    const block = getInlineBlockAt(cursor.line, cursor.col);
    if (block) {
      let newCol: number;

      if (lastInputWasClickRef.current) {
        newCol = block.startCol;
      } else {
        const prev = prevCursorRef.current;
        const movingRight =
          cursor.line > prev.line ||
          (cursor.line === prev.line && cursor.col > prev.col);

        newCol = movingRight ? block.endCol : block.startCol;
      }

      const doc = documentRef.current;
      updateDocument({
        ...doc,
        editor: {
          ...doc.editor,
          cursor: { line: cursor.line, col: newCol },
        },
      });
    }
    prevCursorRef.current = cursor;
  }, [cursor.line, cursor.col, getInlineBlockAt, updateDocument]);

  const navigateWrappedLine = useCallback(
    (direction: "up" | "down"): CursorPosition | null => {
      const lineEl = lineRefs.current.get(cursor.line);
      if (!lineEl) return null;

      const cursorEl = lineEl.querySelector(".cursor");
      if (!cursorEl) return null;

      const cursorRect = cursorEl.getBoundingClientRect();
      const lineRect = lineEl.getBoundingClientRect();
      const lineHeight = 27;

      const cursorMidY = (cursorRect.top + cursorRect.bottom) / 2;
      const targetY =
        direction === "up" ? cursorMidY - lineHeight : cursorMidY + lineHeight;

      if (targetY < lineRect.top || targetY > lineRect.bottom) return null;

      const ownerDoc = lineEl.ownerDocument;
      const range = ownerDoc.caretRangeFromPoint(cursorRect.left, targetY);
      if (!range || !lineEl.contains(range.startContainer)) return null;

      const lineTextEl = lineEl.querySelector(".line-text");
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

      const lineText = linesRef.current[cursor.line] ?? "";
      const bulletInfo = getBulletInfo(lineText);
      const prefixLen = bulletInfo ? bulletInfo.prefixLength : 0;
      const displayText = lineText.slice(prefixLen);
      const rawCol = displayColToRawCol(displayText, displayCol, true) + prefixLen;

      return { line: cursor.line, col: rawCol };
    },
    [cursor, lineRefs, linesRef]
  );

  const markClickInput = useCallback(() => {
    lastInputWasClickRef.current = true;
  }, []);

  const markKeyInput = useCallback(() => {
    lastInputWasClickRef.current = false;
  }, []);

  return {
    cursorVisible,
    getInlineBlockEndingBefore,
    getInlineBlockStartingAfter,
    navigateWrappedLine,
    markClickInput,
    markKeyInput,
  };
}
