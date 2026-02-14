import { describe, it, expect, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import { findAllMatches } from "./FindReplace";
import { RenderedLine } from "./RenderedLine";
import { registerComponent } from "./componentRegistry";

function DummyComponent({ label }: { label?: string }) {
  return <span data-testid="dummy-component">[Dummy: {label || "default"}]</span>;
}

beforeAll(() => {
  registerComponent("Dummy", DummyComponent as React.ComponentType<Record<string, unknown>>);
});

describe("findAllMatches", () => {
  it("finds no matches for empty search", () => {
    expect(findAllMatches(["hello world"], "")).toEqual([]);
  });

  it("finds a single match", () => {
    const matches = findAllMatches(["hello world"], "world");
    expect(matches).toEqual([{ line: 0, startCol: 6, endCol: 11 }]);
  });

  it("finds multiple matches on same line", () => {
    const matches = findAllMatches(["abcabc"], "abc");
    expect(matches).toEqual([
      { line: 0, startCol: 0, endCol: 3 },
      { line: 0, startCol: 3, endCol: 6 },
    ]);
  });

  it("finds overlapping matches", () => {
    const matches = findAllMatches(["aaa"], "aa");
    expect(matches).toEqual([
      { line: 0, startCol: 0, endCol: 2 },
      { line: 0, startCol: 1, endCol: 3 },
    ]);
  });

  it("finds matches across multiple lines", () => {
    const matches = findAllMatches(["hello", "world", "hello again"], "hello");
    expect(matches).toEqual([
      { line: 0, startCol: 0, endCol: 5 },
      { line: 2, startCol: 0, endCol: 5 },
    ]);
  });

  it("is case-insensitive", () => {
    const matches = findAllMatches(["Hello HELLO hello"], "hello");
    expect(matches).toEqual([
      { line: 0, startCol: 0, endCol: 5 },
      { line: 0, startCol: 6, endCol: 11 },
      { line: 0, startCol: 12, endCol: 17 },
    ]);
  });

  it("finds no matches when text is absent", () => {
    expect(findAllMatches(["hello world"], "xyz")).toEqual([]);
  });

  it("matches within markdown link raw text", () => {
    const matches = findAllMatches(["click [here](http://example.com) now"], "here");
    expect(matches).toEqual([{ line: 0, startCol: 7, endCol: 11 }]);
  });

  it("matches the URL portion of a markdown link", () => {
    const matches = findAllMatches(["[link](http://example.com) text"], "example");
    expect(matches).toEqual([{ line: 0, startCol: 14, endCol: 21 }]);
  });

  it("matches within JSX block raw text", () => {
    const matches = findAllMatches(['{{{JSX:<Dummy label="hello" />}}}'], "hello");
    expect(matches).toEqual([{ line: 0, startCol: 21, endCol: 26 }]);
  });

  it("matches text adjacent to JSX blocks", () => {
    const matches = findAllMatches(["before {{{JSX:<Dummy />}}} after"], "before");
    expect(matches).toEqual([{ line: 0, startCol: 0, endCol: 6 }]);
  });

  it("matches within heading prefix text", () => {
    const matches = findAllMatches(["# heading text"], "heading");
    expect(matches).toEqual([{ line: 0, startCol: 2, endCol: 9 }]);
  });

  it("matches within bullet prefix text", () => {
    const matches = findAllMatches(["- bullet item"], "bullet");
    expect(matches).toEqual([{ line: 0, startCol: 2, endCol: 8 }]);
  });
});

describe("RenderedLine selection with find matches", () => {
  const defaultProps = {
    lineIndex: 0,
    cursor: { line: 0, col: 0 },
    selectionAnchor: null,
    hasSelection: false,
    cursorVisible: true,
    headingInfo: null,
    bulletInfo: null,
  };

  describe("plain text selection", () => {
    it("highlights matched text in a plain line", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="hello world"
          cursor={{ line: 0, col: 11 }}
          selectionAnchor={{ line: 0, col: 6 }}
          hasSelection={true}
        />
      );
      const selection = container.querySelector(".selection");
      expect(selection).toBeInTheDocument();
      expect(selection!.textContent).toBe("world");
    });

    it("highlights match at start of line", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="hello world"
          cursor={{ line: 0, col: 5 }}
          selectionAnchor={{ line: 0, col: 0 }}
          hasSelection={true}
        />
      );
      const selection = container.querySelector(".selection");
      expect(selection).toBeInTheDocument();
      expect(selection!.textContent).toBe("hello");
    });

    it("highlights match at end of line", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="hello world"
          cursor={{ line: 0, col: 11 }}
          selectionAnchor={{ line: 0, col: 6 }}
          hasSelection={true}
        />
      );
      const selection = container.querySelector(".selection");
      expect(selection).toBeInTheDocument();
      expect(selection!.textContent).toBe("world");
    });
  });

  describe("markdown link selection", () => {
    it("highlights text before a markdown link", () => {
      const lineText = "click [here](http://example.com) and more";
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText={lineText}
          cursor={{ line: 0, col: 5 }}
          selectionAnchor={{ line: 0, col: 0 }}
          hasSelection={true}
        />
      );
      const selection = container.querySelector(".selection");
      expect(selection).toBeInTheDocument();
      expect(selection!.textContent).toBe("click");
    });

    it("highlights text after a markdown link", () => {
      const lineText = "[link](http://example.com) some text";
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText={lineText}
          cursor={{ line: 0, col: 31 }}
          selectionAnchor={{ line: 0, col: 27 }}
          hasSelection={true}
        />
      );
      const selection = container.querySelector(".selection");
      expect(selection).toBeInTheDocument();
      expect(selection!.textContent).toBe("some");
    });
  });

  describe("JSX block selection", () => {
    it("highlights text before a JSX block", () => {
      const lineText = "before {{{JSX:<Dummy />}}}";
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText={lineText}
          cursor={{ line: 0, col: 6 }}
          selectionAnchor={{ line: 0, col: 0 }}
          hasSelection={true}
        />
      );
      const selection = container.querySelector(".selection");
      expect(selection).toBeInTheDocument();
      expect(selection!.textContent).toBe("before");
    });

    it("highlights text after a JSX block", () => {
      const blockLen = "{{{JSX:<Dummy />}}}".length;
      const lineText = "{{{JSX:<Dummy />}}} after";
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText={lineText}
          cursor={{ line: 0, col: blockLen + 6 }}
          selectionAnchor={{ line: 0, col: blockLen + 1 }}
          hasSelection={true}
        />
      );
      const selection = container.querySelector(".selection");
      expect(selection).toBeInTheDocument();
      expect(selection!.textContent).toBe("after");
    });
  });

  describe("heading prefix selection", () => {
    it("highlights match in heading text when cursor is on the line", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="# hello world"
          cursor={{ line: 0, col: 13 }}
          selectionAnchor={{ line: 0, col: 8 }}
          hasSelection={true}
          headingInfo={{ level: 1, prefixLength: 2 }}
        />
      );
      const selection = container.querySelector(".selection");
      expect(selection).toBeInTheDocument();
      expect(selection!.textContent).toBe("world");
    });

    it("highlights match in heading when cursor is on a different line", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="# hello world"
          lineIndex={1}
          cursor={{ line: 0, col: 0 }}
          selectionAnchor={{ line: 2, col: 0 }}
          hasSelection={true}
          headingInfo={{ level: 1, prefixLength: 2 }}
        />
      );
      const selection = container.querySelector(".selection");
      expect(selection).toBeInTheDocument();
      expect(selection!.textContent).toContain("hello world");
    });
  });

  describe("bullet prefix selection", () => {
    it("highlights match in bullet text", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="- bullet item"
          cursor={{ line: 0, col: 13 }}
          selectionAnchor={{ line: 0, col: 9 }}
          hasSelection={true}
          bulletInfo={{ prefixLength: 2, indentLevel: 1 }}
        />
      );
      const selection = container.querySelector(".selection");
      expect(selection).toBeInTheDocument();
      expect(selection!.textContent).toBe("item");
    });
  });
});
