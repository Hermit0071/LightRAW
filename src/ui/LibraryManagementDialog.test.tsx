import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { createDefaultDevelopRecipe } from "../editor/develop-recipe";
import type { LibraryPhoto } from "../library/catalog";
import { LibraryManagementDialog } from "./LibraryManagementDialog";

const photo = (id: string, path: string): LibraryPhoto => ({
  id,
  path,
  fileName: path.split("/").at(-1) ?? path,
  importedAt: "2026-07-13T00:00:00.000Z",
  rating: 0,
  sourceWidth: 100,
  sourceHeight: 100,
  format: "JPEG",
  camera: null,
  recipe: createDefaultDevelopRecipe(),
  thumbnail: null,
});

const callbacks = () => ({
  onRenameValue: vi.fn(),
  onRename: vi.fn(),
  onRemoveCatalog: vi.fn(),
  onTrash: vi.fn(),
  onCancel: vi.fn(),
});

describe("LibraryManagementDialog", () => {
  it("requires an explicit choice between catalog removal and system trash", () => {
    const handlers = callbacks();
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<LibraryManagementDialog mode="delete" photos={[photo("1", "/photos/a.jpg")]} renameValue="" busy={false} {...handlers} />); });
    const buttons = renderer.root.findAllByType("button");
    const catalogButton = buttons.find((button) => button.findAllByType("strong").some((node) => node.children.join("") === "仅从图库移除"));
    const trashButton = buttons.find((button) => button.findAllByType("strong").some((node) => node.children.join("") === "移到系统废纸篓 / 回收站"));
    expect(catalogButton).toBeDefined();
    expect(trashButton).toBeDefined();
    act(() => catalogButton?.props.onClick());
    act(() => trashButton?.props.onClick());
    expect(handlers.onRemoveCatalog).toHaveBeenCalledOnce();
    expect(handlers.onTrash).toHaveBeenCalledOnce();
  });

  it("shows every generated name before a batch rename", () => {
    const photos = Array.from({ length: 6 }, (_, index) => photo(String(index), `/photos/source-${index + 1}.jpg`));
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(<LibraryManagementDialog mode="rename" photos={photos} renameValue="Trip" busy={false} {...callbacks()} />); });
    const previewNames = renderer.root.findAllByType("strong").map((node) => node.children.join(""));
    expect(previewNames).toEqual(["Trip-001.jpg", "Trip-002.jpg", "Trip-003.jpg", "Trip-004.jpg", "Trip-005.jpg", "Trip-006.jpg"]);
  });
});
