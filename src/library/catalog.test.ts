import { describe, expect, it } from "vitest";
import {
  applyCatalogThumbnails,
  createLibraryPhoto,
  mergeActiveRecipe,
  mergeImportedPhotos,
  applyFileRelocations,
  duplicateRelocatedPhotos,
  parseCatalogCopies,
  parseCatalogJson,
  ratePhoto,
  removePhotos,
  sortPhotos,
  stringifyCatalog,
} from "./catalog";

function photo(path: string, importedAt: string, rating: 0 | 1 | 2 | 3 | 4 | 5 = 0) {
  return createLibraryPhoto({ path, fileName: path.split("/").at(-1)!, sourceWidth: 6000, sourceHeight: 4000, format: "JPEG", camera: null }, path, importedAt, rating);
}

describe("photo catalog", () => {
  it("sorts by import time, file name and rating without mutating the catalog", () => {
    const photos = [photo("/b.jpg", "2026-01-01T00:00:00Z", 2), photo("/a.jpg", "2026-01-02T00:00:00Z", 5)];
    expect(sortPhotos(photos, "importedAt").map((item) => item.fileName)).toEqual(["a.jpg", "b.jpg"]);
    expect(sortPhotos(photos, "fileName").map((item) => item.fileName)).toEqual(["a.jpg", "b.jpg"]);
    expect(sortPhotos(photos, "rating").map((item) => item.rating)).toEqual([5, 2]);
    expect(photos[0].fileName).toBe("b.jpg");
  });

  it("rates one photo and rejects an invalid star value", () => {
    const photos = [photo("/one.jpg", "2026-01-01T00:00:00Z")];
    expect(ratePhoto(photos, photos[0].id, 4)[0].rating).toBe(4);
    expect(() => ratePhoto(photos, photos[0].id, 6 as 5)).toThrow(/评分/);
  });

  it("deduplicates repeated imports while retaining existing edits", () => {
    const existing = photo("/one.jpg", "2026-01-01T00:00:00Z");
    existing.recipe.basic.exposure = 2;
    const repeated = photo("/one.jpg", "2026-01-03T00:00:00Z");
    const added = photo("/two.jpg", "2026-01-03T00:00:00Z");
    const merged = mergeImportedPhotos([existing], [repeated, added]);
    expect(merged).toHaveLength(2);
    expect(merged.find((item) => item.path === "/one.jpg")?.recipe.basic.exposure).toBe(2);
  });

  it("merges the latest active recipe into a close-time catalog snapshot", () => {
    const photos = [photo("/one.jpg", "2026-01-01T00:00:00Z")];
    const latest = structuredClone(photos[0].recipe);
    latest.basic.exposure = 1.5;
    expect(mergeActiveRecipe(photos, photos[0].id, latest)[0].recipe.basic.exposure).toBe(1.5);
    expect(photos[0].recipe.basic.exposure).toBe(0);
  });

  it("round-trips a versioned persistent catalog and rejects corrupt entries", () => {
    const photos = [photo("/one.jpg", "2026-01-01T00:00:00Z", 3)];
    photos[0].thumbnail = "data:image/png;base64,AAAA";
    expect(parseCatalogJson(stringifyCatalog(photos))).toEqual([{ ...photos[0], thumbnail: null }]);
    expect(() => parseCatalogJson('{"version":1,"photos":[{"path":3}]}')).toThrow(/图库/);
  });

  it("recovers a valid backup without accepting a corrupt primary catalog", () => {
    const backup = stringifyCatalog([photo("/safe.jpg", "2026-01-01T00:00:00Z")]);
    const result = parseCatalogCopies("not-json", backup);
    expect(result.recovered).toBe(true);
    expect(result.photos[0].fileName).toBe("safe.jpg");
    expect(() => parseCatalogCopies("not-json", "also-bad")).toThrow(/图库/);
  });

  it("attaches separately stored thumbnails to catalog metadata", () => {
    const photos = [photo("/one.jpg", "2026-01-01T00:00:00Z")];
    expect(applyCatalogThumbnails(photos, { [photos[0].id]: "data:image/png;base64,AAAA" })[0].thumbnail)
      .toBe("data:image/png;base64,AAAA");
  });

  it("removes selected records without mutating the original catalog", () => {
    const photos = [photo("/one.jpg", "2026-01-01T00:00:00Z"), photo("/two.jpg", "2026-01-02T00:00:00Z")];
    expect(removePhotos(photos, new Set([photos[0].id])).map((item) => item.fileName)).toEqual(["two.jpg"]);
    expect(photos).toHaveLength(2);
  });

  it("keeps edits and identity when files are renamed or moved", () => {
    const original = photo("/source/one.jpg", "2026-01-01T00:00:00Z", 4);
    original.recipe.basic.exposure = 1.25;
    const moved = applyFileRelocations([original], [{ source: original.path, destination: "/target/renamed.jpg" }]);
    expect(moved[0]).toMatchObject({ id: original.id, path: "/target/renamed.jpg", fileName: "renamed.jpg", rating: 4 });
    expect(moved[0].recipe.basic.exposure).toBe(1.25);
  });

  it("creates independent catalog records for copied files", () => {
    const original = photo("/source/one.jpg", "2026-01-01T00:00:00Z", 3);
    original.recipe.basic.exposure = 2;
    const copies = duplicateRelocatedPhotos([original], [{ source: original.path, destination: "/copies/one-2.jpg" }],
      () => "copy-id", () => "2026-02-01T00:00:00Z");
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({ id: "copy-id", path: "/copies/one-2.jpg", fileName: "one-2.jpg", rating: 3 });
    expect(copies[0].recipe).not.toBe(original.recipe);
  });
});
