import type { LibraryPhoto } from "../library/catalog";

export type LibraryCollection = "all" | "rated" | "selected";
export type WorkspaceTheme = "dark" | "grey" | "light";

export function filterLibraryPhotos(
  photos: LibraryPhoto[],
  collection: LibraryCollection,
  selectedIds: ReadonlySet<string>,
): LibraryPhoto[] {
  if (collection === "rated") return photos.filter((photo) => photo.rating > 0);
  if (collection === "selected") return photos.filter((photo) => selectedIds.has(photo.id));
  return photos;
}

export function clampInspectorWidth(width: number): number {
  return Math.min(520, Math.max(280, width));
}

export function normalizeWorkspaceTheme(value: string | null): WorkspaceTheme {
  return value === "grey" || value === "light" ? value : "dark";
}
