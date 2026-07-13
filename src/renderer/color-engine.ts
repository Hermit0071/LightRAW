import type { BasicAdjustments } from "../editor/basic-adjustments";
import type { DevelopRecipe } from "../editor/develop-recipe";
import { adjustHslPixel } from "../editor/hsl";
import { evaluateCurve } from "../editor/tone-curve";
import { toPreviewUniforms } from "./uniforms";

export type LinearRgb = readonly [number, number, number];

export const COLOR_ENGINE_CONSTANTS = {
  temperatureGain: 0.45,
  tintRedBlueGain: 0.12,
  tintGreenGain: 0.28,
  zoneStrength: 0.72,
  shadowStart: 0.06,
  shadowEnd: 0.58,
  highlightStart: 0.28,
  highlightEnd: 0.95,
  middleGray: 0.18,
} as const;

/**
 * CPU reference for the phase-one shader. It is intentionally small: the UI,
 * tests and future export engine use the same parameter semantics even though
 * the interactive implementation runs in GLSL.
 *
 * Temperature/tint are relative creative controls, not absolute Kelvin. Their
 * gains were selected to keep the full slider range useful without allowing a
 * channel multiplier to become negative. Tone masks overlap smoothly so a
 * pixel cannot cross a hard highlight/shadow boundary while dragging.
 */
export function adjustLinearPixel(
  input: LinearRgb,
  adjustments: BasicAdjustments,
): LinearRgb {
  const uniforms = toPreviewUniforms(adjustments);
  const constants = COLOR_ENGINE_CONSTANTS;
  let color: LinearRgb = [
    input[0] * 2 ** (
      uniforms.temperature * constants.temperatureGain
      + uniforms.tint * constants.tintRedBlueGain
    ),
    input[1] * 2 ** (-uniforms.tint * constants.tintGreenGain),
    input[2] * 2 ** (
      -uniforms.temperature * constants.temperatureGain
      + uniforms.tint * constants.tintRedBlueGain
    ),
  ];
  const exposureGain = 2 ** uniforms.exposure;
  color = [
    color[0] * exposureGain,
    color[1] * exposureGain,
    color[2] * exposureGain,
  ];

  const before = Math.max(luminance(color), 0.00001);
  let value = before;
  const shadowMask = 1 - smoothstep(constants.shadowStart, constants.shadowEnd, value);
  const highlightMask = smoothstep(
    constants.highlightStart,
    constants.highlightEnd,
    value,
  );
  value = adjustZone(value, uniforms.shadows, shadowMask, constants.zoneStrength);
  value = adjustZone(value, uniforms.highlights, highlightMask, constants.zoneStrength);
  const blackMask = 1 - smoothstep(0.02, 0.32, value);
  const whiteMask = smoothstep(0.48, 1, value);
  value = adjustZone(value, uniforms.blacks, blackMask, 0.48);
  value = adjustZone(value, uniforms.whites, whiteMask, 0.48);
  const toneScale = Math.max(value, 0) / before;
  const contrastSlope = 2 ** uniforms.contrast;

  const applyContrast = (channel: number) => Math.max(
    (channel * toneScale - constants.middleGray) * contrastSlope + constants.middleGray,
    0,
  );
  const contrastedBeforeHaze: LinearRgb = [
    applyContrast(color[0]),
    applyContrast(color[1]),
    applyContrast(color[2]),
  ];
  const hazePivot = 0.12;
  const hazeSlope = 1 + uniforms.dehaze * 0.42;
  const applyDehaze = (channel: number) => Math.max(
    (channel - hazePivot) * hazeSlope + hazePivot - uniforms.dehaze * 0.025, 0,
  );
  const contrasted: LinearRgb = [
    applyDehaze(contrastedBeforeHaze[0]),
    applyDehaze(contrastedBeforeHaze[1]),
    applyDehaze(contrastedBeforeHaze[2]),
  ];
  const lightness = luminance(contrasted);
  const maximum = Math.max(...contrasted);
  const minimum = Math.min(...contrasted);
  const chroma = maximum - minimum;
  const vibranceProtection = 1 - Math.min(chroma, 1);
  const saturationScale = Math.max(
    0,
    1 + uniforms.saturation + uniforms.vibrance * vibranceProtection,
  );
  const applySaturation = (channel: number) => (
    lightness + (channel - lightness) * saturationScale
  );
  return [
    applySaturation(contrasted[0]),
    applySaturation(contrasted[1]),
    applySaturation(contrasted[2]),
  ];
}

export function developLinearPixel(input: LinearRgb, recipe: DevelopRecipe): LinearRgb {
  const basic = adjustLinearPixel(input, recipe.basic);
  const hsl = adjustHslPixel(basic, recipe.hsl);
  return [
    evaluateCurve(recipe.curves.master, evaluateCurve(recipe.curves.red, hsl[0])),
    evaluateCurve(recipe.curves.master, evaluateCurve(recipe.curves.green, hsl[1])),
    evaluateCurve(recipe.curves.master, evaluateCurve(recipe.curves.blue, hsl[2])),
  ];
}

function luminance(color: LinearRgb): number {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}

function smoothstep(start: number, end: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function adjustZone(value: number, amount: number, mask: number, strength: number): number {
  return amount >= 0
    ? value + Math.max(1 - value, 0) * amount * mask * strength
    : value + value * amount * mask * strength;
}
