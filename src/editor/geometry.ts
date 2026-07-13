export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CropAspect = "free" | "1:1" | "4:3" | "16:9" | "3:2";
export type QuarterRotation = 0 | 90 | 180 | 270;
export interface GeometrySettings {
  crop: CropRect;
  rotation: QuarterRotation;
  straighten: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  aspect: CropAspect;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export const CROP_ASPECTS: Record<Exclude<CropAspect, "free">, number> = {
  "1:1": 1,
  "4:3": 4 / 3,
  "16:9": 16 / 9,
  "3:2": 3 / 2,
};

export function createDefaultGeometry(): GeometrySettings {
  return {
    crop: { x: 0, y: 0, width: 1, height: 1 },
    rotation: 0,
    straighten: 0,
    flipHorizontal: false,
    flipVertical: false,
    aspect: "free",
  };
}

export function normalizeCrop(crop: CropRect): CropRect {
  const x = clamp(crop.x, 0, 0.99);
  const y = clamp(crop.y, 0, 0.99);
  return {
    x: rounded(x),
    y: rounded(y),
    width: rounded(clamp(crop.width, 0.01, 1 - x)),
    height: rounded(clamp(crop.height, 0.01, 1 - y)),
  };
}

export function applyCropAspect(
  crop: CropRect,
  imageAspect: number,
  targetAspect: number,
): CropRect {
  const targetNormalizedRatio = targetAspect / imageAspect;
  const centreX = crop.x + crop.width / 2;
  const centreY = crop.y + crop.height / 2;
  let width = crop.width;
  let height = crop.height;
  if (width / height > targetNormalizedRatio) {
    width = height * targetNormalizedRatio;
  } else {
    height = width / targetNormalizedRatio;
  }
  const scale = Math.min(1, 1 / width, 1 / height);
  width *= scale;
  height *= scale;
  return normalizeCrop({
    x: clamp(centreX - width / 2, 0, 1 - width),
    y: clamp(centreY - height / 2, 0, 1 - height),
    width,
    height,
  });
}

export function rotateGeometry(
  geometry: GeometrySettings,
  direction: "clockwise" | "counterclockwise",
): GeometrySettings {
  const delta = direction === "clockwise" ? 90 : 270;
  return { ...geometry, rotation: ((geometry.rotation + delta) % 360) as QuarterRotation };
}

export function updateStraighten(geometry: GeometrySettings, value: number): GeometrySettings {
  return { ...geometry, straighten: clamp(value, -45, 45) };
}

export function cropToDisplay(crop: CropRect, geometry: GeometrySettings): CropRect {
  let display = rotateCrop(crop, geometry.rotation);
  if (geometry.flipHorizontal) display = { ...display, x: rounded(1 - display.x - display.width) };
  if (geometry.flipVertical) display = { ...display, y: rounded(1 - display.y - display.height) };
  return normalizeCrop(display);
}

export function cropFromDisplay(crop: CropRect, geometry: GeometrySettings): CropRect {
  let source = crop;
  if (geometry.flipVertical) source = { ...source, y: rounded(1 - source.y - source.height) };
  if (geometry.flipHorizontal) source = { ...source, x: rounded(1 - source.x - source.width) };
  const inverse = ((360 - geometry.rotation) % 360) as QuarterRotation;
  return normalizeCrop(rotateCrop(source, inverse));
}

/** Maps a top-left-origin output point through the same inverse transform used by the GPU. */
export function mapOutputToSource(
  output: NormalizedPoint,
  geometry: GeometrySettings,
  imageWidth: number,
  imageHeight: number,
): NormalizedPoint {
  const crop = geometry.crop;
  let x = output.x - 0.5;
  let y = 0.5 - output.y;
  if (geometry.flipHorizontal) x = -x;
  if (geometry.flipVertical) y = -y;

  const quarterAngle = -geometry.rotation * Math.PI / 180;
  [x, y] = rotatePoint(x, y, quarterAngle);

  const cropAspect = imageWidth * crop.width / (imageHeight * crop.height);
  const straightenAngle = -geometry.straighten * Math.PI / 180;
  const sine = Math.sin(straightenAngle);
  const cosine = Math.cos(straightenAngle);
  let physicalX = x * cropAspect;
  let physicalY = y;
  [physicalX, physicalY] = rotatePoint(physicalX, physicalY, straightenAngle);
  x = physicalX / cropAspect;
  y = physicalY;
  const safeZoom = Math.max(
    Math.abs(cosine) + Math.abs(sine) / cropAspect,
    Math.abs(sine) * cropAspect + Math.abs(cosine),
  );
  x /= safeZoom;
  y /= safeZoom;
  return {
    x: crop.x + (x + 0.5) * crop.width,
    y: crop.y + (0.5 - y) * crop.height,
  };
}

export function mapSourceToOutput(
  source: NormalizedPoint,
  geometry: GeometrySettings,
  imageWidth: number,
  imageHeight: number,
): NormalizedPoint {
  const crop = geometry.crop;
  let x = (source.x - crop.x) / crop.width - 0.5;
  let y = 0.5 - (source.y - crop.y) / crop.height;
  const cropAspect = imageWidth * crop.width / (imageHeight * crop.height);
  const angle = -geometry.straighten * Math.PI / 180;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const safeZoom = Math.max(
    Math.abs(cosine) + Math.abs(sine) / cropAspect,
    Math.abs(sine) * cropAspect + Math.abs(cosine),
  );
  x *= safeZoom;
  y *= safeZoom;
  let physicalX = x * cropAspect;
  let physicalY = y;
  [physicalX, physicalY] = rotatePoint(physicalX, physicalY, -angle);
  x = physicalX / cropAspect;
  y = physicalY;
  [x, y] = rotatePoint(x, y, geometry.rotation * Math.PI / 180);
  if (geometry.flipVertical) y = -y;
  if (geometry.flipHorizontal) x = -x;
  return { x: x + 0.5, y: 0.5 - y };
}

function rotateCrop(crop: CropRect, rotation: QuarterRotation): CropRect {
  if (rotation === 90) return {
    x: rounded(1 - crop.y - crop.height), y: crop.x, width: crop.height, height: crop.width,
  };
  if (rotation === 180) return {
    x: rounded(1 - crop.x - crop.width), y: rounded(1 - crop.y - crop.height),
    width: crop.width, height: crop.height,
  };
  if (rotation === 270) return {
    x: crop.y, y: rounded(1 - crop.x - crop.width), width: crop.height, height: crop.width,
  };
  return { ...crop };
}

function rotatePoint(x: number, y: number, angle: number): [number, number] {
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  return [cosine * x + sine * y, -sine * x + cosine * y];
}

function rounded(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
