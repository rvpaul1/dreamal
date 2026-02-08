import { describe, it, expect } from "vitest";
import {
  type EditorState,
  type CursorPosition,
  posEqual,
  posBefore,
  getSelectionBounds,
  hasSelection,
  getSelectedText,
  deleteSelection,
  moveCursorLeft,
  moveCursorRight,
  moveCursorUp,
  moveCursorDown,
  moveCursorToLineStart,
  moveCursorToLineEnd,
  moveCursorToDocStart,
  moveCursorToDocEnd,
  setCursor,
  setCursorWithAnchor,
  selectAll,
  backspace,
  deleteForward,
  insertTab,
  insertNewline,
  insertCharacter,
  insertText,
  createInitialState,
  swapLineUp,
  swapLineDown,
  getHeadingLevel,
  isHeadingLine,
  isCollapsedHeading,
  getHiddenLines,
  getCollapsedHiddenLines,
  swapHeadingSectionUp,
  swapHeadingSectionDown,
} from "./editorActions";

function state(
  lines: string[],
  cursor: CursorPosition,
  selectionAnchor: CursorPosition | null = null
): EditorState {
  return { lines, cursor, selectionAnchor };
}

function cursor(line: number, col: number): CursorPosition {
  return { line, col };
}

describe("Position Utilities", () => {
  describe("posEqual", () => {
    it("returns true for identical positions", () => {
      expect(posEqual(cursor(0, 0), cursor(0, 0))).toBe(true);
      expect(posEqual(cursor(5, 10), cursor(5, 10))).toBe(true);
    });

    it("returns false for different positions", () => {
      expect(posEqual(cursor(0, 0), cursor(0, 1))).toBe(false);
      expect(posEqual(cursor(0, 0), cursor(1, 0))).toBe(false);
    });
  });

  describe("posBefore", () => {
    it("returns true when first position is before second on same line", () => {
      expect(posBefore(cursor(0, 0), cursor(0, 5))).toBe(true);
    });

    it("returns true when first position is on earlier line", () => {
      expect(posBefore(cursor(0, 10), cursor(1, 0))).toBe(true);
    });

    it("returns false when positions are equal", () => {
      expect(posBefore(cursor(0, 0), cursor(0, 0))).toBe(false);
    });

    it("returns false when first position is after second", () => {
      expect(posBefore(cursor(0, 5), cursor(0, 0))).toBe(false);
      expect(posBefore(cursor(1, 0), cursor(0, 10))).toBe(false);
    });
  });

  describe("getSelectionBounds", () => {
    it("returns anchor as start when anchor is before focus", () => {
      const bounds = getSelectionBounds(cursor(0, 0), cursor(0, 5));
      expect(bounds.start).toEqual(cursor(0, 0));
      expect(bounds.end).toEqual(cursor(0, 5));
    });

    it("returns focus as start when focus is before anchor", () => {
      const bounds = getSelectionBounds(cursor(0, 5), cursor(0, 0));
      expect(bounds.start).toEqual(cursor(0, 0));
      expect(bounds.end).toEqual(cursor(0, 5));
    });
  });

  describe("hasSelection", () => {
    it("returns false when selectionAnchor is null", () => {
      expect(hasSelection(state(["hello"], cursor(0, 0), null))).toBe(false);
    });

    it("returns false when anchor equals cursor", () => {
      expect(hasSelection(state(["hello"], cursor(0, 0), cursor(0, 0)))).toBe(false);
    });

    it("returns true when anchor differs from cursor", () => {
      expect(hasSelection(state(["hello"], cursor(0, 3), cursor(0, 0)))).toBe(true);
    });
  });

  describe("getSelectedText", () => {
    it("returns empty string when no selection", () => {
      expect(getSelectedText(state(["hello"], cursor(0, 0), null))).toBe("");
    });

    it("returns empty string when anchor equals cursor", () => {
      expect(getSelectedText(state(["hello"], cursor(0, 2), cursor(0, 2)))).toBe("");
    });

    it("returns selected text on single line (cursor after anchor)", () => {
      expect(getSelectedText(state(["hello world"], cursor(0, 5), cursor(0, 0)))).toBe("hello");
    });

    it("returns selected text on single line (cursor before anchor)", () => {
      expect(getSelectedText(state(["hello world"], cursor(0, 0), cursor(0, 5)))).toBe("hello");
    });

    it("returns selected text spanning multiple lines", () => {
      const s = state(["hello", "world", "foo"], cursor(2, 3), cursor(0, 2));
      expect(getSelectedText(s)).toBe("llo\nworld\nfoo");
    });

    it("returns selected text spanning multiple lines (reverse selection)", () => {
      const s = state(["hello", "world", "foo"], cursor(0, 2), cursor(2, 3));
      expect(getSelectedText(s)).toBe("llo\nworld\nfoo");
    });

    it("returns selected text spanning two adjacent lines", () => {
      const s = state(["hello", "world"], cursor(1, 3), cursor(0, 3));
      expect(getSelectedText(s)).toBe("lo\nwor");
    });
  });
});

