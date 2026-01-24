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

export function getCurrentMacroInput(
  lines: string[],
  cursorLine: number,
  cursorCol: number
): string | null {
  const line = lines[cursorLine];
  const textBeforeCursor = line.slice(0, cursorCol);

  const slashIndex = textBeforeCursor.lastIndexOf("/");
  if (slashIndex === -1) {
    return null;
  }

  const candidate = textBeforeCursor.slice(slashIndex);
  if (candidate.includes(" ")) {
    return null;
  }

  return candidate;
}

export function getMatchingMacros(input: string, limit: number = 10): Macro[] {
  if (!input.startsWith("/")) {
    return [];
  }

  return macros
    .filter((m) => m.trigger.startsWith(input))
    .slice(0, limit);
}
