import { describe, it, expect } from "vitest";
import { isWordChar, getWordBoundsAt, displayColToRawCol } from "./useMouseSelection";

describe("isWordChar", () => {
  it("returns true for lowercase letters", () => {
    expect(isWordChar("a")).toBe(true);
    expect(isWordChar("z")).toBe(true);
    expect(isWordChar("m")).toBe(true);
  });

  it("returns true for uppercase letters", () => {
    expect(isWordChar("A")).toBe(true);
    expect(isWordChar("Z")).toBe(true);
    expect(isWordChar("M")).toBe(true);
  });

  it("returns true for digits", () => {
    expect(isWordChar("0")).toBe(true);
    expect(isWordChar("9")).toBe(true);
    expect(isWordChar("5")).toBe(true);
  });

  it("returns false for spaces", () => {
    expect(isWordChar(" ")).toBe(false);
    expect(isWordChar("\t")).toBe(false);
  });

  it("returns false for punctuation", () => {
    expect(isWordChar(".")).toBe(false);
    expect(isWordChar(",")).toBe(false);
    expect(isWordChar("!")).toBe(false);
    expect(isWordChar("-")).toBe(false);
    expect(isWordChar("_")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isWordChar("")).toBe(false);
  });
});

describe("getWordBoundsAt", () => {
  it("returns null for empty line", () => {
    expect(getWordBoundsAt("", 0)).toBe(null);
  });

  it("returns null when cursor is on non-word character and not touching a word", () => {
    expect(getWordBoundsAt("   ", 1)).toBe(null);
    expect(getWordBoundsAt("...", 1)).toBe(null);
  });

  it("returns null for out of bounds column", () => {
    expect(getWordBoundsAt("hello", -1)).toBe(null);
    expect(getWordBoundsAt("hello", 10)).toBe(null);
  });

  it("selects word when cursor is at the start of word", () => {
    expect(getWordBoundsAt("hello world", 0)).toEqual({ start: 0, end: 5 });
  });

  it("selects word when cursor is in the middle of word", () => {
    expect(getWordBoundsAt("hello world", 2)).toEqual({ start: 0, end: 5 });
  });

  it("selects word when cursor is at the end of word", () => {
    expect(getWordBoundsAt("hello world", 5)).toEqual({ start: 0, end: 5 });
  });

  it("selects second word when cursor is on it", () => {
    expect(getWordBoundsAt("hello world", 6)).toEqual({ start: 6, end: 11 });
    expect(getWordBoundsAt("hello world", 8)).toEqual({ start: 6, end: 11 });
  });

  it("selects word containing numbers", () => {
    expect(getWordBoundsAt("test123 foo", 4)).toEqual({ start: 0, end: 7 });
    expect(getWordBoundsAt("abc123def", 5)).toEqual({ start: 0, end: 9 });
  });

  it("selects word when cursor is immediately after word (touching)", () => {
    expect(getWordBoundsAt("hello ", 5)).toEqual({ start: 0, end: 5 });
  });

  it("handles single character words", () => {
    expect(getWordBoundsAt("a b c", 0)).toEqual({ start: 0, end: 1 });
    expect(getWordBoundsAt("a b c", 2)).toEqual({ start: 2, end: 3 });
  });

  it("handles word at end of line", () => {
    expect(getWordBoundsAt("foo bar", 5)).toEqual({ start: 4, end: 7 });
    expect(getWordBoundsAt("foo bar", 7)).toEqual({ start: 4, end: 7 });
  });

  it("handles line with only one word", () => {
    expect(getWordBoundsAt("hello", 0)).toEqual({ start: 0, end: 5 });
    expect(getWordBoundsAt("hello", 2)).toEqual({ start: 0, end: 5 });
    expect(getWordBoundsAt("hello", 5)).toEqual({ start: 0, end: 5 });
  });

  it("handles words separated by multiple spaces", () => {
    expect(getWordBoundsAt("hello   world", 0)).toEqual({ start: 0, end: 5 });
    expect(getWordBoundsAt("hello   world", 8)).toEqual({ start: 8, end: 13 });
  });

  it("returns null when cursor is between words not touching either", () => {
    expect(getWordBoundsAt("hello   world", 6)).toBe(null);
    expect(getWordBoundsAt("hello   world", 7)).toBe(null);
  });

  it("handles words with punctuation boundaries", () => {
    expect(getWordBoundsAt("hello.world", 0)).toEqual({ start: 0, end: 5 });
    expect(getWordBoundsAt("hello.world", 6)).toEqual({ start: 6, end: 11 });
  });
});

describe("displayColToRawCol", () => {
  describe("plain text (no formatting)", () => {
    it("maps display positions to raw positions identity", () => {
      expect(displayColToRawCol("hello", 0, false)).toBe(0);
      expect(displayColToRawCol("hello", 3, false)).toBe(3);
      expect(displayColToRawCol("hello", 5, false)).toBe(5);
    });
  });

  describe("bold text on non-cursor line (markers hidden)", () => {
    it("maps start of bold content to raw position after opening marker", () => {
      expect(displayColToRawCol("**bold**", 0, false)).toBe(2);
    });

    it("maps middle of bold content correctly", () => {
      expect(displayColToRawCol("**bold**", 2, false)).toBe(4);
    });

    it("maps end of bold content to raw position before closing marker", () => {
      expect(displayColToRawCol("**bold**", 4, false)).toBe(6);
    });
  });

  describe("bold text on cursor line (markers visible)", () => {
    it("maps start of opening marker", () => {
      expect(displayColToRawCol("**bold**", 0, true)).toBe(0);
    });

    it("maps inside opening marker", () => {
      expect(displayColToRawCol("**bold**", 1, true)).toBe(1);
    });

    it("maps start of bold content (after opening marker)", () => {
      expect(displayColToRawCol("**bold**", 2, true)).toBe(2);
    });

    it("maps middle of bold content", () => {
      expect(displayColToRawCol("**bold**", 4, true)).toBe(4);
    });

    it("maps end of bold content (before closing marker)", () => {
      expect(displayColToRawCol("**bold**", 6, true)).toBe(6);
    });
  });

  describe("italic text on non-cursor line", () => {
    it("maps start of italic content", () => {
      expect(displayColToRawCol("*italic*", 0, false)).toBe(1);
    });

    it("maps middle of italic content", () => {
      expect(displayColToRawCol("*italic*", 3, false)).toBe(4);
    });
  });

  describe("mixed text with bold segment", () => {
    it("maps plain text before bold correctly", () => {
      expect(displayColToRawCol("hello **world**", 0, false)).toBe(0);
      expect(displayColToRawCol("hello **world**", 4, false)).toBe(4);
    });

    it("maps inside bold segment on non-cursor line", () => {
      expect(displayColToRawCol("hello **world**", 7, false)).toBe(9);
      expect(displayColToRawCol("hello **world**", 9, false)).toBe(11);
    });

    it("maps inside bold segment on cursor line", () => {
      expect(displayColToRawCol("hello **world**", 8, true)).toBe(8);
      expect(displayColToRawCol("hello **world**", 11, true)).toBe(11);
    });
  });

  describe("underline and strikethrough on non-cursor line", () => {
    it("maps inside underline content", () => {
      expect(displayColToRawCol("__text__", 0, false)).toBe(2);
      expect(displayColToRawCol("__text__", 2, false)).toBe(4);
    });

    it("maps inside strikethrough content", () => {
      expect(displayColToRawCol("~~text~~", 0, false)).toBe(2);
      expect(displayColToRawCol("~~text~~", 2, false)).toBe(4);
    });
  });
});
