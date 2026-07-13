export interface CurvePoint {
  x: number;
  y: number;
}

export type CurveChannel = "master" | "red" | "green" | "blue";
export type ToneCurves = Record<CurveChannel, CurvePoint[]>;

const ENDPOINTS: CurvePoint[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
const MIN_POINT_GAP = 0.001;
const REPLACE_DISTANCE = 0.012;
export const MAX_CURVE_POINTS = 16;

export function createDefaultToneCurves(): ToneCurves {
  return {
    master: cloneEndpoints(),
    red: cloneEndpoints(),
    green: cloneEndpoints(),
    blue: cloneEndpoints(),
  };
}

export function addCurvePoint(curve: CurvePoint[], point: CurvePoint): CurvePoint[] {
  const next = curve.map((value) => ({ ...value }));
  const safe = { x: clamp(point.x, MIN_POINT_GAP, 1 - MIN_POINT_GAP), y: clamp01(point.y) };
  const nearby = next.findIndex((value, index) => (
    index > 0 && index < next.length - 1 && Math.abs(value.x - safe.x) <= REPLACE_DISTANCE
  ));
  if (nearby >= 0) {
    next[nearby] = safe;
  } else if (next.length < MAX_CURVE_POINTS) {
    next.push(safe);
  }
  return next.sort((left, right) => left.x - right.x);
}

export function moveCurvePoint(
  curve: CurvePoint[],
  index: number,
  point: CurvePoint,
): CurvePoint[] {
  if (index < 0 || index >= curve.length) {
    return curve;
  }
  const next = curve.map((value) => ({ ...value }));
  if (index === 0 || index === next.length - 1) {
    next[index].y = clamp01(point.y);
    return next;
  }
  next[index] = {
    x: clamp(point.x, next[index - 1].x + MIN_POINT_GAP, next[index + 1].x - MIN_POINT_GAP),
    y: clamp01(point.y),
  };
  return next;
}

export function removeCurvePoint(curve: CurvePoint[], index: number): CurvePoint[] {
  if (index <= 0 || index >= curve.length - 1) {
    return curve;
  }
  return curve.filter((_, pointIndex) => pointIndex !== index);
}

/**
 * Piecewise-linear interpolation is deliberate: it is monotonic between two
 * control points, so an aggressive curve can never create ringing or values
 * outside the neighbouring handles. The GPU receives the same sampled curve.
 */
export function evaluateCurve(curve: CurvePoint[], input: number): number {
  const value = clamp01(input);
  for (let index = 1; index < curve.length; index += 1) {
    const right = curve[index];
    if (value <= right.x) {
      const left = curve[index - 1];
      const width = Math.max(right.x - left.x, Number.EPSILON);
      return left.y + (right.y - left.y) * ((value - left.x) / width);
    }
  }
  return curve[curve.length - 1]?.y ?? value;
}

export function buildCurveLut(curves: ToneCurves, size = 256): Float32Array {
  const data = new Float32Array(size * 4);
  for (let index = 0; index < size; index += 1) {
    const input = index / (size - 1);
    data[index * 4] = evaluateCurve(curves.master, evaluateCurve(curves.red, input));
    data[index * 4 + 1] = evaluateCurve(curves.master, evaluateCurve(curves.green, input));
    data[index * 4 + 2] = evaluateCurve(curves.master, evaluateCurve(curves.blue, input));
    data[index * 4 + 3] = 1;
  }
  return data;
}

function cloneEndpoints(): CurvePoint[] {
  return ENDPOINTS.map((point) => ({ ...point }));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
