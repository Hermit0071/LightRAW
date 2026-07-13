use super::raster::{linear_half_float_bytes, resize_to_fit};
use super::{DecodeError, DecodedPreview};
use image::{DynamicImage, RgbImage};
use libheif_rs::{ColorSpace, HeifContext, LibHeif, RgbChroma};
use std::path::Path;

pub fn decode(path: &Path, max_dimension: u32) -> Result<DecodedPreview, DecodeError> {
    let path_text = path
        .to_str()
        .ok_or_else(|| DecodeError::Heif("path is not valid UTF-8".to_string()))?;
    let context = HeifContext::read_from_file(path_text)
        .map_err(|error| DecodeError::Heif(error.to_string()))?;
    let handle = context
        .primary_image_handle()
        .map_err(|error| DecodeError::Heif(error.to_string()))?;
    let decoded = LibHeif::new()
        .decode(&handle, ColorSpace::Rgb(RgbChroma::Rgb), None)
        .map_err(|error| DecodeError::Heif(error.to_string()))?;
    let plane = decoded
        .planes()
        .interleaved
        .ok_or_else(|| DecodeError::Heif("decoder returned no RGB plane".to_string()))?;

    let width = decoded.width();
    let height = decoded.height();
    let row_bytes = width as usize * 3;
    let mut packed = Vec::with_capacity(row_bytes * height as usize);
    for row in 0..height as usize {
        let start = row * plane.stride;
        packed.extend_from_slice(&plane.data[start..start + row_bytes]);
    }
    let image = RgbImage::from_raw(width, height, packed)
        .ok_or_else(|| DecodeError::Heif("invalid RGB plane dimensions".to_string()))?;
    let preview = resize_to_fit(DynamicImage::ImageRgb8(image), max_dimension.max(1))?;

    Ok(DecodedPreview {
        width: preview.width(),
        height: preview.height(),
        format: path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("HEIF")
            .to_ascii_uppercase(),
        camera: None,
        rgba_f16_le: linear_half_float_bytes(preview),
    })
}
