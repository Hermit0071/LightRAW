use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::Manager;

#[derive(Default)]
pub(crate) struct CatalogState(Arc<tokio::sync::Mutex<()>>);

#[tauri::command]
pub(crate) async fn load_catalog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = catalog_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || read_catalog_with_backup(&path))
        .await
        .map_err(|error| format!("catalog load task failed: {error}"))?
}

#[tauri::command]
pub(crate) async fn load_catalog_backup(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = catalog_backup_path(&catalog_path(&app)?);
    tauri::async_runtime::spawn_blocking(move || read_optional_text(&path, "catalog backup"))
        .await
        .map_err(|error| format!("catalog backup load task failed: {error}"))?
}

#[tauri::command]
pub(crate) async fn save_catalog(
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

#[tauri::command]
pub(crate) async fn load_thumbnails(
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
pub(crate) async fn save_thumbnail(
    app: tauri::AppHandle,
    id: String,
    contents: String,
) -> Result<(), String> {
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

#[tauri::command]
pub(crate) async fn remove_thumbnails(
    app: tauri::AppHandle,
    ids: Vec<String>,
) -> Result<(), String> {
    if ids.len() > 100_000 || ids.iter().any(|id| !valid_thumbnail_id(id)) {
        return Err("invalid thumbnail removal request".to_string());
    }
    let directory = thumbnail_directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        for id in ids {
            match std::fs::remove_file(directory.join(format!("{id}.txt"))) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => return Err(format!("could not remove thumbnail: {error}")),
            }
        }
        Ok(())
    })
    .await
    .map_err(|error| format!("thumbnail removal task failed: {error}"))?
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

#[cfg(test)]
mod tests {
    use super::{read_catalog_with_backup, write_catalog_atomically, write_catalog_serialized};
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