describe("Cursor Movement", () => {
  describe("moveCursorLeft", () => {
    it("moves cursor one position left within a line", () => {
      const result = moveCursorLeft(state(["hello"], cursor(0, 3)), false);
      expect(result.cursor).toEqual(cursor(0, 2));
    });

    it("wraps to end of previous line at line start", () => {
      const result = moveCursorLeft(state(["hello", "world"], cursor(1, 0)), false);
      expect(result.cursor).toEqual(cursor(0, 5));
    });

    it("stays at document start when already there", () => {
      const result = moveCursorLeft(state(["hello"], cursor(0, 0)), false);
      expect(result.cursor).toEqual(cursor(0, 0));
    });

    it("clears selection and moves to selection start without shift", () => {
      const result = moveCursorLeft(
        state(["hello"], cursor(0, 5), cursor(0, 2)),
        false
      );
      expect(result.cursor).toEqual(cursor(0, 2));
      expect(result.selectionAnchor).toBeNull();
    });

    it("extends selection with shift held", () => {
      const result = moveCursorLeft(state(["hello"], cursor(0, 3)), true);
      expect(result.cursor).toEqual(cursor(0, 2));
      expect(result.selectionAnchor).toEqual(cursor(0, 3));
    });

    it("continues extending existing selection with shift", () => {
      const result = moveCursorLeft(
        state(["hello"], cursor(0, 3), cursor(0, 5)),
        true
      );
      expect(result.cursor).toEqual(cursor(0, 2));
      expect(result.selectionAnchor).toEqual(cursor(0, 5));
    });
  });

  describe("moveCursorRight", () => {
    it("moves cursor one position right within a line", () => {
      const result = moveCursorRight(state(["hello"], cursor(0, 2)), false);
      expect(result.cursor).toEqual(cursor(0, 3));
    });

    it("wraps to start of next line at line end", () => {
      const result = moveCursorRight(state(["hello", "world"], cursor(0, 5)), false);
      expect(result.cursor).toEqual(cursor(1, 0));
    });

    it("stays at document end when already there", () => {
      const result = moveCursorRight(state(["hello"], cursor(0, 5)), false);
      expect(result.cursor).toEqual(cursor(0, 5));
    });

    it("clears selection and moves to selection end without shift", () => {
      const result = moveCursorRight(
        state(["hello"], cursor(0, 2), cursor(0, 5)),
        false
      );
      expect(result.cursor).toEqual(cursor(0, 5));
      expect(result.selectionAnchor).toBeNull();
    });

    it("extends selection with shift held", () => {
      const result = moveCursorRight(state(["hello"], cursor(0, 2)), true);
      expect(result.cursor).toEqual(cursor(0, 3));
      expect(result.selectionAnchor).toEqual(cursor(0, 2));
    });
  });

  describe("moveCursorUp", () => {
    it("moves cursor to previous line preserving column", () => {
      const result = moveCursorUp(state(["hello", "world"], cursor(1, 3)), false);
      expect(result.cursor).toEqual(cursor(0, 3));
    });

    it("clamps column to shorter line length", () => {
      const result = moveCursorUp(state(["hi", "world"], cursor(1, 4)), false);
      expect(result.cursor).toEqual(cursor(0, 2));
    });

    it("moves to start of document on first line", () => {
      const result = moveCursorUp(state(["hello"], cursor(0, 3)), false);
      expect(result.cursor).toEqual(cursor(0, 0));
    });

    it("extends selection with shift held", () => {
      const result = moveCursorUp(state(["hello", "world"], cursor(1, 3)), true);
      expect(result.cursor).toEqual(cursor(0, 3));
      expect(result.selectionAnchor).toEqual(cursor(1, 3));
    });
  });

  describe("moveCursorDown", () => {
    it("moves cursor to next line preserving column", () => {
      const result = moveCursorDown(state(["hello", "world"], cursor(0, 3)), false);
      expect(result.cursor).toEqual(cursor(1, 3));
    });

    it("clamps column to shorter line length", () => {
      const result = moveCursorDown(state(["hello", "hi"], cursor(0, 4)), false);
      expect(result.cursor).toEqual(cursor(1, 2));
    });

    it("moves to end of line on last line", () => {
      const result = moveCursorDown(state(["hello"], cursor(0, 2)), false);
      expect(result.cursor).toEqual(cursor(0, 5));
    });

    it("extends selection with shift held", () => {
      const result = moveCursorDown(state(["hello", "world"], cursor(0, 3)), true);
      expect(result.cursor).toEqual(cursor(1, 3));
      expect(result.selectionAnchor).toEqual(cursor(0, 3));
    });
  });

  describe("moveCursorToLineStart", () => {
    it("moves cursor to beginning of line", () => {
      const result = moveCursorToLineStart(state(["hello"], cursor(0, 3)), false);
      expect(result.cursor).toEqual(cursor(0, 0));
    });

    it("stays at start if already there", () => {
      const result = moveCursorToLineStart(state(["hello"], cursor(0, 0)), false);
      expect(result.cursor).toEqual(cursor(0, 0));
    });

    it("works on any line in document", () => {
      const result = moveCursorToLineStart(state(["first", "second", "third"], cursor(2, 4)), false);
      expect(result.cursor).toEqual(cursor(2, 0));
    });

    it("clears selection without shift", () => {
      const result = moveCursorToLineStart(
        state(["hello"], cursor(0, 5), cursor(0, 2)),
        false
      );
      expect(result.cursor).toEqual(cursor(0, 0));
      expect(result.selectionAnchor).toBeNull();
    });

    it("extends selection with shift held", () => {
      const result = moveCursorToLineStart(state(["hello"], cursor(0, 4)), true);
      expect(result.cursor).toEqual(cursor(0, 0));
      expect(result.selectionAnchor).toEqual(cursor(0, 4));
    });

    it("continues extending existing selection with shift", () => {
      const result = moveCursorToLineStart(
        state(["hello"], cursor(0, 3), cursor(0, 5)),
        true
      );
      expect(result.cursor).toEqual(cursor(0, 0));
      expect(result.selectionAnchor).toEqual(cursor(0, 5));
    });
  });

  describe("moveCursorToLineEnd", () => {
    it("moves cursor to end of line", () => {
      const result = moveCursorToLineEnd(state(["hello"], cursor(0, 2)), false);
      expect(result.cursor).toEqual(cursor(0, 5));
    });

    it("stays at end if already there", () => {
      const result = moveCursorToLineEnd(state(["hello"], cursor(0, 5)), false);
      expect(result.cursor).toEqual(cursor(0, 5));
    });

    it("works on any line in document", () => {
      const result = moveCursorToLineEnd(state(["first", "second", "third"], cursor(1, 0)), false);
      expect(result.cursor).toEqual(cursor(1, 6));
    });

    it("handles empty lines", () => {
      const result = moveCursorToLineEnd(state(["hello", "", "world"], cursor(1, 0)), false);
      expect(result.cursor).toEqual(cursor(1, 0));
    });

    it("clears selection without shift", () => {
      const result = moveCursorToLineEnd(
        state(["hello"], cursor(0, 2), cursor(0, 0)),
        false
      );
      expect(result.cursor).toEqual(cursor(0, 5));
      expect(result.selectionAnchor).toBeNull();
    });

    it("extends selection with shift held", () => {
      const result = moveCursorToLineEnd(state(["hello"], cursor(0, 1)), true);
      expect(result.cursor).toEqual(cursor(0, 5));
      expect(result.selectionAnchor).toEqual(cursor(0, 1));
    });
  });

  describe("moveCursorToDocStart", () => {
    it("moves cursor to first line preserving column", () => {
      const result = moveCursorToDocStart(state(["hello", "world", "test"], cursor(2, 3)), false);
      expect(result.cursor).toEqual(cursor(0, 3));
    });

    it("clamps column to first line length", () => {
      const result = moveCursorToDocStart(state(["hi", "world"], cursor(1, 4)), false);
      expect(result.cursor).toEqual(cursor(0, 2));
    });

    it("stays on first line if already there", () => {
      const result = moveCursorToDocStart(state(["hello", "world"], cursor(0, 3)), false);
      expect(result.cursor).toEqual(cursor(0, 3));
    });

    it("handles empty first line", () => {
      const result = moveCursorToDocStart(state(["", "world"], cursor(1, 3)), false);
      expect(result.cursor).toEqual(cursor(0, 0));
    });

    it("clears selection without shift", () => {
      const result = moveCursorToDocStart(
        state(["hello", "world"], cursor(1, 3), cursor(0, 0)),
        false
      );
      expect(result.selectionAnchor).toBeNull();
    });

    it("extends selection with shift held", () => {
      const result = moveCursorToDocStart(state(["hello", "world"], cursor(1, 3)), true);
      expect(result.cursor).toEqual(cursor(0, 3));
      expect(result.selectionAnchor).toEqual(cursor(1, 3));
    });

    it("continues extending existing selection with shift", () => {
      const result = moveCursorToDocStart(
        state(["hello", "world", "test"], cursor(2, 2), cursor(1, 3)),
        true
      );
      expect(result.cursor).toEqual(cursor(0, 2));
      expect(result.selectionAnchor).toEqual(cursor(1, 3));
    });
  });

  describe("moveCursorToDocEnd", () => {
    it("moves cursor to last line preserving column", () => {
      const result = moveCursorToDocEnd(state(["hello", "world", "test"], cursor(0, 3)), false);
      expect(result.cursor).toEqual(cursor(2, 3));
    });

    it("clamps column to last line length", () => {
      const result = moveCursorToDocEnd(state(["hello", "hi"], cursor(0, 4)), false);
      expect(result.cursor).toEqual(cursor(1, 2));
    });

    it("stays on last line if already there", () => {
      const result = moveCursorToDocEnd(state(["hello", "world"], cursor(1, 3)), false);
      expect(result.cursor).toEqual(cursor(1, 3));
    });

    it("handles empty last line", () => {
      const result = moveCursorToDocEnd(state(["hello", ""], cursor(0, 3)), false);
      expect(result.cursor).toEqual(cursor(1, 0));
    });

    it("clears selection without shift", () => {
      const result = moveCursorToDocEnd(
        state(["hello", "world"], cursor(0, 2), cursor(0, 5)),
        false
      );
      expect(result.selectionAnchor).toBeNull();
    });

    it("extends selection with shift held", () => {
      const result = moveCursorToDocEnd(state(["hello", "world"], cursor(0, 3)), true);
      expect(result.cursor).toEqual(cursor(1, 3));
      expect(result.selectionAnchor).toEqual(cursor(0, 3));
    });

    it("continues extending existing selection with shift", () => {
      const result = moveCursorToDocEnd(
        state(["hello", "world", "test"], cursor(0, 2), cursor(1, 3)),
        true
      );
      expect(result.cursor).toEqual(cursor(2, 2));
      expect(result.selectionAnchor).toEqual(cursor(1, 3));
    });
  });

  describe("setCursor", () => {
    it("sets cursor to specified position", () => {
      const result = setCursor(state(["hello", "world"], cursor(0, 0)), cursor(1, 3));
      expect(result.cursor).toEqual(cursor(1, 3));
    });

    it("clears any existing selection", () => {
      const result = setCursor(
        state(["hello", "world"], cursor(0, 5), cursor(0, 0)),
        cursor(1, 2)
      );
      expect(result.cursor).toEqual(cursor(1, 2));
      expect(result.selectionAnchor).toBeNull();
    });

    it("clamps line to valid range", () => {
      const result = setCursor(state(["hello"], cursor(0, 0)), cursor(5, 0));
      expect(result.cursor).toEqual(cursor(0, 0));
    });

    it("clamps negative line to zero", () => {
      const result = setCursor(state(["hello"], cursor(0, 3)), cursor(-1, 2));
      expect(result.cursor).toEqual(cursor(0, 2));
    });

    it("clamps column to line length", () => {
      const result = setCursor(state(["hello"], cursor(0, 0)), cursor(0, 10));
      expect(result.cursor).toEqual(cursor(0, 5));
    });

    it("clamps negative column to zero", () => {
      const result = setCursor(state(["hello"], cursor(0, 3)), cursor(0, -5));
      expect(result.cursor).toEqual(cursor(0, 0));
    });
  });

  describe("setCursorWithAnchor", () => {
    it("sets cursor and anchor to specified positions", () => {
      const result = setCursorWithAnchor(
        state(["hello", "world"], cursor(0, 0)),
        cursor(1, 3),
        cursor(0, 2)
      );
      expect(result.cursor).toEqual(cursor(1, 3));
      expect(result.selectionAnchor).toEqual(cursor(0, 2));
    });

    it("clamps cursor to valid range", () => {
      const result = setCursorWithAnchor(
        state(["hello"], cursor(0, 0)),
        cursor(5, 10),
        cursor(0, 2)
      );
      expect(result.cursor).toEqual(cursor(0, 5));
      expect(result.selectionAnchor).toEqual(cursor(0, 2));
    });

    it("clamps anchor to valid range", () => {
      const result = setCursorWithAnchor(
        state(["hello"], cursor(0, 0)),
        cursor(0, 2),
        cursor(5, 10)
      );
      expect(result.cursor).toEqual(cursor(0, 2));
      expect(result.selectionAnchor).toEqual(cursor(0, 5));
    });

    it("allows cursor and anchor on same position", () => {
      const result = setCursorWithAnchor(
        state(["hello"], cursor(0, 0)),
        cursor(0, 3),
        cursor(0, 3)
      );
      expect(result.cursor).toEqual(cursor(0, 3));
      expect(result.selectionAnchor).toEqual(cursor(0, 3));
    });

    it("works with multi-line documents", () => {
      const result = setCursorWithAnchor(
        state(["first", "second", "third"], cursor(0, 0)),
        cursor(2, 4),
        cursor(0, 1)
      );
      expect(result.cursor).toEqual(cursor(2, 4));
      expect(result.selectionAnchor).toEqual(cursor(0, 1));
    });
  });

  describe("selectAll", () => {
    it("selects entire single line document", () => {
      const result = selectAll(state(["hello"], cursor(0, 2)));
      expect(result.cursor).toEqual(cursor(0, 5));
      expect(result.selectionAnchor).toEqual(cursor(0, 0));
    });

    it("selects entire multi-line document", () => {
      const result = selectAll(state(["first", "second", "third"], cursor(1, 2)));
      expect(result.cursor).toEqual(cursor(2, 5));
      expect(result.selectionAnchor).toEqual(cursor(0, 0));
    });

    it("works with empty document", () => {
      const result = selectAll(state([""], cursor(0, 0)));
      expect(result.cursor).toEqual(cursor(0, 0));
      expect(result.selectionAnchor).toEqual(cursor(0, 0));
    });
  });
});

