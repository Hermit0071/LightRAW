import type { BasicAdjustments } from "../editor/basic-adjustments";

export interface PreviewUniforms {
  temperature: number;
  tint: number;
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  texture: number;
  clarity: number;
  dehaze: number;
  vibrance: number;
  saturation: number;
}

export function toPreviewUniforms(adjustments: BasicAdjustments): PreviewUniforms {
  return {
    temperature: adjustments.temperature / 100,
    tint: adjustments.tint / 100,
    exposure: adjustments.exposure,
    contrast: adjustments.contrast / 100,
    highlights: adjustments.highlights / 100,
    shadows: adjustments.shadows / 100,
    whites: adjustments.whites / 100,
    blacks: adjustments.blacks / 100,
    texture: adjustments.texture / 100,
    clarity: adjustments.clarity / 100,
    dehaze: adjustments.dehaze / 100,
    vibrance: adjustments.vibrance / 100,
    saturation: adjustments.saturation / 100,
  };
}
