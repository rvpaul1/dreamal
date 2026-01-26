import { describe, it, expect } from "vitest";
import {
  isContentBlank,
  isDocumentBlank,
  parseFromMDX,
  serializeToMDX,
  createDocument,
  getFilePath,
  type Document,
} from "./documentModel";
import { createInitialState } from "./editorActions";

describe("isContentBlank", () => {
  it("returns true for empty content", () => {
    expect(isContentBlank("")).toBe(true);
  });

  it("returns true for whitespace only content", () => {
    expect(isContentBlank("   ")).toBe(true);
    expect(isContentBlank("\n\n")).toBe(true);
    expect(isContentBlank("  \n  \n  ")).toBe(true);
  });

  it("returns true for frontmatter with empty body", () => {
    const content = `---
id: test-id
created: 2024-01-01T00:00:00.000Z
modified: 2024-01-01T00:00:00.000Z
---

`;
    expect(isContentBlank(content)).toBe(true);
  });

  it("returns true for frontmatter with whitespace-only body", () => {
    const content = `---
id: test-id
created: 2024-01-01T00:00:00.000Z
modified: 2024-01-01T00:00:00.000Z
---



`;
    expect(isContentBlank(content)).toBe(true);
  });

  it("returns false for frontmatter with content", () => {
    const content = `---
id: test-id
created: 2024-01-01T00:00:00.000Z
modified: 2024-01-01T00:00:00.000Z
---

Hello world`;
    expect(isContentBlank(content)).toBe(false);
  });

  it("returns false for content without frontmatter", () => {
    expect(isContentBlank("Hello world")).toBe(false);
  });

  it("returns false for content with only a single character", () => {
    const content = `---
id: test-id
created: 2024-01-01T00:00:00.000Z
modified: 2024-01-01T00:00:00.000Z
---

a`;
    expect(isContentBlank(content)).toBe(false);
  });
});

describe("isDocumentBlank", () => {
  function makeDoc(lines: string[]): Document {
    return {
      metadata: {
        id: "test",
        created: new Date(),
        modified: new Date(),
      },
      editor: {
        lines,
        cursor: { line: 0, col: 0 },
        selectionAnchor: null,
      },
    };
  }

  it("returns true for empty lines array", () => {
    expect(isDocumentBlank(makeDoc([]))).toBe(true);
  });

  it("returns true for single empty line", () => {
    expect(isDocumentBlank(makeDoc([""]))).toBe(true);
  });

  it("returns true for single whitespace-only line", () => {
    expect(isDocumentBlank(makeDoc(["   "]))).toBe(true);
  });

  it("returns true for multiple empty lines", () => {
    expect(isDocumentBlank(makeDoc(["", "", ""]))).toBe(true);
  });

  it("returns true for multiple whitespace-only lines", () => {
    expect(isDocumentBlank(makeDoc(["  ", "   ", "\t"]))).toBe(true);
  });

  it("returns false for document with content", () => {
    expect(isDocumentBlank(makeDoc(["Hello"]))).toBe(false);
  });

  it("returns false for document with content on later line", () => {
    expect(isDocumentBlank(makeDoc(["", "", "Hello"]))).toBe(false);
  });

  it("returns false for document with single character", () => {
    expect(isDocumentBlank(makeDoc(["a"]))).toBe(false);
  });

  it("returns true for initial state document", () => {
    const doc = createDocument(createInitialState());
    expect(isDocumentBlank(doc)).toBe(true);
  });
});

describe("parseFromMDX and serializeToMDX roundtrip", () => {
  it("preserves blank document", () => {
    const doc = createDocument(createInitialState());
    const serialized = serializeToMDX(doc);
    const parsed = parseFromMDX(serialized, "/test/path.md");

    expect(isDocumentBlank(parsed)).toBe(true);
  });

  it("preserves document with content", () => {
    const doc = createDocument({
      lines: ["Hello", "World"],
      cursor: { line: 0, col: 0 },
      selectionAnchor: null,
    });
    const serialized = serializeToMDX(doc);
    const parsed = parseFromMDX(serialized, "/test/path.md");

    expect(parsed.editor.lines).toEqual(["Hello", "World"]);
    expect(isDocumentBlank(parsed)).toBe(false);
  });

  it("blank content check matches blank document check after roundtrip", () => {
    const blankDoc = createDocument(createInitialState());
    const blankSerialized = serializeToMDX(blankDoc);

    expect(isContentBlank(blankSerialized)).toBe(true);
    expect(isDocumentBlank(parseFromMDX(blankSerialized, "/test.md"))).toBe(true);

    const contentDoc = createDocument({
      lines: ["Some content"],
      cursor: { line: 0, col: 0 },
      selectionAnchor: null,
    });
    const contentSerialized = serializeToMDX(contentDoc);

    expect(isContentBlank(contentSerialized)).toBe(false);
    expect(isDocumentBlank(parseFromMDX(contentSerialized, "/test.md"))).toBe(false);
  });
});

describe("getFilePath", () => {
  it("generates correct path structure", () => {
    const date = new Date(2024, 0, 15, 10, 30, 45); // Jan 15, 2024 10:30:45
    const path = getFilePath("/journal", date);

    expect(path).toBe("/journal/2024/01/2024-01-15-103045.md");
  });

  it("pads single digit months and days", () => {
    const date = new Date(2024, 0, 5, 9, 5, 5); // Jan 5, 2024 09:05:05
    const path = getFilePath("/journal", date);

    expect(path).toBe("/journal/2024/01/2024-01-05-090505.md");
  });
});
