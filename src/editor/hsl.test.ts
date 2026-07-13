import { describe, expect, it } from "vitest";
import { adjustHslPixel, createDefaultHsl, updateHslChannel } from "./hsl";

describe("HSL adjustments", () => {
  it("starts with eight neutral colour channels", () => {
    const hsl = createDefaultHsl();
    expect(Object.keys(hsl)).toEqual([
      "red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta",
    ]);
    expect(hsl.blue).toEqual({ hue: 0, saturation: 0, luminance: 0 });
  });

  it("uses a meaningful public range for each HSL parameter", () => {
    const initial = createDefaultHsl();
    expect(updateHslChannel(initial, "blue", "hue", 240).blue.hue).toBe(180);
    expect(updateHslChannel(initial, "blue", "saturation", 240).blue.saturation).toBe(200);
    expect(updateHslChannel(initial, "blue", "saturation", -140).blue.saturation).toBe(-100);
    expect(updateHslChannel(initial, "blue", "luminance", -240).blue.luminance).toBe(-200);
  });

  it("preserves fractional channel edits without rounding", () => {
    expect(updateHslChannel(createDefaultHsl(), "blue", "hue", 137.25).blue.hue).toBe(137.25);
  });

  it("changes the selected hue family without moving a distant family", () => {
    const edited = updateHslChannel(createDefaultHsl(), "red", "saturation", -100);
    const red = adjustHslPixel([0.9, 0.1, 0.1], edited);
    const green = adjustHslPixel([0.1, 0.9, 0.1], edited);
    expect(Math.max(...red) - Math.min(...red)).toBeLessThan(0.8);
    expect(green).toEqual([0.1, 0.9, 0.1]);
  });
});
