import { invoke } from "@tauri-apps/api/core";

let catalogSaveQueue: Promise<void> = Promise.resolve();

export async function loadCatalogFile(): Promise<string | null> {
  return invoke<string | null>("load_catalog");
}

export async function loadCatalogBackupFile(): Promise<string | null> {
  return invoke<string | null>("load_catalog_backup");
}

export async function loadCatalogThumbnails(ids: string[]): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("load_thumbnails", { ids });
}

export async function saveCatalogThumbnail(id: string, contents: string): Promise<void> {
  await invoke("save_thumbnail", { id, contents });
}

export function saveCatalogFile(contents: string): Promise<void> {
  return enqueueCatalogSave(async () => {
    await invoke("save_catalog", { contents });
  });
}

export function enqueueCatalogSave(task: () => Promise<void>): Promise<void> {
  const pending = catalogSaveQueue.catch(() => undefined).then(task);
  catalogSaveQueue = pending;
  return pending;
}
