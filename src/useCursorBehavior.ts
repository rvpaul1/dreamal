import { useState, useEffect, useRef, useCallback } from "react";
import { parseLineSegments } from "./jsxBlocks";
import type { CursorPosition, Document } from "./useEditorState";

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

  const getInlineBlockAt = useCallback(
    (line: number, col: number): { startCol: number; endCol: number } | null => {
      const lineText = linesRef.current[line];
      if (!lineText) return null;

      const segments = parseLineSegments(lineText);
      for (const seg of segments) {
        if (seg.type === "jsx" && col > seg.startCol && col < seg.endCol) {
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
        if (seg.type === "jsx" && seg.endCol === col) {
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
        if (seg.type === "jsx" && seg.startCol === col) {
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
