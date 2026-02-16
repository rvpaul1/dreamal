import { useState, useEffect, useCallback } from "react";
import { serializeComponent, type ParsedComponent } from "./jsxBlocks";
import type { CursorPosition, Document } from "./useEditorState";

export interface SelectedBlockRange {
  line: number;
  startCol: number;
  endCol: number;
}

interface UseBlockManipulationProps {
  lines: string[];
  cursor: CursorPosition;
  document: Document;
  updateDocument: (doc: Document) => void;
  updateLineContent: (lineIndex: number, updater: (lineText: string) => string) => void;
}

export function useBlockManipulation({
  lines,
  cursor,
  document,
  updateDocument,
  updateLineContent,
}: UseBlockManipulationProps) {
  const [selectedBlockRange, setSelectedBlockRange] = useState<SelectedBlockRange | null>(null);

  useEffect(() => {
    setSelectedBlockRange(null);
  }, [cursor]);

  const handleBlockSelect = useCallback((lineIndex: number, startCol: number, endCol: number) => {
    setSelectedBlockRange({ line: lineIndex, startCol, endCol });
  }, []);

  const handleBlockStateChange = useCallback(
    (lineIndex: number, startCol: number, endCol: number, newComponent: ParsedComponent) => {
      const newBlockStr = `{{{JSX:${serializeComponent(newComponent)}}}}`;
      updateLineContent(lineIndex, (lineText) =>
        lineText.slice(0, startCol) + newBlockStr + lineText.slice(endCol)
      );
    },
    [updateLineContent]
  );

  const handleBlockDelete = useCallback(
    (lineIndex: number, startCol: number, endCol: number) => {
      const lineText = lines[lineIndex];
      const newLineText = lineText.slice(0, startCol) + lineText.slice(endCol);

      const newLines = [...lines];
      newLines[lineIndex] = newLineText;

      setSelectedBlockRange(null);
      updateDocument({
        ...document,
        editor: {
          ...document.editor,
          lines: newLines,
          cursor: { line: lineIndex, col: startCol },
        },
      });
    },
    [document, lines, updateDocument]
  );

  const clearBlockSelection = useCallback(() => {
    setSelectedBlockRange(null);
  }, []);

  return {
    selectedBlockRange,
    handleBlockSelect,
    handleBlockStateChange,
    handleBlockDelete,
    clearBlockSelection,
  };
}
