import { describe, expect, it } from "vitest";
import { createDefaultAdjustments } from "../editor/basic-adjustments";
import { toPreviewUniforms } from "./uniforms";

describe("preview renderer interface", () => {
  it("maps editor units to stable shader units", () => {
    const uniforms = toPreviewUniforms({
      ...createDefaultAdjustments(),
      temperature: 50,
      tint: -100,
      exposure: 2.5,
      contrast: 40,
      highlights: -25,
      shadows: 75,
    });

    expect(uniforms).toEqual({
      temperature: 0.5,
      tint: -1,
      exposure: 2.5,
      contrast: 0.4,
      highlights: -0.25,
      shadows: 0.75,
    });
  });
});
