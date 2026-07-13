import type { DevelopRecipe } from "../editor/develop-recipe";
import { HSL_CHANNELS } from "../editor/hsl";
import { buildCurveLut } from "../editor/tone-curve";
import { COLOR_ENGINE_CONSTANTS } from "./color-engine";
import { toPreviewUniforms } from "./uniforms";

const VERTEX_SHADER = `#version 300 es
precision highp float;
out vec2 v_uv;

void main() {
  vec2 position = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform sampler2D u_curve;
uniform vec2 u_texel_size;
uniform vec4 u_crop;
uniform float u_crop_aspect;
uniform float u_rotation;
uniform float u_straighten;
uniform bool u_flip_horizontal;
uniform bool u_flip_vertical;
uniform float u_temperature;
uniform float u_tint;
uniform float u_exposure;
uniform float u_contrast;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_whites;
uniform float u_blacks;
uniform float u_texture;
uniform float u_clarity;
uniform float u_dehaze;
uniform float u_vibrance;
uniform float u_saturation;
uniform vec3 u_hsl[8];
uniform float u_sharpening_amount;
uniform float u_sharpening_radius;
uniform float u_sharpening_detail;
uniform float u_luminance_noise;
uniform float u_color_noise;
in vec2 v_uv;
out vec4 out_color;

float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

vec3 linear_to_srgb(vec3 color) {
  vec3 lower = color * 12.92;
  vec3 upper = 1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
  return mix(upper, lower, lessThanEqual(color, vec3(0.0031308)));
}

vec2 map_uv(vec2 output_uv) {
  vec2 point = output_uv - 0.5;
  if (u_flip_horizontal) point.x = -point.x;
  if (u_flip_vertical) point.y = -point.y;
  float quarter_angle = radians(-u_rotation);
  float quarter_sine = sin(quarter_angle);
  float quarter_cosine = cos(quarter_angle);
  point = mat2(quarter_cosine, -quarter_sine, quarter_sine, quarter_cosine) * point;

  // Straighten in pixel space, then zoom just enough to avoid empty corners.
  float angle = radians(-u_straighten);
  float sine = sin(angle);
  float cosine = cos(angle);
  vec2 physical = vec2(point.x * u_crop_aspect, point.y);
  physical = mat2(cosine, -sine, sine, cosine) * physical;
  point = vec2(physical.x / u_crop_aspect, physical.y);
  float safe_zoom = max(
    abs(cosine) + abs(sine) / u_crop_aspect,
    abs(sine) * u_crop_aspect + abs(cosine)
  );
  point /= safe_zoom;
  // Recipe crop Y is measured from the visible top; texture V grows upward.
  vec2 crop_origin = vec2(u_crop.x, 1.0 - u_crop.y - u_crop.w);
  return crop_origin + (point + 0.5) * u_crop.zw;
}

vec3 sample_cross(vec2 uv, vec2 offset) {
  return (
    texture(u_image, uv + vec2(offset.x, 0.0)).rgb +
    texture(u_image, uv - vec2(offset.x, 0.0)).rgb +
    texture(u_image, uv + vec2(0.0, offset.y)).rgb +
    texture(u_image, uv - vec2(0.0, offset.y)).rgb
  ) * 0.25;
}

vec3 filter_detail(vec2 uv) {
  vec3 centre = texture(u_image, uv).rgb;
  vec3 fine = sample_cross(uv, u_texel_size);
  vec3 coarse = sample_cross(uv, u_texel_size * 4.0);
  float centre_luma = luminance(centre);
  float fine_luma = luminance(fine);
  float coarse_luma = luminance(coarse);
  vec3 colour_smoothed = vec3(centre_luma) + (fine - vec3(fine_luma));
  vec3 filtered = mix(centre, colour_smoothed, u_color_noise * 0.72);
  filtered += vec3((fine_luma - centre_luma) * u_luminance_noise * 0.72);

  float fine_detail = centre_luma - fine_luma;
  float coarse_detail = centre_luma - coarse_luma;
  float radius_mix = (u_sharpening_radius - 0.5) / 2.5;
  float sharpening_detail = mix(fine_detail, coarse_detail, radius_mix);
  float sharpen_gain = u_sharpening_amount * (0.3 + u_sharpening_detail * 0.9);
  filtered += vec3(sharpening_detail * sharpen_gain);
  filtered += vec3(fine_detail * u_texture * 0.38 + coarse_detail * u_clarity * 0.62);
  return max(filtered, vec3(0.0));
}

vec3 apply_white_balance(vec3 color) {
  vec3 gains = exp2(vec3(
    u_temperature * ${COLOR_ENGINE_CONSTANTS.temperatureGain} + u_tint * ${COLOR_ENGINE_CONSTANTS.tintRedBlueGain},
    -u_tint * ${COLOR_ENGINE_CONSTANTS.tintGreenGain},
    -u_temperature * ${COLOR_ENGINE_CONSTANTS.temperatureGain} + u_tint * ${COLOR_ENGINE_CONSTANTS.tintRedBlueGain}
  ));
  return color * gains;
}

float adjust_zone(float value, float amount, float mask, float strength) {
  if (amount >= 0.0) return value + max(1.0 - value, 0.0) * amount * mask * strength;
  return value + value * amount * mask * strength;
}

vec3 apply_tone(vec3 color) {
  float before = max(luminance(color), 0.00001);
  float value = before;
  value = adjust_zone(value, u_shadows, 1.0 - smoothstep(${COLOR_ENGINE_CONSTANTS.shadowStart}, ${COLOR_ENGINE_CONSTANTS.shadowEnd}, value), ${COLOR_ENGINE_CONSTANTS.zoneStrength});
  value = adjust_zone(value, u_highlights, smoothstep(${COLOR_ENGINE_CONSTANTS.highlightStart}, ${COLOR_ENGINE_CONSTANTS.highlightEnd}, value), ${COLOR_ENGINE_CONSTANTS.zoneStrength});
  value = adjust_zone(value, u_blacks, 1.0 - smoothstep(0.02, 0.32, value), 0.48);
  value = adjust_zone(value, u_whites, smoothstep(0.48, 1.0, value), 0.48);
  return color * max(value, 0.0) / before;
}

vec3 rgb_to_hsl(vec3 color) {
  float maximum = max(max(color.r, color.g), color.b);
  float minimum = min(min(color.r, color.g), color.b);
  float lightness = (maximum + minimum) * 0.5;
  float delta = maximum - minimum;
  if (delta < 0.000001) return vec3(0.0, 0.0, lightness);
  float saturation = delta / max(1.0 - abs(2.0 * lightness - 1.0), 0.000001);
  float hue;
  if (maximum == color.r) hue = 60.0 * mod((color.g - color.b) / delta, 6.0);
  else if (maximum == color.g) hue = 60.0 * ((color.b - color.r) / delta + 2.0);
  else hue = 60.0 * ((color.r - color.g) / delta + 4.0);
  return vec3(mod(hue + 360.0, 360.0), saturation, lightness);
}

vec3 hsl_to_rgb(vec3 hsl) {
  float chroma = (1.0 - abs(2.0 * hsl.z - 1.0)) * hsl.y;
  float intermediate = chroma * (1.0 - abs(mod(hsl.x / 60.0, 2.0) - 1.0));
  vec3 value;
  if (hsl.x < 60.0) value = vec3(chroma, intermediate, 0.0);
  else if (hsl.x < 120.0) value = vec3(intermediate, chroma, 0.0);
  else if (hsl.x < 180.0) value = vec3(0.0, chroma, intermediate);
  else if (hsl.x < 240.0) value = vec3(0.0, intermediate, chroma);
  else if (hsl.x < 300.0) value = vec3(intermediate, 0.0, chroma);
  else value = vec3(chroma, 0.0, intermediate);
  return value + hsl.z - chroma * 0.5;
}

float hue_weight(float hue, float centre) {
  float distance = abs(mod(hue - centre + 540.0, 360.0) - 180.0);
  return max(0.0, 1.0 - distance / 45.0);
}

vec3 apply_hsl(vec3 color) {
  vec3 hsl = rgb_to_hsl(clamp(color, 0.0, 1.0));
  float centres[8] = float[8](0.0, 30.0, 60.0, 120.0, 180.0, 240.0, 275.0, 315.0);
  vec3 edit = vec3(0.0);
  for (int index = 0; index < 8; index++) edit += u_hsl[index] * hue_weight(hsl.x, centres[index]);
  hsl.x = mod(hsl.x + edit.x * 30.0 + 360.0, 360.0);
  hsl.y = clamp(hsl.y * (1.0 + edit.y), 0.0, 1.0);
  hsl.z = clamp(hsl.z + edit.z * 0.5, 0.0, 1.0);
  return hsl_to_rgb(hsl);
}

vec3 apply_curve(vec3 color) {
  return vec3(
    texture(u_curve, vec2(clamp(color.r, 0.0, 1.0), 0.5)).r,
    texture(u_curve, vec2(clamp(color.g, 0.0, 1.0), 0.5)).g,
    texture(u_curve, vec2(clamp(color.b, 0.0, 1.0), 0.5)).b
  );
}

void main() {
  vec3 color = filter_detail(map_uv(v_uv));
  color = apply_white_balance(color) * exp2(u_exposure);
  color = apply_tone(color);
  color = max((color - ${COLOR_ENGINE_CONSTANTS.middleGray}) * exp2(u_contrast) + ${COLOR_ENGINE_CONSTANTS.middleGray}, vec3(0.0));
  color = max((color - 0.12) * (1.0 + u_dehaze * 0.42) + 0.12 - u_dehaze * 0.025, vec3(0.0));
  float lightness = luminance(color);
  float chroma = max(max(color.r, color.g), color.b) - min(min(color.r, color.g), color.b);
  float saturation_scale = max(0.0, 1.0 + u_saturation + u_vibrance * (1.0 - min(chroma, 1.0)));
  color = vec3(lightness) + (color - vec3(lightness)) * saturation_scale;
  color = apply_curve(apply_hsl(color));
  out_color = vec4(linear_to_srgb(color), 1.0);
}`;