describe("Text Deletion", () => {
  describe("backspace", () => {
    it("deletes character before cursor", () => {
      const result = backspace(state(["hello"], cursor(0, 3)));
      expect(result.lines).toEqual(["helo"]);
      expect(result.cursor).toEqual(cursor(0, 2));
    });

    it("does nothing at document start", () => {
      const result = backspace(state(["hello"], cursor(0, 0)));
      expect(result.lines).toEqual(["hello"]);
      expect(result.cursor).toEqual(cursor(0, 0));
    });

    it("merges with previous line at line start", () => {
      const result = backspace(state(["hello", "world"], cursor(1, 0)));
      expect(result.lines).toEqual(["helloworld"]);
      expect(result.cursor).toEqual(cursor(0, 5));
    });

    it("deletes selection when present", () => {
      const result = backspace(state(["hello"], cursor(0, 4), cursor(0, 1)));
      expect(result.lines).toEqual(["ho"]);
      expect(result.cursor).toEqual(cursor(0, 1));
      expect(result.selectionAnchor).toBeNull();
    });

    it("deletes multi-line selection", () => {
      const result = backspace(
        state(["hello", "beautiful", "world"], cursor(2, 2), cursor(0, 2))
      );
      expect(result.lines).toEqual(["herld"]);
      expect(result.cursor).toEqual(cursor(0, 2));
    });

    it("deletes bullet prefix when cursor is at start of bullet text", () => {
      const result = backspace(state(["\t- hello"], cursor(0, 3)));
      expect(result.lines).toEqual(["hello"]);
      expect(result.cursor).toEqual(cursor(0, 0));
    });

    it("deletes bullet prefix when cursor is inside prefix", () => {
      const result = backspace(state(["\t- hello"], cursor(0, 1)));
      expect(result.lines).toEqual(["hello"]);
      expect(result.cursor).toEqual(cursor(0, 0));
    });

    it("merges with previous line when at start of bullet line", () => {
      const result = backspace(state(["above", "\t- hello"], cursor(1, 0)));
      expect(result.lines).toEqual(["above\t- hello"]);
      expect(result.cursor).toEqual(cursor(0, 5));
    });

    it("deletes nested bullet prefix", () => {
      const result = backspace(state(["\t\t- hello"], cursor(0, 4)));
      expect(result.lines).toEqual(["hello"]);
      expect(result.cursor).toEqual(cursor(0, 0));
    });
  });

  describe("deleteForward", () => {
    it("deletes character after cursor", () => {
      const result = deleteForward(state(["hello"], cursor(0, 2)));
      expect(result.lines).toEqual(["helo"]);
      expect(result.cursor).toEqual(cursor(0, 2));
    });

    it("does nothing at document end", () => {
      const result = deleteForward(state(["hello"], cursor(0, 5)));
      expect(result.lines).toEqual(["hello"]);
    });

    it("merges with next line at line end", () => {
      const result = deleteForward(state(["hello", "world"], cursor(0, 5)));
      expect(result.lines).toEqual(["helloworld"]);
      expect(result.cursor).toEqual(cursor(0, 5));
    });

    it("deletes selection when present", () => {
      const result = deleteForward(state(["hello"], cursor(0, 4), cursor(0, 1)));
      expect(result.lines).toEqual(["ho"]);
      expect(result.cursor).toEqual(cursor(0, 1));
    });
  });

  describe("deleteSelection", () => {
    it("removes selected text on single line", () => {
      const result = deleteSelection(state(["hello world"], cursor(0, 5), cursor(0, 0)));
      expect(result.lines).toEqual([" world"]);
      expect(result.cursor).toEqual(cursor(0, 0));
    });

    it("removes selected text across multiple lines", () => {
      const result = deleteSelection(
        state(["first", "second", "third"], cursor(2, 3), cursor(0, 2))
      );
      expect(result.lines).toEqual(["fird"]);
      expect(result.cursor).toEqual(cursor(0, 2));
    });

    it("returns unchanged state when no anchor", () => {
      const original = state(["hello"], cursor(0, 3), null);
      const result = deleteSelection(original);
      expect(result).toBe(original);
    });
  });
});

