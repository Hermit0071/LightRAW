use std::path::{Path, PathBuf};

pub(crate) fn suffixed_path(path: &Path, suffix: usize) -> PathBuf {
    let mut name = path.file_stem().unwrap_or_default().to_os_string();
    name.push(format!("-{suffix}"));
    let mut candidate = path.with_file_name(name);
    if let Some(extension) = path.extension() {
        candidate.set_extension(extension);
    }
    candidate
}
