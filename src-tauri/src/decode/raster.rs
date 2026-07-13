use super::{DecodeError, DecodedPreview};
use fast_image_resize::{FilterType, ResizeAlg, ResizeOptions, Resizer};
use half::f16;
use image::{DynamicImage, GenericImageView, ImageReader};
use std::path::Path;

#[derive(Clone, Copy)]
pub(super) enum SourceTransfer {
    Linear,
    Srgb,
}

pub fn decode(path: &Path, max_dimension: u32) -> Result<DecodedPreview, DecodeError> {
    let source = if is_jpeg(path) {
        let bytes = std::fs::read(path)?;
        let image: image::RgbImage = turbojpeg::decompress_image(&bytes)
            .map_err(|error| DecodeError::Jpeg(error.to_string()))?;
        DynamicImage::ImageRgb8(image)
    } else {
        ImageReader::open(path)?.with_guessed_format()?.decode()?
    };
    let (source_width, source_height) = source.dimensions();
    let preview = resize_to_fit(source, max_dimension.max(1))?;
    let (width, height) = preview.dimensions();
    let rgba_f16_le = half_float_bytes(preview, SourceTransfer::Srgb);

    Ok(DecodedPreview {
        width,
        height,
        source_width,
        source_height,
        format: display_format(path),
        camera: None,
        rgba_f16_le,
    })
}

fn is_jpeg(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .map(str::to_ascii_lowercase)
            .as_deref(),
        Some("jpg" | "jpeg")
    )
}

pub(super) fn resize_to_fit(
    image: DynamicImage,
    max_dimension: u32,
) -> Result<DynamicImage, DecodeError> {
    let (width, height) = image.dimensions();
    let longest = width.max(height);
    if longest <= max_dimension {
        return Ok(image);
    }

    let scale = max_dimension as f64 / longest as f64;
    let target_width = (width as f64 * scale).round().max(1.0) as u32;
    let target_height = (height as f64 * scale).round().max(1.0) as u32;
    let mut output = empty_image_like(&image, target_width, target_height);
    let options = ResizeOptions::new().resize_alg(ResizeAlg::Convolution(FilterType::Lanczos3));
    Resizer::new()
        .resize(&image, &mut output, Some(&options))
        .map_err(|error| DecodeError::Resize(error.to_string()))?;
    Ok(output)
}

fn empty_image_like(source: &DynamicImage, width: u32, height: u32) -> DynamicImage {
    match source {
        DynamicImage::ImageLuma8(_) => DynamicImage::new_luma8(width, height),
        DynamicImage::ImageLumaA8(_) => DynamicImage::new_luma_a8(width, height),
        DynamicImage::ImageRgb8(_) => DynamicImage::new_rgb8(width, height),
        DynamicImage::ImageRgba8(_) => DynamicImage::new_rgba8(width, height),
        DynamicImage::ImageLuma16(_) => DynamicImage::new_luma16(width, height),
        DynamicImage::ImageLumaA16(_) => DynamicImage::new_luma_a16(width, height),
        DynamicImage::ImageRgb16(_) => DynamicImage::new_rgb16(width, height),
        DynamicImage::ImageRgba16(_) => DynamicImage::new_rgba16(width, height),
        DynamicImage::ImageRgb32F(_) => DynamicImage::new_rgb32f(width, height),
        DynamicImage::ImageRgba32F(_) => DynamicImage::new_rgba32f(width, height),
        _ => DynamicImage::new_rgba8(width, height),
    }
}

pub(super) fn half_float_bytes(image: DynamicImage, source_transfer: SourceTransfer) -> Vec<u8> {
    let rgba = image.to_rgba32f();
    let mut output = Vec::with_capacity(rgba.len() * 2);

    for (index, value) in rgba.into_raw().into_iter().enumerate() {
        let linear = match (index % 4, source_transfer) {
            (3, _) | (_, SourceTransfer::Linear) => value,
            (_, SourceTransfer::Srgb) => srgb_to_linear(value),
        };
        output.extend_from_slice(&f16::from_f32(linear.clamp(0.0, 1.0)).to_le_bytes());
    }
    output
}

fn srgb_to_linear(value: f32) -> f32 {
    if value <= 0.04045 {
        value / 12.92
    } else {
        ((value + 0.055) / 1.055).powf(2.4)
    }
}

fn display_format(path: &Path) -> String {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "JPEG".to_string(),
        "tif" | "tiff" => "TIFF".to_string(),
        extension => extension.to_ascii_uppercase(),
    }
}

#[cfg(test)]
mod tests {
    use super::{half_float_bytes, SourceTransfer};
    use half::f16;
    use image::{DynamicImage, Rgb, Rgb32FImage};

    #[test]
    fn preserves_linear_raw_samples_without_applying_srgb_transfer_again() {
        let image = DynamicImage::ImageRgb32F(Rgb32FImage::from_pixel(1, 1, Rgb([0.5, 0.5, 0.5])));

        let bytes = half_float_bytes(image, SourceTransfer::Linear);
        let red = f16::from_le_bytes([bytes[0], bytes[1]]).to_f32();

        assert!((red - 0.5).abs() < 0.001);
    }
}
