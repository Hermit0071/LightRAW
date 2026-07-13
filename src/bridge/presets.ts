import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

export async function choosePresetJson(): Promise<string | null> {
  const path = await open({ multiple: false, directory: false, filters: [{ name: "LightRAW 预设", extensions: ["json"] }] });
  if (!path || Array.isArray(path)) return null;
  return invoke<string>("read_text_file", { path });
}

export async function savePresetJson(fileName: string, contents: string): Promise<boolean> {
  const path = await save({ defaultPath: `${safeFileName(fileName)}.json`, filters: [{ name: "LightRAW 预设", extensions: ["json"] }] });
  if (!path) return false;
  await invoke("write_text_file", { path, contents });
  return true;
}

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").trim() || "LightRAW-Preset";
}
