export interface ParsedProp {
  name: string;
  value: unknown;
}

export interface ParsedComponent {
  name: string;
  props: Record<string, unknown>;
  children: ParsedComponent[];
}

export interface JSXBlock {
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
  raw: string;
  component: ParsedComponent | null;
  error?: string;
}

const JSX_BLOCK_PATTERN = /\{\{\{JSX:([\s\S]*?)\}\}\}/g;

export function findJSXBlocks(lines: string[]): JSXBlock[] {
  const fullText = lines.join("\n");
  const blocks: JSXBlock[] = [];

  let match;
  while ((match = JSX_BLOCK_PATTERN.exec(fullText)) !== null) {
    const startOffset = match.index;
    const endOffset = match.index + match[0].length;
    const jsxContent = match[1];

    const { line: startLine, col: startCol } = offsetToPosition(
      lines,
      startOffset
    );
    const { line: endLine, col: endCol } = offsetToPosition(lines, endOffset);

    let component: ParsedComponent | null = null;
    let error: string | undefined;

    try {
      component = parseJSX(jsxContent.trim());
    } catch (e) {
      error = e instanceof Error ? e.message : "Parse error";
    }

    blocks.push({
      startLine,
      endLine,
      startCol,
      endCol,
      raw: match[0],
      component,
      error,
    });
  }

  return blocks;
}

function offsetToPosition(
  lines: string[],
  offset: number
): { line: number; col: number } {
  let remaining = offset;
  for (let i = 0; i < lines.length; i++) {
    const lineLen = lines[i].length + 1;
    if (remaining < lineLen) {
      return { line: i, col: remaining };
    }
    remaining -= lineLen;
  }
  return { line: lines.length - 1, col: lines[lines.length - 1]?.length || 0 };
}

export function parseJSX(jsx: string): ParsedComponent {
  const trimmed = jsx.trim();

  const selfClosingMatch = trimmed.match(
    /^<([A-Z][a-zA-Z0-9]*)\s*((?:[^>]*?)?)\s*\/>$/
  );
  if (selfClosingMatch) {
    const [, name, propsStr] = selfClosingMatch;
    return {
      name,
      props: parseProps(propsStr || ""),
      children: [],
    };
  }

  const openTagMatch = trimmed.match(/^<([A-Z][a-zA-Z0-9]*)\s*((?:[^>]*?)?)\s*>/);
  if (!openTagMatch) {
    throw new Error("Invalid JSX: missing opening tag");
  }

  const [fullOpenTag, name, propsStr] = openTagMatch;
  const closeTag = `</${name}>`;

  if (!trimmed.endsWith(closeTag)) {
    throw new Error(`Invalid JSX: missing closing tag </${name}>`);
  }

  const childrenStr = trimmed.slice(
    fullOpenTag.length,
    trimmed.length - closeTag.length
  );
  const children = parseChildren(childrenStr.trim());

  return {
    name,
    props: parseProps(propsStr || ""),
    children,
  };
}

function parseProps(propsStr: string): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  if (!propsStr.trim()) return props;

  const propPattern = /([a-zA-Z_][a-zA-Z0-9_]*)(?:=(?:\{([^}]*)\}|"([^"]*)"|'([^']*)'))?/g;

  let match;
  while ((match = propPattern.exec(propsStr)) !== null) {
    const [, name, braceValue, doubleQuoteValue, singleQuoteValue] = match;

    if (braceValue !== undefined) {
      props[name] = parseValue(braceValue);
    } else if (doubleQuoteValue !== undefined) {
      props[name] = doubleQuoteValue;
    } else if (singleQuoteValue !== undefined) {
      props[name] = singleQuoteValue;
    } else {
      props[name] = true;
    }
  }

  return props;
}

