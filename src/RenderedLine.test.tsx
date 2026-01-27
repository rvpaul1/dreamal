import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { RenderedLine } from "./RenderedLine";
import { registerComponent } from "./componentRegistry";

function DummyComponent({ label }: { label?: string }) {
  return <span data-testid="dummy-component">[Dummy: {label || "default"}]</span>;
}

beforeAll(() => {
  registerComponent("Dummy", DummyComponent as React.ComponentType<Record<string, unknown>>);
});

describe("RenderedLine", () => {
  const defaultProps = {
    lineIndex: 0,
    cursor: { line: 0, col: 0 },
    selectionAnchor: null,
    hasSelection: false,
    cursorVisible: true,
    headingInfo: null,
    bulletInfo: null,
  };

  describe("text rendering", () => {
    it("renders plain text", () => {
      render(<RenderedLine {...defaultProps} lineText="Hello world" />);
      expect(screen.getByText("Hello world")).toBeInTheDocument();
    });

    it("renders empty line with zero-width space", () => {
      const { container } = render(<RenderedLine {...defaultProps} lineText="" />);
      expect(container.textContent).toContain("\u200B");
    });
  });

  describe("JSX block rendering", () => {
    it("renders a JSX block as component", () => {
      render(
        <RenderedLine
          {...defaultProps}
          lineText="{{{JSX:<Dummy />}}}"
        />
      );
      expect(screen.getByTestId("dummy-component")).toBeInTheDocument();
      expect(screen.getByText("[Dummy: default]")).toBeInTheDocument();
    });

    it("renders a JSX block with props", () => {
      render(
        <RenderedLine
          {...defaultProps}
          lineText='{{{JSX:<Dummy label="test" />}}}'
        />
      );
      expect(screen.getByText("[Dummy: test]")).toBeInTheDocument();
    });

    it("renders text before JSX block", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="Before {{{JSX:<Dummy />}}}"
        />
      );
      expect(container.textContent).toContain("Before");
      expect(screen.getByTestId("dummy-component")).toBeInTheDocument();
    });

    it("renders text after JSX block", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="{{{JSX:<Dummy />}}} after"
        />
      );
      expect(container.textContent).toContain("after");
      expect(screen.getByTestId("dummy-component")).toBeInTheDocument();
    });

    it("renders text before and after JSX block", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="Start {{{JSX:<Dummy />}}} end"
        />
      );
      expect(container.textContent).toContain("Start");
      expect(container.textContent).toContain("end");
      expect(screen.getByTestId("dummy-component")).toBeInTheDocument();
    });

    it("renders multiple JSX blocks on same line", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText='{{{JSX:<Dummy label="A" />}}} and {{{JSX:<Dummy label="B" />}}}'
        />
      );
      expect(screen.getByText("[Dummy: A]")).toBeInTheDocument();
      expect(screen.getByText("[Dummy: B]")).toBeInTheDocument();
      expect(container.textContent).toContain("and");
    });

    it("renders error for malformed JSX", () => {
      render(
        <RenderedLine
          {...defaultProps}
          lineText="{{{JSX:<Invalid}}}"
        />
      );
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });

    it("renders unknown component message", () => {
      render(
        <RenderedLine
          {...defaultProps}
          lineText="{{{JSX:<UnknownComponent />}}}"
        />
      );
      expect(screen.getByText(/Unknown: UnknownComponent/)).toBeInTheDocument();
    });
  });

  describe("cursor rendering", () => {
    it("shows cursor at start of line", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="Hello"
          cursor={{ line: 0, col: 0 }}
        />
      );
      const cursor = container.querySelector(".cursor");
      expect(cursor).toBeInTheDocument();
    });

    it("shows cursor in middle of text", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="Hello"
          cursor={{ line: 0, col: 2 }}
        />
      );
      expect(screen.getByText("He")).toBeInTheDocument();
      expect(screen.getByText("llo")).toBeInTheDocument();
      const cursor = container.querySelector(".cursor");
      expect(cursor).toBeInTheDocument();
    });

    it("shows cursor at end of line", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="Hello"
          cursor={{ line: 0, col: 5 }}
        />
      );
      expect(screen.getByText("Hello")).toBeInTheDocument();
      const cursor = container.querySelector(".cursor");
      expect(cursor).toBeInTheDocument();
    });

    it("shows cursor before JSX block", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="ab{{{JSX:<Dummy />}}}cd"
          cursor={{ line: 0, col: 2 }}
        />
      );
      expect(screen.getByText("ab")).toBeInTheDocument();
      const cursor = container.querySelector(".cursor");
      expect(cursor).toBeInTheDocument();
    });

    it("shows cursor after JSX block", () => {
      const blockLength = "{{{JSX:<Dummy />}}}".length;
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="ab{{{JSX:<Dummy />}}}cd"
          cursor={{ line: 0, col: 2 + blockLength }}
        />
      );
      const cursor = container.querySelector(".cursor");
      expect(cursor).toBeInTheDocument();
      expect(screen.getByTestId("dummy-component")).toBeInTheDocument();
    });

    it("does not show cursor on different line", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="Hello"
          lineIndex={1}
          cursor={{ line: 0, col: 2 }}
        />
      );
      const cursor = container.querySelector(".cursor");
      expect(cursor).not.toBeInTheDocument();
    });

    it("cursor visibility toggles", () => {
      const { container, rerender } = render(
        <RenderedLine
          {...defaultProps}
          lineText="Hello"
          cursor={{ line: 0, col: 2 }}
          cursorVisible={true}
        />
      );
      let cursor = container.querySelector(".cursor");
      expect(cursor).toHaveClass("visible");

      rerender(
        <RenderedLine
          {...defaultProps}
          lineText="Hello"
          cursor={{ line: 0, col: 2 }}
          cursorVisible={false}
        />
      );
      cursor = container.querySelector(".cursor");
      expect(cursor).not.toHaveClass("visible");
    });
  });

  describe("block selection", () => {
    it("applies selected class to selected block", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="{{{JSX:<Dummy />}}}"
          selectedBlockRange={{ startCol: 0, endCol: 19 }}
        />
      );
      const block = container.querySelector(".jsx-block");
      expect(block).toHaveClass("jsx-block-selected");
    });

    it("does not apply selected class to unselected block", () => {
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText="{{{JSX:<Dummy />}}}"
          selectedBlockRange={null}
        />
      );
      const block = container.querySelector(".jsx-block");
      expect(block).not.toHaveClass("jsx-block-selected");
    });

    it("only selects matching block when multiple exist", () => {
      // First block: {{{JSX:<Dummy label="A" />}}} = 29 chars (0-29)
      const { container } = render(
        <RenderedLine
          {...defaultProps}
          lineText='{{{JSX:<Dummy label="A" />}}} {{{JSX:<Dummy label="B" />}}}'
          selectedBlockRange={{ startCol: 0, endCol: 29 }}
        />
      );
      const blocks = container.querySelectorAll(".jsx-block");
      expect(blocks[0]).toHaveClass("jsx-block-selected");
      expect(blocks[1]).not.toHaveClass("jsx-block-selected");
    });
  });
});
