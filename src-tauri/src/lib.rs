mod decode;
mod exporting;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::path::Path;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::ipc::Response;
use tauri::Manager;

const MAX_EXPORT_PIXELS: u64 = 40_000_000;
const MAX_PENDING_EXPORTS: usize = 16;

#[derive(Default)]
struct PreviewState(Mutex<PreviewCache>);

#[derive(Default)]
struct ExportState(Mutex<ExportQueue>);

#[derive(Default)]
struct CatalogState(Arc<tokio::sync::Mutex<()>>);

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
struct PrepareExportRequest {
    path: Option<String>,
    directory: Option<String>,
    file_name: Option<String>,
    width: u32,
    height: u32,
    format: String,
    quality: u8,
}

#[derive(Default)]
struct PreviewCache {
    latest_request: u64,
    image: Option<CachedPreview>,
}

struct CachedPreview {
    id: u64,
    pixels: Vec<u8>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PreviewInfo {
    id: u64,
    path: String,
    file_name: String,
    width: u32,
    height: u32,
    source_width: u32,
    source_height: u32,
    format: String,
    camera: Option<String>,
}

#[tauri::command]
async fn open_image(
    path: String,
    max_dimension: Option<u32>,
    state: tauri::State<'_, PreviewState>,
) -> Result<PreviewInfo, String> {
    let request_id = {
        let mut cache = state.0.lock().map_err(|_| "preview cache is unavailable")?;
        cache.latest_request += 1;
        cache.latest_request
    };
    let source_path = PathBuf::from(&path);
    let decode_path = source_path.clone();
    let preview = tauri::async_runtime::spawn_blocking(move || {
        decode::decode_preview(
            &decode_path,
            max_dimension.unwrap_or(4096).clamp(128, 16_384),
        )
    })
    .await
    .map_err(|error| format!("decoder task failed: {error}"))?
    .map_err(|error| error.to_string())?;

    let info = PreviewInfo {
        id: request_id,
        path: path.clone(),
        file_name: source_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Untitled")
            .to_string(),
        width: preview.width,
        height: preview.height,
        source_width: preview.source_width,
        source_height: preview.source_height,
        format: preview.format,
        camera: preview.camera,
    };
    let mut cache = state.0.lock().map_err(|_| "preview cache is unavailable")?;
    if cache.latest_request != request_id {
        return Err("a newer photo was opened".to_string());
    }
    cache.image = Some(CachedPreview {
        id: request_id,
        pixels: preview.rgba_f16_le,
    });
    Ok(info)
}

#[tauri::command]
fn preview_pixels(id: u64, state: tauri::State<'_, PreviewState>) -> Result<Response, String> {
    let cache = state.0.lock().map_err(|_| "preview cache is unavailable")?;
    let image = cache
        .image
        .as_ref()
        .filter(|image| image.id == id)
        .ok_or_else(|| "preview is no longer cached".to_string())?;
    Ok(Response::new(image.pixels.clone()))
}

#[tauri::command]
fn supported_extensions() -> Vec<&'static str> {
    decode::supported_extensions()
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|error| format!("could not read file: {error}"))
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|error| format!("could not write file: {error}"))
}

#[tauri::command]
async fn load_catalog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = catalog_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || read_catalog_with_backup(&path))
        .await
        .map_err(|error| format!("catalog load task failed: {error}"))?
}

#[tauri::command]
async fn load_catalog_backup(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = catalog_backup_path(&catalog_path(&app)?);
    tauri::async_runtime::spawn_blocking(move || read_optional_text(&path, "catalog backup"))
        .await
        .map_err(|error| format!("catalog backup load task failed: {error}"))?
}

fn read_catalog_with_backup(path: &Path) -> Result<Option<String>, String> {
    match std::fs::read_to_string(path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            read_optional_text(&catalog_backup_path(path), "catalog backup")
        }
        Err(error) => Err(format!("could not read catalog: {error}")),
    }
}

fn read_optional_text(path: &Path, label: &str) -> Result<Option<String>, String> {
    match std::fs::read_to_string(path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("could not read {label}: {error}")),
    }
}

#[tauri::command]
async fn save_catalog(
    app: tauri::AppHandle,
    contents: String,
    state: tauri::State<'_, CatalogState>,
) -> Result<(), String> {
    if contents.len() > 100 * 1024 * 1024 {
        return Err("catalog is too large".to_string());
    }
    let path = catalog_path(&app)?;
    write_catalog_serialized(state.0.clone(), path, contents.into_bytes()).await
}

async fn write_catalog_serialized(
    lock: Arc<tokio::sync::Mutex<()>>,
    path: PathBuf,
    contents: Vec<u8>,
) -> Result<(), String> {
    let _guard = lock.lock().await;
    tauri::async_runtime::spawn_blocking(move || write_catalog_atomically(&path, &contents))
        .await
        .map_err(|error| format!("catalog save task failed: {error}"))?
}

