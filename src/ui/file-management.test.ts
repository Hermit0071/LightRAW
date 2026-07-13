import { describe, expect, it } from "vitest";
import { createLibraryPhoto } from "../library/catalog";
import { buildRenameRequests } from "./file-management";

function photo(path: string) {
  return createLibraryPhoto({ path, fileName: path.split("/").at(-1)!, sourceWidth: 10, sourceHeight: 10, format: "JPEG", camera: null });
}

describe("library file management", () => {
  it("uses the exact name for one photo", () => {
    expect(buildRenameRequests([photo("/source/one.jpg")], "renamed.nef")).toEqual([
      { path: "/source/one.jpg", newName: "renamed.nef" },
    ]);
  });

  it("previews a stable numbered batch while preserving extensions", () => {
    expect(buildRenameRequests([photo("/source/a.jpg"), photo("/source/b.NEF")], "Trip")).toEqual([
      { path: "/source/a.jpg", newName: "Trip-001.jpg" },
      { path: "/source/b.NEF", newName: "Trip-002.NEF" },
    ]);
  });

  it("rejects path separators and empty names", () => {
    expect(() => buildRenameRequests([photo("/source/a.jpg")], "../bad.jpg")).toThrow(/文件名/);
    expect(() => buildRenameRequests([photo("/source/a.jpg")], "  ")).toThrow(/文件名/);
  });

  it("rejects names that Windows cannot create", () => {
    expect(() => buildRenameRequests([photo("/source/a.jpg")], "bad:name.jpg")).toThrow(/文件名/);
    expect(() => buildRenameRequests([photo("/source/a.jpg")], "CON.jpg")).toThrow(/文件名/);
    expect(() => buildRenameRequests([photo("/source/a.jpg")], "trailing. ")).toThrow(/文件名/);
  });
});
