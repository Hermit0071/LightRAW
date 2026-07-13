export const HSL_CHANNELS = [
  "red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta",
] as const;

export type HslChannelName = (typeof HSL_CHANNELS)[number];
export type HslParameter = "hue" | "saturation" | "luminance";
export const HSL_PARAMETER_LIMITS: Record<HslParameter, readonly [number, number]> = {
  hue: [-180, 180],
  saturation: [-100, 200],
  luminance: [-200, 200],
};
export interface HslChannel {
  hue: number;
  saturation: number;
  luminance: number;
}
export type HslAdjustments = Record<HslChannelName, HslChannel>;

const HUE_CENTRES: Record<HslChannelName, number> = {
  red: 0,
  orange: 30,
  yellow: 60,
  green: 120,
  aqua: 180,
  blue: 240,
  purple: 275,
  magenta: 315,
};

export function createDefaultHsl(): HslAdjustments {
  return Object.fromEntries(HSL_CHANNELS.map((name) => [
    name,
    { hue: 0, saturation: 0, luminance: 0 },
  ])) as HslAdjustments;
}

export function updateHslChannel(
  current: HslAdjustments,
  channel: HslChannelName,
  parameter: HslParameter,
  value: number,
): HslAdjustments {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${channel}.${parameter} must be finite`);
  }
  return {
    ...current,
    [channel]: { ...current[channel], [parameter]: clamp(value, ...HSL_PARAMETER_LIMITS[parameter]) },
  };
}

/**
 * HSL channel controls use overlapping triangular hue windows. Adjacent colour
 * families blend across their boundary, avoiding the hard banding produced by
 * eight independent hue ranges. A value of 100 corresponds to a 30 degree
 * shift; the expanded public range permits up to 54 degrees in either direction.
 */
export function adjustHslPixel(
  input: readonly [number, number, number],
  adjustments: HslAdjustments,
): [number, number, number] {
  const safe: [number, number, number] = [clamp(input[0], 0, 1), clamp(input[1], 0, 1), clamp(input[2], 0, 1)];
  const hsl = rgbToHsl(safe);
  let hue = 0;
  let saturation = 0;
  let luminance = 0;
  for (const channel of HSL_CHANNELS) {
    const weight = hueWeight(hsl[0], HUE_CENTRES[channel]);
    hue += adjustments[channel].hue * weight;
    saturation += adjustments[channel].saturation * weight;
    luminance += adjustments[channel].luminance * weight;
  }
  if (hue === 0 && saturation === 0 && luminance === 0) {
    return safe;
  }
  return hslToRgb([
    wrapDegrees(hsl[0] + hue * 0.3),
    clamp(hsl[1] * (1 + saturation / 100), 0, 1),
    clamp(hsl[2] + (luminance / 100) * 0.5, 0, 1),
  ]);
}

function hueWeight(hue: number, centre: number): number {
  const distance = Math.abs(((hue - centre + 180) % 360 + 360) % 360 - 180);
  return Math.max(0, 1 - distance / 45);
}

function rgbToHsl(rgb: readonly [number, number, number]): [number, number, number] {
  const [red, green, blue] = rgb;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const lightness = (maximum + minimum) / 2;
  const delta = maximum - minimum;
  if (delta === 0) {
    return [0, 0, lightness];
  }
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = maximum === red
    ? 60 * (((green - blue) / delta) % 6)
    : maximum === green
      ? 60 * ((blue - red) / delta + 2)
      : 60 * ((red - green) / delta + 4);
  hue = wrapDegrees(hue);
  return [hue, saturation, lightness];
}

function hslToRgb(hsl: readonly [number, number, number]): [number, number, number] {
  const [hue, saturation, lightness] = hsl;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const intermediate = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const offset = lightness - chroma / 2;
  const sector = Math.floor(hue / 60) % 6;
  const values = [
    [chroma, intermediate, 0], [intermediate, chroma, 0], [0, chroma, intermediate],
    [0, intermediate, chroma], [intermediate, 0, chroma], [chroma, 0, intermediate],
  ][sector];
  return [values[0] + offset, values[1] + offset, values[2] + offset];
}

function wrapDegrees(value: number): number {
  return (value % 360 + 360) % 360;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
