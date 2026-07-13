import type { GeometrySettings } from "../editor/geometry";

export type ExportFormat = "jpeg" | "png" | "tiff";
export type ExportSizeMode = "longEdge" | "shortEdge" | "percent";
export interface ExportSize { mode: ExportSizeMode; value: number }
export interface ExportDimensions { width: number; height: number }
export const MAX_EXPORT_PIXELS = 40_000_000;

export function calculateExportDimensions(
  sourceWidth: number,
  sourceHeight: number,
  geometry: GeometrySettings,
  size: ExportSize,
): ExportDimensions {
  if (![sourceWidth, sourceHeight, size.value].every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError("导出尺寸必须大于 0");
  }
  let width = sourceWidth * geometry.crop.width;
  let height = sourceHeight * geometry.crop.height;
  if (geometry.rotation === 90 || geometry.rotation === 270) [width, height] = [height, width];
  const scale = size.mode === "percent" ? size.value / 100
    : size.value / (size.mode === "longEdge" ? Math.max(width, height) : Math.min(width, height));
  const output = { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
  if (output.width > MAX_EXPORT_PIXELS / output.height) {
    throw new RangeError(`导出总像素不能超过 ${MAX_EXPORT_PIXELS}`);
  }
  return output;
}

export function exportFileName(sourceName: string, format: ExportFormat): string {
  const dot = sourceName.lastIndexOf(".");
  const stem = dot > 0 ? sourceName.slice(0, dot) : sourceName;
  const extension = format === "jpeg" ? "jpg" : format === "tiff" ? "tif" : "png";
  return `${stem}-LightRAW.${extension}`;
}

export function batchExportFileNames(sourceNames: string[], format: ExportFormat): string[] {
  const counts = new Map<string, number>();
  return sourceNames.map((sourceName) => {
    const base = exportFileName(sourceName, format);
    const key = base.toLocaleLowerCase();
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    if (count === 1) return base;
    const dot = base.lastIndexOf(".");
    return `${base.slice(0, dot)}-${count}${base.slice(dot)}`;
  });
}

export function calculateDecodeLongEdge(
  sourceWidth: number,
  sourceHeight: number,
  geometry: GeometrySettings,
  output: ExportDimensions,
): number {
  const quarterTurn = geometry.rotation === 90 || geometry.rotation === 270;
  const cropOutputWidth = quarterTurn ? output.height : output.width;
  const cropOutputHeight = quarterTurn ? output.width : output.height;
  const required = Math.ceil(Math.max(cropOutputWidth / geometry.crop.width, cropOutputHeight / geometry.crop.height));
  return Math.min(Math.max(sourceWidth, sourceHeight), Math.max(128, required));
}
