import { describe, expect, it } from "vitest";
import { createDefaultDevelopRecipe } from "../editor/develop-recipe";
import { calculateHistogram, halfToFloat } from "./histogram";

describe("edited histogram", () => {
  it("decodes IEEE 754 half-float values", () => {
    expect(halfToFloat(0x0000)).toBe(0);
    expect(halfToFloat(0x3800)).toBe(0.5);
    expect(halfToFloat(0x3c00)).toBe(1);
  });

  it("bins the current non-destructive edit instead of the source only", () => {
    const pixels = new Uint16Array([
      0x3800, 0x3800, 0x3800, 0x3c00,
      0x3800, 0x3800, 0x3800, 0x3c00,
    ]);
    const neutral = calculateHistogram(pixels, 2, 1, createDefaultDevelopRecipe());
    const brighter = calculateHistogram(pixels, 2, 1, {
      ...createDefaultDevelopRecipe(),
      basic: { ...createDefaultDevelopRecipe().basic, exposure: 1 },
    });
    expect(neutral.luminance.findIndex((count) => count > 0)).toBeLessThan(
      brighter.luminance.findIndex((count) => count > 0),
    );
    expect(brighter.samples).toBe(2);
  });

  it("never exceeds the interactive sample budget", () => {
    const pixels = new Uint16Array(300 * 300 * 4).fill(0x3800);
    const histogram = calculateHistogram(pixels, 300, 300, createDefaultDevelopRecipe());
    expect(histogram.samples).toBeLessThanOrEqual(24_000);
  });

  it("includes local detail controls in the displayed distribution", () => {
    const pixels = new Uint16Array(9 * 9 * 4);
    for (let index = 0; index < 9 * 9; index += 1) {
      const value = index % 2 === 0 ? 0x3400 : 0x3a00;
      pixels.set([value, value, value, 0x3c00], index * 4);
    }
    const neutralRecipe = createDefaultDevelopRecipe();
    const texturedRecipe = {
      ...neutralRecipe,
      basic: { ...neutralRecipe.basic, texture: 100 },
    };
    const neutral = calculateHistogram(pixels, 9, 9, neutralRecipe);
    const textured = calculateHistogram(pixels, 9, 9, texturedRecipe);
    expect(textured.luminance).not.toEqual(neutral.luminance);
  });
});