export interface PreviewMetrics {
  fps: number;
  frameLatencyMs: number;
}

export interface PreviewLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class PreviewRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly imageTexture: WebGLTexture;
  private readonly curveTexture: WebGLTexture;
  private readonly resizeObserver: ResizeObserver;
  private recipe: DevelopRecipe;
  private imageWidth = 0;
  private imageHeight = 0;
  private frameRequest = 0;
  private scheduledAt = 0;
  private lastFrameAt = 0;
  private readonly frameIntervals: number[] = [];
  private lastLayout: PreviewLayout | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    initial: DevelopRecipe,
    private readonly onMetrics?: (metrics: PreviewMetrics) => void,
    private readonly onLayout?: (layout: PreviewLayout) => void,
  ) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("当前设备不支持 WebGL 2，无法启动 GPU 预览。");
    if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("当前 GPU 不支持半浮点渲染缓冲区。");
    this.gl = gl;
    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    this.imageTexture = createTexture(gl, gl.LINEAR);
    this.curveTexture = createTexture(gl, gl.LINEAR);
    this.recipe = initial;

    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    verifyHalfFloatTexture(gl, this.imageTexture);
    this.uploadCurve();

    this.resizeObserver = new ResizeObserver(() => this.scheduleRender());
    this.resizeObserver.observe(canvas);
  }

  setImage(width: number, height: number, pixels: Uint8Array): void {
    if (pixels.byteLength !== width * height * 4 * 2) throw new Error("解码后的预览缓冲区尺寸不正确。");
    this.imageWidth = width;
    this.imageHeight = height;
    const data = new Uint16Array(pixels.buffer, pixels.byteOffset, pixels.byteLength / 2);
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, data);
    this.scheduleRender();
  }

  setRecipe(recipe: DevelopRecipe): void {
    const curveChanged = recipe.curves !== this.recipe.curves;
    this.recipe = recipe;
    if (curveChanged) this.uploadCurve();
    this.scheduleRender();
  }

  destroy(): void {
    cancelAnimationFrame(this.frameRequest);
    this.resizeObserver.disconnect();
    this.gl.deleteTexture(this.imageTexture);
    this.gl.deleteTexture(this.curveTexture);
    this.gl.deleteProgram(this.program);
  }

  private uploadCurve(): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.curveTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 256, 1, 0, gl.RGBA, gl.FLOAT, buildCurveLut(this.recipe.curves));
  }

  private scheduleRender(): void {
    if (this.frameRequest !== 0) return;
    this.scheduledAt = performance.now();
    this.frameRequest = requestAnimationFrame(() => {
      this.frameRequest = 0;
      this.render();
    });
  }

  private render(): void {
    const frameStartedAt = performance.now();
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0.055, 0.056, 0.052, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.imageWidth === 0 || this.imageHeight === 0) {
      this.reportMetrics(frameStartedAt);
      return;
    }

    const crop = this.recipe.geometry.crop;
    const quarterTurn = this.recipe.geometry.rotation === 90 || this.recipe.geometry.rotation === 270;
    const cropWidth = this.imageWidth * crop.width;
    const cropHeight = this.imageHeight * crop.height;
    const imageAspect = quarterTurn ? cropHeight / cropWidth : cropWidth / cropHeight;
    const canvasAspect = width / height;
    let drawWidth = width;
    let drawHeight = height;
    if (imageAspect > canvasAspect) drawHeight = Math.round(width / imageAspect);
    else drawWidth = Math.round(height * imageAspect);
    const viewportX = Math.round((width - drawWidth) / 2);
    const viewportY = Math.round((height - drawHeight) / 2);
    gl.viewport(viewportX, viewportY, drawWidth, drawHeight);
    const layout = { x: viewportX / ratio, y: viewportY / ratio, width: drawWidth / ratio, height: drawHeight / ratio };
    if (!this.lastLayout || Object.keys(layout).some((key) => (
      Math.abs(layout[key as keyof PreviewLayout] - this.lastLayout![key as keyof PreviewLayout]) > 0.1
    ))) {
      this.lastLayout = layout;
      this.onLayout?.(layout);
    }

    const uniforms = toPreviewUniforms(this.recipe.basic);
    const detail = this.recipe.detail;
    const geometry = this.recipe.geometry;
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
    setUniform1i(gl, this.program, "u_image", 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curveTexture);
    setUniform1i(gl, this.program, "u_curve", 1);
    setUniform2f(gl, this.program, "u_texel_size", 1 / this.imageWidth, 1 / this.imageHeight);
    setUniform4f(gl, this.program, "u_crop", crop.x, crop.y, crop.width, crop.height);
    setUniform1f(gl, this.program, "u_crop_aspect", cropWidth / cropHeight);
    setUniform1f(gl, this.program, "u_rotation", geometry.rotation);
    setUniform1f(gl, this.program, "u_straighten", geometry.straighten);
    setUniform1i(gl, this.program, "u_flip_horizontal", geometry.flipHorizontal ? 1 : 0);
    setUniform1i(gl, this.program, "u_flip_vertical", geometry.flipVertical ? 1 : 0);
    for (const [name, value] of Object.entries(uniforms)) setUniform1f(gl, this.program, `u_${name}`, value);
    const hslValues = new Float32Array(HSL_CHANNELS.flatMap((name) => {
      const channel = this.recipe.hsl[name];
      return [channel.hue / 100, channel.saturation / 100, channel.luminance / 100];
    }));
    setUniform3fv(gl, this.program, "u_hsl[0]", hslValues);
    setUniform1f(gl, this.program, "u_sharpening_amount", detail.sharpeningAmount / 100);
    setUniform1f(gl, this.program, "u_sharpening_radius", detail.sharpeningRadius);
    setUniform1f(gl, this.program, "u_sharpening_detail", detail.sharpeningDetail / 100);
    setUniform1f(gl, this.program, "u_luminance_noise", detail.luminanceNoiseReduction / 100);
    setUniform1f(gl, this.program, "u_color_noise", detail.colorNoiseReduction / 100);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.flush();
    this.reportMetrics(frameStartedAt);
  }

  private reportMetrics(frameStartedAt: number): void {
    const now = performance.now();
    if (this.lastFrameAt > 0) {
      const interval = now - this.lastFrameAt;
      if (interval < 250) {
        this.frameIntervals.push(interval);
        if (this.frameIntervals.length > 30) this.frameIntervals.shift();
      } else this.frameIntervals.length = 0;
    }
    this.lastFrameAt = now;
    const average = this.frameIntervals.length
      ? this.frameIntervals.reduce((sum, value) => sum + value, 0) / this.frameIntervals.length
      : 0;
    const fps = average > 0 ? Math.round(1000 / average) : 0;
    requestAnimationFrame(() => this.onMetrics?.({
      fps,
      frameLatencyMs: performance.now() - (this.scheduledAt || frameStartedAt),
    }));
  }
}

