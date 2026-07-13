import type { BasicAdjustments } from "../editor/basic-adjustments";

export interface PreviewUniforms {
  temperature: number;
  tint: number;
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
}

export function toPreviewUniforms(adjustments: BasicAdjustments): PreviewUniforms {
  return {
    temperature: adjustments.temperature / 100,
    tint: adjustments.tint / 100,
    exposure: adjustments.exposure,
    contrast: adjustments.contrast / 100,
    highlights: adjustments.highlights / 100,
    shadows: adjustments.shadows / 100,
  };
}