describe("Text Insertion", () => {
  describe("insertCharacter", () => {
    it("inserts character at cursor position", () => {
      const result = insertCharacter(state(["helo"], cursor(0, 3)), "l");
      expect(result.lines).toEqual(["hello"]);
      expect(result.cursor).toEqual(cursor(0, 4));
    });

    it("inserts at start of line", () => {
      const result = insertCharacter(state(["ello"], cursor(0, 0)), "h");
      expect(result.lines).toEqual(["hello"]);
      expect(result.cursor).toEqual(cursor(0, 1));
    });

    it("inserts at end of line", () => {
      const result = insertCharacter(state(["hell"], cursor(0, 4)), "o");
      expect(result.lines).toEqual(["hello"]);
      expect(result.cursor).toEqual(cursor(0, 5));
    });

    it("replaces selection when present", () => {
      const result = insertCharacter(
        state(["hello"], cursor(0, 5), cursor(0, 0)),
        "X"
      );
      expect(result.lines).toEqual(["X"]);
      expect(result.cursor).toEqual(cursor(0, 1));
    });

    it("handles special characters", () => {
      const result = insertCharacter(state(["hello"], cursor(0, 5)), "!");
      expect(result.lines).toEqual(["hello!"]);
    });
  });

  describe("insertTab", () => {
    it("inserts tab character at cursor", () => {
      const result = insertTab(state(["hello"], cursor(0, 0)));
      expect(result.lines).toEqual(["\thello"]);
      expect(result.cursor).toEqual(cursor(0, 1));
    });

    it("inserts tab in middle of line", () => {
      const result = insertTab(state(["hello"], cursor(0, 2)));
      expect(result.lines).toEqual(["he\tllo"]);
      expect(result.cursor).toEqual(cursor(0, 3));
    });

    it("replaces selection with tab", () => {
      const result = insertTab(state(["hello"], cursor(0, 5), cursor(0, 0)));
      expect(result.lines).toEqual(["\t"]);
      expect(result.cursor).toEqual(cursor(0, 1));
    });
  });

  describe("insertNewline", () => {
    it("splits line at cursor position", () => {
      const result = insertNewline(state(["hello"], cursor(0, 2)));
      expect(result.lines).toEqual(["he", "llo"]);
      expect(result.cursor).toEqual(cursor(1, 0));
    });

    it("creates empty line when at line start", () => {
      const result = insertNewline(state(["hello"], cursor(0, 0)));
      expect(result.lines).toEqual(["", "hello"]);
      expect(result.cursor).toEqual(cursor(1, 0));
    });

    it("creates empty line when at line end", () => {
      const result = insertNewline(state(["hello"], cursor(0, 5)));
      expect(result.lines).toEqual(["hello", ""]);
      expect(result.cursor).toEqual(cursor(1, 0));
    });

    it("replaces selection with newline", () => {
      const result = insertNewline(state(["hello world"], cursor(0, 11), cursor(0, 5)));
      expect(result.lines).toEqual(["hello", ""]);
      expect(result.cursor).toEqual(cursor(1, 0));
    });

    it("handles newline in multi-line document", () => {
      const result = insertNewline(state(["first", "second"], cursor(0, 3)));
      expect(result.lines).toEqual(["fir", "st", "second"]);
      expect(result.cursor).toEqual(cursor(1, 0));
    });
  });
});

