import { describe, expect, it } from "vitest";
import { createDefaultGeometry } from "../editor/geometry";
import {
  batchExportFileNames,
  calculateDecodeLongEdge,
  calculateExportDimensions,
  exportFileName,
  type ExportSize,
} from "./export-options";

describe("export sizing", () => {
  const geometry = createDefaultGeometry();
  const dimensions = (size: ExportSize) => calculateExportDimensions(6000, 4000, geometry, size);

  it("supports long edge, short edge and percentage sizing", () => {
    expect(dimensions({ mode: "longEdge", value: 3000 })).toEqual({ width: 3000, height: 2000 });
    expect(dimensions({ mode: "shortEdge", value: 2000 })).toEqual({ width: 3000, height: 2000 });
    expect(dimensions({ mode: "percent", value: 50 })).toEqual({ width: 3000, height: 2000 });
  });

  it("accounts for crop and quarter-turn rotation", () => {
    const cropped = { ...geometry, crop: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 }, rotation: 90 as const };
    expect(calculateExportDimensions(6000, 4000, cropped, { mode: "percent", value: 100 })).toEqual({ width: 2000, height: 3000 });
    expect(calculateDecodeLongEdge(6000, 4000, cropped, { width: 1000, height: 1500 })).toBe(3000);
  });

  it("normalizes the output extension", () => {
    expect(exportFileName("portrait.CR3", "jpeg")).toBe("portrait-LightRAW.jpg");
    expect(exportFileName("portrait", "tiff")).toBe("portrait-LightRAW.tif");
  });

  it("keeps same-named photos distinct in a batch", () => {
    expect(batchExportFileNames(["IMG_0001.CR3", "IMG_0001.NEF", "IMG_0001.jpg"], "jpeg"))
      .toEqual(["IMG_0001-LightRAW.jpg", "IMG_0001-LightRAW-2.jpg", "IMG_0001-LightRAW-3.jpg"]);
  });

  it("rejects export sizes above the bounded whole-image budget", () => {
    expect(() => calculateExportDimensions(10_000, 10_000, geometry, { mode: "percent", value: 100 }))
      .toThrow("40000000");
  });
});
