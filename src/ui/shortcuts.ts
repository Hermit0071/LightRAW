export type ShortcutTool = "library" | "adjust" | "crop" | "mask" | "preset" | "export";

export type AppShortcut =
  | { type: "import" | "undo" | "redo" | "compare" | "delete" | "rename" }
  | { type: "tool"; tool: ShortcutTool }
  | { type: "rating"; value: 0 | 1 | 2 | 3 | 4 | 5 };

interface ShortcutKey {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export function resolveShortcut(event: ShortcutKey): AppShortcut | null {
  const key = event.key.toLowerCase();
  const command = event.metaKey || event.ctrlKey;
  if (event.altKey) return null;
  if (command && key === "o") return { type: "import" };
  if (command && key === "z") return { type: event.shiftKey ? "redo" : "undo" };
  if (command && key === "y") return { type: "redo" };
  if (command && event.shiftKey && key === "e") return { type: "tool", tool: "export" };
  if (command) return null;
  if (key === "delete" || key === "backspace") return { type: "delete" };
  if (key === "f2") return { type: "rename" };
  if (event.key === "\\") return { type: "compare" };
  if (/^[0-5]$/.test(key)) return { type: "rating", value: Number(key) as 0 | 1 | 2 | 3 | 4 | 5 };
  const tool = ({
    g: "library", d: "adjust", e: "adjust", r: "crop", c: "crop", m: "mask", p: "preset", x: "export",
  } as const)[key as "g" | "d" | "e" | "r" | "c" | "m" | "p" | "x"];
  return tool ? { type: "tool", tool } : null;
}
