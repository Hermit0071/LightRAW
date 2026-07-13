export interface BasicAdjustments {
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

export type BasicAdjustmentName = keyof BasicAdjustments;

export const BASIC_ADJUSTMENT_LIMITS: Record<
  BasicAdjustmentName,
  readonly [number, number]
> = {
  temperature: [-200, 200],
  tint: [-200, 200],
  exposure: [-10, 10],
  contrast: [-200, 200],
  highlights: [-200, 200],
  shadows: [-200, 200],
  whites: [-200, 200],
  blacks: [-200, 200],
  texture: [-200, 200],
  clarity: [-200, 200],
  dehaze: [-200, 200],
  vibrance: [-200, 200],
  saturation: [-100, 200],
};

export function createDefaultAdjustments(): BasicAdjustments {
  return {
    temperature: 0,
    tint: 0,
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    texture: 0,
    clarity: 0,
    dehaze: 0,
    vibrance: 0,
    saturation: 0,
  };
}

export function updateAdjustment(
  current: BasicAdjustments,
  name: BasicAdjustmentName,
  value: number,
): BasicAdjustments {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`);
  }

  const [minimum, maximum] = BASIC_ADJUSTMENT_LIMITS[name];
  return {
    ...current,
    [name]: Math.min(maximum, Math.max(minimum, value)),
  };
}
