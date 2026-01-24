export interface Macro {
  trigger: string;
  expand: () => string;
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export const macros: Macro[] = [
  {
    trigger: "/date",
    expand: () => formatFullDate(new Date()),
  },
];

export function findMacro(text: string): Macro | undefined {
  return macros.find((m) => text.endsWith(m.trigger));
}

export function expandMacro(
  lines: string[],
  cursorLine: number,
  cursorCol: number
): { lines: string[]; newCol: number } | null {
  const line = lines[cursorLine];
  const textBeforeCursor = line.slice(0, cursorCol);

  for (const macro of macros) {
    if (textBeforeCursor.endsWith(macro.trigger)) {
      const expanded = macro.expand();
      const beforeMacro = textBeforeCursor.slice(0, -macro.trigger.length);
      const afterCursor = line.slice(cursorCol);

      const newLines = [...lines];
      newLines[cursorLine] = beforeMacro + expanded + afterCursor;

      return {
        lines: newLines,
        newCol: beforeMacro.length + expanded.length,
      };
    }
  }

  return null;
}
