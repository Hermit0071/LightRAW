import type { LibraryPhoto } from "../library/catalog";
import type { RenameRequest } from "../bridge/file-management";

export function buildRenameRequests(photos: LibraryPhoto[], value: string): RenameRequest[] {
  const name = value.trim();
  if (!validFileName(name)) throw new Error("请输入兼容 macOS 和 Windows 的有效文件名");
  const requests = photos.length === 1 ? [{ path: photos[0].path, newName: name }] : photos.map((photo, index) => ({
    path: photo.path,
    newName: `${name}-${String(index + 1).padStart(3, "0")}${extension(photo.fileName)}`,
  }));
  if (requests.some((request) => !validFileName(request.newName))) throw new Error("请输入兼容 macOS 和 Windows 的有效文件名");
  return requests;
}

function extension(name: string): string {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index) : "";
}

function validFileName(name: string): boolean {
  const base = name.split(".", 1)[0].toUpperCase();
  return !!name && name !== "." && name !== ".." && !/[<>:"/\\|?*\0]/.test(name)
    && !name.endsWith(".") && !name.endsWith(" ") && !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(base)
    && ![...name].some((character) => character.charCodeAt(0) < 32);
}
