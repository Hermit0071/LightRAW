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
      whites: 20,
      blacks: -30,
      texture: 10,
      clarity: -20,
      dehaze: 30,
      vibrance: 40,
      saturation: -50,
    });

    expect(uniforms).toEqual({
      temperature: 0.5,
      tint: -1,
      exposure: 2.5,
      contrast: 0.4,
      highlights: -0.25,
      shadows: 0.75,
      whites: 0.2,
      blacks: -0.3,
      texture: 0.1,
      clarity: -0.2,
      dehaze: 0.3,
      vibrance: 0.4,
      saturation: -0.5,
    });
  });
});
