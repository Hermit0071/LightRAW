import { describe, expect, it } from "vitest";
import { createDefaultDetail } from "../editor/detail";
import { adjustDetailPixel } from "./detail-engine";

describe("detail engine", () => {
  const centre = [0.3, 0.5, 0.7] as const;

  it("preserves the centre pixel when detail controls are neutral", () => {
    expect(adjustDetailPixel(centre, [0.2, 0.4, 0.6], [0.1, 0.3, 0.5], createDefaultDetail()))
      .toEqual(centre);
  });

  it("smooths luminance and colour noise independently", () => {
    const neighbours = [0.4, 0.4, 0.4] as const;
    const luminance = adjustDetailPixel([0.8, 0.8, 0.8], neighbours, neighbours, {
      ...createDefaultDetail(), luminanceNoiseReduction: 100,
    });
    const colour = adjustDetailPixel([0.8, 0.2, 0.2], neighbours, neighbours, {
      ...createDefaultDetail(), colorNoiseReduction: 100,
    });
    expect(luminance[0]).toBeLessThan(0.8);
    expect(Math.max(...colour) - Math.min(...colour)).toBeLessThan(0.6);
  });

  it("uses fine detail for texture and coarse detail for clarity", () => {
    const texture = adjustDetailPixel([0.6, 0.6, 0.6], [0.4, 0.4, 0.4], [0.6, 0.6, 0.6], {
      ...createDefaultDetail(),
    }, 100, 0);
    const clarity = adjustDetailPixel([0.6, 0.6, 0.6], [0.6, 0.6, 0.6], [0.4, 0.4, 0.4], {
      ...createDefaultDetail(),
    }, 0, 100);
    expect(texture[0]).toBeGreaterThan(0.6);
    expect(clarity[0]).toBeGreaterThan(0.6);
  });

  it("maps the expanded sharpening radius endpoints to fine and coarse detail", () => {
    const detail = { ...createDefaultDetail(), sharpeningAmount: 100, sharpeningDetail: 0 };
    const fine = adjustDetailPixel([0.6, 0.6, 0.6], [0.5, 0.5, 0.5], [0.2, 0.2, 0.2], {
      ...detail, sharpeningRadius: 0.1,
    });
    const coarse = adjustDetailPixel([0.6, 0.6, 0.6], [0.5, 0.5, 0.5], [0.2, 0.2, 0.2], {
      ...detail, sharpeningRadius: 5,
    });
    expect(fine[0]).toBeCloseTo(0.63, 6);
    expect(coarse[0]).toBeCloseTo(0.72, 6);
  });
});
