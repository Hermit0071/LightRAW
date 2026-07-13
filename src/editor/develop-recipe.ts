import { createDefaultAdjustments, type BasicAdjustments } from "./basic-adjustments";
import { createDefaultDetail, type DetailAdjustments } from "./detail";
import { createDefaultGeometry, type GeometrySettings } from "./geometry";
import { createDefaultHsl, type HslAdjustments } from "./hsl";
import { createDefaultToneCurves, type ToneCurves } from "./tone-curve";

export interface DevelopRecipe {
  version: 2;
  basic: BasicAdjustments;
  hsl: HslAdjustments;
  curves: ToneCurves;
  detail: DetailAdjustments;
  geometry: GeometrySettings;
}

export function createDefaultDevelopRecipe(): DevelopRecipe {
  return {
    version: 2,
    basic: createDefaultAdjustments(),
    hsl: createDefaultHsl(),
    curves: createDefaultToneCurves(),
    detail: createDefaultDetail(),
    geometry: createDefaultGeometry(),
  };
}
