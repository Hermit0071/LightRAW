use super::raster::{linear_half_float_bytes, resize_to_fit};
use super::{DecodeError, DecodedPreview};
use image::DynamicImage;
use std::ffi::{c_char, c_int, CStr, CString};
use std::path::Path;

#[repr(C)]
struct NativeRawPreview {
    data: *mut u8,
    data_size: usize,
    width: u32,
    height: u32,
    colors: u16,
    camera: [c_char; 160],
    error: [c_char; 256],
}

unsafe extern "C" {
    fn lightraw_decode_raw(
        path: *const c_char,
        max_dimension: u32,
        output: *mut NativeRawPreview,
    ) -> c_int;
    fn lightraw_free_raw_preview(preview: *mut NativeRawPreview);
}

pub fn decode(path: &Path, max_dimension: u32) -> Result<DecodedPreview, DecodeError> {
    let path_text = path
        .to_str()
        .ok_or_else(|| DecodeError::Raw("path is not valid UTF-8".to_string()))?;
    let native_path = CString::new(path_text)
        .map_err(|_| DecodeError::Raw("path contains a null byte".to_string()))?;
    let mut native = NativeRawPreview {
        data: std::ptr::null_mut(),
        data_size: 0,
        width: 0,
        height: 0,
        colors: 0,
        camera: [0; 160],
        error: [0; 256],
    };

    let code = unsafe { lightraw_decode_raw(native_path.as_ptr(), max_dimension, &mut native) };
    if code != 0 {
        let error = unsafe { CStr::from_ptr(native.error.as_ptr()) }
            .to_string_lossy()
            .into_owned();
        return Err(DecodeError::Raw(error));
    }

    let decoded = copy_native_pixels(&native);
    unsafe { lightraw_free_raw_preview(&mut native) };
    let image = decoded?;
    let preview = resize_to_fit(DynamicImage::ImageRgb16(image), max_dimension.max(1))?;
    let camera = unsafe { CStr::from_ptr(native.camera.as_ptr()) }
        .to_string_lossy()
        .trim()
        .to_string();

    Ok(DecodedPreview {
        width: preview.width(),
        height: preview.height(),
        format: path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("RAW")
            .to_ascii_uppercase(),
        camera: (!camera.is_empty()).then_some(camera),
        rgba_f16_le: linear_half_float_bytes(preview),
    })
}

fn copy_native_pixels(native: &NativeRawPreview) -> Result<RgbImage16, DecodeError> {
    if native.data.is_null() || native.colors < 3 {
        return Err(DecodeError::Raw(
            "decoder returned no RGB pixels".to_string(),
        ));
    }
    let sample_count = native.data_size / std::mem::size_of::<u16>();
    let samples = unsafe { std::slice::from_raw_parts(native.data.cast::<u16>(), sample_count) };
    let pixel_count = native.width as usize * native.height as usize;
    let mut rgb = Vec::with_capacity(pixel_count * 3);
    for pixel in samples
        .chunks_exact(native.colors as usize)
        .take(pixel_count)
    {
        rgb.extend_from_slice(&pixel[..3]);
    }
    RgbImage16::from_raw(native.width, native.height, rgb)
        .ok_or_else(|| DecodeError::Raw("invalid decoded RAW dimensions".to_string()))
}

type RgbImage16 = image::ImageBuffer<image::Rgb<u16>, Vec<u16>>;
