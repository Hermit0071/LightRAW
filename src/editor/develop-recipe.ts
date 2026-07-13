import { createDefaultAdjustments, type BasicAdjustments } from "./basic-adjustments";
import { createDefaultDetail, type DetailAdjustments } from "./detail";
import { createDefaultGeometry, type GeometrySettings } from "./geometry";
import { createDefaultHsl, type HslAdjustments } from "./hsl";
import { createDefaultToneCurves, type ToneCurves } from "./tone-curve";
import type { AdjustmentLayer } from "./masks";

export interface DevelopRecipe {
  version: 3;
  basic: BasicAdjustments;
  hsl: HslAdjustments;
  curves: ToneCurves;
  detail: DetailAdjustments;
  geometry: GeometrySettings;
  layers: AdjustmentLayer[];
}

export function createDefaultDevelopRecipe(): DevelopRecipe {
  return {
    version: 3,
    basic: createDefaultAdjustments(),
    hsl: createDefaultHsl(),
    curves: createDefaultToneCurves(),
    detail: createDefaultDetail(),
    geometry: createDefaultGeometry(),
    layers: [],
  };
}