function createTexture(gl: WebGL2RenderingContext, filter: number): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("无法创建 GPU 图像纹理。");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function verifyHalfFloatTexture(gl: WebGL2RenderingContext, texture: WebGLTexture): void {
  for (let attempt = 0; attempt < 8 && gl.getError() !== gl.NO_ERROR; attempt += 1) { /* clear */ }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 1, 1, 0, gl.RGBA, gl.HALF_FLOAT, new Uint16Array([0, 0, 0, 0x3c00]));
  if (gl.getError() !== gl.NO_ERROR) throw new Error("当前 GPU 无法创建 RGBA16F 预览纹理。");
}

function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("无法创建 GPU 调色程序。");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`GPU 调色程序链接失败：${gl.getProgramInfoLog(program) ?? "未知错误"}`);
  return program;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("无法创建 GPU shader。");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "未知错误";
    gl.deleteShader(shader);
    throw new Error(`GPU shader 编译失败：${message}`);
  }
  return shader;
}

function uniform(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (location === null) throw new Error(`GPU 参数不存在：${name}`);
  return location;
}

function setUniform1f(gl: WebGL2RenderingContext, program: WebGLProgram, name: string, value: number): void {
  gl.uniform1f(uniform(gl, program, name), value);
}
function setUniform1i(gl: WebGL2RenderingContext, program: WebGLProgram, name: string, value: number): void {
  gl.uniform1i(uniform(gl, program, name), value);
}
function setUniform2f(gl: WebGL2RenderingContext, program: WebGLProgram, name: string, x: number, y: number): void {
  gl.uniform2f(uniform(gl, program, name), x, y);
}
function setUniform4f(gl: WebGL2RenderingContext, program: WebGLProgram, name: string, x: number, y: number, z: number, w: number): void {
  gl.uniform4f(uniform(gl, program, name), x, y, z, w);
}
function setUniform3fv(gl: WebGL2RenderingContext, program: WebGLProgram, name: string, values: Float32Array): void {
  gl.uniform3fv(uniform(gl, program, name), values);
}
