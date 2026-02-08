export interface MacroContext {
  lineRawText: string;
}

export interface Macro {
  trigger: string;
  expand?: (args?: Record<string, unknown>) => string;
  onSelect?: (context: MacroContext) => void;
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
  {
    trigger: "/timer",
    expand: () => "{{{JSX:<Timer duration={300} />}}}",
  },
  {
    trigger: "/timer1",
    expand: () => "{{{JSX:<Timer duration={60} />}}}",
  },
  {
    trigger: "/timer5",
    expand: () => "{{{JSX:<Timer duration={300} />}}}",
  },
  {
    trigger: "/timer10",
    expand: () => "{{{JSX:<Timer duration={600} />}}}",
  },
  {
    trigger: "/todo",
    expand: () => '{{{JSX:<TaskStatus status="todo" />}}}',
  },
  {
    trigger: "/in-progress",
    expand: () => '{{{JSX:<TaskStatus status="in-progress" />}}}',
  },
  {
    trigger: "/done",
    expand: () => '{{{JSX:<TaskStatus status="done" />}}}',
  },
  {
    trigger: "/claude",
    expand: (args) => {
      const sessionId = args?.sessionId as string;
      return `{{{JSX:<ClaudeStatus sessionId="${sessionId}" />}}}`;
    },
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

  if (slashIndex > 0 && textBeforeCursor[slashIndex - 1] !== " ") {
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
