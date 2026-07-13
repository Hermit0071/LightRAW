import { describe, expect, it } from "vitest";
import { buildThumbnailRgba } from "./thumbnail";

describe("catalog thumbnails", () => {
  it("downsamples a half-float preview to the requested long edge", () => {
    const source = new Uint16Array(4 * 2 * 4);
    const thumbnail = buildThumbnailRgba(source, 4, 2, 2);
    expect({ width: thumbnail.width, height: thumbnail.height }).toEqual({ width: 2, height: 1 });
    expect(thumbnail.rgba).toHaveLength(8);
  });
});
