import { useState, useCallback } from "react";
import type { Document } from "./documentModel";
import type { FindReplaceMatch } from "./FindReplace";

interface UseFindReplaceProps {
  lines: string[];
  document: Document;
  updateDocument: (doc: Document) => void;
  editorRef: React.RefObject<HTMLDivElement | null>;
}

export function useFindReplace({
  lines,
  document,
  updateDocument,
  editorRef,
}: UseFindReplaceProps) {
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findReplaceShowReplace, setFindReplaceShowReplace] = useState(false);

  const handleFindReplaceClose = useCallback(() => {
    setFindReplaceOpen(false);
    editorRef.current?.focus();
  }, [editorRef]);

  const handleFindReplaceNavigate = useCallback(
    (line: number, col: number) => {
      updateDocument({
        ...document,
        editor: {
          ...document.editor,
          cursor: { line, col },
          selectionAnchor: null,
        },
      });
    },
    [document, updateDocument]
  );

  const handleFindReplaceReplace = useCallback(
    (match: FindReplaceMatch, replacement: string) => {
      const newLines = [...lines];
      const line = newLines[match.line];
      newLines[match.line] =
        line.slice(0, match.startCol) + replacement + line.slice(match.endCol);
      updateDocument({
        ...document,
        editor: {
          ...document.editor,
          lines: newLines,
          cursor: { line: match.line, col: match.startCol + replacement.length },
          selectionAnchor: null,
        },
      });
    },
    [lines, document, updateDocument]
  );

  const handleFindReplaceAll = useCallback(
    (searchText: string, replacement: string) => {
      const lowerSearch = searchText.toLowerCase();
      const newLines = lines.map((line) => {
        let result = "";
        const lowerLine = line.toLowerCase();
        let searchStart = 0;
        while (true) {
          const idx = lowerLine.indexOf(lowerSearch, searchStart);
          if (idx === -1) {
            result += line.slice(searchStart);
            break;
          }
          result += line.slice(searchStart, idx) + replacement;
          searchStart = idx + searchText.length;
        }
        return result;
      });
      updateDocument({
        ...document,
        editor: {
          ...document.editor,
          lines: newLines,
          selectionAnchor: null,
        },
      });
    },
    [lines, document, updateDocument]
  );

  const handleToggleFindReplaceReplace = useCallback(() => {
    setFindReplaceShowReplace((prev) => !prev);
  }, []);

  const openFind = useCallback(() => {
    setFindReplaceOpen(true);
    setFindReplaceShowReplace(false);
  }, []);

  const openReplace = useCallback(() => {
    setFindReplaceOpen(true);
    setFindReplaceShowReplace(true);
  }, []);

  return {
    findReplaceOpen,
    findReplaceShowReplace,
    handleFindReplaceClose,
    handleFindReplaceNavigate,
    handleFindReplaceReplace,
    handleFindReplaceAll,
    handleToggleFindReplaceReplace,
    openFind,
    openReplace,
  };
}
