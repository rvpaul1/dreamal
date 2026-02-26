import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  getCollapsedHiddenLines,
  isHeadingLine,
  isCollapsedHeading,
  getScrollableLines,
  removeScrollable as removeScrollablePrefix,
  setCursor,
  setCursorWithAnchor,
  selectAll,
  insertCharacterWithBulletCheck,
  insertNewlineWithBullet,
  indentBullet,
  outdentBullet,
  isBulletLine,
  toggleInlineFormat,
  tryFormatUrlBeforeSpace,
  tryFormatUrlBeforeNewline,
} from "./editorActions";
import { type Document, createDocument } from "./documentModel";
import { type Macro } from "./macros";
import { useUndoRedo } from "./useUndoRedo";

export { posEqual, posBefore, getSelectionBounds } from "./editorActions";
export type { CursorPosition, EditorState } from "./editorActions";
export type { Document, DocumentMetadata } from "./documentModel";

export function useEditorState() {
  const [document, setDocument] = useState<Document>(() =>
    createDocument(createInitialState())
  );
  const [isOptionHeld, setIsOptionHeld] = useState(false);
  const [hiddenLines, setHiddenLines] = useState<Set<number>>(new Set());
  const { pushState, undo, redo, clear: clearHistory } = useUndoRedo();
  const documentRef = useRef(document);
  documentRef.current = document;
  const collapsedHeadings = useMemo(() => {
    const collapsed = new Set<number>();
    for (let i = 0; i < document.editor.lines.length; i++) {
      if (isCollapsedHeading(document.editor.lines[i])) {
        collapsed.add(i);
      }
    }
    return collapsed;
  }, [document.editor.lines]);

  const scrollableHeadings = useMemo(() => {
    const map = new Map<number, number>();
    for (let i = 0; i < document.editor.lines.length; i++) {
      const scrollLines = getScrollableLines(document.editor.lines[i]);
      if (scrollLines != null) {
        map.set(i, scrollLines);
      }
    }
    return map;
  }, [document.editor.lines]);

  const allHiddenLines = useMemo(() => {
    const collapsedHidden = getCollapsedHiddenLines(document.editor.lines, collapsedHeadings);
    const merged = new Set(hiddenLines);
    for (const line of collapsedHidden) {
      merged.add(line);
    }
    return merged;
  }, [document.editor.lines, collapsedHeadings, hiddenLines]);

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

  const updateEditorWithHistory = useCallback(
    (updater: (state: EditorState) => EditorState) => {
      setDocument((doc) => {
        pushState(doc.editor);
        return {
          ...doc,
          editor: updater(doc.editor),
        };
      });
    },
    [pushState]
  );

  const updateEditorNoHistory = useCallback(
    (updater: (state: EditorState) => EditorState) => {
      setDocument((doc) => ({
        ...doc,
        editor: updater(doc.editor),
      }));
    },
    []
  );

  const updateEditorWithUrlCheck = useCallback(
    (
      firstUpdate: (state: EditorState) => EditorState,
      urlCheck: (state: EditorState) => EditorState | null
    ) => {
      const preState = documentRef.current.editor;
      pushState(preState);
      const intermediate = firstUpdate(preState);
      const withUrl = urlCheck(intermediate);
      if (withUrl) {
        pushState(intermediate);
        setDocument((doc) => ({ ...doc, editor: withUrl }));
      } else {
        setDocument((doc) => ({ ...doc, editor: intermediate }));
      }
    },
    [pushState]
  );

  const handleUndo = useCallback(() => {
    const previous = undo(documentRef.current.editor);
    if (!previous) return;
    setDocument((doc) => ({ ...doc, editor: previous }));
  }, [undo]);

  const handleRedo = useCallback(() => {
    const next = redo(documentRef.current.editor);
    if (!next) return;
    setDocument((doc) => ({ ...doc, editor: next }));
  }, [redo]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentHiddenLines: Set<number>) => {
      if (e.key === "Alt") {
        setIsOptionHeld(true);
      }

      if (e.altKey && !e.shiftKey && !e.metaKey) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          updateEditorWithHistory((s) => swapHeadingSectionUp(s, currentHiddenLines));
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          updateEditorWithHistory((s) => swapHeadingSectionDown(s, currentHiddenLines));
          return;
        }
        return;
      }

      if (e.metaKey && !e.altKey && !e.ctrlKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
          return;
        }
        if (e.key === "z" && e.shiftKey) {
          e.preventDefault();
          handleRedo();
          return;
        }

        if (e.shiftKey && e.key === "x") {
          e.preventDefault();
          updateEditorWithHistory((s) => toggleInlineFormat(s, "~~"));
          return;
        }

        const isShift = e.shiftKey;
        switch (e.key) {
          case "a":
            e.preventDefault();
            updateEditorNoHistory(selectAll);
            return;
          case "b":
            e.preventDefault();
            updateEditorWithHistory((s) => toggleInlineFormat(s, "**"));
            return;
          case "i":
            e.preventDefault();
            updateEditorWithHistory((s) => toggleInlineFormat(s, "*"));
            return;
          case "u":
            e.preventDefault();
            updateEditorWithHistory((s) => toggleInlineFormat(s, "__"));
            return;
          case "ArrowLeft":
            e.preventDefault();
            updateEditorNoHistory((s) => moveCursorToLineStart(s, isShift));
            return;
          case "ArrowRight":
            e.preventDefault();
            updateEditorNoHistory((s) => moveCursorToLineEnd(s, isShift));
            return;
          case "ArrowUp":
            e.preventDefault();
            updateEditorNoHistory((s) => moveCursorToDocStart(s, isShift));
            return;
          case "ArrowDown":
            e.preventDefault();
            updateEditorNoHistory((s) => moveCursorToDocEnd(s, isShift));
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
          updateEditorNoHistory((s) => moveCursorLeft(s, isShift));
          break;
        case "ArrowRight":
          e.preventDefault();
          updateEditorNoHistory((s) => moveCursorRight(s, isShift));
          break;
        case "ArrowUp":
          e.preventDefault();
          updateEditorNoHistory((s) => moveCursorUp(s, isShift));
          break;
        case "ArrowDown":
          e.preventDefault();
          updateEditorNoHistory((s) => moveCursorDown(s, isShift));
          break;
        case "Backspace":
          e.preventDefault();
          updateEditorWithHistory(backspace);
          break;
        case "Delete":
          e.preventDefault();
          updateEditorWithHistory(deleteForward);
          break;
        case "Tab":
          e.preventDefault();
          if (isShift) {
            updateEditorWithHistory((s) => {
              if (isBulletLine(s.lines[s.cursor.line])) {
                return outdentBullet(s);
              }
              return s;
            });
          } else {
            updateEditorWithHistory((s) => {
              if (isBulletLine(s.lines[s.cursor.line])) {
                return indentBullet(s);
              }
              return insertTab(s);
            });
          }
          break;
        case " ":
          e.preventDefault();
          updateEditorWithUrlCheck(
            (s) => insertCharacterWithBulletCheck(s, " "),
            tryFormatUrlBeforeSpace
          );
          break;
        case "Enter":
          e.preventDefault();
          updateEditorWithUrlCheck(insertNewlineWithBullet, tryFormatUrlBeforeNewline);
          break;
        case "Shift":
          break;
        default:
          if (e.key.length === 1) {
            e.preventDefault();
            updateEditorWithHistory((s) => insertCharacterWithBulletCheck(s, e.key));
          }
          break;
      }
    },
    [updateEditorWithHistory, updateEditorNoHistory, updateEditorWithUrlCheck, handleUndo, handleRedo]
  );

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Alt") {
      setIsOptionHeld(false);
    }
  }, []);

  const updateDocument = useCallback((docOrUpdater: Document | ((prev: Document) => Document)) => {
    setDocument(docOrUpdater);
    clearHistory();
  }, [clearHistory]);

  const updateMetadata = useCallback((metadata: Document["metadata"]) => {
    setDocument((doc) => ({ ...doc, metadata }));
  }, []);

  const applyMacro = useCallback(
    (macro: Macro, inputLength: number) => {
      if (!macro.expand) return;

      updateEditorWithHistory((state) => {
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
    [updateEditorWithHistory]
  );

  const handleClickAt = useCallback(
    (pos: CursorPosition) => {
      updateEditorNoHistory((s) => setCursor(s, pos));
    },
    [updateEditorNoHistory]
  );

  const handleDragTo = useCallback(
    (pos: CursorPosition, anchor: CursorPosition) => {
      updateEditorNoHistory((s) => setCursorWithAnchor(s, pos, anchor));
    },
    [updateEditorNoHistory]
  );

  const handlePaste = useCallback(
    (text: string) => {
      updateEditorWithHistory((s) => insertText(s, text));
    },
    [updateEditorWithHistory]
  );

  const handleCopy = useCallback((): string => {
    return getSelectedText(document.editor);
  }, [document.editor]);

  const toggleHeadingCollapse = useCallback((lineIndex: number) => {
    updateEditorWithHistory((state) => {
      const line = state.lines[lineIndex];
      if (!line) return state;
      const newLines = [...state.lines];
      if (isCollapsedHeading(line)) {
        const scrollableMatch = line.match(/^(~S\d+~ )\^ /);
        if (scrollableMatch) {
          newLines[lineIndex] = scrollableMatch[1] + line.slice(scrollableMatch[0].length);
        } else {
          newLines[lineIndex] = line.slice(2);
        }
      } else if (isHeadingLine(line)) {
        const scrollableMatch = line.match(/^(~S\d+~ )/);
        if (scrollableMatch) {
          newLines[lineIndex] = scrollableMatch[1] + "^ " + line.slice(scrollableMatch[0].length);
        } else {
          newLines[lineIndex] = "^ " + line;
        }
      } else {
        return state;
      }
      return { ...state, lines: newLines };
    });
  }, [updateEditorWithHistory]);

  const removeScrollable = useCallback((lineIndex: number) => {
    updateEditorWithHistory((state) => {
      const line = state.lines[lineIndex];
      if (!line) return state;
      const newLine = removeScrollablePrefix(line);
      if (newLine === line) return state;
      const newLines = [...state.lines];
      newLines[lineIndex] = newLine;
      return { ...state, lines: newLines };
    });
  }, [updateEditorWithHistory]);

  return {
    document,
    lines: document.editor.lines,
    cursor: document.editor.cursor,
    selectionAnchor: document.editor.selectionAnchor,
    hasSelection,
    hiddenLines,
    collapsedHeadings,
    scrollableHeadings,
    allHiddenLines,
    toggleHeadingCollapse,
    removeScrollable,
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