function parseValue(valueStr: string): unknown {
  const trimmed = valueStr.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (trimmed === "undefined") return undefined;

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function parseChildren(childrenStr: string): ParsedComponent[] {
  if (!childrenStr) return [];

  const children: ParsedComponent[] = [];
  let remaining = childrenStr;

  while (remaining.trim()) {
    remaining = remaining.trim();

    if (!remaining.startsWith("<")) {
      break;
    }

    const selfClosingMatch = remaining.match(
      /^<([A-Z][a-zA-Z0-9]*)\s*((?:[^>]*?)?)\s*\/>/
    );
    if (selfClosingMatch) {
      const [fullMatch, name, propsStr] = selfClosingMatch;
      children.push({
        name,
        props: parseProps(propsStr || ""),
        children: [],
      });
      remaining = remaining.slice(fullMatch.length);
      continue;
    }

    const openTagMatch = remaining.match(
      /^<([A-Z][a-zA-Z0-9]*)\s*((?:[^>]*?)?)\s*>/
    );
    if (openTagMatch) {
      const [fullOpenTag, name, propsStr] = openTagMatch;
      const closeTag = `</${name}>`;
      const closeIndex = findMatchingClose(
        remaining.slice(fullOpenTag.length),
        name
      );

      if (closeIndex === -1) {
        throw new Error(`Missing closing tag for ${name}`);
      }

      const innerContent = remaining.slice(
        fullOpenTag.length,
        fullOpenTag.length + closeIndex
      );
      const nestedChildren = parseChildren(innerContent.trim());

      children.push({
        name,
        props: parseProps(propsStr || ""),
        children: nestedChildren,
      });

      remaining = remaining.slice(
        fullOpenTag.length + closeIndex + closeTag.length
      );
      continue;
    }

    break;
  }

  return children;
}

function findMatchingClose(str: string, tagName: string): number {
  let depth = 1;
  let i = 0;

  while (i < str.length && depth > 0) {
    const openTag = `<${tagName}`;
    const closeTag = `</${tagName}>`;

    if (str.slice(i).startsWith(closeTag)) {
      depth--;
      if (depth === 0) {
        return i;
      }
      i += closeTag.length;
    } else if (str.slice(i).startsWith(openTag)) {
      const afterTag = str.slice(i + openTag.length);
      if (afterTag.match(/^[\s>\/]/)) {
        depth++;
      }
      i++;
    } else {
      i++;
    }
  }

  return -1;
}

export function serializeComponent(component: ParsedComponent): string {
  const propsStr = serializeProps(component.props);
  const propsWithSpace = propsStr ? ` ${propsStr}` : "";

  if (component.children.length === 0) {
    return `<${component.name}${propsWithSpace} />`;
  }

  const childrenStr = component.children
    .map((child) => serializeComponent(child))
    .join("");

  return `<${component.name}${propsWithSpace}>${childrenStr}</${component.name}>`;
}

function serializeProps(props: Record<string, unknown>): string {
  return Object.entries(props)
    .map(([key, value]) => {
      if (value === true) {
        return key;
      }
      if (typeof value === "string") {
        return `${key}="${value}"`;
      }
      return `${key}={${JSON.stringify(value)}}`;
    })
    .join(" ");
}

export function serializeJSXBlock(component: ParsedComponent): string {
  return `{{{JSX:${serializeComponent(component)}}}}`;
}

export function isPositionInBlock(
  line: number,
  col: number,
  block: JSXBlock
): boolean {
  if (line < block.startLine || line > block.endLine) {
    return false;
  }
  if (line === block.startLine && col < block.startCol) {
    return false;
  }
  if (line === block.endLine && col > block.endCol) {
    return false;
  }
  return true;
}

export function getBlockAtPosition(
  line: number,
  col: number,
  blocks: JSXBlock[]
): JSXBlock | null {
  return blocks.find((block) => isPositionInBlock(line, col, block)) || null;
}

export interface MarkdownLinkSegment {
  text: string;
  url: string;
}

export type InlineFormatType = "bold" | "italic" | "underline" | "strikethrough";

export interface InlineFormatSegment {
  content: string;
  format: InlineFormatType;
  markerLength: number;
}

export type LineSegment =
  | { type: "text"; content: string; startCol: number; endCol: number }
  | { type: "jsx"; block: InlineJSXBlock; startCol: number; endCol: number }
  | { type: "link"; link: MarkdownLinkSegment; startCol: number; endCol: number }
  | { type: "format"; format: InlineFormatSegment; startCol: number; endCol: number };

export interface InlineJSXBlock {
  raw: string;
  component: ParsedComponent | null;
  error?: string;
}

const INLINE_JSX_PATTERN = /\{\{\{JSX:([\s\S]*?)\}\}\}/g;
const MARKDOWN_LINK_PATTERN = /\[([^\]]*)\]\(([^)]*)\)/g;

function splitTextWithLinks(textSegment: { content: string; startCol: number; endCol: number }): LineSegment[] {
  const { content, startCol } = textSegment;
  const results: LineSegment[] = [];
  let lastIndex = 0;

  MARKDOWN_LINK_PATTERN.lastIndex = 0;
  let match;

  while ((match = MARKDOWN_LINK_PATTERN.exec(content)) !== null) {
    const matchEnd = match.index + match[0].length;
    const charAfter = content[matchEnd];
    const isFinished = matchEnd < content.length && charAfter === " ";

    if (!isFinished) continue;

    if (match.index > lastIndex) {
      results.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
        startCol: startCol + lastIndex,
        endCol: startCol + match.index,
      });
    }

    results.push({
      type: "link",
      link: {
        text: match[1],
        url: match[2],
      },
      startCol: startCol + match.index,
      endCol: startCol + matchEnd,
    });

    lastIndex = matchEnd;
  }

  if (lastIndex < content.length) {
    results.push({
      type: "text",
      content: content.slice(lastIndex),
      startCol: startCol + lastIndex,
      endCol: startCol + content.length,
    });
  }

  if (results.length === 0) {
    results.push(textSegment as LineSegment);
  }

  return results;
}

