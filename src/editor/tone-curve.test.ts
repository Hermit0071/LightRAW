import { describe, expect, it } from "vitest";
import {
  addCurvePoint,
  createDefaultToneCurves,
  evaluateCurve,
  moveCurvePoint,
  removeCurvePoint,
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
});
