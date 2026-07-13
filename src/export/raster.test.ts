import { describe, expect, it } from "vitest";
import { flipRgbaRows } from "./raster";

describe("export raster", () => {
  it("converts WebGL bottom-up rows to encoder top-down rows", () => {
    const bottom = [0, 0, 255, 255, 255, 0, 0, 255];
    const pixels = new Uint8Array(bottom);
    expect(flipRgbaRows(pixels, 1, 2)).toBe(pixels);
    expect([...pixels]).toEqual([255, 0, 0, 255, 0, 0, 255, 255]);
  });
});
