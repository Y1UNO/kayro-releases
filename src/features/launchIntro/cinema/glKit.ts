/**
 * Shared pieces of the launch scenes (30/10): their setup, their own canvas and context, instanced
 * quads, textures, and the little pinhole camera whose screen is the card's plane (a point of the
 * card's plane lands where it is on screen; deeper points shrink towards the card's centre).
 */
export interface CinemaSetup {
  /** Where the scene's own canvas goes (it is removed with the scene). */
  host: HTMLElement;
  /** The card on screen when the sequence starts (CSS px). */
  rect: { x: number; y: number; w: number; h: number };
  /** The game's colours, 0–1. */
  a: readonly [number, number, number];
  b: readonly [number, number, number];
  poster: string | null;
  eco: boolean;
}

export type Vec3 = [number, number, number];

/** Stable pseudo-random numbers in [0, 1) (no Math.random: the same scene every time). */
export const hash = (i: number, k: number) => Math.abs(Math.sin(i * k) * 43758.5453) % 1;
export const rad = (deg: number) => (deg * Math.PI) / 180;

/** A canvas of the scene's own, over the hub, and its WebGL2 context (null if refused). */
export function sceneCanvas(): { canvas: HTMLCanvasElement; gl: WebGL2RenderingContext } | null {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  return gl ? { canvas, gl } : null;
}

/** The window in CSS px and the backing scale (× device pixels, lower in Eco); sizes the canvas. */
export function fitCanvas(canvas: HTMLCanvasElement, res: number) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const scale = Math.min(1.5, window.devicePixelRatio || 1) * res;
  canvas.width = Math.max(1, Math.round(W * scale));
  canvas.height = Math.max(1, Math.round(H * scale));
  return { W, H, scale };
}

/** Screen position (CSS px) and scale of a world point, for a camera `P` px in front of the card. */
export function project(
  rect: CinemaSetup["rect"],
  x: number,
  y: number,
  z: number,
  P: number,
): Vec3 {
  const k = P / Math.max(1, P + z);
  return [rect.x + rect.w / 2 + x * k, rect.y + rect.h / 2 + y * k, k];
}

/** Instanced quads (`aPos` corners, then per-instance vec4s) on one dynamic buffer. */
export function instanced(gl: WebGL2RenderingContext, max: number, vec4s: number) {
  const vao = gl.createVertexArray()!;
  const corners = gl.createBuffer();
  const inst = gl.createBuffer()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, inst);
  gl.bufferData(gl.ARRAY_BUFFER, max * vec4s * 16, gl.DYNAMIC_DRAW);
  for (let i = 0; i < vec4s; i++) {
    gl.enableVertexAttribArray(1 + i);
    gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, vec4s * 16, i * 16);
    gl.vertexAttribDivisor(1 + i, 1);
  }
  gl.bindVertexArray(null);
  return { vao, inst, data: new Float32Array(max * vec4s * 4) };
}

export type Instanced = ReturnType<typeof instanced>;

/** Uploads `count` instances and draws them. */
export function drawInstanced(
  gl: WebGL2RenderingContext,
  set: Instanced,
  count: number,
  vec4s: number,
) {
  if (count <= 0) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, set.inst);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, set.data, 0, count * vec4s * 4);
  gl.bindVertexArray(set.vao);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
}

export function makeTexture(
  gl: WebGL2RenderingContext,
  src: TexImageSource,
  mips: boolean,
): WebGLTexture | null {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  if (mips) gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
