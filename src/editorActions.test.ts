import { describe, it, expect } from "vitest";
import {
  type EditorState,
  type CursorPosition,
  posEqual,
  posBefore,
  getSelectionBounds,
  hasSelection,
  deleteSelection,
  moveCursorLeft,
  moveCursorRight,
  moveCursorUp,
  moveCursorDown,
  backspace,
  deleteForward,
  insertTab,
  insertNewline,
  insertCharacter,
  createInitialState,
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
