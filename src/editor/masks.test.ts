import { describe, expect, it } from "vitest";
import {
  addLayer,
  addMaskComponent,
  componentCoverageAt,
  createAdjustmentLayer,
  createMaskComponent,
  layerCoverageAt,
  MAX_LAYERS,
  removeMaskComponent,
  removeLayer,
  setMaskComponentVisibility,
} from "./masks";

describe("adjustment layers and masks", () => {
  it("stores color adjustments on the layer and selection tools below it", () => {
    const mask = createMaskComponent("linear", "mask-1");
    const layer = createAdjustmentLayer("layer-1", mask);
    expect(layer).toMatchObject({ id: "layer-1", visible: true, mask: { components: [{ id: "mask-1", type: "linear" }] } });
    expect(layer.adjustments.exposure).toBe(0);
    expect(removeLayer(addLayer([], layer), layer.id)).toEqual([]);
    expect(createAdjustmentLayer("normalized", createMaskComponent("linear", "first", "subtract")).mask.components[0].mode).toBe("add");
  });

  it("combines child masks with add, subtract and intersect", () => {
    const full = { ...createMaskComponent("radial", "full"), radiusX: 1, radiusY: 1, feather: 0 };
    const hole = { ...createMaskComponent("radial", "hole", "subtract"), radiusX: 0.1, radiusY: 0.1, feather: 0 };
    const layer = addMaskComponent(createAdjustmentLayer("layer", full), hole);
    expect(layerCoverageAt(layer, { x: 0.5, y: 0.5 })).toBe(0);
    expect(layerCoverageAt(layer, { x: 0.75, y: 0.5 })).toBe(1);

    const intersect = { ...createMaskComponent("linear", "half", "intersect"), start: { x: 0.5, y: 0.5 }, end: { x: 1, y: 0.5 }, feather: 0 };
    expect(layerCoverageAt(addMaskComponent(layer, intersect), { x: 0.25, y: 0.5 })).toBe(0);
  });

  it("promotes the first remaining visible component to the Add base", () => {
    const add = createMaskComponent("linear", "add");
    const subtract = createMaskComponent("radial", "subtract", "subtract");
    const layer = addMaskComponent(createAdjustmentLayer("layer", add), subtract);
    expect(removeMaskComponent(layer, add.id).mask.components[0].mode).toBe("add");
    const hidden = setMaskComponentVisibility(layer, add.id, false);
    expect(hidden.mask.components[1].mode).toBe("subtract");
    expect(layerCoverageAt(hidden, { x: 0.5, y: 0.5 })).toBe(1);
    expect(setMaskComponentVisibility(hidden, add.id, true).mask.components[1].mode).toBe("subtract");
    const extra = addMaskComponent(hidden, createMaskComponent("pen", "extra", "intersect"));
    expect(removeMaskComponent(extra, "extra").mask.components[1].mode).toBe("subtract");
  });

  it("projects diagonal gradients in physical image space", () => {
    const mask = { ...createMaskComponent("linear", "diagonal"), start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
    expect(componentCoverageAt(mask, { x: 0.5, y: 0 }, undefined, 2)).toBeCloseTo(0.352, 6);
  });

  it("accumulates flow across brush strokes", () => {
    const stroke = { points: [{ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }], size: 0.1, feather: 0.5, flow: 0.5 };
    const brush = { ...createMaskComponent("brush", "brush"), strokes: [stroke, stroke] };
    expect(componentCoverageAt(brush, { x: 0.5, y: 0.5 })).toBeCloseTo(0.75, 6);
  });

  it("supports pen, chroma, inversion and the layer cap", () => {
    const pen = { ...createMaskComponent("pen", "pen"), points: [
      { x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.75, y: 0.75 }, { x: 0.25, y: 0.75 },
    ], closed: true };
    expect(componentCoverageAt(pen, { x: 0.5, y: 0.5 })).toBe(1);
    const chroma = { ...createMaskComponent("chroma", "chroma"), target: [1, 0, 0] as const };
    expect(componentCoverageAt(chroma, { x: 0.5, y: 0.5 }, [1, 0, 0])).toBe(1);
    expect(componentCoverageAt({ ...pen, inverted: true }, { x: 0.5, y: 0.5 })).toBe(0);
    const full = Array.from({ length: MAX_LAYERS }, (_, index) => createAdjustmentLayer(String(index)));
    expect(() => addLayer(full, createAdjustmentLayer("overflow"))).toThrow(/最多支持/);
  });
});
