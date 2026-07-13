import { describe, expect, it } from "vitest";
import { createAdjustmentLayer, createMaskComponent } from "../editor/masks";
import { applyLayersToPixel } from "./mask-engine";
import { updateHslChannel } from "../editor/hsl";
import { addCurvePoint } from "../editor/tone-curve";

const context = {
  point: { x: 0.75, y: 0.5 },
  sourceColor: [0.2, 0.2, 0.2] as const,
  fineDetail: 0,
  coarseDetail: 0,
  imageAspect: 1,
};

describe("masked adjustment layers", () => {
  it("blends each layer's adjustment through its combined mask and opacity", () => {
    const layer = createAdjustmentLayer("layer", createMaskComponent("linear", "linear"));
    layer.adjustments.exposure = 1;
    expect(applyLayersToPixel([0.2, 0.2, 0.2], [layer], context)[0]).toBeCloseTo(0.4, 6);
    expect(applyLayersToPixel([0.2, 0.2, 0.2], [{ ...layer, opacity: 0.5 }], context)[0]).toBeCloseTo(0.3, 6);
    expect(applyLayersToPixel([0.2, 0.2, 0.2], [{ ...layer, visible: false }], context)[0]).toBe(0.2);
  });

  it("applies local HSL and curves from the layer, not its selection components", () => {
    const layer = createAdjustmentLayer("layer", createMaskComponent("linear", "linear"));
    layer.hsl = updateHslChannel(layer.hsl, "red", "saturation", -100);
    const neutral = applyLayersToPixel([0.8, 0.2, 0.2], [layer], { ...context, sourceColor: [0.8, 0.2, 0.2] });
    expect(Math.max(...neutral) - Math.min(...neutral)).toBeLessThan(0.01);

    layer.hsl = createAdjustmentLayer("neutral").hsl;
    layer.curves = { ...layer.curves, master: addCurvePoint(layer.curves.master, { x: 0.5, y: 0.25 }) };
    expect(applyLayersToPixel([0.5, 0.5, 0.5], [layer], { ...context, sourceColor: [0.5, 0.5, 0.5] })[0]).toBeCloseTo(0.25, 6);
  });
});
