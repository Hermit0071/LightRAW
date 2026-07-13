import { describe, expect, it } from "vitest";
import {
  createDefaultAdjustments,
  updateAdjustment,
} from "./basic-adjustments";

describe("basic adjustment recipe", () => {
  it("starts from a neutral, versioned state", () => {
    expect(createDefaultAdjustments()).toEqual({
      temperature: 0,
      tint: 0,
      exposure: 0,
      contrast: 0,
      highlights: 0,
      shadows: 0,
      whites: 0,
      blacks: 0,
      texture: 0,
      clarity: 0,
      dehaze: 0,
      vibrance: 0,
      saturation: 0,
    });
  });

  it("clamps edits to the public parameter ranges", () => {
    const initial = createDefaultAdjustments();

    expect(updateAdjustment(initial, "exposure", 12).exposure).toBe(10);
    expect(updateAdjustment(initial, "temperature", -240).temperature).toBe(-200);
    expect(updateAdjustment(initial, "saturation", -140).saturation).toBe(-100);
  });

  it("preserves fractional edits without rounding", () => {
    expect(updateAdjustment(createDefaultAdjustments(), "contrast", 137.25).contrast).toBe(137.25);
  });
});
