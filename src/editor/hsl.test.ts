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

  it("clamps a channel edit to the public range", () => {
    expect(updateHslChannel(createDefaultHsl(), "blue", "saturation", 140).blue.saturation).toBe(100);
  });

  it("changes the selected hue family without moving a distant family", () => {
    const edited = updateHslChannel(createDefaultHsl(), "red", "saturation", -100);
    const red = adjustHslPixel([0.9, 0.1, 0.1], edited);
    const green = adjustHslPixel([0.1, 0.9, 0.1], edited);
    expect(Math.max(...red) - Math.min(...red)).toBeLessThan(0.8);
    expect(green).toEqual([0.1, 0.9, 0.1]);
  });
});