describe("Initial State", () => {
  it("creates empty document with cursor at start", () => {
    const result = createInitialState();
    expect(result.lines).toEqual([""]);
    expect(result.cursor).toEqual(cursor(0, 0));
    expect(result.selectionAnchor).toBeNull();
  });
});

describe("Line Swapping", () => {
  describe("swapLineUp", () => {
    it("swaps current line with previous line", () => {
      const result = swapLineUp(state(["first", "second", "third"], cursor(1, 3)));
      expect(result.lines).toEqual(["second", "first", "third"]);
      expect(result.cursor).toEqual(cursor(0, 3));
    });

    it("does nothing on first line", () => {
      const original = state(["first", "second"], cursor(0, 2));
      const result = swapLineUp(original);
      expect(result).toBe(original);
    });

    it("clamps cursor column to new line length", () => {
      const result = swapLineUp(state(["hi", "hello"], cursor(1, 4)));
      expect(result.lines).toEqual(["hello", "hi"]);
      expect(result.cursor).toEqual(cursor(0, 4));
    });

    it("clamps cursor to shorter previous line", () => {
      const result = swapLineUp(state(["ab", "hello"], cursor(1, 5)));
      expect(result.lines).toEqual(["hello", "ab"]);
      expect(result.cursor).toEqual(cursor(0, 5));
    });

    it("clears selection", () => {
      const result = swapLineUp(state(["first", "second"], cursor(1, 3), cursor(1, 0)));
      expect(result.selectionAnchor).toBeNull();
    });

    it("works with last line", () => {
      const result = swapLineUp(state(["first", "second", "third"], cursor(2, 2)));
      expect(result.lines).toEqual(["first", "third", "second"]);
      expect(result.cursor).toEqual(cursor(1, 2));
    });
  });

  describe("swapLineDown", () => {
    it("swaps current line with next line", () => {
      const result = swapLineDown(state(["first", "second", "third"], cursor(0, 3)));
      expect(result.lines).toEqual(["second", "first", "third"]);
      expect(result.cursor).toEqual(cursor(1, 3));
    });

    it("does nothing on last line", () => {
      const original = state(["first", "second"], cursor(1, 2));
      const result = swapLineDown(original);
      expect(result).toBe(original);
    });

    it("clamps cursor column to new line length", () => {
      const result = swapLineDown(state(["hello", "hi"], cursor(0, 4)));
      expect(result.lines).toEqual(["hi", "hello"]);
      expect(result.cursor).toEqual(cursor(1, 4));
    });

    it("clamps cursor to shorter next line", () => {
      const result = swapLineDown(state(["hello", "ab"], cursor(0, 5)));
      expect(result.lines).toEqual(["ab", "hello"]);
      expect(result.cursor).toEqual(cursor(1, 5));
    });

    it("clears selection", () => {
      const result = swapLineDown(state(["first", "second"], cursor(0, 3), cursor(0, 0)));
      expect(result.selectionAnchor).toBeNull();
    });

    it("works with middle line", () => {
      const result = swapLineDown(state(["first", "second", "third"], cursor(1, 2)));
      expect(result.lines).toEqual(["first", "third", "second"]);
      expect(result.cursor).toEqual(cursor(2, 2));
    });
  });
});

