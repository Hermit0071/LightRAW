import type { DevelopRecipe } from "./develop-recipe";
import { BASIC_ADJUSTMENT_LIMITS } from "./basic-adjustments";
import { DETAIL_LIMITS } from "./detail";
import { HSL_CHANNELS } from "./hsl";
import { MAX_LAYERS, MAX_MASK_COMPONENTS, type AdjustmentLayer, type MaskComponent } from "./masks";
import { MAX_CURVE_POINTS, MIN_CURVE_POINT_GAP } from "./tone-curve";

export interface DevelopPreset {
  kind: "lightraw-preset";
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  settings: Pick<DevelopRecipe, "basic" | "hsl" | "curves" | "detail"> & { layers: AdjustmentLayer[] };
}

export function createPreset(name: string, recipe: DevelopRecipe, id: string = crypto.randomUUID()): DevelopPreset {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("预设名称不能为空");
  return {
    kind: "lightraw-preset",
    version: 1,
    id,
    name: trimmed,
    createdAt: new Date().toISOString(),
    settings: clone({ basic: recipe.basic, hsl: recipe.hsl, curves: recipe.curves, detail: recipe.detail, layers: recipe.layers }),
  };
}

export function applyPreset(recipe: DevelopRecipe, preset: DevelopPreset): DevelopRecipe {
  const settings = clone(preset.settings);
  return { ...recipe, basic: settings.basic, hsl: settings.hsl, curves: settings.curves, detail: settings.detail, layers: settings.layers };
}

export function stringifyPreset(preset: DevelopPreset): string {
  return `${JSON.stringify(preset, null, 2)}\n`;
}

export function parsePresetJson(json: string): DevelopPreset {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("预设 JSON 无法解析");
  }
  if (!isRecord(value)
    || value.kind !== "lightraw-preset"
    || value.version !== 1
    || typeof value.id !== "string"
    || typeof value.name !== "string"
    || typeof value.createdAt !== "string"
    || !isRecord(value.settings)
    || value.name.trim().length === 0
    || value.name.length > 120
    || !Number.isFinite(Date.parse(value.createdAt))
    || !validSettings(value.settings)) {
    throw new Error("不是有效的 LightRAW 预设");
  }
  return clone(value as unknown as DevelopPreset);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validSettings(value: Record<string, unknown>): boolean {
  const keys = ["basic", "hsl", "curves", "detail", "layers"];
  return Object.keys(value).length === keys.length
    && Object.keys(value).every((key) => keys.includes(key))
    && validNumbers(value.basic, BASIC_ADJUSTMENT_LIMITS)
    && validHsl(value.hsl)
    && validCurves(value.curves)
    && validNumbers(value.detail, DETAIL_LIMITS)
    && Array.isArray(value.layers)
    && value.layers.length <= MAX_LAYERS
    && uniqueStrings(value.layers.map((layer) => isRecord(layer) ? layer.id : null))
    && value.layers.every(validLayer);
}

function validNumbers(value: unknown, limits: Record<string, readonly [number, number]>): boolean {
  if (!isRecord(value)) return false;
  const keys = Object.keys(limits);
  return keys.every((key) => inRange(value[key], ...limits[key]))
    && Object.keys(value).every((key) => keys.includes(key));
}

function validHsl(value: unknown): boolean {
  if (!isRecord(value) || Object.keys(value).length !== HSL_CHANNELS.length) return false;
  return HSL_CHANNELS.every((name) => validNumbers(value[name], {
    hue: [-100, 100], saturation: [-100, 100], luminance: [-100, 100],
  }));
}

function validCurves(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const channels = ["master", "red", "green", "blue"];
  return Object.keys(value).every((key) => channels.includes(key)) && channels.every((channel) => {
    const curve = value[channel];
    if (!Array.isArray(curve) || curve.length < 2 || curve.length > MAX_CURVE_POINTS) return false;
    if (!isPoint(curve[0]) || curve[0].x !== 0 || !isPoint(curve.at(-1)) || curve.at(-1)!.x !== 1) return false;
    return curve.every((point, index) => isPoint(point) && (index === 0
      || (isPoint(curve[index - 1]) && point.x - curve[index - 1].x >= MIN_CURVE_POINT_GAP)));
  });
}

function validLayer(value: unknown): boolean {
  if (!isRecord(value)
    || !shortString(value.id)
    || typeof value.name !== "string" || value.name.length > 200
    || typeof value.visible !== "boolean"
    || !inRange(value.opacity, 0, 1)
    || !["normal", "multiply", "screen"].includes(String(value.blendMode))
    || !validNumbers(value.adjustments, BASIC_ADJUSTMENT_LIMITS)
    || !validHsl(value.hsl)
    || !validCurves(value.curves)
    || !isRecord(value.mask)
    || typeof value.mask.inverted !== "boolean"
    || !Array.isArray(value.mask.components)
    || value.mask.components.length > MAX_MASK_COMPONENTS
    || !uniqueStrings(value.mask.components.map((mask) => isRecord(mask) ? mask.id : null))
    || !value.mask.components.every(validMaskComponent)) return false;
  const first = value.mask.components[0];
  return first === undefined || (isRecord(first) && first.mode === "add");
}

function validMaskComponent(value: unknown): value is MaskComponent {
  if (!isRecord(value)
    || !shortString(value.id)
    || typeof value.name !== "string" || value.name.length > 200
    || typeof value.visible !== "boolean"
    || typeof value.inverted !== "boolean"
    || !["add", "subtract", "intersect"].includes(String(value.mode))) return false;
  if (value.type === "linear") return isPoint(value.start) && isPoint(value.end) && inRange(value.feather, 0, 1);
  if (value.type === "radial") return isPoint(value.center) && inRange(value.radiusX, 0.001, 1)
    && inRange(value.radiusY, 0.001, 1) && inRange(value.rotation, -180, 180) && inRange(value.feather, 0, 1);
  if (value.type === "pen") return Array.isArray(value.points) && value.points.length <= 10_000
    && value.points.every(isPoint) && typeof value.closed === "boolean" && inRange(value.feather, 0, 1);
  if (value.type === "chroma") return validColor(value.target) && inRange(value.tolerance, 0, 1) && inRange(value.softness, 0, 1);
  if (value.type === "brush") return Array.isArray(value.strokes) && value.strokes.length <= 1_000
    && value.strokes.every((stroke) => isRecord(stroke) && Array.isArray(stroke.points) && stroke.points.length <= 10_000
      && stroke.points.every(isPoint) && inRange(stroke.size, 0.001, 1) && inRange(stroke.feather, 0, 1) && inRange(stroke.flow, 0, 1));
  return false;
}

function isPoint(value: unknown): value is { x: number; y: number } {
  return isRecord(value) && inRange(value.x, 0, 1) && inRange(value.y, 0, 1);
}

function validColor(value: unknown): boolean {
  return Array.isArray(value) && value.length === 3 && value.every((channel) => inRange(channel, 0, 1));
}

function inRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function shortString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}

function uniqueStrings(values: unknown[]): boolean {
  return values.every(shortString) && new Set(values).size === values.length;
}