const INLINE_FORMAT_PATTERNS: { pattern: RegExp; format: InlineFormatType; markerLength: number }[] = [
  { pattern: /\*\*(.+?)\*\*/g, format: "bold", markerLength: 2 },
  { pattern: /~~(.+?)~~/g, format: "strikethrough", markerLength: 2 },
  { pattern: /__(.+?)__/g, format: "underline", markerLength: 2 },
  { pattern: /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, format: "italic", markerLength: 1 },
];

function splitTextWithFormats(textSegment: { type: "text"; content: string; startCol: number; endCol: number }): LineSegment[] {
  const { content, startCol } = textSegment;

  interface FormatMatch {
    index: number;
    fullLength: number;
    innerContent: string;
    format: InlineFormatType;
    markerLength: number;
  }

  const allMatches: FormatMatch[] = [];

  for (const { pattern, format, markerLength } of INLINE_FORMAT_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      allMatches.push({
        index: match.index,
        fullLength: match[0].length,
        innerContent: match[1],
        format,
        markerLength,
      });
    }
  }

  allMatches.sort((a, b) => a.index - b.index);

  const nonOverlapping: FormatMatch[] = [];
  let lastEnd = 0;
  for (const m of allMatches) {
    if (m.index >= lastEnd) {
      nonOverlapping.push(m);
      lastEnd = m.index + m.fullLength;
    }
  }

  if (nonOverlapping.length === 0) {
    return [textSegment];
  }

  const results: LineSegment[] = [];
  let lastIndex = 0;

  for (const m of nonOverlapping) {
    if (m.index > lastIndex) {
      results.push({
        type: "text",
        content: content.slice(lastIndex, m.index),
        startCol: startCol + lastIndex,
        endCol: startCol + m.index,
      });
    }

    results.push({
      type: "format",
      format: {
        content: m.innerContent,
        format: m.format,
        markerLength: m.markerLength,
      },
      startCol: startCol + m.index,
      endCol: startCol + m.index + m.fullLength,
    });

    lastIndex = m.index + m.fullLength;
  }

  if (lastIndex < content.length) {
    results.push({
      type: "text",
      content: content.slice(lastIndex),
      startCol: startCol + lastIndex,
      endCol: startCol + content.length,
    });
  }

  return results;
}

export function parseLineSegments(lineText: string): LineSegment[] {
  const rawSegments: LineSegment[] = [];
  let lastIndex = 0;

  INLINE_JSX_PATTERN.lastIndex = 0;
  let match;

  while ((match = INLINE_JSX_PATTERN.exec(lineText)) !== null) {
    if (match.index > lastIndex) {
      rawSegments.push({
        type: "text",
        content: lineText.slice(lastIndex, match.index),
        startCol: lastIndex,
        endCol: match.index,
      });
    }

    const jsxContent = match[1];
    let component: ParsedComponent | null = null;
    let error: string | undefined;

    try {
      component = parseJSX(jsxContent.trim());
    } catch (e) {
      error = e instanceof Error ? e.message : "Parse error";
    }

    rawSegments.push({
      type: "jsx",
      block: {
        raw: match[0],
        component,
        error,
      },
      startCol: match.index,
      endCol: match.index + match[0].length,
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < lineText.length) {
    rawSegments.push({
      type: "text",
      content: lineText.slice(lastIndex),
      startCol: lastIndex,
      endCol: lineText.length,
    });
  }

  if (rawSegments.length === 0) {
    rawSegments.push({
      type: "text",
      content: lineText,
      startCol: 0,
      endCol: lineText.length,
    });
  }

  const afterLinks: LineSegment[] = [];
  for (const seg of rawSegments) {
    if (seg.type === "text") {
      afterLinks.push(...splitTextWithLinks(seg));
    } else {
      afterLinks.push(seg);
    }
  }

  const segments: LineSegment[] = [];
  for (const seg of afterLinks) {
    if (seg.type === "text") {
      segments.push(...splitTextWithFormats(seg as { type: "text"; content: string; startCol: number; endCol: number }));
    } else {
      segments.push(seg);
    }
  }

  return segments;
}