describe("Complex Scenarios", () => {
  describe("typing a sentence", () => {
    it("builds up text character by character", () => {
      let s = createInitialState();
      s = insertCharacter(s, "H");
      s = insertCharacter(s, "i");
      s = insertCharacter(s, "!");
      expect(s.lines).toEqual(["Hi!"]);
      expect(s.cursor).toEqual(cursor(0, 3));
    });
  });

  describe("editing existing text", () => {
    it("supports navigating and inserting", () => {
      let s = state(["hello"], cursor(0, 5));
      s = moveCursorLeft(s, false);
      s = moveCursorLeft(s, false);
      s = insertCharacter(s, "X");
      expect(s.lines).toEqual(["helXlo"]);
    });
  });

  describe("select all and replace", () => {
    it("replaces all content with new text", () => {
      let s = state(["hello", "world"], cursor(0, 0));
      s = moveCursorDown(s, true);
      s = moveCursorDown(s, true);
      s = insertCharacter(s, "X");
      expect(s.lines).toEqual(["X"]);
    });
  });

  describe("multi-line editing", () => {
    it("supports creating and editing multiple lines", () => {
      let s = createInitialState();
      s = insertCharacter(s, "A");
      s = insertNewline(s);
      s = insertCharacter(s, "B");
      s = insertNewline(s);
      s = insertCharacter(s, "C");
      expect(s.lines).toEqual(["A", "B", "C"]);

      s = moveCursorUp(s, false);
      s = moveCursorLeft(s, false);
      s = backspace(s);
      expect(s.lines).toEqual(["AB", "C"]);
      expect(s.cursor).toEqual(cursor(0, 1));
    });

    it("deletes entire line by selecting and backspacing", () => {
      let s = state(["A", "B", "C"], cursor(1, 0));
      s = moveCursorDown(s, true);
      s = backspace(s);
      expect(s.lines).toEqual(["A", "C"]);
      expect(s.cursor).toEqual(cursor(1, 0));
    });
  });
});

describe("insertText", () => {
  it("inserts single-line text at cursor", () => {
    const result = insertText(state(["hello"], cursor(0, 5)), " world");
    expect(result.lines).toEqual(["hello world"]);
    expect(result.cursor).toEqual(cursor(0, 11));
  });

  it("inserts single-line text in middle of line", () => {
    const result = insertText(state(["helloworld"], cursor(0, 5)), " ");
    expect(result.lines).toEqual(["hello world"]);
    expect(result.cursor).toEqual(cursor(0, 6));
  });

  it("inserts multi-line text", () => {
    const result = insertText(state(["ab"], cursor(0, 1)), "X\nY\nZ");
    expect(result.lines).toEqual(["aX", "Y", "Zb"]);
    expect(result.cursor).toEqual(cursor(2, 1));
  });

  it("inserts two-line text", () => {
    const result = insertText(state(["hello"], cursor(0, 5)), "\nworld");
    expect(result.lines).toEqual(["hello", "world"]);
    expect(result.cursor).toEqual(cursor(1, 5));
  });

  it("inserts at beginning of line", () => {
    const result = insertText(state(["world"], cursor(0, 0)), "hello ");
    expect(result.lines).toEqual(["hello world"]);
    expect(result.cursor).toEqual(cursor(0, 6));
  });

  it("inserts multi-line at beginning", () => {
    const result = insertText(state(["end"], cursor(0, 0)), "start\nmiddle\n");
    expect(result.lines).toEqual(["start", "middle", "end"]);
    expect(result.cursor).toEqual(cursor(2, 0));
  });

  it("replaces selection with single-line text", () => {
    const result = insertText(state(["hello world"], cursor(0, 5), cursor(0, 0)), "hi");
    expect(result.lines).toEqual(["hi world"]);
    expect(result.cursor).toEqual(cursor(0, 2));
  });

  it("replaces selection with multi-line text", () => {
    const result = insertText(state(["hello world"], cursor(0, 5), cursor(0, 0)), "a\nb\nc");
    expect(result.lines).toEqual(["a", "b", "c world"]);
    expect(result.cursor).toEqual(cursor(2, 1));
  });

  it("replaces multi-line selection", () => {
    const result = insertText(state(["first", "second", "third"], cursor(2, 0), cursor(0, 0)), "X");
    expect(result.lines).toEqual(["Xthird"]);
    expect(result.cursor).toEqual(cursor(0, 1));
  });

  it("handles empty text", () => {
    const result = insertText(state(["hello"], cursor(0, 5)), "");
    expect(result.lines).toEqual(["hello"]);
    expect(result.cursor).toEqual(cursor(0, 5));
  });

  it("inserts into empty document", () => {
    const result = insertText(state([""], cursor(0, 0)), "hello\nworld");
    expect(result.lines).toEqual(["hello", "world"]);
    expect(result.cursor).toEqual(cursor(1, 5));
  });
});

