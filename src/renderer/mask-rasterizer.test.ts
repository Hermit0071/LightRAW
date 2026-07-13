import { describe, expect, it } from "vitest";
import { createAdjustmentLayer, createMaskComponent, layerCoverageAt } from "../editor/masks";
import { layerRasterKey, rasterizeLayerMask } from "./mask-rasterizer";

describe("layer mask rasterizer", () => {
  it("combines selection components into one bottom-up layer mask", () => {
    const vertical = { ...createMaskComponent("linear", "linear"), start: { x: 0.5, y: 0.75 }, end: { x: 0.5, y: 0.25 } };
    const pixels = rasterizeLayerMask(createAdjustmentLayer("layer", vertical), 4, 1);
    expect(pixels[0]).toBeLessThan(pixels[12]);
  });

  it("applies chroma as a child selection instead of an adjustment layer", () => {
    const chroma = { ...createMaskComponent("chroma", "red"), target: [1, 0, 0] as const };
    const pixels = rasterizeLayerMask(createAdjustmentLayer("layer", chroma), 2, 1, () => [1, 0, 0]);
    expect([...pixels]).toEqual([255, 255, 255, 255]);
  });

  it("does not rebuild selection coverage for layer adjustment changes", () => {
    const layer = createAdjustmentLayer("layer", createMaskComponent("brush", "brush"));
    expect(layerRasterKey(layer)).toBe(layerRasterKey({ ...layer, adjustments: { ...layer.adjustments, exposure: 1 } }));
  });

  it("matches the domain coverage at texture sample centers", () => {
    const layer = createAdjustmentLayer("layer", createMaskComponent("linear", "linear"));
    const pixels = rasterizeLayerMask(layer, 4, 1);
    const point = { x: 0.625, y: 0.625 };
    const textureOffset = (4 - 1 - 2) * 4 + 2;
    expect(pixels[textureOffset] / 255).toBeCloseTo(layerCoverageAt(layer, point), 2);
  });
});
