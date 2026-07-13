import { createDefaultDevelopRecipe, type DevelopRecipe } from "../editor/develop-recipe";
import type { GeometrySettings } from "../editor/geometry";
import { parsePresetJson } from "../editor/presets";

export type PhotoRating = 0 | 1 | 2 | 3 | 4 | 5;
export type LibrarySort = "importedAt" | "fileName" | "rating";

export interface LibraryPhotoMetadata {
  path: string;
  fileName: string;
  sourceWidth: number;
  sourceHeight: number;
  format: string;
  camera: string | null;
}

export interface LibraryPhoto extends LibraryPhotoMetadata {
  id: string;
  importedAt: string;
  rating: PhotoRating;
  recipe: DevelopRecipe;
  thumbnail: string | null;
}

export interface FileRelocation {
  source: string;
  destination: string;
}

export function createLibraryPhoto(
  metadata: LibraryPhotoMetadata,
  id: string = crypto.randomUUID(),
  importedAt = new Date().toISOString(),
  rating: PhotoRating = 0,
): LibraryPhoto {
  return { ...metadata, id, importedAt, rating, recipe: createDefaultDevelopRecipe(), thumbnail: null };
}

export function sortPhotos(photos: LibraryPhoto[], sort: LibrarySort): LibraryPhoto[] {
  return [...photos].sort((left, right) => {
    if (sort === "importedAt") return right.importedAt.localeCompare(left.importedAt);
    if (sort === "rating") return right.rating - left.rating || left.fileName.localeCompare(right.fileName, undefined, { numeric: true });
    return left.fileName.localeCompare(right.fileName, undefined, { numeric: true });
  });
}

export function ratePhoto(photos: LibraryPhoto[], id: string, rating: PhotoRating): LibraryPhoto[] {
  if (!Number.isInteger(rating) || rating < 0 || rating > 5) throw new RangeError("评分必须是 0 到 5 星");
  return photos.map((photo) => photo.id === id ? { ...photo, rating } : photo);
}

export function mergeImportedPhotos(current: LibraryPhoto[], imported: LibraryPhoto[]): LibraryPhoto[] {
  const knownPaths = new Set(current.map((photo) => photo.path));
  return [...current, ...imported.filter((photo) => {
    if (knownPaths.has(photo.path)) return false;
    knownPaths.add(photo.path);
    return true;
  })];
}

export function removePhotos(photos: LibraryPhoto[], ids: ReadonlySet<string>): LibraryPhoto[] {
  return photos.filter((photo) => !ids.has(photo.id));
}

export function applyFileRelocations(photos: LibraryPhoto[], relocations: FileRelocation[]): LibraryPhoto[] {
  const destinations = new Map(relocations.map((item) => [item.source, item.destination]));
  return photos.map((photo) => {
    const destination = destinations.get(photo.path);
    return destination ? { ...photo, path: destination, fileName: fileName(destination) } : photo;
  });
}

export function duplicateRelocatedPhotos(
  photos: LibraryPhoto[],
  relocations: FileRelocation[],
  createId: () => string = () => crypto.randomUUID(),
  now: () => string = () => new Date().toISOString(),
): LibraryPhoto[] {
  const sources = new Map(photos.map((photo) => [photo.path, photo]));
  return relocations.flatMap(({ source, destination }) => {
    const photo = sources.get(source);
    return photo ? [{ ...photo, id: createId(), path: destination, fileName: fileName(destination), importedAt: now(), recipe: structuredClone(photo.recipe) }] : [];
  });
}

export function mergeActiveRecipe(
  photos: LibraryPhoto[],
  activePhotoId: string | null,
  recipe: DevelopRecipe,
): LibraryPhoto[] {
  return activePhotoId
    ? photos.map((photo) => photo.id === activePhotoId ? { ...photo, recipe } : photo)
    : photos;
}

export function stringifyCatalog(photos: LibraryPhoto[]): string {
  const metadata = photos.map((photo) => ({ ...photo, thumbnail: null }));
  return `${JSON.stringify({ version: 1, photos: metadata }, null, 2)}\n`;
}

