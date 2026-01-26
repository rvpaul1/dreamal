import type { EditorState } from "./editorActions";

export interface DocumentMetadata {
  id: string;
  created: Date;
  modified: Date;
}

export interface Document {
  metadata: DocumentMetadata;
  editor: EditorState;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function createDocument(editor: EditorState): Document {
  const now = new Date();
  return {
    metadata: {
      id: generateId(),
      created: now,
      modified: now,
    },
    editor,
  };
}

export function updateModified(doc: Document): Document {
  return {
    ...doc,
    metadata: {
      ...doc.metadata,
      modified: new Date(),
    },
  };
}

function formatDate(date: Date): string {
  return date.toISOString();
}

export function serializeToMDX(doc: Document): string {
  const { metadata, editor } = doc;

  const frontmatter = [
    "---",
    `id: ${metadata.id}`,
    `created: ${formatDate(metadata.created)}`,
    `modified: ${formatDate(metadata.modified)}`,
    "---",
  ].join("\n");

  const content = editor.lines.join("\n");

  return `${frontmatter}\n\n${content}`;
}

function padZero(n: number, length: number = 2): string {
  return n.toString().padStart(length, "0");
}

export function getFilePath(journalDir: string, created: Date): string {
  const year = created.getFullYear();
  const month = padZero(created.getMonth() + 1);
  const day = padZero(created.getDate());
  const hours = padZero(created.getHours());
  const minutes = padZero(created.getMinutes());
  const seconds = padZero(created.getSeconds());

  const filename = `${year}-${month}-${day}-${hours}${minutes}${seconds}.md`;
  return `${journalDir}/${year}/${month}/${filename}`;
}

export function parseFromMDX(content: string, filepath: string): Document {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);

  if (!frontmatterMatch) {
    const created = parseDateFromFilepath(filepath);
    return {
      metadata: {
        id: generateId(),
        created,
        modified: created,
      },
      editor: {
        lines: content.split("\n"),
        cursor: { line: 0, col: 0 },
        selectionAnchor: null,
      },
    };
  }

  const [, frontmatterStr, body] = frontmatterMatch;
  const metadata = parseFrontmatter(frontmatterStr, filepath);

  return {
    metadata,
    editor: {
      lines: body.split("\n"),
      cursor: { line: 0, col: 0 },
      selectionAnchor: null,
    },
  };
}

function parseFrontmatter(frontmatter: string, filepath: string): DocumentMetadata {
  const lines = frontmatter.split("\n");
  const data: Record<string, string> = {};

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      data[key] = value;
    }
  }

  const fallbackDate = parseDateFromFilepath(filepath);

  return {
    id: data.id || generateId(),
    created: data.created ? new Date(data.created) : fallbackDate,
    modified: data.modified ? new Date(data.modified) : fallbackDate,
  };
}

function parseDateFromFilepath(filepath: string): Date {
  const match = filepath.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})\.md$/);
  if (match) {
    const [, year, month, day, hours, minutes, seconds] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      parseInt(seconds)
    );
  }
  return new Date();
}

export function isDocumentBlank(doc: Document): boolean {
  const { lines } = doc.editor;
  if (lines.length === 0) return true;
  if (lines.length === 1 && lines[0].trim() === "") return true;
  return lines.every((line) => line.trim() === "");
}

export function isContentBlank(content: string): boolean {
  const frontmatterMatch = content.match(/^---\n[\s\S]*?\n---\n\n?([\s\S]*)$/);
  if (!frontmatterMatch) {
    return content.trim() === "";
  }
  const body = frontmatterMatch[1];
  return body.trim() === "";
}
