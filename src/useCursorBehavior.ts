import { useState, useEffect, useRef, useCallback } from "react";
import { parseLineSegments } from "./jsxBlocks";
import type { CursorPosition, Document } from "./useEditorState";

interface UseCursorBehaviorProps {
  lines: string[];
  cursor: CursorPosition;
  document: Document;
  updateDocument: (doc: Document) => void;
  lineRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
}

export function useCursorBehavior({
  lines,
  cursor,
  document,
  updateDocument,
  lineRefs,
}: UseCursorBehaviorProps) {
  const [cursorVisible, setCursorVisible] = useState(true);
  const prevCursorRef = useRef(cursor);
  const lastInputWasClickRef = useRef(false);

  const isBlockSegment = useCallback(
    (seg: ReturnType<typeof parseLineSegments>[number]) =>
      seg.type === "jsx" || seg.type === "link",
    []
  );

  const getInlineBlockAt = useCallback(
    (line: number, col: number): { startCol: number; endCol: number } | null => {
      const lineText = lines[line];
      if (!lineText) return null;

      const segments = parseLineSegments(lineText);
      for (const seg of segments) {
        if (isBlockSegment(seg) && col > seg.startCol && col < seg.endCol) {
          return { startCol: seg.startCol, endCol: seg.endCol };
        }
      }
      return null;
    },
    [lines, isBlockSegment]
  );

  const getInlineBlockEndingBefore = useCallback(
    (line: number, col: number): { startCol: number; endCol: number } | null => {
      const lineText = lines[line];
      if (!lineText) return null;

      const segments = parseLineSegments(lineText);
      for (const seg of segments) {
        if (isBlockSegment(seg) && seg.endCol === col) {
          return { startCol: seg.startCol, endCol: seg.endCol };
        }
      }
      return null;
    },
    [lines, isBlockSegment]
  );

  const getInlineBlockStartingAfter = useCallback(
    (line: number, col: number): { startCol: number; endCol: number } | null => {
      const lineText = lines[line];
      if (!lineText) return null;

      const segments = parseLineSegments(lineText);
      for (const seg of segments) {
        if (isBlockSegment(seg) && seg.startCol === col) {
          return { startCol: seg.startCol, endCol: seg.endCol };
        }
      }
      return null;
    },
    [lines, isBlockSegment]
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

      updateDocument({
        ...document,
        editor: {
          ...document.editor,
          cursor: { line: cursor.line, col: newCol },
        },
      });
    }
    prevCursorRef.current = cursor;
  }, [cursor, getInlineBlockAt, document, updateDocument]);

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
    markClickInput,
    markKeyInput,
  };
}
