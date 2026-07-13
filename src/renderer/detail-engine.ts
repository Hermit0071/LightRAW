import { DETAIL_LIMITS, type DetailAdjustments } from "../editor/detail";
import type { LinearRgb } from "./color-engine";

/**
 * Reference for the local-detail shader. Fine neighbours drive denoise and
 * texture; coarse neighbours drive clarity. Sharpening radius blends between
 * those two frequency bands, so it does not change any denoise parameter.
 */
export function adjustDetailPixel(
  centre: LinearRgb,
  fine: LinearRgb,
  coarse: LinearRgb,
  detail: DetailAdjustments,
  texture = 0,
  clarity = 0,
): LinearRgb {
  const centreLuma = luminance(centre);
  const fineLuma = luminance(fine);
  const coarseLuma = luminance(coarse);
  const colorMix = detail.colorNoiseReduction / 100 * 0.72;
  const luminanceMix = detail.luminanceNoiseReduction / 100 * 0.72;
  const colourSmoothed: LinearRgb = [
    centreLuma + fine[0] - fineLuma,
    centreLuma + fine[1] - fineLuma,
    centreLuma + fine[2] - fineLuma,
  ];
  let filtered: LinearRgb = [
    mix(centre[0], colourSmoothed[0], colorMix),
    mix(centre[1], colourSmoothed[1], colorMix),
    mix(centre[2], colourSmoothed[2], colorMix),
  ];
  const luminanceDelta = (fineLuma - centreLuma) * luminanceMix;
  filtered = [filtered[0] + luminanceDelta, filtered[1] + luminanceDelta, filtered[2] + luminanceDelta];

  const fineDetail = centreLuma - fineLuma;
  const coarseDetail = centreLuma - coarseLuma;
  const [minimumRadius, maximumRadius] = DETAIL_LIMITS.sharpeningRadius;
  const radiusMix = (detail.sharpeningRadius - minimumRadius) / (maximumRadius - minimumRadius);
  const sharpening = mix(fineDetail, coarseDetail, radiusMix)
    * (detail.sharpeningAmount / 100)
    * (0.3 + detail.sharpeningDetail / 100 * 0.9);
  const localContrast = fineDetail * (texture / 100) * 0.38
    + coarseDetail * (clarity / 100) * 0.62;
  const adjustment = sharpening + localContrast;
  return [
    Math.max(0, filtered[0] + adjustment),
    Math.max(0, filtered[1] + adjustment),
    Math.max(0, filtered[2] + adjustment),
  ];
}

function luminance(color: LinearRgb): number {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}

function mix(left: number, right: number, amount: number): number {
  return left + (right - left) * amount;
}
