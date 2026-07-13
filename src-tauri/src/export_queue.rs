use crate::exporting;
use crate::path_utils::suffixed_path;
use serde::Deserialize;
use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const MAX_EXPORT_PIXELS: u64 = 40_000_000;
const MAX_PENDING_EXPORTS: usize = 16;

#[derive(Default)]
pub(crate) struct ExportState(Mutex<ExportQueue>);

#[derive(Default)]
struct ExportQueue {
    next_id: u64,
    pending: HashMap<u64, PendingExport>,
}

struct PendingExport {
    path: PathBuf,
    avoid_overwrite: bool,
    width: u32,
    height: u32,
    format: String,
    quality: u8,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PrepareExportRequest {
    path: Option<String>,
    directory: Option<String>,
    file_name: Option<String>,
    width: u32,
    height: u32,
    format: String,
    quality: u8,
}

#[tauri::command]
pub(crate) fn prepare_export(
    request: PrepareExportRequest,
    state: tauri::State<'_, ExportState>,
) -> Result<u64, String> {
    if request.width == 0
        || request.height == 0
        || request.width > 16_384
        || request.height > 16_384
        || u64::from(request.width) * u64::from(request.height) > MAX_EXPORT_PIXELS
    {
        return Err(format!(
            "export dimensions exceed the 16384 edge or {MAX_EXPORT_PIXELS} pixel limit"
        ));
    }
    if !matches!(request.format.as_str(), "jpeg" | "png" | "tiff") {
        return Err("unsupported export format".to_string());
    }
    let (target, avoid_overwrite) = match (request.path, request.directory, request.file_name) {
        (Some(path), None, None) => (PathBuf::from(path), false),
        (None, Some(directory), Some(file_name))
            if Path::new(&file_name)
                .file_name()
                .and_then(|name| name.to_str())
                == Some(file_name.as_str()) =>
        {
            (PathBuf::from(directory).join(file_name), true)
        }
        _ => return Err("invalid export target".to_string()),
    };
    let mut queue = state.0.lock().map_err(|_| "export queue is unavailable")?;
    if queue.pending.len() >= MAX_PENDING_EXPORTS {
        return Err("too many pending exports".to_string());
    }
    queue.next_id += 1;
    let id = queue.next_id;
    queue.pending.insert(
        id,
        PendingExport {
            path: target,
            avoid_overwrite,
            width: request.width,
            height: request.height,
            format: request.format,
            quality: request.quality,
        },
    );
    Ok(id)
}

#[tauri::command]
pub(crate) async fn write_export(
    request: tauri::ipc::Request<'_>,
    state: tauri::State<'_, ExportState>,
) -> Result<(), String> {
    let id = request
        .headers()
        .get("x-lightraw-export-id")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
        .ok_or_else(|| "missing export id".to_string())?;
    let tauri::ipc::InvokeBody::Raw(rgba) = request.body() else {
        return Err("export body must be raw RGBA bytes".to_string());
    };
    let pending = state
        .0
        .lock()
        .map_err(|_| "export queue is unavailable")?
        .pending
        .remove(&id)
        .ok_or_else(|| "export request expired".to_string())?;
    let expected = pending.width as usize * pending.height as usize * 4;
    if rgba.len() != expected {
        return Err("export RGBA buffer dimensions do not match".to_string());
    }
    let rgba = rgba.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let encoded = exporting::encode_image(
            pending.width,
            pending.height,
            &rgba,
            &pending.format,
            pending.quality,
        )?;
        write_export_file(&pending.path, &encoded, pending.avoid_overwrite)
    })
    .await
    .map_err(|error| format!("export task failed: {error}"))?
}

fn write_export_file(path: &Path, encoded: &[u8], avoid_overwrite: bool) -> Result<(), String> {
    if !avoid_overwrite {
        return std::fs::write(path, encoded)
            .map_err(|error| format!("could not write export: {error}"));
    }
    for suffix in 1..=10_000 {
        let candidate = if suffix == 1 {
            path.to_path_buf()
        } else {
            suffixed_path(path, suffix)
        };
        match std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&candidate)
        {
            Ok(mut file) => {
                if let Err(error) = file.write_all(encoded) {
                    let _ = std::fs::remove_file(&candidate);
                    return Err(format!("could not write export: {error}"));
                }
                return Ok(());
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(format!("could not create export: {error}")),
        }
    }
    Err("could not find an available export file name".to_string())
}

#[cfg(test)]
mod tests {
    use super::write_export_file;

    #[test]
    fn directory_exports_never_overwrite_an_existing_file() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("photo-LightRAW.jpg");
        std::fs::write(&path, b"old").unwrap();
        write_export_file(&path, b"new", true).unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"old");
        assert_eq!(
            std::fs::read(directory.path().join("photo-LightRAW-2.jpg")).unwrap(),
            b"new"
        );
    }
}
