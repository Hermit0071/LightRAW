import type { BasicAdjustments } from "../editor/basic-adjustments";
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
uniform float u_temperature;
uniform float u_tint;
uniform float u_exposure;
uniform float u_contrast;
uniform float u_highlights;
uniform float u_shadows;
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

vec3 apply_white_balance(vec3 color) {
  // Temperature shifts red against blue; tint shifts green against magenta.
  // Exponential gains remain positive and preserve neutral zero values.
  vec3 gains = exp2(vec3(
    u_temperature * 0.45 + u_tint * 0.12,
    -u_tint * 0.28,
    -u_temperature * 0.45 + u_tint * 0.12
  ));
  return color * gains;
}

float adjust_zone(float value, float amount, float mask) {
  if (amount >= 0.0) {
    return value + (1.0 - value) * amount * mask * 0.72;
  }
  return value + value * amount * mask * 0.72;
}

vec3 apply_tone(vec3 color) {
  float before = max(luminance(color), 0.00001);
  float value = before;
  float shadow_mask = 1.0 - smoothstep(0.06, 0.58, value);
  float highlight_mask = smoothstep(0.28, 0.95, value);
  value = adjust_zone(value, u_shadows, shadow_mask);
  value = adjust_zone(value, u_highlights, highlight_mask);
  return color * max(value, 0.0) / before;
}

void main() {
  vec4 source = texture(u_image, v_uv);
  vec3 color = apply_white_balance(source.rgb);
  color *= exp2(u_exposure);
  color = apply_tone(color);

  // Contrast pivots around photographic middle grey in linear light.
  float slope = exp2(u_contrast);
  color = max((color - 0.18) * slope + 0.18, vec3(0.0));
  out_color = vec4(linear_to_srgb(color), source.a);
}`;

export class PreviewRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly texture: WebGLTexture;
  private readonly resizeObserver: ResizeObserver;
  private adjustments: BasicAdjustments;
  private imageWidth = 0;
  private imageHeight = 0;
  private frameRequest = 0;

  constructor(canvas: HTMLCanvasElement, initial: BasicAdjustments) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      throw new Error("当前设备不支持 WebGL 2，无法启动 GPU 预览。");
    }
    this.gl = gl;
    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error("无法创建 GPU 图像纹理。");
    }
    this.texture = texture;
    this.adjustments = initial;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    this.resizeObserver = new ResizeObserver(() => this.scheduleRender());
    this.resizeObserver.observe(canvas);
  }

  setImage(width: number, height: number, pixels: Uint8Array): void {
    if (pixels.byteLength !== width * height * 4 * 2) {
      throw new Error("解码后的预览缓冲区尺寸不正确。");
    }
    this.imageWidth = width;
    this.imageHeight = height;
    const data = new Uint16Array(
      pixels.buffer,
      pixels.byteOffset,
      pixels.byteLength / Uint16Array.BYTES_PER_ELEMENT,
    );
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA16F,
      width,
      height,
      0,
      gl.RGBA,
      gl.HALF_FLOAT,
      data,
    );
    this.scheduleRender();
  }

  setAdjustments(adjustments: BasicAdjustments): void {
    this.adjustments = adjustments;
    this.scheduleRender();
  }

  destroy(): void {
    cancelAnimationFrame(this.frameRequest);
    this.resizeObserver.disconnect();
    this.gl.deleteTexture(this.texture);
    this.gl.deleteProgram(this.program);
  }

  private scheduleRender(): void {
    if (this.frameRequest !== 0) {
      return;
    }
    this.frameRequest = requestAnimationFrame(() => {
      this.frameRequest = 0;
      this.render();
    });
  }

  private render(): void {
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
      return;
    }

    const imageAspect = this.imageWidth / this.imageHeight;
    const canvasAspect = width / height;
    let drawWidth = width;
    let drawHeight = height;
    if (imageAspect > canvasAspect) {
      drawHeight = Math.round(width / imageAspect);
    } else {
      drawWidth = Math.round(height * imageAspect);
    }
    gl.viewport(
      Math.round((width - drawWidth) / 2),
      Math.round((height - drawHeight) / 2),
      drawWidth,
      drawHeight,
    );

    const uniforms = toPreviewUniforms(this.adjustments);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    setUniform(gl, this.program, "u_image", 0, true);
    setUniform(gl, this.program, "u_temperature", uniforms.temperature);
    setUniform(gl, this.program, "u_tint", uniforms.tint);
    setUniform(gl, this.program, "u_exposure", uniforms.exposure);
    setUniform(gl, this.program, "u_contrast", uniforms.contrast);
    setUniform(gl, this.program, "u_highlights", uniforms.highlights);
    setUniform(gl, this.program, "u_shadows", uniforms.shadows);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("无法创建 GPU 调色程序。");
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`GPU 调色程序链接失败：${gl.getProgramInfoLog(program) ?? "未知错误"}`);
  }
  return program;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("无法创建 GPU shader。");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "未知错误";
    gl.deleteShader(shader);
    throw new Error(`GPU shader 编译失败：${message}`);
  }
  return shader;
}

function setUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  value: number,
  integer = false,
): void {
  const location = gl.getUniformLocation(program, name);
  if (location === null) {
    throw new Error(`GPU 参数不存在：${name}`);
  }
  if (integer) {
    gl.uniform1i(location, value);
  } else {
    gl.uniform1f(location, value);
  }
}
