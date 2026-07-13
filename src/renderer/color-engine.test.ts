import { describe, expect, it } from "vitest";
import { createDefaultAdjustments } from "../editor/basic-adjustments";
import { adjustLinearPixel } from "./color-engine";

const neutral = createDefaultAdjustments();

describe("phase-one color engine", () => {
  it("preserves a linear pixel when every adjustment is neutral", () => {
    expect(adjustLinearPixel([0.1, 0.35, 0.8], neutral)).toEqual([0.1, 0.35, 0.8]);
  });

  it("treats one exposure stop as twice the linear light", () => {
    const result = adjustLinearPixel([0.1, 0.1, 0.1], { ...neutral, exposure: 1 });
    expect(result[0]).toBeCloseTo(0.2, 6);
  });

  it("warms a neutral pixel by raising red while lowering blue", () => {
    const result = adjustLinearPixel([0.4, 0.4, 0.4], { ...neutral, temperature: 50 });
    expect(result[0]).toBeGreaterThan(0.4);
    expect(result[2]).toBeLessThan(0.4);
  });

  it("targets shadows more strongly on dark pixels", () => {
    const dark = adjustLinearPixel([0.1, 0.1, 0.1], { ...neutral, shadows: 50 });
    const bright = adjustLinearPixel([0.8, 0.8, 0.8], { ...neutral, shadows: 50 });
    expect(dark[0] - 0.1).toBeGreaterThan(bright[0] - 0.8);
  });

  it("targets highlights more strongly on bright pixels", () => {
    const dark = adjustLinearPixel([0.1, 0.1, 0.1], { ...neutral, highlights: -50 });
    const bright = adjustLinearPixel([0.8, 0.8, 0.8], { ...neutral, highlights: -50 });
    expect(0.8 - bright[0]).toBeGreaterThan(0.1 - dark[0]);
  });
});
