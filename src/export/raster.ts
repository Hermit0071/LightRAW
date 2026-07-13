export function flipRgbaRows(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const rowBytes = width * 4;
  if (pixels.byteLength !== rowBytes * height) throw new RangeError("RGBA 缓冲区尺寸不正确");
  const temporary = new Uint8Array(rowBytes);
  for (let row = 0; row < Math.floor(height / 2); row += 1) {
    const opposite = height - 1 - row;
    const first = row * rowBytes;
    const second = opposite * rowBytes;
    temporary.set(pixels.subarray(first, first + rowBytes));
    pixels.copyWithin(first, second, second + rowBytes);
    pixels.set(temporary, second);
  }
  return pixels;
}

export function addTextWatermark(pixels: Uint8Array, width: number, height: number, text: string): Uint8Array {
  if (!text.trim()) return pixels;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建水印画布");
  const clamped = new Uint8ClampedArray(pixels.buffer as ArrayBuffer, pixels.byteOffset, pixels.byteLength);
  context.putImageData(new ImageData(clamped, width, height), 0, 0);
  const fontSize = Math.max(14, Math.round(Math.min(width, height) * 0.035));
  const margin = Math.max(12, Math.round(fontSize * 0.8));
  context.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  context.textAlign = "right";
  context.textBaseline = "bottom";
  context.fillStyle = "rgba(255,255,255,.82)";
  context.shadowColor = "rgba(0,0,0,.65)";
  context.shadowBlur = Math.max(2, Math.round(fontSize * 0.15));
  context.fillText(text.trim(), width - margin, height - margin);
  return new Uint8Array(context.getImageData(0, 0, width, height).data.buffer);
}
