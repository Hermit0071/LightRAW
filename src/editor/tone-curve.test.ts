import { describe, expect, it } from "vitest";
import {
  addCurvePoint,
  buildCurveBezierSegments,
  buildCurveLut,
  createDefaultToneCurves,
  evaluateCurve,
  moveCurvePoint,
  removeCurvePoint,
  CURVE_LUT_SIZE,
  MIN_CURVE_POINT_GAP,
} from "./tone-curve";

describe("tone curve", () => {
  it("starts as a neutral diagonal", () => {
    const curves = createDefaultToneCurves();
    expect(curves.master).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(evaluateCurve(curves.master, 0.42)).toBeCloseTo(0.42, 6);
  });

  it("keeps points ordered and replaces a nearby point", () => {
    const first = addCurvePoint([{ x: 0, y: 0 }, { x: 1, y: 1 }], { x: 0.5, y: 0.65 });
    const replaced = addCurvePoint(first, { x: 0.505, y: 0.4 });
    expect(replaced).toEqual([{ x: 0, y: 0 }, { x: 0.505, y: 0.4 }, { x: 1, y: 1 }]);
  });

  it("keeps new control points away from fixed endpoint X positions", () => {
    const curve = addCurvePoint([{ x: 0, y: 0 }, { x: 1, y: 1 }], { x: 0, y: 0.4 });
    expect(curve[1].x).toBe(0.001);
  });

  it("moves interior points without crossing neighbours", () => {
    const curve = [{ x: 0, y: 0 }, { x: 0.4, y: 0.3 }, { x: 1, y: 1 }];
    expect(moveCurvePoint(curve, 1, { x: 2, y: -1 })[1]).toEqual({ x: 0.999, y: 0 });
  });

  it("does not remove the two endpoints", () => {
    const curve = [{ x: 0, y: 0 }, { x: 0.5, y: 0.6 }, { x: 1, y: 1 }];
    expect(removeCurvePoint(curve, 0)).toEqual(curve);
    expect(removeCurvePoint(curve, 1)).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });

  it("interpolates smoothly without overshooting adjacent values", () => {
    const curve = [{ x: 0, y: 0 }, { x: 0.35, y: 0.2 }, { x: 0.7, y: 0.8 }, { x: 1, y: 1 }];
    const value = evaluateCurve(curve, 0.5);
    expect(value).toBeGreaterThan(0.2);
    expect(value).toBeLessThan(0.8);
  });

  it("keeps the slope continuous through control points instead of drawing segments", () => {
    const curve = [{ x: 0, y: 0 }, { x: 0.5, y: 0.2 }, { x: 1, y: 1 }];
    const epsilon = 0.0001;
    const knot = evaluateCurve(curve, 0.5);
    const slopeBefore = (knot - evaluateCurve(curve, 0.5 - epsilon)) / epsilon;
    const slopeAfter = (evaluateCurve(curve, 0.5 + epsilon) - knot) / epsilon;

    expect(Math.abs(slopeBefore - slopeAfter)).toBeLessThan(0.01);
    expect(evaluateCurve(curve, 0.25)).not.toBeCloseTo(0.1, 4);
  });

  it("samples a smooth curve without overshooting any pair of neighbouring handles", () => {
    const curve = [{ x: 0, y: 0.1 }, { x: 0.25, y: 0.8 }, { x: 0.6, y: 0.3 }, { x: 1, y: 0.9 }];
    const samples = Array.from({ length: 401 }, (_, index) => ({ x: index / 400, y: evaluateCurve(curve, index / 400) }));

    expect(samples[0]).toEqual({ x: 0, y: 0.1 });
    expect(samples.at(-1)).toEqual({ x: 1, y: 0.9 });
    for (const sample of samples) {
      const rightIndex = curve.findIndex((point) => sample.x <= point.x);
      const left = curve[Math.max(0, rightIndex - 1)];
      const right = curve[Math.max(0, rightIndex)];
      expect(sample.y).toBeGreaterThanOrEqual(Math.min(left.y, right.y) - 0.000001);
      expect(sample.y).toBeLessThanOrEqual(Math.max(left.y, right.y) + 0.000001);
    }
  });

  it("builds exact cubic segments through every control point", () => {
    const curve = [{ x: 0, y: 0 }, { x: 0.333, y: 0.7 }, { x: 1, y: 1 }];
    const segments = buildCurveBezierSegments(curve);

    expect(segments.map((segment) => segment.start)).toEqual(curve.slice(0, -1));
    expect(segments.map((segment) => segment.end)).toEqual(curve.slice(1));
    expect(segments[0].control2.x).toBeLessThan(curve[1].x);
    expect(segments[1].control1.x).toBeGreaterThan(curve[1].x);
  });

  it("keeps the dense GPU LUT close to the spline around tightly spaced handles", () => {
    const curves = createDefaultToneCurves();
    curves.master = [{ x: 0, y: 0 }, { x: 0.5, y: 0.2 }, { x: 0.501, y: 0.8 }, { x: 1, y: 1 }];
    const lut = buildCurveLut(curves);
    const lookup = (input: number) => {
      const position = input * (CURVE_LUT_SIZE - 1);
      const left = Math.floor(position);
      const amount = position - left;
      return lut[left * 4] + (lut[Math.min(CURVE_LUT_SIZE - 1, left + 1) * 4] - lut[left * 4]) * amount;
    };

    expect(CURVE_LUT_SIZE * MIN_CURVE_POINT_GAP).toBeGreaterThan(4);
    expect(lookup(0.5)).toBeCloseTo(0.2, 2);
    expect(lookup(0.501)).toBeCloseTo(0.8, 2);
  });
});
