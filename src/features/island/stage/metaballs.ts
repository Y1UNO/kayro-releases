import { FULL_VERTEX, makeProgram, makeQuad, type Program } from "../../../fx/gpu/gl";
import type { Box } from "./motion";

/**
 * Kysland's « Dancing »: the black drops drawn as one ink, merged where they meet (a smooth union
 * of their distances, on the graphics card, WebGL2). Only the box around them is drawn (scissor);
 * each frame starts from a cleared canvas (nothing stale can stay). A thin glint lights the ink's
 * edge from the top left (none in Éco). Its canvas is its own, made for the show under the page's
 * and removed after it (a canvas keeps its context, lost or not: never reused). The context lost
 * or refused, `draw` says so and the page draws plain circles instead; too slow, it draws at a
 * lower resolution. Logical px of the stage.
 */

/** The drops, and the ball they burst from or gather into. */
export const MAX_DROPS = 25;

const FRAGMENT = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes;
uniform float uSc;
uniform float uK;
uniform float uGloss;
uniform float uAlpha;
uniform vec3 uB[${MAX_DROPS}];
uniform int uN;
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uSc;
  float d = 1e5;
  for (int i = 0; i < ${MAX_DROPS}; i++) {
    if (i >= uN) break;
    vec3 b = uB[i];
    if (b.z < 0.5) continue;
    d = smin(d, length(p - b.xy) - b.z, uK);
  }
  vec2 g = vec2(dFdx(d), dFdy(d));
  float gn = length(g);
  vec2 n = gn > 1e-6 ? g / gn : vec2(0.0);
  float px = d * uSc;
  float a = clamp(0.5 - px / 1.2, 0.0, 1.0);
  float band = exp(-pow((px + 2.4) / 1.7, 2.0));
  float lit = uGloss * band * pow(max(dot(n, vec2(-0.6, 0.8)), 0.0), 1.5) * 0.4;
  a *= uAlpha;
  o = vec4(vec3(lit) * a, a);
}
`;

const UNIFORMS = ["uRes", "uSc", "uK", "uGloss", "uAlpha", "uB", "uN"] as const;

export class Metaballs {
  /** A canvas of its own under `page` (the stage's 2D canvas), as big as it; null without WebGL2. */
  static under(
    page: HTMLCanvasElement,
    W: number,
    H: number,
    dpr: number,
    gloss: boolean,
  ): Metaballs | null {
    const host = page.parentElement;
    if (!host) return null;
    const c = document.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    c.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
    host.insertBefore(c, page);
    const m = new Metaballs(c, W, H, dpr, gloss);
    if (m.gl) return m;
    m.dispose();
    return null;
  }

  private gl: WebGL2RenderingContext | null = null;
  private prog: Program | null = null;
  private quad: WebGLVertexArrayObject | null = null;
  private lost = false;
  private res = 1;
  private drawn = false;
  private readonly data = new Float32Array(3 * MAX_DROPS);

  constructor(
    private canvas: HTMLCanvasElement,
    private W: number,
    private H: number,
    private dpr: number,
    private gloss: boolean,
  ) {
    canvas.addEventListener("webglcontextlost", this.onLost);
    canvas.addEventListener("webglcontextrestored", this.onRestored);
    this.size();
    this.gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    this.init();
  }

  /** Drawn on the graphics card (else the page draws circles). */
  get ok(): boolean {
    return this.prog !== null && this.quad !== null && !this.lost;
  }

  /** Too slow: drawn at a lower resolution from now on. */
  lower(): void {
    if (this.res < 1) return;
    this.res = 0.6;
    this.size();
  }

  private size(): void {
    const k = this.dpr * this.res;
    this.canvas.width = Math.max(1, Math.round(this.W * k));
    this.canvas.height = Math.max(1, Math.round(this.H * k));
  }

  private init(): void {
    const gl = this.gl;
    if (!gl || gl.isContextLost()) return;
    this.prog = makeProgram(gl, FULL_VERTEX, FRAGMENT, UNIFORMS);
    this.quad = makeQuad(gl);
  }

  /**
   * Draws `n` drops (x, y, r in `drops`), merged over `k` px, inside `box` only, at `alpha`:
   * false if it cannot (the page draws them itself).
   */
  draw(drops: Float32Array, n: number, k: number, box: Box, alpha = 1): boolean {
    const { gl, prog, quad } = this;
    if (!gl || !prog || !quad || this.lost) return false;
    const [cw, ch] = [this.canvas.width, this.canvas.height];
    const sc = this.dpr * this.res;
    gl.viewport(0, 0, cw, ch);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const x0 = Math.max(0, Math.floor(box.x0 * sc));
    const y0 = Math.max(0, Math.floor(box.y0 * sc));
    const x1 = Math.min(cw, Math.ceil(box.x1 * sc));
    const y1 = Math.min(ch, Math.ceil(box.y1 * sc));
    this.drawn = true;
    if (x1 <= x0 || y1 <= y0 || n <= 0) return true;
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x0, ch - y1, x1 - x0, y1 - y0);
    gl.useProgram(prog.program);
    this.data.fill(0);
    this.data.set(drops.subarray(0, 3 * Math.min(n, MAX_DROPS)));
    gl.uniform2f(prog.loc.uRes!, cw, ch);
    gl.uniform1f(prog.loc.uSc!, sc);
    gl.uniform1f(prog.loc.uK!, k);
    gl.uniform1f(prog.loc.uGloss!, this.gloss ? 1 : 0);
    gl.uniform1f(prog.loc.uAlpha!, alpha);
    gl.uniform3fv(prog.loc.uB!, this.data);
    gl.uniform1i(prog.loc.uN!, Math.min(n, MAX_DROPS));
    gl.bindVertexArray(quad);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.disable(gl.SCISSOR_TEST);
    return true;
  }

  /** Nothing drawn any more (once: the canvas keeps its last frame otherwise). */
  clear(): void {
    const gl = this.gl;
    if (!gl || !this.drawn || this.lost) return;
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.drawn = false;
  }

  dispose(): void {
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    const gl = this.gl;
    if (gl && !gl.isContextLost()) {
      if (this.prog) gl.deleteProgram(this.prog.program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    [this.gl, this.prog, this.quad] = [null, null, null];
    // The canvas as big as the screen lets its memory go, and leaves the page.
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.canvas.remove();
  }

  private onLost = (e: Event): void => {
    e.preventDefault();
    this.lost = true;
    [this.prog, this.quad] = [null, null];
  };

  private onRestored = (): void => {
    this.lost = false;
    this.init();
  };
}
