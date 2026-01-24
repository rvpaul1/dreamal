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
