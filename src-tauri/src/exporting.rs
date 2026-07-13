use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::PngEncoder;
use image::codecs::tiff::TiffEncoder;
use image::{ColorType, ImageEncoder};
use std::io::Cursor;

pub fn encode_image(
    width: u32,
    height: u32,
    rgba: &[u8],
    format: &str,
    quality: u8,
) -> Result<Vec<u8>, String> {
    let expected = width as usize * height as usize * 4;
    if width == 0 || height == 0 || rgba.len() != expected {
        return Err("export RGBA buffer dimensions do not match".to_string());
    }
    let mut output = Vec::new();
    match format {
        "jpeg" => {
            let rgb: Vec<u8> = rgba
                .chunks_exact(4)
                .flat_map(|pixel| &pixel[..3])
                .copied()
                .collect();
            JpegEncoder::new_with_quality(&mut output, quality.clamp(1, 100))
                .encode(&rgb, width, height, ColorType::Rgb8.into())
                .map_err(|error| error.to_string())?;
        }
        "png" => PngEncoder::new(&mut output)
            .write_image(rgba, width, height, ColorType::Rgba8.into())
            .map_err(|error| error.to_string())?,
        "tiff" => TiffEncoder::new(Cursor::new(&mut output))
            .write_image(rgba, width, height, ColorType::Rgba8.into())
            .map_err(|error| error.to_string())?,
        _ => return Err(format!("unsupported export format: {format}")),
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::encode_image;
    use image::GenericImageView;

    #[test]
    fn encodes_jpeg_png_and_tiff_with_the_requested_dimensions() {
        let rgba = vec![255_u8, 0, 0, 255, 0, 255, 0, 255];
        for format in ["jpeg", "png", "tiff"] {
            let bytes = encode_image(2, 1, &rgba, format, 82).unwrap();
            let image = image::load_from_memory(&bytes).unwrap();
            assert_eq!(image.dimensions(), (2, 1), "{format}");
        }
    }

    #[test]
    fn rejects_a_mismatched_rgba_buffer() {
        assert!(encode_image(2, 1, &[0; 4], "png", 100).is_err());
    }
}
