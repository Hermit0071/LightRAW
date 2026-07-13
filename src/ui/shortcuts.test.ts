import { describe, expect, it } from "vitest";
import { resolveShortcut } from "./shortcuts";

const key = (value: string, modifiers: Partial<Parameters<typeof resolveShortcut>[0]> = {}) => ({
  key: value,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...modifiers,
});

describe("application shortcuts", () => {
  it("maps undo and redo on macOS and Windows", () => {
    expect(resolveShortcut(key("z", { metaKey: true }))).toEqual({ type: "undo" });
    expect(resolveShortcut(key("Z", { ctrlKey: true, shiftKey: true }))).toEqual({ type: "redo" });
    expect(resolveShortcut(key("y", { ctrlKey: true }))).toEqual({ type: "redo" });
  });

  it("maps common import, export and workspace shortcuts", () => {
    expect(resolveShortcut(key("o", { metaKey: true }))).toEqual({ type: "import" });
    expect(resolveShortcut(key("e", { ctrlKey: true, shiftKey: true }))).toEqual({ type: "tool", tool: "export" });
    expect(resolveShortcut(key("d"))).toEqual({ type: "tool", tool: "adjust" });
    expect(resolveShortcut(key("r"))).toEqual({ type: "tool", tool: "crop" });
  });

  it("keeps the existing panel aliases and rating keys", () => {
    expect(resolveShortcut(key("e"))).toEqual({ type: "tool", tool: "adjust" });
    expect(resolveShortcut(key("c"))).toEqual({ type: "tool", tool: "crop" });
    expect(resolveShortcut(key("x"))).toEqual({ type: "tool", tool: "export" });
    expect(resolveShortcut(key("4"))).toEqual({ type: "rating", value: 4 });
  });

  it("does not treat unrelated modified keys as application shortcuts", () => {
    expect(resolveShortcut(key("g", { altKey: true }))).toBeNull();
    expect(resolveShortcut(key("o", { ctrlKey: true, altKey: true }))).toBeNull();
    expect(resolveShortcut(key("z", { ctrlKey: true, altKey: true }))).toBeNull();
    expect(resolveShortcut(key("s", { ctrlKey: true }))).toBeNull();
  });
});
