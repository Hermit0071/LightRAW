import { describe, expect, it } from "vitest";
import { createLibraryPhoto } from "../library/catalog";
import {
  clampInspectorWidth,
  filterLibraryPhotos,
  normalizeWorkspaceTheme,
} from "./workspace-layout";

const photos = [
  createLibraryPhoto({ path: "/a.jpg", fileName: "a.jpg", sourceWidth: 10, sourceHeight: 10, format: "JPEG", camera: null }, "a", "2026-01-01T00:00:00Z", 0),
  createLibraryPhoto({ path: "/b.jpg", fileName: "b.jpg", sourceWidth: 10, sourceHeight: 10, format: "JPEG", camera: null }, "b", "2026-01-02T00:00:00Z", 4),
];

describe("workspace layout", () => {
  it("filters the real catalog without changing its order", () => {
    expect(filterLibraryPhotos(photos, "all", new Set()).map((photo) => photo.id)).toEqual(["a", "b"]);
    expect(filterLibraryPhotos(photos, "rated", new Set()).map((photo) => photo.id)).toEqual(["b"]);
    expect(filterLibraryPhotos(photos, "selected", new Set(["a"])).map((photo) => photo.id)).toEqual(["a"]);
  });

  it("keeps the inspector inside usable bounds", () => {
    expect(clampInspectorWidth(180)).toBe(280);
    expect(clampInspectorWidth(394.5)).toBe(394.5);
    expect(clampInspectorWidth(900)).toBe(520);
  });

  it("recovers a supported theme and falls back safely", () => {
    expect(normalizeWorkspaceTheme("grey")).toBe("grey");
    expect(normalizeWorkspaceTheme("light")).toBe("light");
    expect(normalizeWorkspaceTheme("sepia")).toBe("dark");
    expect(normalizeWorkspaceTheme(null)).toBe("dark");
  });
});
