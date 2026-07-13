mod decode;

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
    file_name: String,
    width: u32,
    height: u32,
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
        decode::decode_preview(&decode_path, max_dimension.unwrap_or(4096).clamp(512, 4096))
    })
    .await
    .map_err(|error| format!("decoder task failed: {error}"))?
    .map_err(|error| error.to_string())?;

    let info = PreviewInfo {
        id: request_id,
        file_name: source_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Untitled")
            .to_string(),
        width: preview.width,
        height: preview.height,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(PreviewState::default())
        .invoke_handler(tauri::generate_handler![open_image, preview_pixels])
        .run(tauri::generate_context!())
        .expect("failed to run LightRAW");
}
