use crate::path_utils::suffixed_path;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FileOperationOutcome {
    source: String,
    destination: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RenameRequest {
    path: String,
    new_name: String,
}

#[tauri::command]
pub(crate) async fn rename_photos(
    requests: Vec<RenameRequest>,
) -> Result<Vec<FileOperationOutcome>, String> {
    if requests.is_empty() || requests.len() > 10_000 {
        return Err("invalid rename request".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || {
        requests
            .into_iter()
            .map(
                |request| match rename_photo_file(Path::new(&request.path), &request.new_name) {
                    Ok(destination) => FileOperationOutcome {
                        source: request.path,
                        destination: Some(destination.to_string_lossy().into_owned()),
                        error: None,
                    },
                    Err(error) => FileOperationOutcome {
                        source: request.path,
                        destination: None,
                        error: Some(error),
                    },
                },
            )
            .collect()
    })
    .await
    .map_err(|error| format!("rename task failed: {error}"))
}

#[tauri::command]
pub(crate) async fn copy_photo_files(
    paths: Vec<String>,
    directory: String,
) -> Result<Vec<FileOperationOutcome>, String> {
    file_transfer_task(paths, directory, false).await
}

#[tauri::command]
pub(crate) async fn move_photo_files(
    paths: Vec<String>,
    directory: String,
) -> Result<Vec<FileOperationOutcome>, String> {
    file_transfer_task(paths, directory, true).await
}

#[tauri::command]
pub(crate) async fn trash_photo_files(
    paths: Vec<String>,
) -> Result<Vec<FileOperationOutcome>, String> {
    if paths.is_empty() || paths.len() > 10_000 {
        return Err("invalid trash request".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || {
        paths
            .into_iter()
            .map(|source| match trash::delete(&source) {
                Ok(()) => FileOperationOutcome {
                    source,
                    destination: None,
                    error: None,
                },
                Err(error) => FileOperationOutcome {
                    source,
                    destination: None,
                    error: Some(error.to_string()),
                },
            })
            .collect()
    })
    .await
    .map_err(|error| format!("trash task failed: {error}"))
}

#[tauri::command]
pub(crate) fn reveal_photo(path: String) -> Result<(), String> {
    let source = PathBuf::from(path);
    if !source.exists() {
        return Err("file does not exist".to_string());
    }
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = std::process::Command::new("open");
        command.arg("-R").arg(&source);
        command
    };
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = std::process::Command::new("explorer");
        command.arg(format!("/select,{}", source.display()));
        command
    };
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let mut command = {
        let mut command = std::process::Command::new("xdg-open");
        command.arg(source.parent().unwrap_or(Path::new(".")));
        command
    };
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("could not reveal file: {error}"))
}

