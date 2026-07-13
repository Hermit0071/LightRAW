import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { exportFileName, type ExportFormat } from "../export/export-options";

export async function chooseExportPath(sourceName: string, format: ExportFormat): Promise<string | null> {
  const extensions = format === "jpeg" ? ["jpg", "jpeg"] : format === "tiff" ? ["tif", "tiff"] : ["png"];
  return save({ defaultPath: exportFileName(sourceName, format), filters: [{ name: format.toUpperCase(), extensions }] });
}

export async function chooseExportDirectory(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false });
  return typeof selected === "string" ? selected : null;
}

export async function writeExport(options: {
  path?: string;
  directory?: string;
  fileName?: string;
  width: number;
  height: number;
  format: ExportFormat;
  quality: number;
  rgba: Uint8Array;
}): Promise<void> {
  const id = await invoke<number>("prepare_export", {
    request: {
      path: options.path,
      directory: options.directory,
      fileName: options.fileName,
      width: options.width,
      height: options.height,
      format: options.format,
      quality: Math.round(options.quality),
    },
  });
  await invoke("write_export", options.rgba, { headers: { "x-lightraw-export-id": String(id) } });
}
