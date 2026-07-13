export interface CurvePoint {
  x: number;
  y: number;
}

export type CurveChannel = "master" | "red" | "green" | "blue";
export type ToneCurves = Record<CurveChannel, CurvePoint[]>;

const ENDPOINTS: CurvePoint[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
export const MIN_CURVE_POINT_GAP = 0.001;
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
  const safe = { x: clamp(point.x, MIN_CURVE_POINT_GAP, 1 - MIN_CURVE_POINT_GAP), y: clamp01(point.y) };
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
    x: clamp(point.x, next[index - 1].x + MIN_CURVE_POINT_GAP, next[index + 1].x - MIN_CURVE_POINT_GAP),
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

export function evaluateCurve(curve: CurvePoint[], input: number): number {
  return evaluatePreparedCurve(curve, monotoneTangents(curve), input);
}

export function sampleCurve(curve: CurvePoint[], sampleCount: number): CurvePoint[] {
  const count = Math.max(2, Math.floor(sampleCount));
  const tangents = monotoneTangents(curve);
  return Array.from({ length: count }, (_, index) => {
    const x = index / (count - 1);
    return { x, y: evaluatePreparedCurve(curve, tangents, x) };
  });
}

function evaluatePreparedCurve(curve: CurvePoint[], tangents: number[], input: number): number {
  const value = clamp01(input);
  for (let index = 1; index < curve.length; index += 1) {
    const right = curve[index];
    if (value <= right.x) {
      const left = curve[index - 1];
      const width = Math.max(right.x - left.x, Number.EPSILON);
      const amount = (value - left.x) / width;
      const amountSquared = amount * amount;
      const amountCubed = amountSquared * amount;
      const leftWeight = 2 * amountCubed - 3 * amountSquared + 1;
      const leftTangentWeight = amountCubed - 2 * amountSquared + amount;
      const rightWeight = -2 * amountCubed + 3 * amountSquared;
      const rightTangentWeight = amountCubed - amountSquared;
      return clamp01(
        leftWeight * left.y
        + leftTangentWeight * width * tangents[index - 1]
        + rightWeight * right.y
        + rightTangentWeight * width * tangents[index],
      );
    }
  }
  return curve[curve.length - 1]?.y ?? value;
}

/**
 * Shape-preserving cubic Hermite tangents (PCHIP). Adjacent secants with
 * opposite signs get a flat tangent; matching signs use a weighted harmonic
 * mean. This keeps the curve C1-continuous without overshooting either handle.
 */
function monotoneTangents(curve: CurvePoint[]): number[] {
  if (curve.length < 2) return [];
  const widths = curve.slice(1).map((point, index) => Math.max(point.x - curve[index].x, Number.EPSILON));
  const slopes = widths.map((width, index) => (curve[index + 1].y - curve[index].y) / width);
  if (curve.length === 2) return [slopes[0], slopes[0]];

  const tangents = new Array<number>(curve.length);
  tangents[0] = endpointTangent(widths[0], widths[1], slopes[0], slopes[1]);
  for (let index = 1; index < curve.length - 1; index += 1) {
    const before = slopes[index - 1];
    const after = slopes[index];
    if (before === 0 || after === 0 || Math.sign(before) !== Math.sign(after)) {
      tangents[index] = 0;
      continue;
    }
    const beforeWeight = 2 * widths[index] + widths[index - 1];
    const afterWeight = widths[index] + 2 * widths[index - 1];
    tangents[index] = (beforeWeight + afterWeight) / (beforeWeight / before + afterWeight / after);
  }
  const last = curve.length - 1;
  tangents[last] = endpointTangent(widths[last - 1], widths[last - 2], slopes[last - 1], slopes[last - 2]);
  return tangents;
}

function endpointTangent(width: number, adjacentWidth: number, slope: number, adjacentSlope: number): number {
  const tangent = ((2 * width + adjacentWidth) * slope - width * adjacentSlope) / (width + adjacentWidth);
  if (Math.sign(tangent) !== Math.sign(slope)) return 0;
  if (Math.sign(slope) !== Math.sign(adjacentSlope) && Math.abs(tangent) > Math.abs(3 * slope)) return 3 * slope;
  return tangent;
}

export function buildCurveLut(curves: ToneCurves, size = 256): Float32Array {
  const data = new Float32Array(size * 4);
  const masterTangents = monotoneTangents(curves.master);
  const redTangents = monotoneTangents(curves.red);
  const greenTangents = monotoneTangents(curves.green);
  const blueTangents = monotoneTangents(curves.blue);
  for (let index = 0; index < size; index += 1) {
    const input = index / (size - 1);
    const red = evaluatePreparedCurve(curves.red, redTangents, input);
    const green = evaluatePreparedCurve(curves.green, greenTangents, input);
    const blue = evaluatePreparedCurve(curves.blue, blueTangents, input);
    data[index * 4] = evaluatePreparedCurve(curves.master, masterTangents, red);
    data[index * 4 + 1] = evaluatePreparedCurve(curves.master, masterTangents, green);
    data[index * 4 + 2] = evaluatePreparedCurve(curves.master, masterTangents, blue);
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
