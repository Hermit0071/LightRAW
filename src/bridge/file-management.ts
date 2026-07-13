import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface FileOperationOutcome {
  source: string;
  destination: string | null;
  error: string | null;
}

export interface RenameRequest {
  path: string;
  newName: string;
}

export async function chooseTargetDirectory(): Promise<string | null> {
  const selected = await open({ multiple: false, directory: true });
  return typeof selected === "string" ? selected : null;
}

export async function renamePhotoFiles(requests: RenameRequest[]): Promise<FileOperationOutcome[]> {
  return invoke<FileOperationOutcome[]>("rename_photos", { requests });
}

export async function copyPhotoFiles(paths: string[], directory: string): Promise<FileOperationOutcome[]> {
  return invoke<FileOperationOutcome[]>("copy_photo_files", { paths, directory });
}

export async function movePhotoFiles(paths: string[], directory: string): Promise<FileOperationOutcome[]> {
  return invoke<FileOperationOutcome[]>("move_photo_files", { paths, directory });
}

export async function trashPhotoFiles(paths: string[]): Promise<FileOperationOutcome[]> {
  return invoke<FileOperationOutcome[]>("trash_photo_files", { paths });
}

export async function revealPhoto(path: string): Promise<void> {
  await invoke("reveal_photo", { path });
}