export function parseCatalogCopies(primary: string | null, backup: string | null): {
  photos: LibraryPhoto[];
  recovered: boolean;
} {
  if (primary === null) {
    return backup === null ? { photos: [], recovered: false } : { photos: parseCatalogJson(backup), recovered: true };
  }
  try {
    return { photos: parseCatalogJson(primary), recovered: false };
  } catch (primaryError) {
    if (backup !== null) {
      try { return { photos: parseCatalogJson(backup), recovered: true }; } catch { /* report the primary error */ }
    }
    throw primaryError;
  }
}

export function applyCatalogThumbnails(
  photos: LibraryPhoto[],
  thumbnails: Record<string, string>,
): LibraryPhoto[] {
  return photos.map((photo) => {
    const thumbnail = thumbnails[photo.id];
    return typeof thumbnail === "string" && thumbnail.startsWith("data:image/")
      ? { ...photo, thumbnail }
      : photo;
  });
}

export function parseCatalogJson(json: string): LibraryPhoto[] {
  let document: unknown;
  try { document = JSON.parse(json); } catch { throw new Error("图库文件无法解析"); }
  if (!isRecord(document) || document.version !== 1 || !Array.isArray(document.photos)) throw new Error("不是有效的 LightRAW 图库");
  const photos = document.photos.map(parsePhoto);
  if (new Set(photos.map((photo) => photo.id)).size !== photos.length
    || new Set(photos.map((photo) => photo.path)).size !== photos.length) throw new Error("图库包含重复照片");
  return photos;
}

function parsePhoto(value: unknown): LibraryPhoto {
  if (!isRecord(value)
    || !text(value.id) || !text(value.path) || !text(value.fileName) || !text(value.format)
    || !positiveInteger(value.sourceWidth) || !positiveInteger(value.sourceHeight)
    || !(value.camera === null || typeof value.camera === "string")
    || typeof value.importedAt !== "string" || !Number.isFinite(Date.parse(value.importedAt))
    || !Number.isSafeInteger(value.rating) || (value.rating as number) < 0 || (value.rating as number) > 5
    || !(value.thumbnail === null || (typeof value.thumbnail === "string" && value.thumbnail.startsWith("data:image/")))
    || !isRecord(value.recipe) || value.recipe.version !== 4 || !validGeometry(value.recipe.geometry)) {
    throw new Error("图库包含无效照片条目");
  }
  const settings = parsePresetJson(JSON.stringify({
    kind: "lightraw-preset", version: 1, id: value.id, name: "Catalog", createdAt: value.importedAt,
    settings: {
      basic: value.recipe.basic, hsl: value.recipe.hsl, curves: value.recipe.curves,
      detail: value.recipe.detail, layers: value.recipe.layers,
    },
  })).settings;
  return {
    id: value.id, path: value.path, fileName: value.fileName,
    sourceWidth: value.sourceWidth, sourceHeight: value.sourceHeight,
    format: value.format, camera: value.camera, importedAt: value.importedAt,
    rating: value.rating as PhotoRating, thumbnail: value.thumbnail,
    recipe: { version: 4, ...settings, geometry: value.recipe.geometry as unknown as GeometrySettings },
  };
}

function validGeometry(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.crop)) return false;
  const crop = value.crop;
  return [crop.x, crop.y, crop.width, crop.height].every((number) => typeof number === "number" && Number.isFinite(number))
    && (crop.x as number) >= 0 && (crop.y as number) >= 0 && (crop.width as number) > 0 && (crop.height as number) > 0
    && (crop.x as number) + (crop.width as number) <= 1.000001 && (crop.y as number) + (crop.height as number) <= 1.000001
    && [0, 90, 180, 270].includes(value.rotation as number)
    && typeof value.straighten === "number" && Number.isFinite(value.straighten) && value.straighten >= -45 && value.straighten <= 45
    && typeof value.flipHorizontal === "boolean" && typeof value.flipVertical === "boolean"
    && ["free", "1:1", "4:3", "16:9", "3:2"].includes(String(value.aspect));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 32_768;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function fileName(path: string): string {
  return path.split(/[/\\]/).at(-1) ?? path;
}
