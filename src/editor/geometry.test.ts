import { describe, expect, it } from "vitest";
import {
  applyCropAspect,
  createDefaultGeometry,
  normalizeCrop,
  rotateGeometry,
  cropFromDisplay,
  cropToDisplay,
  mapOutputToSource,
  mapSourceToOutput,
} from "./geometry";

describe("crop and geometry", () => {
  it("starts with the full image and no transform", () => {
    expect(createDefaultGeometry()).toEqual({
      crop: { x: 0, y: 0, width: 1, height: 1 },
      rotation: 0,
      straighten: 0,
      flipHorizontal: false,
      flipVertical: false,
      aspect: "free",
    });
  });

  it("clamps crop rectangles inside the image", () => {
    expect(normalizeCrop({ x: -0.2, y: 0.9, width: 1.4, height: 0.4 })).toEqual({
      x: 0,
      y: 0.9,
      width: 1,
      height: 0.1,
    });
  });

  it("fits a ratio around the current crop centre", () => {
    const crop = applyCropAspect({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 }, 1, 3 / 2);
    expect(crop.width / crop.height).toBeCloseTo(1.5, 6);
    expect(crop.x + crop.width / 2).toBeCloseTo(0.5, 6);
  });

  it("rotates in quarter turns", () => {
    expect(rotateGeometry(createDefaultGeometry(), "counterclockwise").rotation).toBe(270);
    expect(rotateGeometry(createDefaultGeometry(), "clockwise").rotation).toBe(90);
  });

  it("maps crop handles through rotation without losing the source rectangle", () => {
    const source = { x: 0.1, y: 0.2, width: 0.5, height: 0.4 };
    for (const rotation of [0, 90, 180, 270] as const) {
      const geometry = { ...createDefaultGeometry(), rotation, flipHorizontal: true };
      expect(cropFromDisplay(cropToDisplay(source, geometry), geometry)).toEqual(source);
    }
  });

  it("maps final output samples through crop and straighten using top-origin coordinates", () => {
    const geometry = {
      ...createDefaultGeometry(),
      crop: { x: 0.1, y: 0.2, width: 0.6, height: 0.5 },
      straighten: 12,
    };
    expect(mapOutputToSource({ x: 0.5, y: 0.5 }, geometry, 1200, 800)).toEqual({ x: 0.4, y: 0.45 });
    const top = mapOutputToSource({ x: 0.5, y: 0 }, { ...geometry, straighten: 0 }, 1200, 800);
    expect(top.y).toBeCloseTo(0.2, 8);
  });

  it("round-trips mask points through the edited preview geometry", () => {
    const geometry = {
      ...createDefaultGeometry(),
      crop: { x: 0.1, y: 0.15, width: 0.7, height: 0.65 },
      rotation: 90 as const,
      straighten: 7,
      flipHorizontal: true,
    };
    const output = { x: 0.38, y: 0.61 };
    const source = mapOutputToSource(output, geometry, 1200, 800);
    expect(mapSourceToOutput(source, geometry, 1200, 800)).toEqual({
      x: expect.closeTo(output.x, 8),
      y: expect.closeTo(output.y, 8),
    });
  });
});
