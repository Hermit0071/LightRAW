import type { DevelopRecipe } from "../editor/develop-recipe";
import { mapOutputToSource } from "../editor/geometry";
import { developLinearPixel } from "./color-engine";
import { adjustDetailPixel } from "./detail-engine";
import { applyLayersToPixel } from "./mask-engine";
import { MASK_TEXTURE_SIZE, rasterizeLayerMask } from "./mask-rasterizer";

export interface HistogramData {
  red: number[];
  green: number[];
  blue: number[];
  luminance: number[];
  samples: number;
}

const BIN_COUNT = 256;
const MAX_SAMPLES = 24_000;

export function calculateHistogram(
  pixels: Uint16Array,
  width: number,
  height: number,
  recipe: DevelopRecipe,
): HistogramData {
  const histogram: HistogramData = {
    red: emptyBins(), green: emptyBins(), blue: emptyBins(), luminance: emptyBins(), samples: 0,
  };
  const crop = recipe.geometry.crop;
  const quarterTurn = recipe.geometry.rotation === 90 || recipe.geometry.rotation === 270;
  const sourceCropWidth = Math.max(1, Math.round(crop.width * width));
  const sourceCropHeight = Math.max(1, Math.round(crop.height * height));
  const outputWidth = quarterTurn ? sourceCropHeight : sourceCropWidth;
  const outputHeight = quarterTurn ? sourceCropWidth : sourceCropHeight;
  const outputPixels = outputWidth * outputHeight;
  const step = Math.max(1, Math.ceil(outputPixels / MAX_SAMPLES));
  const imageAspect = width / height;
  const layerMasks = recipe.layers.map((layer) => layer.visible
    ? rasterizeLayerMask(layer, MASK_TEXTURE_SIZE, imageAspect, (point) => readPixel(
      pixels,
      width,
      height,
      Math.floor(point.x * width),
      Math.floor(point.y * height),
    ))
    : null);

  for (let index = 0; index < outputPixels; index += step) {
    const outputX = index % outputWidth;
    const outputY = Math.floor(index / outputWidth);
    const source = mapOutputToSource(
      { x: (outputX + 0.5) / outputWidth, y: (outputY + 0.5) / outputHeight },
      recipe.geometry,
      width,
      height,
    );
    const x = Math.floor(source.x * width);
    const y = Math.floor(source.y * height);
    const centre = readPixel(pixels, width, height, x, y);
    const fine = crossAverage(pixels, width, height, x, y, 1);
    const coarse = crossAverage(pixels, width, height, x, y, 4);
    const detailed = adjustDetailPixel(
      centre,
      fine,
      coarse,
      recipe.detail,
      recipe.basic.texture,
      recipe.basic.clarity,
    );
    const global = developLinearPixel(detailed, recipe);
    const fineLuma = luminance(fine);
    const coarseLuma = luminance(coarse);
    const centreLuma = luminance(centre);
    const edited = applyLayersToPixel(global, recipe.layers, {
      point: source,
      sourceColor: centre,
      fineDetail: centreLuma - fineLuma,
      coarseDetail: centreLuma - coarseLuma,
      imageAspect,
      layerCoverages: recipe.layers.map((layer, layerIndex) => {
        const mask = layerMasks[layerIndex];
        if (!layer.visible || !mask) return 0;
        return sampleMask(mask, source) * Math.min(1, Math.max(0, layer.opacity));
      }),
    });
    const red = linearToSrgb(edited[0]);
    const green = linearToSrgb(edited[1]);
    const blue = linearToSrgb(edited[2]);
    histogram.red[toBin(red)] += 1;
    histogram.green[toBin(green)] += 1;
    histogram.blue[toBin(blue)] += 1;
    histogram.luminance[toBin(red * 0.2126 + green * 0.7152 + blue * 0.0722)] += 1;
    histogram.samples += 1;
  }
  return histogram;
}

function crossAverage(
  pixels: Uint16Array,
  width: number,
  height: number,
  x: number,
  y: number,
  distance: number,
): readonly [number, number, number] {
  const left = readPixel(pixels, width, height, x - distance, y);
  const right = readPixel(pixels, width, height, x + distance, y);
  const top = readPixel(pixels, width, height, x, y - distance);
  const bottom = readPixel(pixels, width, height, x, y + distance);
  return [
    (left[0] + right[0] + top[0] + bottom[0]) / 4,
    (left[1] + right[1] + top[1] + bottom[1]) / 4,
    (left[2] + right[2] + top[2] + bottom[2]) / 4,
  ];
}

function readPixel(
  pixels: Uint16Array,
  width: number,
  height: number,
  x: number,
  y: number,
): readonly [number, number, number] {
  const safeX = Math.min(width - 1, Math.max(0, x));
  const safeY = Math.min(height - 1, Math.max(0, y));
  const offset = (safeY * width + safeX) * 4;
  return [halfToFloat(pixels[offset]), halfToFloat(pixels[offset + 1]), halfToFloat(pixels[offset + 2])];
}

export function halfToFloat(value: number): number {
  const sign = (value & 0x8000) ? -1 : 1;
  const exponent = (value >> 10) & 0x1f;
  const fraction = value & 0x03ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 31) return fraction === 0 ? sign * Infinity : Number.NaN;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

function emptyBins(): number[] {
  return Array.from({ length: BIN_COUNT }, () => 0);
}

function linearToSrgb(value: number): number {
  const safe = Math.max(0, value);
  return safe <= 0.0031308 ? safe * 12.92 : 1.055 * safe ** (1 / 2.4) - 0.055;
}

function luminance(color: readonly [number, number, number]): number {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}

function sampleMask(mask: Uint8Array, point: { x: number; y: number }): number {
  const x = Math.min(MASK_TEXTURE_SIZE - 1, Math.max(0, Math.floor(point.x * MASK_TEXTURE_SIZE)));
  const y = Math.min(MASK_TEXTURE_SIZE - 1, Math.max(0, Math.floor(point.y * MASK_TEXTURE_SIZE)));
  return mask[(MASK_TEXTURE_SIZE - 1 - y) * MASK_TEXTURE_SIZE + x] / 255;
}

function toBin(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value * 255)));
}
