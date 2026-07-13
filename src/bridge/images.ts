import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface PreviewInfo {
  id: number;
  fileName: string;
  width: number;
  height: number;
  format: string;
  camera: string | null;
}

export interface OpenedPreview {
  info: PreviewInfo;
  pixels: Uint8Array;
}

const SUPPORTED_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "tif",
  "tiff",
  "heif",
  "heic",
  "cr2",
  "cr3",
  "nef",
  "nrw",
  "arw",
  "raf",
  "rw2",
  "orf",
  "dng",
];

export async function chooseAndOpenImage(): Promise<OpenedPreview | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "照片与 RAW", extensions: SUPPORTED_EXTENSIONS }],
  });
  if (!selected || Array.isArray(selected)) {
    return null;
  }

  const info = await invoke<PreviewInfo>("open_image", {
    path: selected,
    maxDimension: previewLongEdge(),
  });
  const payload = await invoke<ArrayBuffer | Uint8Array | number[]>("preview_pixels", {
    id: info.id,
  });
  return { info, pixels: asBytes(payload) };
}

function previewLongEdge(): number {
  const displayNeed = Math.ceil(
    Math.max(window.innerWidth, window.innerHeight) * Math.min(window.devicePixelRatio || 1, 2),
  );
  return Math.min(4096, Math.max(2048, displayNeed));
}

function asBytes(payload: ArrayBuffer | Uint8Array | number[]): Uint8Array {
  if (payload instanceof Uint8Array) {
    return payload;
  }
  if (payload instanceof ArrayBuffer) {
    return new Uint8Array(payload);
  }
  return Uint8Array.from(payload);
}
