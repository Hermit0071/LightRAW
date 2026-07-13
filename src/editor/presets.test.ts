import { describe, expect, it } from "vitest";
import { createDefaultDevelopRecipe } from "./develop-recipe";
import { createAdjustmentLayer, createMaskComponent, MAX_LAYERS } from "./masks";
import { applyPreset, createPreset, parsePresetJson, stringifyPreset } from "./presets";

describe("JSON develop presets", () => {
  it("round-trips global and layer adjustments but keeps photo-specific geometry", () => {
    const source = createDefaultDevelopRecipe();
    source.basic.exposure = 1.25;
    source.layers = [createAdjustmentLayer("layer", createMaskComponent("linear", "mask"))];
    const preset = createPreset("Bright", source, "preset-1");
    const parsed = parsePresetJson(stringifyPreset(preset));

    const target = createDefaultDevelopRecipe();
    target.geometry.crop = { x: 0.1, y: 0.2, width: 0.6, height: 0.5 };
    const applied = applyPreset(target, parsed);
    expect(applied.basic.exposure).toBe(1.25);
    expect(applied.geometry).toEqual(target.geometry);
    expect(parsed.name).toBe("Bright");
  });

  it("rejects unrelated or malformed JSON", () => {
    expect(() => parsePresetJson("[]")).toThrow(/预设/);
    expect(() => parsePresetJson('{"kind":"other"}')).toThrow(/预设/);
    const valid = createPreset("Safe", createDefaultDevelopRecipe(), "safe");
    expect(() => parsePresetJson(JSON.stringify({ ...valid, settings: { ...valid.settings, basic: {} } }))).toThrow(/预设/);
    expect(() => parsePresetJson(JSON.stringify({ ...valid, settings: { ...valid.settings, layers: Array(MAX_LAYERS + 1).fill({}) } }))).toThrow(/预设/);
    const layer = createAdjustmentLayer("layer", createMaskComponent("linear", "mask"));
    expect(() => parsePresetJson(JSON.stringify({ ...valid, settings: { ...valid.settings, layers: [{ ...layer, blendMode: "overlay" }] } }))).toThrow(/预设/);
    expect(() => parsePresetJson(JSON.stringify({ ...valid, settings: { ...valid.settings, curves: {
      ...valid.settings.curves, master: [{ x: 0.2, y: 0 }, { x: 0.8, y: 1 }],
    } } }))).toThrow(/预设/);
    expect(() => parsePresetJson(JSON.stringify({ ...valid, settings: { ...valid.settings, version: 999 } }))).toThrow(/预设/);
  });
});
