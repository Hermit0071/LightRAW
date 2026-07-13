import { describe, expect, it } from "vitest";
import { createLibraryPhoto } from "./catalog";
import { stringifyCatalogAsync } from "./catalog-serializer";

describe("catalog background serialization", () => {
  it("keeps persisted metadata independent from thumbnail payloads", async () => {
    const photo = createLibraryPhoto({
      path: "/photo.jpg",
      fileName: "photo.jpg",
      sourceWidth: 6000,
      sourceHeight: 4000,
      format: "JPEG",
      camera: null,
    }, "photo-id", "2026-01-01T00:00:00Z");
    photo.thumbnail = "data:image/png;base64,AAAA";
    const document = JSON.parse(await stringifyCatalogAsync([photo])) as { photos: Array<{ thumbnail: unknown }> };
    expect(document.photos[0].thumbnail).toBeNull();
  });
});
