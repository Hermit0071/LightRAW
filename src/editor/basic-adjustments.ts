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
  temperature: [-100, 100],
  tint: [-100, 100],
  exposure: [-5, 5],
  contrast: [-100, 100],
  highlights: [-100, 100],
  shadows: [-100, 100],
  whites: [-100, 100],
  blacks: [-100, 100],
  texture: [-100, 100],
  clarity: [-100, 100],
  dehaze: [-100, 100],
  vibrance: [-100, 100],
  saturation: [-100, 100],
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
