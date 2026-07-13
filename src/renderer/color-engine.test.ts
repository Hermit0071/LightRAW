import { describe, expect, it } from "vitest";
import { createDefaultAdjustments } from "../editor/basic-adjustments";
import { adjustLinearPixel, developLinearPixel } from "./color-engine";
import { createDefaultDevelopRecipe } from "../editor/develop-recipe";

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

  it("moves positive tint away from green without changing brightness controls", () => {
    const result = adjustLinearPixel([0.4, 0.4, 0.4], { ...neutral, tint: 50 });
    expect(result[0]).toBeGreaterThan(0.4);
    expect(result[1]).toBeLessThan(0.4);
    expect(result[2]).toBeGreaterThan(0.4);
  });

  it("expands values around middle grey when contrast increases", () => {
    const dark = adjustLinearPixel([0.1, 0.1, 0.1], { ...neutral, contrast: 50 });
    const bright = adjustLinearPixel([0.8, 0.8, 0.8], { ...neutral, contrast: 50 });
    expect(dark[0]).toBeLessThan(0.1);
    expect(bright[0]).toBeGreaterThan(0.8);
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

describe("phase-two color engine", () => {
  it("keeps a neutral recipe transparent", () => {
    expect(developLinearPixel([0.15, 0.4, 0.75], createDefaultDevelopRecipe()))
      .toEqual([0.15, 0.4, 0.75]);
  });

  it("targets whites more strongly than midtones", () => {
    const bright = adjustLinearPixel([0.9, 0.9, 0.9], { ...neutral, whites: -60 });
    const middle = adjustLinearPixel([0.3, 0.3, 0.3], { ...neutral, whites: -60 });
    expect(0.9 - bright[0]).toBeGreaterThan(0.3 - middle[0]);
  });

  it("vibrance protects already saturated colours", () => {
    const grey = adjustLinearPixel([0.4, 0.42, 0.4], { ...neutral, vibrance: 80 });
    const vivid = adjustLinearPixel([0.8, 0.1, 0.1], { ...neutral, vibrance: 80 });
    expect(grey[1] - grey[0]).toBeGreaterThan(0.02);
    expect(vivid[0]).toBeLessThan(1.25);
  });
});
