export interface BasicAdjustments {
  version: 1;
  temperature: number;
  tint: number;
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
}

export type BasicAdjustmentName = Exclude<keyof BasicAdjustments, "version">;

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
};

export function createDefaultAdjustments(): BasicAdjustments {
  return {
    version: 1,
    temperature: 0,
    tint: 0,
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
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