fn write_catalog_atomically(path: &Path, contents: &[u8]) -> Result<(), String> {
    let temporary = path.with_file_name("catalog.json.tmp");
    let backup = catalog_backup_path(path);
    let displaced = path.with_file_name("catalog.json.old");
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&temporary)
        .map_err(|error| format!("could not create catalog temporary file: {error}"))?;
    file.write_all(contents)
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("could not flush catalog: {error}"))?;
    if path.exists() {
        if displaced.exists() {
            std::fs::remove_file(&displaced)
                .map_err(|error| format!("could not replace displaced catalog: {error}"))?;
        }
        std::fs::rename(path, &displaced)
            .map_err(|error| format!("could not stage previous catalog: {error}"))?;
    }
    if let Err(error) = std::fs::rename(&temporary, path) {
        if !path.exists() && displaced.exists() {
            let _ = std::fs::rename(&displaced, path);
        }
        return Err(format!("could not replace catalog: {error}"));
    }
    if displaced.exists() {
        if backup.exists() {
            let _ = std::fs::remove_file(&backup);
        }
        let _ = std::fs::rename(&displaced, &backup);
    }
    Ok(())
}

fn catalog_backup_path(path: &Path) -> PathBuf {
    path.with_file_name("catalog.json.bak")
}

fn catalog_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("could not locate app data: {error}"))?;
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("could not create app data: {error}"))?;
    Ok(directory.join("catalog.json"))
}

#[tauri::command]
async fn load_thumbnails(
    app: tauri::AppHandle,
    ids: Vec<String>,
) -> Result<HashMap<String, String>, String> {
    if ids.len() > 100_000 || ids.iter().any(|id| !valid_thumbnail_id(id)) {
        return Err("invalid thumbnail request".to_string());
    }
    let directory = thumbnail_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut thumbnails = HashMap::new();
        for id in ids {
            match std::fs::read_to_string(directory.join(format!("{id}.txt"))) {
                Ok(contents) if valid_thumbnail_contents(&contents) => {
                    thumbnails.insert(id, contents);
                }
                Ok(_) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return Err(format!("could not read thumbnail: {error}")),
            }
        }
        Ok(thumbnails)
    })
    .await
    .map_err(|error| format!("thumbnail load task failed: {error}"))?
}

#[tauri::command]
async fn save_thumbnail(app: tauri::AppHandle, id: String, contents: String) -> Result<(), String> {
    if !valid_thumbnail_id(&id) || !valid_thumbnail_contents(&contents) {
        return Err("invalid thumbnail".to_string());
    }
    let path = thumbnail_directory(&app)?.join(format!("{id}.txt"));
    tauri::async_runtime::spawn_blocking(move || {
        std::fs::write(path, contents)
            .map_err(|error| format!("could not write thumbnail: {error}"))
    })
    .await
    .map_err(|error| format!("thumbnail save task failed: {error}"))?
}

fn thumbnail_directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("could not locate app data: {error}"))?
        .join("thumbnails");
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("could not create thumbnail directory: {error}"))?;
    Ok(directory)
}

fn valid_thumbnail_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

fn valid_thumbnail_contents(contents: &str) -> bool {
    contents.starts_with("data:image/") && contents.len() <= 2 * 1024 * 1024
}

#[tauri::command]
fn prepare_export(
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
async fn write_export(
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

fn suffixed_path(path: &Path, suffix: usize) -> PathBuf {
    let mut name = path.file_stem().unwrap_or_default().to_os_string();
    name.push(format!("-{suffix}"));
    let mut candidate = path.with_file_name(name);
    if let Some(extension) = path.extension() {
        candidate.set_extension(extension);
    }
    candidate
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(PreviewState::default())
        .manage(ExportState::default())
        .manage(CatalogState::default())
        .invoke_handler(tauri::generate_handler![
            open_image,
            preview_pixels,
            supported_extensions,
            read_text_file,
            write_text_file,
            load_catalog,
            load_catalog_backup,
            save_catalog,
            load_thumbnails,
            save_thumbnail,
            prepare_export,
            write_export
        ])
        .run(tauri::generate_context!())
        .expect("failed to run LightRAW");
}

#[cfg(test)]
mod persistence_tests {
    use super::{
        read_catalog_with_backup, write_catalog_atomically, write_catalog_serialized,
        write_export_file,
    };
    use std::sync::Arc;

    #[test]
    fn atomically_replaces_catalog_and_recovers_the_previous_copy() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("catalog.json");
        write_catalog_atomically(&path, b"first").unwrap();
        write_catalog_atomically(&path, b"second").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "second");
        std::fs::remove_file(&path).unwrap();
        assert_eq!(
            read_catalog_with_backup(&path).unwrap().as_deref(),
            Some("first")
        );
    }

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

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn serializes_overlapping_catalog_saves_without_file_collisions() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("catalog.json");
        let lock = Arc::new(tokio::sync::Mutex::new(()));
        let gate = lock.lock().await;
        let first = tokio::spawn(write_catalog_serialized(
            lock.clone(),
            path.clone(),
            b"first".to_vec(),
        ));
        tokio::task::yield_now().await;
        let second = tokio::spawn(write_catalog_serialized(
            lock.clone(),
            path.clone(),
            b"close-snapshot".to_vec(),
        ));
        drop(gate);
        first.await.unwrap().unwrap();
        second.await.unwrap().unwrap();
        let mut versions = vec![
            std::fs::read_to_string(&path).unwrap(),
            std::fs::read_to_string(directory.path().join("catalog.json.bak")).unwrap(),
        ];
        versions.sort();
        assert_eq!(versions, ["close-snapshot", "first"]);
    }
}
