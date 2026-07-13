import {
  componentCoverageAt,
  type AdjustmentLayer,
  type BrushMask,
  type MaskComponent,
  type MaskPoint,
} from "../editor/masks";

export const MASK_TEXTURE_SIZE = 256;
export type SourceSampler = (point: MaskPoint) => readonly [number, number, number];

/** Builds the final alpha selection for one adjustment layer, bottom-up for WebGL. */
export function rasterizeLayerMask(
  layer: AdjustmentLayer,
  size: number,
  imageAspect: number,
  sampleSource?: SourceSampler,
): Uint8Array {
  const coverage = new Float32Array(size * size);
  let hasBase = false;
  for (const mask of layer.mask.components) {
    if (!mask.visible) continue;
    const component = rasterizeComponent(mask, size, imageAspect, sampleSource);
    for (let offset = 0; offset < coverage.length; offset += 1) {
      const value = component[offset] / 255;
      if (!hasBase) coverage[offset] = value;
      else if (mask.mode === "add") coverage[offset] = Math.max(coverage[offset], value);
      else if (mask.mode === "subtract") coverage[offset] *= 1 - value;
      else coverage[offset] *= value;
    }
    hasBase = true;
  }
  return Uint8Array.from(coverage, (value) => Math.round((layer.mask.inverted ? 1 - value : value) * 255));
}

/** Cache identity for selection coverage only; layer color adjustments are uploaded separately. */
export function layerRasterKey(layer: AdjustmentLayer): string {
  return JSON.stringify(layer.mask);
}

function rasterizeComponent(
  mask: MaskComponent,
  size: number,
  imageAspect: number,
  sampleSource?: SourceSampler,
): Uint8Array {
  if (mask.type === "brush") return rasterizeBrush(mask, size, imageAspect);
  const pixels = new Uint8Array(size * size);
  for (let textureY = 0; textureY < size; textureY += 1) {
    const sourceY = 1 - (textureY + 0.5) / size;
    for (let x = 0; x < size; x += 1) {
      const point = { x: (x + 0.5) / size, y: sourceY };
      const pixel = mask.type === "chroma" ? sampleSource?.(point) : undefined;
      pixels[textureY * size + x] = Math.round(componentCoverageAt(mask, point, pixel, imageAspect) * 255);
    }
  }
  return pixels;
}

function rasterizeBrush(mask: BrushMask, size: number, imageAspect: number): Uint8Array {
  const coverage = new Float32Array(size * size);
  for (const stroke of mask.strokes) {
    const strokeCoverage = new Float32Array(size * size);
    const radius = Math.max(stroke.size / 2, 0.001);
    for (let index = 0; index < stroke.points.length; index += 1) {
      const start = stroke.points[Math.max(0, index - 1)];
      const end = stroke.points[index];
      const minX = Math.max(0, Math.floor((Math.min(start.x, end.x) - radius / imageAspect) * size));
      const maxX = Math.min(size - 1, Math.ceil((Math.max(start.x, end.x) + radius / imageAspect) * size));
      const minY = Math.max(0, Math.floor((Math.min(start.y, end.y) - radius) * size));
      const maxY = Math.min(size - 1, Math.ceil((Math.max(start.y, end.y) + radius) * size));
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const point = { x: (x + 0.5) / size, y: (y + 0.5) / size };
          const shape = 1 - smoothstep(1 - stroke.feather, 1, segmentDistance(point, start, end, imageAspect) / radius);
          const offset = y * size + x;
          strokeCoverage[offset] = Math.max(strokeCoverage[offset], shape);
        }
      }
    }
    for (let offset = 0; offset < coverage.length; offset += 1) {
      coverage[offset] = 1 - (1 - coverage[offset]) * (1 - strokeCoverage[offset] * stroke.flow);
    }
  }

  const pixels = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = mask.inverted ? 1 - coverage[y * size + x] : coverage[y * size + x];
      pixels[(size - 1 - y) * size + x] = Math.round(value * 255);
    }
  }
  return pixels;
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

function smoothstep(start: number, end: number, value: number): number {
  if (start === end) return value < start ? 0 : 1;
  const t = clamp((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
