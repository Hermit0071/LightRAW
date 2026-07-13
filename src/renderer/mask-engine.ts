import { layerCoverageAt, type AdjustmentLayer, type MaskPoint } from "../editor/masks";
import { adjustLinearPixel, type LinearRgb } from "./color-engine";
import { adjustHslPixel } from "../editor/hsl";
import { evaluateCurve } from "../editor/tone-curve";

export interface MaskPixelContext {
  point: MaskPoint;
  sourceColor: LinearRgb;
  fineDetail: number;
  coarseDetail: number;
  imageAspect: number;
  layerCoverages?: readonly number[];
}

export function applyLayersToPixel(
  input: LinearRgb,
  layers: AdjustmentLayer[],
  context: MaskPixelContext,
): LinearRgb {
  let color = input;
  for (let index = 0; index < layers.length; index += 1) {
    const layer = layers[index];
    if (!layer.visible) continue;
    const coverage = context.layerCoverages?.[index]
      ?? layerCoverageAt(layer, context.point, context.sourceColor, context.imageAspect);
    const localContrast = context.fineDetail * layer.adjustments.texture / 100 * 0.38
      + context.coarseDetail * layer.adjustments.clarity / 100 * 0.62;
    const basic = adjustLinearPixel([
      color[0] + localContrast,
      color[1] + localContrast,
      color[2] + localContrast,
    ], layer.adjustments);
    const hsl = adjustHslPixel(basic, layer.hsl);
    const adjusted: LinearRgb = [
      evaluateCurve(layer.curves.master, evaluateCurve(layer.curves.red, hsl[0])),
      evaluateCurve(layer.curves.master, evaluateCurve(layer.curves.green, hsl[1])),
      evaluateCurve(layer.curves.master, evaluateCurve(layer.curves.blue, hsl[2])),
    ];
    const blended = blend(color, adjusted, layer.blendMode);
    color = [mix(color[0], blended[0], coverage), mix(color[1], blended[1], coverage), mix(color[2], blended[2], coverage)];
  }
  return color;
}

function blend(base: LinearRgb, layer: LinearRgb, mode: AdjustmentLayer["blendMode"]): LinearRgb {
  if (mode === "multiply") return [base[0] * layer[0], base[1] * layer[1], base[2] * layer[2]];
  if (mode === "screen") return [
    1 - (1 - base[0]) * (1 - layer[0]),
    1 - (1 - base[1]) * (1 - layer[1]),
    1 - (1 - base[2]) * (1 - layer[2]),
  ];
  return layer;
}

function mix(left: number, right: number, amount: number): number {
  return left + (right - left) * amount;
}
