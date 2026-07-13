import { halfToFloat } from "../renderer/histogram";

export interface ThumbnailRgba { width: number; height: number; rgba: Uint8ClampedArray }

export function buildThumbnailRgba(source: Uint16Array, width: number, height: number, maxEdge = 320): ThumbnailRgba {
  if (source.length !== width * height * 4) throw new RangeError("缩略图源缓冲区尺寸不正确");
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const rgba = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor((y + 0.5) * height / targetHeight));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor((x + 0.5) * width / targetWidth));
      const input = (sourceY * width + sourceX) * 4;
      const output = (y * targetWidth + x) * 4;
      rgba[output] = linearByte(source[input]);
      rgba[output + 1] = linearByte(source[input + 1]);
      rgba[output + 2] = linearByte(source[input + 2]);
      rgba[output + 3] = 255;
    }
  }
  return { width: targetWidth, height: targetHeight, rgba };
}

export function thumbnailDataUrl(source: Uint16Array, width: number, height: number): string {
  const thumbnail = buildThumbnailRgba(source, width, height);
  const canvas = document.createElement("canvas");
  canvas.width = thumbnail.width;
  canvas.height = thumbnail.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建缩略图画布");
  const image = context.createImageData(thumbnail.width, thumbnail.height);
  image.data.set(thumbnail.rgba);
  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.78);
}

function linearByte(value: number): number {
  const linear = Math.min(1, Math.max(0, halfToFloat(value)));
  const srgb = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.round(srgb * 255);
}
