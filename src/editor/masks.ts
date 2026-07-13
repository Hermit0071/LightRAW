import { createDefaultAdjustments, type BasicAdjustments } from "./basic-adjustments";
import { createDefaultHsl, type HslAdjustments } from "./hsl";
import { createDefaultToneCurves, type ToneCurves } from "./tone-curve";

export interface MaskPoint { x: number; y: number }
export type MaskCombineMode = "add" | "subtract" | "intersect";

interface MaskComponentBase {
  id: string;
  name: string;
  visible: boolean;
  inverted: boolean;
  mode: MaskCombineMode;
}

export interface LinearMask extends MaskComponentBase {
  type: "linear";
  start: MaskPoint;
  end: MaskPoint;
  feather: number;
}

export interface RadialMask extends MaskComponentBase {
  type: "radial";
  center: MaskPoint;
  radiusX: number;
  radiusY: number;
  rotation: number;
  feather: number;
}

export interface BrushStroke {
  points: MaskPoint[];
  size: number;
  feather: number;
  flow: number;
}

export interface BrushMask extends MaskComponentBase { type: "brush"; strokes: BrushStroke[] }
export interface PenMask extends MaskComponentBase { type: "pen"; points: MaskPoint[]; closed: boolean; feather: number }
export interface ChromaMask extends MaskComponentBase {
  type: "chroma";
  target: readonly [number, number, number];
  tolerance: number;
  softness: number;
}

export type MaskComponent = LinearMask | RadialMask | BrushMask | PenMask | ChromaMask;
export type MaskType = MaskComponent["type"];

export interface LayerMask {
  inverted: boolean;
  components: MaskComponent[];
}

export interface AdjustmentLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  adjustments: BasicAdjustments;
  hsl: HslAdjustments;
  curves: ToneCurves;
  mask: LayerMask;
}

export const MAX_LAYERS = 8;
export const MAX_MASK_COMPONENTS = 8;

export function createMaskComponent(type: MaskType, id: string, mode: MaskCombineMode = "add"): MaskComponent {
  const base = { id, name: MASK_NAMES[type], visible: true, inverted: false, mode };
  if (type === "linear") return { ...base, type, start: { x: 0.25, y: 0.5 }, end: { x: 0.75, y: 0.5 }, feather: 1 };
  if (type === "radial") return { ...base, type, center: { x: 0.5, y: 0.5 }, radiusX: 0.25, radiusY: 0.25, rotation: 0, feather: 0.35 };
  if (type === "brush") return { ...base, type, strokes: [] };
  if (type === "pen") return { ...base, type, points: [], closed: false, feather: 0.03 };
  return { ...base, type, target: [0.5, 0.5, 0.5], tolerance: 0.08, softness: 0.08 };
}

export function createAdjustmentLayer(id: string, mask?: MaskComponent): AdjustmentLayer {
  const firstMask = mask && mask.mode !== "add" ? { ...mask, mode: "add" as const } : mask;
  return {
    id,
    name: mask?.name ?? "调整图层",
    visible: true,
    opacity: 1,
    adjustments: createDefaultAdjustments(),
    hsl: createDefaultHsl(),
    curves: createDefaultToneCurves(),
    mask: { inverted: false, components: firstMask ? [firstMask] : [] },
  };
}

export function addLayer(layers: AdjustmentLayer[], layer: AdjustmentLayer): AdjustmentLayer[] {
  if (layers.length >= MAX_LAYERS) throw new RangeError(`最多支持 ${MAX_LAYERS} 个调整图层`);
  return [...layers, layer];
}

export function removeLayer(layers: AdjustmentLayer[], id: string): AdjustmentLayer[] {
  return layers.filter((layer) => layer.id !== id);
}

export function updateLayer(layers: AdjustmentLayer[], updated: AdjustmentLayer): AdjustmentLayer[] {
  return layers.map((layer) => layer.id === updated.id ? updated : layer);
}

export function addMaskComponent(layer: AdjustmentLayer, mask: MaskComponent): AdjustmentLayer {
  if (layer.mask.components.length >= MAX_MASK_COMPONENTS) throw new RangeError(`每层最多支持 ${MAX_MASK_COMPONENTS} 个蒙版组件`);
  const component = layer.mask.components.length === 0 && mask.mode !== "add" ? { ...mask, mode: "add" as const } : mask;
  return { ...layer, mask: { ...layer.mask, components: [...layer.mask.components, component] } };
}

export function removeMaskComponent(layer: AdjustmentLayer, id: string): AdjustmentLayer {
  const removedIndex = layer.mask.components.findIndex((mask) => mask.id === id);
  const components = layer.mask.components.filter((mask) => mask.id !== id);
  if (removedIndex === 0 && components[0]?.mode !== "add") components[0] = { ...components[0], mode: "add" };
  return { ...layer, mask: { ...layer.mask, components } };
}

export function setMaskComponentVisibility(layer: AdjustmentLayer, id: string, visible: boolean): AdjustmentLayer {
  return {
    ...layer,
    mask: { ...layer.mask, components: layer.mask.components.map((mask) => mask.id === id ? { ...mask, visible } : mask) },
  };
}

