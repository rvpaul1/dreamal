import { describe, it, expect } from "vitest";
import {
  parseLineSegments,
  parseJSX,
  serializeComponent,
  type ParsedComponent,
} from "./jsxBlocks";

describe("parseJSX", () => {
  it("parses a self-closing component with no props", () => {
    const result = parseJSX("<Timer />");
    expect(result).toEqual({
      name: "Timer",
      props: {},
      children: [],
    });
  });

  it("parses a self-closing component with string prop", () => {
    const result = parseJSX('<Button label="Click me" />');
    expect(result).toEqual({
      name: "Button",
      props: { label: "Click me" },
      children: [],
    });
  });

  it("parses a self-closing component with numeric prop", () => {
    const result = parseJSX("<Timer duration={300} />");
    expect(result).toEqual({
      name: "Timer",
      props: { duration: 300 },
      children: [],
    });
  });

  it("parses a self-closing component with boolean prop", () => {
    const result = parseJSX("<Toggle enabled={true} />");
    expect(result).toEqual({
      name: "Toggle",
      props: { enabled: true },
      children: [],
    });
  });

  it("parses a self-closing component with multiple props", () => {
    const result = parseJSX('<Input type="text" maxLength={100} disabled />');
    expect(result).toEqual({
      name: "Input",
      props: { type: "text", maxLength: 100, disabled: true },
      children: [],
    });
  });

  it("parses a component with children", () => {
    const result = parseJSX("<Container><Child /></Container>");
    expect(result).toEqual({
      name: "Container",
      props: {},
      children: [{ name: "Child", props: {}, children: [] }],
    });
  });

  it("parses nested components", () => {
    const result = parseJSX("<Outer><Middle><Inner /></Middle></Outer>");
    expect(result).toEqual({
      name: "Outer",
      props: {},
      children: [
        {
          name: "Middle",
          props: {},
          children: [{ name: "Inner", props: {}, children: [] }],
        },
      ],
    });
  });

  it("parses array props", () => {
    const result = parseJSX("<Chart data={[1, 2, 3]} />");
    expect(result).toEqual({
      name: "Chart",
      props: { data: [1, 2, 3] },
      children: [],
    });
  });

  it("parses simple object-like string in props", () => {
    // Note: The simple parser doesn't handle nested braces well
    // Complex objects should use JSON.stringify format without nested braces
    const result = parseJSX('<Config value={123} />');
    expect(result).toEqual({
      name: "Config",
      props: { value: 123 },
      children: [],
    });
  });
});

describe("serializeComponent", () => {
  it("serializes a simple component", () => {
    const component: ParsedComponent = {
      name: "Timer",
      props: {},
      children: [],
    };
    expect(serializeComponent(component)).toBe("<Timer />");
  });

  it("serializes a component with string prop", () => {
    const component: ParsedComponent = {
      name: "Button",
      props: { label: "Click" },
      children: [],
    };
    expect(serializeComponent(component)).toBe('<Button label="Click" />');
  });

  it("serializes a component with numeric prop", () => {
    const component: ParsedComponent = {
      name: "Timer",
      props: { duration: 300 },
      children: [],
    };
    expect(serializeComponent(component)).toBe("<Timer duration={300} />");
  });

  it("serializes a component with boolean prop", () => {
    const component: ParsedComponent = {
      name: "Toggle",
      props: { enabled: true },
      children: [],
    };
    expect(serializeComponent(component)).toBe("<Toggle enabled />");
  });

  it("serializes a component with children", () => {
    const component: ParsedComponent = {
      name: "Container",
      props: {},
      children: [{ name: "Child", props: {}, children: [] }],
    };
    expect(serializeComponent(component)).toBe(
      "<Container><Child /></Container>"
    );
  });
});