async fn file_transfer_task(
    paths: Vec<String>,
    directory: String,
    moving: bool,
) -> Result<Vec<FileOperationOutcome>, String> {
    if paths.is_empty() || paths.len() > 10_000 {
        return Err("invalid file operation request".to_string());
    }
    let directory = PathBuf::from(directory);
    if !directory.is_dir() {
        return Err("target directory does not exist".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || {
        paths
            .into_iter()
            .map(|source| {
                let result = if moving {
                    move_file_to_directory(Path::new(&source), &directory)
                } else {
                    copy_file_to_directory(Path::new(&source), &directory)
                };
                match result {
                    Ok(destination) => FileOperationOutcome {
                        source,
                        destination: Some(destination.to_string_lossy().into_owned()),
                        error: None,
                    },
                    Err(error) => FileOperationOutcome {
                        source,
                        destination: None,
                        error: Some(error),
                    },
                }
            })
            .collect()
    })
    .await
    .map_err(|error| format!("file operation task failed: {error}"))
}

fn valid_file_name(name: &str) -> bool {
    let base = name
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    !name.is_empty()
        && name != "."
        && name != ".."
        && name.len() <= 255
        && Path::new(name).file_name().and_then(|value| value.to_str()) == Some(name)
        && !name.ends_with(['.', ' '])
        && !name
            .chars()
            .any(|character| character < '\u{20}' || "<>:\"/\\|?*".contains(character))
        && !matches!(
            base.as_str(),
            "CON"
                | "PRN"
                | "AUX"
                | "NUL"
                | "COM1"
                | "COM2"
                | "COM3"
                | "COM4"
                | "COM5"
                | "COM6"
                | "COM7"
                | "COM8"
                | "COM9"
                | "LPT1"
                | "LPT2"
                | "LPT3"
                | "LPT4"
                | "LPT5"
                | "LPT6"
                | "LPT7"
                | "LPT8"
                | "LPT9"
        )
}

fn rename_photo_file(source: &Path, new_name: &str) -> Result<PathBuf, String> {
    if !source.is_file() || !valid_file_name(new_name) {
        return Err("invalid file or file name".to_string());
    }
    let destination = source.with_file_name(new_name);
    if destination == source {
        return Ok(destination);
    }
    if destination.exists() {
        return Err("a file with that name already exists".to_string());
    }
    move_without_overwrite(source, &destination)?;
    Ok(destination)
}

fn copy_file_to_directory(source: &Path, directory: &Path) -> Result<PathBuf, String> {
    if !source.is_file() || !directory.is_dir() {
        return Err("source file or target directory does not exist".to_string());
    }
    let name = source
        .file_name()
        .ok_or_else(|| "source file has no name".to_string())?;
    let destination = available_file_path(&directory.join(name))?;
    copy_without_overwrite(source, &destination)?;
    Ok(destination)
}

fn move_file_to_directory(source: &Path, directory: &Path) -> Result<PathBuf, String> {
    if !source.is_file() || !directory.is_dir() {
        return Err("source file or target directory does not exist".to_string());
    }
    if source.parent().and_then(|path| path.canonicalize().ok()) == directory.canonicalize().ok() {
        return Err("file is already in the selected directory".to_string());
    }
    let name = source
        .file_name()
        .ok_or_else(|| "source file has no name".to_string())?;
    let destination = available_file_path(&directory.join(name))?;
    move_without_overwrite(source, &destination)?;
    Ok(destination)
}

fn move_without_overwrite(source: &Path, destination: &Path) -> Result<(), String> {
    if let Err(link_error) = std::fs::hard_link(source, destination) {
        copy_without_overwrite(source, destination)
            .map_err(|copy_error| format!("could not move file: {link_error}; {copy_error}"))?;
    }
    if let Err(error) = std::fs::remove_file(source) {
        let _ = std::fs::remove_file(destination);
        return Err(format!("could not remove source after copying: {error}"));
    }
    Ok(())
}

fn copy_without_overwrite(source: &Path, destination: &Path) -> Result<(), String> {
    let mut input =
        std::fs::File::open(source).map_err(|error| format!("could not open source: {error}"))?;
    let mut output = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(destination)
        .map_err(|error| format!("could not create destination: {error}"))?;
    if let Err(error) = std::io::copy(&mut input, &mut output).and_then(|_| output.sync_all()) {
        let _ = std::fs::remove_file(destination);
        return Err(format!("could not copy file: {error}"));
    }
    Ok(())
}

fn available_file_path(path: &Path) -> Result<PathBuf, String> {
    for suffix in 1..=10_000 {
        let candidate = if suffix == 1 {
            path.to_path_buf()
        } else {
            suffixed_path(path, suffix)
        };
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err("could not find an available file name".to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        copy_file_to_directory, move_file_to_directory, rename_photo_file, valid_file_name,
    };

    #[test]
    fn validates_names_and_renames_without_overwriting() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("photo.jpg");
        std::fs::write(&source, b"photo").unwrap();
        assert!(valid_file_name("renamed.jpg"));
        assert!(!valid_file_name("../renamed.jpg"));
        assert!(!valid_file_name("folder/renamed.jpg"));
        assert!(!valid_file_name("bad:name.jpg"));
        assert!(!valid_file_name("CON.jpg"));
        assert!(!valid_file_name("trailing. "));
        let renamed = rename_photo_file(&source, "renamed.jpg").unwrap();
        assert_eq!(renamed, directory.path().join("renamed.jpg"));
        std::fs::write(directory.path().join("occupied.jpg"), b"old").unwrap();
        assert!(rename_photo_file(&renamed, "occupied.jpg").is_err());
    }

    #[test]
    fn copy_and_move_never_overwrite_existing_files() {
        let source_directory = tempfile::tempdir().unwrap();
        let target_directory = tempfile::tempdir().unwrap();
        let source = source_directory.path().join("photo.jpg");
        std::fs::write(&source, b"new").unwrap();
        std::fs::write(target_directory.path().join("photo.jpg"), b"old").unwrap();
        let copied = copy_file_to_directory(&source, target_directory.path()).unwrap();
        assert_eq!(copied, target_directory.path().join("photo-2.jpg"));
        assert_eq!(
            std::fs::read(target_directory.path().join("photo.jpg")).unwrap(),
            b"old"
        );
        assert!(move_file_to_directory(&copied, target_directory.path()).is_err());
        let moved = move_file_to_directory(&source, target_directory.path()).unwrap();
        assert_eq!(moved, target_directory.path().join("photo-3.jpg"));
        assert!(!source.exists());
    }
}
