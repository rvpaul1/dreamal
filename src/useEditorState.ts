import { useState, useCallback, useRef, useEffect } from "react";
import {
  type EditorState,
  type CursorPosition,
  hasSelection as checkHasSelection,
  getSelectedText,
  moveCursorLeft,
  moveCursorRight,
  moveCursorUp,
  moveCursorDown,
  moveCursorToLineStart,
  moveCursorToLineEnd,
  moveCursorToDocStart,
  moveCursorToDocEnd,
  backspace,
  deleteForward,
  insertTab,
  insertText,
  createInitialState,
  swapHeadingSectionUp,
  swapHeadingSectionDown,
  getHiddenLines,
  isHeadingLine,
  setCursor,
  setCursorWithAnchor,
  selectAll,
  insertCharacterWithBulletCheck,
  insertNewlineWithBullet,
  indentBullet,
  outdentBullet,
  isBulletLine,
} from "./editorActions";
import { type Document, createDocument } from "./documentModel";
import { type Macro } from "./macros";

export { posEqual, posBefore, getSelectionBounds } from "./editorActions";
export type { CursorPosition, EditorState } from "./editorActions";
export type { Document, DocumentMetadata } from "./documentModel";

export function useEditorState() {
  const [document, setDocument] = useState<Document>(() =>
    createDocument(createInitialState())
  );
  const [isOptionHeld, setIsOptionHeld] = useState(false);
  const [hiddenLines, setHiddenLines] = useState<Set<number>>(new Set());
  const [collapsedHeadings, setCollapsedHeadings] = useState<Set<number>>(new Set());
  const prevOptionHeldRef = useRef(false);

  const hasSelection = checkHasSelection(document.editor);

  useEffect(() => {
    const wasOptionHeld = prevOptionHeldRef.current;
    prevOptionHeldRef.current = isOptionHeld;

    if (!isOptionHeld) {
      if (wasOptionHeld) {
        setHiddenLines(new Set());
      }
      return;
    }

    if (wasOptionHeld) {
      return;
    }

    const { cursor, selectionAnchor, lines } = document.editor;
    const cursorLine = cursor.line;

    let selectionRange: { start: number; end: number } | undefined;
    if (selectionAnchor) {
      const startLine = Math.min(cursor.line, selectionAnchor.line);
      const endLine = Math.max(cursor.line, selectionAnchor.line);
      selectionRange = { start: startLine, end: endLine };
    }

    const rangeStart = selectionRange?.start ?? cursorLine;
    const rangeEnd = selectionRange?.end ?? cursorLine;
    let hasHeadingInRange = false;
    for (let i = rangeStart; i <= rangeEnd; i++) {
      if (isHeadingLine(lines[i])) {
        hasHeadingInRange = true;
        break;
      }
    }

    if (!hasHeadingInRange) {
      setHiddenLines(new Set());
      return;
    }

    setHiddenLines(getHiddenLines(document.editor, cursorLine, selectionRange));
  }, [isOptionHeld, document.editor]);

  const updateEditor = useCallback(
    (updater: (state: EditorState) => EditorState) => {
      setDocument((doc) => ({
        ...doc,
        editor: updater(doc.editor),
      }));
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentHiddenLines: Set<number>) => {
      if (e.key === "Alt") {
        setIsOptionHeld(true);
      }

      if (e.altKey && !e.shiftKey && !e.metaKey) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          updateEditor((s) => swapHeadingSectionUp(s, currentHiddenLines));
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          updateEditor((s) => swapHeadingSectionDown(s, currentHiddenLines));
          return;
        }
        return;
      }

      if (e.metaKey && !e.altKey && !e.ctrlKey) {
        const isShift = e.shiftKey;
        switch (e.key) {
          case "a":
            e.preventDefault();
            updateEditor(selectAll);
            return;
          case "ArrowLeft":
            e.preventDefault();
            updateEditor((s) => moveCursorToLineStart(s, isShift));
            return;
          case "ArrowRight":
            e.preventDefault();
            updateEditor((s) => moveCursorToLineEnd(s, isShift));
            return;
          case "ArrowUp":
            e.preventDefault();
            updateEditor((s) => moveCursorToDocStart(s, isShift));
            return;
          case "ArrowDown":
            e.preventDefault();
            updateEditor((s) => moveCursorToDocEnd(s, isShift));
            return;
        }
        return;
      }

      if (e.ctrlKey || e.altKey) {
        return;
      }

      const isShift = e.shiftKey;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          updateEditor((s) => moveCursorLeft(s, isShift));
          break;
        case "ArrowRight":
          e.preventDefault();
          updateEditor((s) => moveCursorRight(s, isShift));
          break;
        case "ArrowUp":
          e.preventDefault();
          updateEditor((s) => moveCursorUp(s, isShift));
          break;
        case "ArrowDown":
          e.preventDefault();
          updateEditor((s) => moveCursorDown(s, isShift));
          break;
        case "Backspace":
          e.preventDefault();
          updateEditor(backspace);
          break;
        case "Delete":
          e.preventDefault();
          updateEditor(deleteForward);
          break;
        case "Tab":
          e.preventDefault();
          if (isShift) {
            updateEditor((s) => {
              if (isBulletLine(s.lines[s.cursor.line])) {
                return outdentBullet(s);
              }
              return s;
            });
          } else {
            updateEditor((s) => {
              if (isBulletLine(s.lines[s.cursor.line])) {
                return indentBullet(s);
              }
              return insertTab(s);
            });
          }
          break;
        case "Enter":
          e.preventDefault();
          updateEditor(insertNewlineWithBullet);
          break;
        case "Shift":
          break;
        default:
          if (e.key.length === 1) {
            e.preventDefault();
            updateEditor((s) => insertCharacterWithBulletCheck(s, e.key));
          }
          break;
      }
    },
    [updateEditor]
  );

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Alt") {
      setIsOptionHeld(false);
    }
  }, []);

  const updateDocument = useCallback((doc: Document) => {
    setDocument(doc);
  }, []);

  const updateMetadata = useCallback((metadata: Document["metadata"]) => {
    setDocument((doc) => ({ ...doc, metadata }));
  }, []);

  const applyMacro = useCallback(
    (macro: Macro, inputLength: number) => {
      if (!macro.expand) return;

      updateEditor((state) => {
        const { line, col } = state.cursor;
        const currentLine = state.lines[line];
        const expanded = macro.expand!();

        const beforeMacro = currentLine.slice(0, col - inputLength);
        const afterCursor = currentLine.slice(col);

        const newLines = [...state.lines];
        newLines[line] = beforeMacro + expanded + afterCursor;

        return {
          ...state,
          lines: newLines,
          cursor: { line, col: beforeMacro.length + expanded.length },
        };
      });
    },
    [updateEditor]
  );

  const handleClickAt = useCallback(
    (pos: CursorPosition) => {
      updateEditor((s) => setCursor(s, pos));
    },
    [updateEditor]
  );

  const handleDragTo = useCallback(
    (pos: CursorPosition, anchor: CursorPosition) => {
      updateEditor((s) => setCursorWithAnchor(s, pos, anchor));
    },
    [updateEditor]
  );

  const handlePaste = useCallback(
    (text: string) => {
      updateEditor((s) => insertText(s, text));
    },
    [updateEditor]
  );

  const handleCopy = useCallback((): string => {
    return getSelectedText(document.editor);
  }, [document.editor]);

  const toggleHeadingCollapse = useCallback((lineIndex: number) => {
    setCollapsedHeadings((prev) => {
      const next = new Set(prev);
      if (next.has(lineIndex)) {
        next.delete(lineIndex);
      } else {
        next.add(lineIndex);
      }
      return next;
    });
  }, []);

  return {
    document,
    lines: document.editor.lines,
    cursor: document.editor.cursor,
    selectionAnchor: document.editor.selectionAnchor,
    hasSelection,
    hiddenLines,
    collapsedHeadings,
    toggleHeadingCollapse,
    handleKeyDown,
    handleKeyUp,
    handleClickAt,
    handleDragTo,
    handlePaste,
    handleCopy,
    updateDocument,
    updateMetadata,
    applyMacro,
  };
}
