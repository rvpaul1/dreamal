import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUndoRedo } from "./useUndoRedo";
import type { EditorState } from "./editorActions";

function makeState(text: string, cursorCol?: number): EditorState {
  return {
    lines: [text],
    cursor: { line: 0, col: cursorCol ?? text.length },
    selectionAnchor: null,
  };
}

describe("useUndoRedo", () => {
  it("returns null when undoing with empty history", () => {
    const { result } = renderHook(() => useUndoRedo());
    const current = makeState("hello");
    expect(result.current.undo(current)).toBeNull();
  });

  it("returns null when redoing with empty history", () => {
    const { result } = renderHook(() => useUndoRedo());
    const current = makeState("hello");
    expect(result.current.redo(current)).toBeNull();
  });

  it("undoes a single change", () => {
    const { result } = renderHook(() => useUndoRedo());
    const state1 = makeState("hello");
    const state2 = makeState("hello world");

    act(() => result.current.pushState(state1));

    const undone = result.current.undo(state2);
    expect(undone).toEqual(state1);
  });

  it("redoes after undo", () => {
    const { result } = renderHook(() => useUndoRedo());
    const state1 = makeState("hello");
    const state2 = makeState("hello world");

    act(() => result.current.pushState(state1));

    const undone = result.current.undo(state2);
    expect(undone).toEqual(state1);

    const redone = result.current.redo(state1);
    expect(redone).toEqual(state2);
  });

  it("undoes multiple changes in order", () => {
    const { result } = renderHook(() => useUndoRedo());
    const state1 = makeState("a");
    const state2 = makeState("ab");
    const state3 = makeState("abc");

    act(() => {
      result.current.pushState(state1);
      result.current.pushState(state2);
    });

    const undone1 = result.current.undo(state3);
    expect(undone1).toEqual(state2);

    const undone2 = result.current.undo(state2);
    expect(undone2).toEqual(state1);

    expect(result.current.undo(state1)).toBeNull();
  });

  it("clears redo stack on new change after undo", () => {
    const { result } = renderHook(() => useUndoRedo());
    const state1 = makeState("a");
    const state2 = makeState("ab");
    const state3 = makeState("ac");

    act(() => result.current.pushState(state1));

    result.current.undo(state2);

    act(() => result.current.pushState(state1));

    expect(result.current.redo(state3)).toBeNull();
  });

  it("clear resets all history", () => {
    const { result } = renderHook(() => useUndoRedo());
    const state1 = makeState("a");
    const state2 = makeState("ab");

    act(() => result.current.pushState(state1));

    act(() => result.current.clear());

    expect(result.current.undo(state2)).toBeNull();
  });

  it("does not push duplicate states", () => {
    const { result } = renderHook(() => useUndoRedo());
    const state1 = makeState("hello");
    const state2 = makeState("hello");

    act(() => {
      result.current.pushState(state1);
      result.current.pushState(state2);
    });

    const undone = result.current.undo(makeState("world"));
    expect(undone).toEqual(state1);
    expect(result.current.undo(state1)).toBeNull();
  });

  it("supports undo-redo-undo cycle", () => {
    const { result } = renderHook(() => useUndoRedo());
    const state1 = makeState("a");
    const state2 = makeState("ab");

    act(() => result.current.pushState(state1));

    const undone = result.current.undo(state2);
    expect(undone).toEqual(state1);

    const redone = result.current.redo(state1);
    expect(redone).toEqual(state2);

    const undone2 = result.current.undo(state2);
    expect(undone2).toEqual(state1);
  });
});
