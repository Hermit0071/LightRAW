import { describe, expect, it } from "vitest";
import { createDefaultDetail, updateDetail } from "./detail";

describe("detail adjustment recipe", () => {
  it("expands sharpening controls while keeping denoise inside its effective range", () => {
    const initial = createDefaultDetail();
    expect(updateDetail(initial, "sharpeningAmount", 240).sharpeningAmount).toBe(200);
    expect(updateDetail(initial, "sharpeningRadius", 8).sharpeningRadius).toBe(5);
    expect(updateDetail(initial, "luminanceNoiseReduction", 140).luminanceNoiseReduction).toBe(100);
  });

  it("preserves fractional edits without rounding", () => {
    expect(updateDetail(createDefaultDetail(), "sharpeningDetail", 137.25).sharpeningDetail).toBe(137.25);
  });
});
