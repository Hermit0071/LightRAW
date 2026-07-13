mod catalog;
mod decode;
mod export_queue;
mod exporting;
mod file_management;
mod path_utils;

use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::ipc::Response;

#[derive(Default)]
struct PreviewState(Mutex<PreviewCache>);

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(PreviewState::default())
        .manage(export_queue::ExportState::default())
        .manage(catalog::CatalogState::default())
        .invoke_handler(tauri::generate_handler![
            open_image,
            preview_pixels,
            supported_extensions,
            read_text_file,
            write_text_file,
            catalog::load_catalog,
            catalog::load_catalog_backup,
            catalog::save_catalog,
            catalog::load_thumbnails,
            catalog::save_thumbnail,
            catalog::remove_thumbnails,
            file_management::rename_photos,
            file_management::copy_photo_files,
            file_management::move_photo_files,
            file_management::trash_photo_files,
            file_management::reveal_photo,
            export_queue::prepare_export,
            export_queue::write_export
        ])
        .run(tauri::generate_context!())
        .expect("failed to run LightRAW");
}