describe("Heading Functions", () => {
  describe("getHeadingLevel", () => {
    it("returns level for h1-h6 headings", () => {
      expect(getHeadingLevel("# Heading")).toBe(1);
      expect(getHeadingLevel("## Heading")).toBe(2);
      expect(getHeadingLevel("### Heading")).toBe(3);
      expect(getHeadingLevel("#### Heading")).toBe(4);
      expect(getHeadingLevel("##### Heading")).toBe(5);
      expect(getHeadingLevel("###### Heading")).toBe(6);
    });

    it("returns Infinity for non-headings", () => {
      expect(getHeadingLevel("Regular text")).toBe(Infinity);
      expect(getHeadingLevel("")).toBe(Infinity);
      expect(getHeadingLevel("#NoSpace")).toBe(Infinity);
      expect(getHeadingLevel("####### Too many")).toBe(Infinity);
    });
  });

  describe("isHeadingLine", () => {
    it("returns true for valid headings", () => {
      expect(isHeadingLine("# Heading")).toBe(true);
      expect(isHeadingLine("## Heading")).toBe(true);
    });

    it("returns false for non-headings", () => {
      expect(isHeadingLine("Regular text")).toBe(false);
      expect(isHeadingLine("#NoSpace")).toBe(false);
    });
  });

  describe("getHiddenLines", () => {
    it("returns empty set when cursor not on heading", () => {
      const s = state(["Regular text", "# Heading"], cursor(0, 0));
      const hidden = getHiddenLines(s, 0);
      expect(hidden.size).toBe(0);
    });

    it("hides lines smaller than current heading level", () => {
      const s = state([
        "# Title",
        "## Section A",
        "content A",
        "### Sub A",
        "## Section B",
        "content B",
      ], cursor(1, 0));
      const hidden = getHiddenLines(s, 1);
      expect(hidden.has(0)).toBe(false);
      expect(hidden.has(1)).toBe(false);
      expect(hidden.has(2)).toBe(true);
      expect(hidden.has(3)).toBe(true);
      expect(hidden.has(4)).toBe(false);
      expect(hidden.has(5)).toBe(true);
    });

    it("hides all content and subheadings for level 1", () => {
      const s = state([
        "# Title",
        "intro",
        "## Section",
        "content",
      ], cursor(0, 0));
      const hidden = getHiddenLines(s, 0);
      expect(hidden.has(0)).toBe(false);
      expect(hidden.has(1)).toBe(true);
      expect(hidden.has(2)).toBe(true);
      expect(hidden.has(3)).toBe(true);
    });
  });

  describe("swapHeadingSectionUp", () => {
    it("swaps entire section with previous sibling", () => {
      const s = state([
        "## Section A",
        "content A",
        "## Section B",
        "content B",
      ], cursor(2, 0));
      const hidden = getHiddenLines(s, 2);
      const result = swapHeadingSectionUp(s, hidden);
      expect(result.lines).toEqual([
        "## Section B",
        "content B",
        "## Section A",
        "content A",
      ]);
      expect(result.cursor.line).toBe(0);
    });

    it("does not move when at first position", () => {
      const s = state([
        "## Section A",
        "content A",
        "## Section B",
      ], cursor(0, 0));
      const hidden = getHiddenLines(s, 0);
      const result = swapHeadingSectionUp(s, hidden);
      expect(result.lines).toEqual(s.lines);
    });

    it("includes subheadings in the swap", () => {
      const s = state([
        "## Section A",
        "### Sub A1",
        "## Section B",
        "### Sub B1",
      ], cursor(2, 0));
      const hidden = getHiddenLines(s, 2);
      const result = swapHeadingSectionUp(s, hidden);
      expect(result.lines).toEqual([
        "## Section B",
        "### Sub B1",
        "## Section A",
        "### Sub A1",
      ]);
    });

    it("falls back to line swap for non-heading lines", () => {
      const s = state(["line A", "line B"], cursor(1, 0));
      const result = swapHeadingSectionUp(s, new Set());
      expect(result.lines).toEqual(["line B", "line A"]);
      expect(result.cursor.line).toBe(0);
    });
  });

  describe("swapHeadingSectionDown", () => {
    it("swaps entire section with next sibling", () => {
      const s = state([
        "## Section A",
        "content A",
        "## Section B",
        "content B",
      ], cursor(0, 0));
      const hidden = getHiddenLines(s, 0);
      const result = swapHeadingSectionDown(s, hidden);
      expect(result.lines).toEqual([
        "## Section B",
        "content B",
        "## Section A",
        "content A",
      ]);
      expect(result.cursor.line).toBe(2);
    });

    it("does not move when at last position", () => {
      const s = state([
        "## Section A",
        "## Section B",
        "content B",
      ], cursor(1, 0));
      const hidden = getHiddenLines(s, 1);
      const result = swapHeadingSectionDown(s, hidden);
      expect(result.lines).toEqual(s.lines);
    });

    it("includes subheadings in the swap", () => {
      const s = state([
        "## Section A",
        "### Sub A1",
        "content",
        "## Section B",
        "### Sub B1",
      ], cursor(0, 0));
      const hidden = getHiddenLines(s, 0);
      const result = swapHeadingSectionDown(s, hidden);
      expect(result.lines).toEqual([
        "## Section B",
        "### Sub B1",
        "## Section A",
        "### Sub A1",
        "content",
      ]);
    });

    it("falls back to line swap for non-heading lines", () => {
      const s = state(["line A", "line B"], cursor(0, 0));
      const result = swapHeadingSectionDown(s, new Set());
      expect(result.lines).toEqual(["line B", "line A"]);
      expect(result.cursor.line).toBe(1);
    });
  });

  describe("getHiddenLines with selection", () => {
    it("uses smallest heading level in selection range", () => {
      const s = state([
        "# Title",
        "## Section A",
        "### Sub A",
        "## Section B",
      ], cursor(1, 0));
      const hidden = getHiddenLines(s, 1, { start: 1, end: 3 });
      expect(hidden.has(0)).toBe(false);
      expect(hidden.has(1)).toBe(false);
      expect(hidden.has(2)).toBe(false);
      expect(hidden.has(3)).toBe(false);
    });

    it("returns empty set when selection contains regular lines", () => {
      const s = state([
        "## Section A",
        "content",
        "## Section B",
      ], cursor(0, 0));
      const hidden = getHiddenLines(s, 0, { start: 0, end: 1 });
      expect(hidden.size).toBe(0);
    });

    it("hides based on smallest heading in selection", () => {
      const s = state([
        "# Title",
        "## Section A",
        "## Section B",
        "### Sub B",
        "content",
      ], cursor(1, 0));
      const hidden = getHiddenLines(s, 1, { start: 1, end: 2 });
      expect(hidden.has(0)).toBe(false);
      expect(hidden.has(3)).toBe(true);
      expect(hidden.has(4)).toBe(true);
    });
  });

  describe("swapHeadingSectionUp with selection", () => {
    it("swaps selected lines with previous line", () => {
      const s = state([
        "line 1",
        "line 2",
        "line 3",
        "line 4",
        "line 5",
      ], cursor(3, 0), cursor(1, 0));
      const result = swapHeadingSectionUp(s, new Set());
      expect(result.lines).toEqual([
        "line 2",
        "line 3",
        "line 4",
        "line 1",
        "line 5",
      ]);
      expect(result.cursor.line).toBe(2);
      expect(result.selectionAnchor?.line).toBe(0);
    });

    it("swaps selection including hidden content", () => {
      const s = state([
        "## Section A",
        "## Section B",
        "content B",
        "## Section C",
      ], cursor(1, 0), cursor(1, 5));
      const hidden = getHiddenLines(s, 1, { start: 1, end: 1 });
      const result = swapHeadingSectionUp(s, hidden);
      expect(result.lines).toEqual([
        "## Section B",
        "content B",
        "## Section A",
        "## Section C",
      ]);
    });
  });

  describe("swapHeadingSectionDown with selection", () => {
    it("swaps selected lines with next line", () => {
      const s = state([
        "line 1",
        "line 2",
        "line 3",
        "line 4",
        "line 5",
      ], cursor(1, 0), cursor(3, 0));
      const result = swapHeadingSectionDown(s, new Set());
      expect(result.lines).toEqual([
        "line 1",
        "line 5",
        "line 2",
        "line 3",
        "line 4",
      ]);
      expect(result.cursor.line).toBe(2);
      expect(result.selectionAnchor?.line).toBe(4);
    });

    it("swaps selection including hidden content", () => {
      const s = state([
        "## Section A",
        "content A",
        "## Section B",
        "## Section C",
      ], cursor(0, 0), cursor(0, 5));
      const hidden = getHiddenLines(s, 0, { start: 0, end: 0 });
      const result = swapHeadingSectionDown(s, hidden);
      expect(result.lines).toEqual([
        "## Section B",
        "## Section A",
        "content A",
        "## Section C",
      ]);
    });
  });

  describe("getCollapsedHiddenLines", () => {
    it("hides content under collapsed heading", () => {
      const lines = [
        "## Section A",
        "content A",
        "### Sub A",
        "## Section B",
      ];
      const collapsed = new Set([0]);
      const hidden = getCollapsedHiddenLines(lines, collapsed);
      expect(hidden.has(0)).toBe(false);
      expect(hidden.has(1)).toBe(true);
      expect(hidden.has(2)).toBe(true);
      expect(hidden.has(3)).toBe(false);
    });

    it("handles multiple collapsed headings", () => {
      const lines = [
        "## Section A",
        "content A",
        "## Section B",
        "content B",
        "## Section C",
      ];
      const collapsed = new Set([0, 2]);
      const hidden = getCollapsedHiddenLines(lines, collapsed);
      expect(hidden.has(1)).toBe(true);
      expect(hidden.has(3)).toBe(true);
      expect(hidden.has(4)).toBe(false);
    });

    it("returns empty set when no headings collapsed", () => {
      const lines = [
        "## Section A",
        "content A",
      ];
      const hidden = getCollapsedHiddenLines(lines, new Set());
      expect(hidden.size).toBe(0);
    });

    it("ignores invalid line indices", () => {
      const lines = ["## Section A", "content"];
      const collapsed = new Set([100]);
      const hidden = getCollapsedHiddenLines(lines, collapsed);
      expect(hidden.size).toBe(0);
    });
  });

  describe("isCollapsedHeading", () => {
    it("returns true for collapsed heading", () => {
      expect(isCollapsedHeading("^ ## Section A")).toBe(true);
    });

    it("returns false for normal heading", () => {
      expect(isCollapsedHeading("## Section A")).toBe(false);
    });

    it("returns false for plain text", () => {
      expect(isCollapsedHeading("just text")).toBe(false);
    });

    it("returns true for all heading levels", () => {
      expect(isCollapsedHeading("^ # H1")).toBe(true);
      expect(isCollapsedHeading("^ ### H3")).toBe(true);
      expect(isCollapsedHeading("^ ###### H6")).toBe(true);
    });
  });

  describe("getHeadingLevel with collapsed prefix", () => {
    it("returns correct level for collapsed heading", () => {
      expect(getHeadingLevel("^ ## Section")).toBe(2);
    });

    it("returns correct level for collapsed h1", () => {
      expect(getHeadingLevel("^ # Title")).toBe(1);
    });
  });

  describe("isHeadingLine with collapsed prefix", () => {
    it("returns true for collapsed heading", () => {
      expect(isHeadingLine("^ ## Section")).toBe(true);
    });
  });

  describe("getCollapsedHiddenLines with ^ prefix", () => {
    it("hides content under collapsed heading with ^ prefix", () => {
      const lines = [
        "^ ## Section A",
        "content A",
        "### Sub A",
        "## Section B",
      ];
      const collapsed = new Set([0]);
      const hidden = getCollapsedHiddenLines(lines, collapsed);
      expect(hidden.has(0)).toBe(false);
      expect(hidden.has(1)).toBe(true);
      expect(hidden.has(2)).toBe(true);
      expect(hidden.has(3)).toBe(false);
    });
  });
});