export function componentCoverageAt(
  mask: MaskComponent,
  point: MaskPoint,
  pixel?: readonly [number, number, number],
  imageAspect = 1,
): number {
  if (!mask.visible) return 0;
  let coverage = 0;
  if (mask.type === "linear") coverage = linearCoverage(mask, point, imageAspect);
  else if (mask.type === "radial") coverage = radialCoverage(mask, point);
  else if (mask.type === "brush") coverage = brushCoverage(mask, point, imageAspect);
  else if (mask.type === "pen") coverage = penCoverage(mask, point, imageAspect);
  else if (pixel) coverage = chromaCoverage(mask, pixel);
  return mask.inverted ? 1 - coverage : coverage;
}

export function layerCoverageAt(
  layer: AdjustmentLayer,
  point: MaskPoint,
  pixel?: readonly [number, number, number],
  imageAspect = 1,
): number {
  if (!layer.visible) return 0;
  let coverage = 0;
  let hasBase = false;
  for (const mask of layer.mask.components) {
    if (!mask.visible) continue;
    const component = componentCoverageAt(mask, point, pixel, imageAspect);
    if (!hasBase) {
      coverage = component;
      hasBase = true;
    } else if (mask.mode === "add") coverage = Math.max(coverage, component);
    else if (mask.mode === "subtract") coverage *= 1 - component;
    else coverage *= component;
  }
  const masked = layer.mask.inverted ? 1 - coverage : coverage;
  return masked * clamp(layer.opacity, 0, 1);
}

const MASK_NAMES: Record<MaskType, string> = {
  linear: "线性渐变",
  radial: "径向渐变",
  brush: "画笔",
  pen: "钢笔路径",
  chroma: "色度范围",
};

function linearCoverage(mask: LinearMask, point: MaskPoint, aspect: number): number {
  const dx = (mask.end.x - mask.start.x) * aspect;
  const dy = mask.end.y - mask.start.y;
  const lengthSquared = Math.max(dx * dx + dy * dy, Number.EPSILON);
  const t = clamp(((point.x - mask.start.x) * aspect * dx + (point.y - mask.start.y) * dy) / lengthSquared, 0, 1);
  return mix(t >= 0.5 ? 1 : 0, smoothstep(0, 1, t), mask.feather);
}

function radialCoverage(mask: RadialMask, point: MaskPoint): number {
  const angle = -mask.rotation * Math.PI / 180;
  const dx = point.x - mask.center.x;
  const dy = point.y - mask.center.y;
  const x = (Math.cos(angle) * dx - Math.sin(angle) * dy) / Math.max(mask.radiusX, 0.001);
  const y = (Math.sin(angle) * dx + Math.cos(angle) * dy) / Math.max(mask.radiusY, 0.001);
  return 1 - smoothstep(1 - mask.feather, 1, Math.hypot(x, y));
}

function brushCoverage(mask: BrushMask, point: MaskPoint, aspect: number): number {
  let coverage = 0;
  for (const stroke of mask.strokes) {
    let strokeCoverage = 0;
    for (let index = 0; index < stroke.points.length; index += 1) {
      const distance = segmentDistance(point, stroke.points[Math.max(0, index - 1)], stroke.points[index], aspect);
      strokeCoverage = Math.max(strokeCoverage, 1 - smoothstep(1 - stroke.feather, 1, distance / Math.max(stroke.size / 2, 0.001)));
    }
    coverage = 1 - (1 - coverage) * (1 - strokeCoverage * stroke.flow);
  }
  return coverage;
}

function penCoverage(mask: PenMask, point: MaskPoint, aspect: number): number {
  if (!mask.closed || mask.points.length < 3 || !pointInPolygon(point, mask.points)) return 0;
  if (mask.feather <= 0) return 1;
  let distance = Infinity;
  for (let index = 0; index < mask.points.length; index += 1) {
    distance = Math.min(distance, segmentDistance(point, mask.points[index], mask.points[(index + 1) % mask.points.length], aspect));
  }
  return smoothstep(0, mask.feather, distance);
}

function chromaCoverage(mask: ChromaMask, pixel: readonly [number, number, number]): number {
  const [, cb, cr] = toYCbCr(pixel);
  const [, targetCb, targetCr] = toYCbCr(mask.target);
  return 1 - smoothstep(mask.tolerance, mask.tolerance + mask.softness, Math.hypot(cb - targetCb, cr - targetCr));
}

function segmentDistance(point: MaskPoint, start: MaskPoint, end: MaskPoint, aspect: number): number {
  const px = point.x * aspect;
  const sx = start.x * aspect;
  const dx = (end.x - start.x) * aspect;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : clamp(((px - sx) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(px - (sx + dx * t), point.y - (start.y + dy * t));
}

function pointInPolygon(point: MaskPoint, polygon: MaskPoint[]): boolean {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const left = polygon[current];
    const right = polygon[previous];
    if ((left.y > point.y) !== (right.y > point.y)
      && point.x < (right.x - left.x) * (point.y - left.y) / (right.y - left.y) + left.x) inside = !inside;
  }
  return inside;
}

function toYCbCr(color: readonly [number, number, number]): [number, number, number] {
  const y = color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114;
  return [y, (color[2] - y) * 0.564, (color[0] - y) * 0.713];
}

function smoothstep(start: number, end: number, value: number): number {
  if (start === end) return value < start ? 0 : 1;
  const t = clamp((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}

function mix(left: number, right: number, amount: number): number {
  return left + (right - left) * clamp(amount, 0, 1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
