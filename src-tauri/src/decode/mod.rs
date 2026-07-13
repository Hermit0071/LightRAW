use std::path::Path;

mod heif;
mod raster;
mod raw;

#[derive(Debug, thiserror::Error)]
pub enum DecodeError {
    #[error("unsupported image format: {0}")]
    UnsupportedFormat(String),
    #[error("could not decode image: {0}")]
    Image(#[from] image::ImageError),
    #[error("could not read image: {0}")]
    Io(#[from] std::io::Error),
    #[error("HEIF decoder error: {0}")]
    Heif(String),
    #[error("RAW decoder error: {0}")]
    Raw(String),
    #[error("could not resize preview: {0}")]
    Resize(String),
    #[error("JPEG decoder error: {0}")]
    Jpeg(String),
}

#[derive(Debug)]
pub struct DecodedPreview {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub camera: Option<String>,
    pub rgba_f16_le: Vec<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImageKind {
    Raster,
    Heif,
    Raw,
}

impl ImageKind {
    pub fn from_path(path: &Path) -> Option<Self> {
        let extension = path.extension()?.to_str()?.to_ascii_lowercase();
        match extension.as_str() {
            "jpg" | "jpeg" | "png" | "tif" | "tiff" => Some(Self::Raster),
            "heif" | "heic" => Some(Self::Heif),
            "cr2" | "cr3" | "nef" | "nrw" | "arw" | "raf" | "rw2" | "orf" | "dng" => {
                Some(Self::Raw)
            }
            _ => None,
        }
    }
}

pub fn decode_preview(path: &Path, max_dimension: u32) -> Result<DecodedPreview, DecodeError> {
    match ImageKind::from_path(path) {
        Some(ImageKind::Raster) => raster::decode(path, max_dimension),
        Some(ImageKind::Heif) => heif::decode(path, max_dimension),
        Some(ImageKind::Raw) => raw::decode(path, max_dimension),
        None => Err(DecodeError::UnsupportedFormat(
            path.extension()
                .and_then(|value| value.to_str())
                .unwrap_or("unknown")
                .to_string(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::{decode_preview, ImageKind};
    use image::{ImageBuffer, Rgb};
    use std::path::Path;

    #[test]
    fn routes_supported_extensions_to_their_decoder() {
        for extension in ["jpg", "jpeg", "png", "tif", "tiff"] {
            let path = format!("photo.{extension}");
            assert_eq!(
                ImageKind::from_path(Path::new(&path)),
                Some(ImageKind::Raster)
            );
        }

        for extension in ["heif", "heic"] {
            let path = format!("photo.{extension}");
            assert_eq!(
                ImageKind::from_path(Path::new(&path)),
                Some(ImageKind::Heif)
            );
        }

        for extension in [
            "cr2", "cr3", "nef", "nrw", "arw", "raf", "rw2", "orf", "dng",
        ] {
            let path = format!("photo.{extension}");
            assert_eq!(ImageKind::from_path(Path::new(&path)), Some(ImageKind::Raw));
        }
    }

    #[test]
    fn decodes_a_raster_into_a_linear_half_float_preview() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("sample.png");
        let image = ImageBuffer::from_fn(2, 1, |x, _| {
            if x == 0 {
                Rgb([255_u8, 0, 0])
            } else {
                Rgb([0_u8, 128, 255])
            }
        });
        image.save(&path).unwrap();

        let preview = decode_preview(&path, 4096).unwrap();

        assert_eq!((preview.width, preview.height), (2, 1));
        assert_eq!(preview.format, "PNG");
        assert_eq!(preview.rgba_f16_le.len(), 2 * 1 * 4 * 2);
    }

    #[test]
    #[ignore = "requires LIGHTRAW_REAL_IMAGE"]
    fn decodes_a_real_photo_within_the_interactive_budget() {
        let path = std::env::var("LIGHTRAW_REAL_IMAGE").expect("set LIGHTRAW_REAL_IMAGE");
        let started = std::time::Instant::now();
        let preview = decode_preview(Path::new(&path), 4096).unwrap();

        assert!(preview.width.max(preview.height) <= 4096);
        assert!(
            started.elapsed() < std::time::Duration::from_secs(10),
            "real photo decode took {:?}",
            started.elapsed()
        );
    }
}
