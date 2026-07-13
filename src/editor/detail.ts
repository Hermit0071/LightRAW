export interface DetailAdjustments {
  sharpeningAmount: number;
  sharpeningRadius: number;
  sharpeningDetail: number;
  luminanceNoiseReduction: number;
  colorNoiseReduction: number;
}

export type DetailAdjustmentName = keyof DetailAdjustments;
export const DETAIL_LIMITS: Record<DetailAdjustmentName, readonly [number, number]> = {
  sharpeningAmount: [0, 100],
  sharpeningRadius: [0.5, 3],
  sharpeningDetail: [0, 100],
  luminanceNoiseReduction: [0, 100],
  colorNoiseReduction: [0, 100],
};

export function createDefaultDetail(): DetailAdjustments {
  return {
    sharpeningAmount: 0,
    sharpeningRadius: 1,
    sharpeningDetail: 25,
    luminanceNoiseReduction: 0,
    colorNoiseReduction: 0,
  };
}

export function updateDetail(
  current: DetailAdjustments,
  name: DetailAdjustmentName,
  value: number,
): DetailAdjustments {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`);
  }
  const [minimum, maximum] = DETAIL_LIMITS[name];
  return { ...current, [name]: Math.min(maximum, Math.max(minimum, value)) };
}
