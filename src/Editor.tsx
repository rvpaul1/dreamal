import { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  useEditorState,
  getSelectionBounds,
  posBefore,
} from "./useEditorState";
import { usePersistence } from "./usePersistence";

function Editor() {
  const {
    document,
    lines,
    cursor,
    selectionAnchor,
    hasSelection,
    handleKeyDown,
    updateDocument,
  } = useEditorState();

  const { saveState, flushSave } = usePersistence(document, updateDocument);

  const [cursorVisible, setCursorVisible] = useState(true);
  const editorRef = useRef<HTMLDivElement>(null);

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
    editorRef.current?.focus();
  }, []);

  useEffect(() => {
    const unlisten = listen("tauri://close-requested", () => {
      flushSave();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [flushSave]);

  const renderLine = (lineText: string, lineIndex: number) => {
    const isCursorLine = lineIndex === cursor.line;

    if (!hasSelection) {
      if (isCursorLine) {
        return (
          <>
            <span>{lineText.slice(0, cursor.col)}</span>
            <span className={`cursor ${cursorVisible ? "visible" : ""}`} />
            <span>{lineText.slice(cursor.col)}</span>
          </>
        );
      }
      return <span>{lineText || "\u200B"}</span>;
    }

    const { start, end } = getSelectionBounds(selectionAnchor!, cursor);
    const isInSelection = lineIndex >= start.line && lineIndex <= end.line;

    if (!isInSelection) {
      return <span>{lineText || "\u200B"}</span>;
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
  };

  return (
    <div
      ref={editorRef}
      className="editor"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onBlur={flushSave}
    >
      {saveState.status === "error" && (
        <div className="save-error">Save failed: {saveState.error}</div>
      )}
      <div className="editor-content">
        {lines.map((lineText, lineIndex) => (
          <div key={lineIndex} className="editor-line">
            {renderLine(lineText, lineIndex)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Editor;