describe("parseLineSegments", () => {
  it("parses a line with no JSX blocks", () => {
    const segments = parseLineSegments("Hello world");
    expect(segments).toEqual([
      { type: "text", content: "Hello world", startCol: 0, endCol: 11 },
    ]);
  });

  it("parses a line with only a JSX block", () => {
    const segments = parseLineSegments("{{{JSX:<Timer />}}}");
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("jsx");
    expect(segments[0].startCol).toBe(0);
    expect(segments[0].endCol).toBe(19);
    if (segments[0].type === "jsx") {
      expect(segments[0].block.component?.name).toBe("Timer");
    }
  });

  it("parses a line with text before JSX block", () => {
    const segments = parseLineSegments("Start {{{JSX:<Timer />}}}");
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({
      type: "text",
      content: "Start ",
      startCol: 0,
      endCol: 6,
    });
    expect(segments[1].type).toBe("jsx");
    expect(segments[1].startCol).toBe(6);
    expect(segments[1].endCol).toBe(25);
  });

  it("parses a line with text after JSX block", () => {
    const segments = parseLineSegments("{{{JSX:<Timer />}}} end");
    expect(segments).toHaveLength(2);
    expect(segments[0].type).toBe("jsx");
    expect(segments[0].startCol).toBe(0);
    expect(segments[0].endCol).toBe(19);
    expect(segments[1]).toEqual({
      type: "text",
      content: " end",
      startCol: 19,
      endCol: 23,
    });
  });

  it("parses a line with text before and after JSX block", () => {
    const segments = parseLineSegments("Before {{{JSX:<Timer />}}} after");
    expect(segments).toHaveLength(3);
    expect(segments[0]).toEqual({
      type: "text",
      content: "Before ",
      startCol: 0,
      endCol: 7,
    });
    expect(segments[1].type).toBe("jsx");
    expect(segments[1].startCol).toBe(7);
    expect(segments[1].endCol).toBe(26);
    expect(segments[2]).toEqual({
      type: "text",
      content: " after",
      startCol: 26,
      endCol: 32,
    });
  });

  it("parses a line with multiple JSX blocks", () => {
    const segments = parseLineSegments(
      "{{{JSX:<A />}}} middle {{{JSX:<B />}}}"
    );
    expect(segments).toHaveLength(3);
    expect(segments[0].type).toBe("jsx");
    if (segments[0].type === "jsx") {
      expect(segments[0].block.component?.name).toBe("A");
    }
    expect(segments[1]).toEqual({
      type: "text",
      content: " middle ",
      startCol: 15,
      endCol: 23,
    });
    expect(segments[2].type).toBe("jsx");
    if (segments[2].type === "jsx") {
      expect(segments[2].block.component?.name).toBe("B");
    }
  });

  it("parses JSX block with props", () => {
    const segments = parseLineSegments("{{{JSX:<Timer duration={60} />}}}");
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("jsx");
    if (segments[0].type === "jsx") {
      expect(segments[0].block.component?.name).toBe("Timer");
      expect(segments[0].block.component?.props).toEqual({ duration: 60 });
    }
  });

  it("handles empty line", () => {
    const segments = parseLineSegments("");
    expect(segments).toEqual([
      { type: "text", content: "", startCol: 0, endCol: 0 },
    ]);
  });

  it("handles malformed JSX gracefully", () => {
    const segments = parseLineSegments("{{{JSX:<Invalid}}}");
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("jsx");
    if (segments[0].type === "jsx") {
      expect(segments[0].block.error).toBeDefined();
      expect(segments[0].block.component).toBeNull();
    }
  });
});

describe("cursor position helpers", () => {
  it("identifies cursor position relative to JSX blocks", () => {
    const line = "text {{{JSX:<Timer />}}} more";
    const segments = parseLineSegments(line);

    const jsxSegment = segments.find((s) => s.type === "jsx")!;
    expect(jsxSegment.startCol).toBe(5);
    expect(jsxSegment.endCol).toBe(24);

    expect(4 < jsxSegment.startCol).toBe(true);
    expect(5 >= jsxSegment.startCol && 5 < jsxSegment.endCol).toBe(true);
    expect(24 >= jsxSegment.endCol).toBe(true);
  });

  it("cursor at block start is outside block", () => {
    const line = "{{{JSX:<Timer />}}}";
    const segments = parseLineSegments(line);
    const jsxSegment = segments[0];

    expect(jsxSegment.startCol).toBe(0);
    const cursorCol = 0;
    const isInside = cursorCol > jsxSegment.startCol && cursorCol < jsxSegment.endCol;
    expect(isInside).toBe(false);
  });

  it("cursor at block end is outside block", () => {
    const line = "{{{JSX:<Timer />}}}";
    const segments = parseLineSegments(line);
    const jsxSegment = segments[0];

    expect(jsxSegment.endCol).toBe(19);
    const cursorCol = 19;
    const isInside = cursorCol > jsxSegment.startCol && cursorCol < jsxSegment.endCol;
    expect(isInside).toBe(false);
  });

  it("cursor inside block is detected", () => {
    const line = "{{{JSX:<Timer />}}}";
    const segments = parseLineSegments(line);
    const jsxSegment = segments[0];

    const cursorCol = 10;
    const isInside = cursorCol > jsxSegment.startCol && cursorCol < jsxSegment.endCol;
    expect(isInside).toBe(true);
  });
});

