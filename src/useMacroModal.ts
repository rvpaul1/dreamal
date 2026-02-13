import { useState, useCallback } from "react";
import type { Document } from "./documentModel";
import type { CursorPosition } from "./useEditorState";
import type { Macro, MacroContext } from "./macros";

interface UseMacroModalProps {
  lines: string[];
  cursor: CursorPosition;
  document: Document;
  updateDocument: (doc: Document) => void;
  applyMacro: (macro: Macro, inputLength: number) => void;
}

export function useMacroModal({
  lines,
  cursor,
  document,
  updateDocument,
  applyMacro,
}: UseMacroModalProps) {
  const [claudeModal, setClaudeModal] = useState<{
    macro: Macro;
    instructions: string;
    macroInputLength: number;
  } | null>(null);

  const handleSelectMacro = useCallback(
    (macro: Macro, inputLength: number, context: MacroContext) => {
      if (macro.trigger === "/claude") {
        const lineText = context.lineRawText;
        const instructionsEndIndex = lineText.length - inputLength;
        const instructions = lineText.slice(0, instructionsEndIndex).trim();

        const { line, col } = cursor;
        const currentLine = lines[line];
        const beforeMacro = currentLine.slice(0, col - inputLength);
        const afterCursor = currentLine.slice(col);
        const triggerText = macro.trigger;
        const newLines = [...lines];
        newLines[line] = beforeMacro + triggerText + afterCursor;

        updateDocument({
          ...document,
          editor: {
            ...document.editor,
            lines: newLines,
            cursor: { line, col: beforeMacro.length + triggerText.length },
            selectionAnchor: null,
          },
        });

        setClaudeModal({ macro, instructions, macroInputLength: triggerText.length });
      } else if (macro.expand) {
        applyMacro(macro, inputLength);
      }
    },
    [applyMacro, cursor, lines, document, updateDocument]
  );

  const handleClaudeConfirm = useCallback(
    (sessionId: string) => {
      if (!claudeModal || !claudeModal.macro.expand) return;

      const { line, col } = cursor;
      const currentLine = lines[line];
      const lineBeforeMacro = currentLine.slice(0, col - claudeModal.macroInputLength);
      const lineAfterCursor = currentLine.slice(col);

      const expanded = claudeModal.macro.expand({ sessionId });
      const newLines = [...lines];
      newLines[line] = lineBeforeMacro + expanded + lineAfterCursor;

      updateDocument({
        ...document,
        editor: {
          ...document.editor,
          lines: newLines,
          cursor: { line, col: lineBeforeMacro.length + expanded.length },
          selectionAnchor: null,
        },
      });

      setClaudeModal(null);
    },
    [claudeModal, cursor, lines, document, updateDocument]
  );

  const handleClaudeCancel = useCallback(() => {
    setClaudeModal(null);
  }, []);

  return {
    claudeModal,
    handleSelectMacro,
    handleClaudeConfirm,
    handleClaudeCancel,
  };
}