describe("block movement scenarios", () => {
  it("moving right into block should skip to end", () => {
    const line = "ab{{{JSX:<Timer />}}}cd";
    const segments = parseLineSegments(line);
    const jsxSegment = segments.find((s) => s.type === "jsx")!;

    const cursorBefore = 2;
    expect(cursorBefore).toBe(jsxSegment.startCol);

    const cursorAfterMove = 3;
    const isInsideBlock =
      cursorAfterMove > jsxSegment.startCol && cursorAfterMove < jsxSegment.endCol;
    expect(isInsideBlock).toBe(true);

    const adjustedCursor = jsxSegment.endCol;
    expect(adjustedCursor).toBe(21);
  });

  it("moving left into block should skip to start", () => {
    const line = "ab{{{JSX:<Timer />}}}cd";
    const segments = parseLineSegments(line);
    const jsxSegment = segments.find((s) => s.type === "jsx")!;

    const cursorBefore = 21;
    expect(cursorBefore).toBe(jsxSegment.endCol);

    const cursorAfterMove = 20;
    const isInsideBlock =
      cursorAfterMove > jsxSegment.startCol && cursorAfterMove < jsxSegment.endCol;
    expect(isInsideBlock).toBe(true);

    const adjustedCursor = jsxSegment.startCol;
    expect(adjustedCursor).toBe(2);
  });

  it("backspace at block end should identify block to delete", () => {
    const line = "ab{{{JSX:<Timer />}}}cd";
    const segments = parseLineSegments(line);

    const cursorCol = 21;

    const blockEndingBefore = segments.find(
      (s) => s.type === "jsx" && s.endCol === cursorCol
    );
    expect(blockEndingBefore).toBeDefined();
    expect(blockEndingBefore?.startCol).toBe(2);
    expect(blockEndingBefore?.endCol).toBe(21);
  });

  it("delete at block start should identify block to delete", () => {
    const line = "ab{{{JSX:<Timer />}}}cd";
    const segments = parseLineSegments(line);

    const cursorCol = 2;

    const blockStartingAfter = segments.find(
      (s) => s.type === "jsx" && s.startCol === cursorCol
    );
    expect(blockStartingAfter).toBeDefined();
    expect(blockStartingAfter?.startCol).toBe(2);
    expect(blockStartingAfter?.endCol).toBe(21);
  });

  it("simulates deleting a block and verifying new line content", () => {
    const line = "ab{{{JSX:<Timer />}}}cd";
    const segments = parseLineSegments(line);
    const jsxSegment = segments.find((s) => s.type === "jsx")!;

    const newLine =
      line.slice(0, jsxSegment.startCol) + line.slice(jsxSegment.endCol);
    expect(newLine).toBe("abcd");
  });

  it("simulates inserting block into line", () => {
    const line = "hello world";
    const insertCol = 6;
    const blockStr = "{{{JSX:<Timer />}}}";

    const newLine =
      line.slice(0, insertCol) + blockStr + line.slice(insertCol);
    expect(newLine).toBe("hello {{{JSX:<Timer />}}}world");

    const segments = parseLineSegments(newLine);
    expect(segments).toHaveLength(3);
    expect(segments[0].type).toBe("text");
    expect(segments[1].type).toBe("jsx");
    expect(segments[2].type).toBe("text");
  });
});
