import type { Box } from "./motion";
import type { Palette } from "./palette";
import { FS_FINAL, FS_LIGHT, UNIFORMS, VS } from "./shaders";
import type { Uniforms } from "./uniforms";

/**
 * Kysland's music mode: the lab's two WebGL2 passes on a canvas of their own, under the page's
 * 2D one (made for the show, removed after it: a canvas keeps its context, lost or not). The
 * light (halo, rays, waves, strings) at half resolution into a float texture, ping-pong with the
 * previous one shrunk, zoomed and turned (the trails: `max(previous × decay, now)`); then the
 * final image (the ink in the island's black, glossy only if asked; the cover in its core; the
 * light around it), transparent
 * (premultiplied), only inside the box that matters. Trails are corrected for the frame time
 * (`pow(x, dt·60)`): the same at 60, 144 or 280 Hz. Logical px of the stage.
 */

interface Program {
  p: WebGLProgram;
  loc: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
}

interface Target {
  t: WebGLTexture;
  f: WebGLFramebuffer;
  w: number;
  h: number;
}

/** What the passes need besides the scene: the look, the music's state for the trails. */
export interface Frame {
  U: Uniforms;
  pal: Palette;
  gloss: number;
  trails: number;
  bass: number;
  crash: number;
  kick: number;
  crashNow: number;
  tail: number;
  build: number;
  turn: number;
  /** The light and the gloss (0–1): faded in and out at the swaps. */
  lit: number;
  time: number;
  dt: number;
  /** Only this box is drawn (logical px). */
  box: Box;
}

export class Renderer {
  /** A canvas of its own under `page`, as big as it; null without WebGL2. */
  static under(page: HTMLCanvasElement): Renderer | null {
    const host = page.parentElement;
    if (!host) return null;
    const c = document.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    c.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
    host.insertBefore(c, page);
    const gl = c.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    try {
      if (gl) return new Renderer(c, gl);
    } catch (e) {
      console.warn(e);
    }
    c.remove();
    return null;
  }

  lost = false;
  private PL: Program;
  private PF: Program;
  private vao: WebGLVertexArrayObject | null;
  private fa: Target | null = null;
  private fb: Target | null = null;
  private hasF: boolean;
  private coverTex: WebGLTexture | null;
  private W = 1;
  private H = 1;

  private constructor(
    private canvas: HTMLCanvasElement,
    private gl: WebGL2RenderingContext,
  ) {
    this.PL = this.program(FS_LIGHT);
    this.PF = this.program(FS_FINAL);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.hasF = Boolean(
      gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"),
    );
    this.coverTex = gl.createTexture();
    canvas.addEventListener("webglcontextlost", this.onLost);
  }

  private program(fs: string): Program {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "a");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p) ?? "link");
    const loc = {} as Program["loc"];
    for (const n of UNIFORMS) loc[n] = gl.getUniformLocation(p, n);
    return { p, loc };
  }

  private target(w: number, h: number): Target {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    const F = this.hasF;
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      F ? gl.RGBA16F : gl.RGBA8,
      w,
      h,
      0,
      gl.RGBA,
      F ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
      null,
    );
    for (const [k, v] of [
      [gl.TEXTURE_MIN_FILTER, gl.LINEAR],
      [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
    ] as const) {
      gl.texParameteri(gl.TEXTURE_2D, k, v);
    }
    const f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && F) {
      gl.deleteFramebuffer(f);
      gl.deleteTexture(t);
      this.hasF = false;
      return this.target(w, h);
    }
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { t, f, w, h };
  }

  private drop(x: Target | null): void {
    if (!x) return;
    this.gl.deleteFramebuffer(x.f);
    this.gl.deleteTexture(x.t);
  }

  /** The stage `W` × `H` (logical) drawn at `scale` device px per logical px. */
  resize(W: number, H: number, scale: number): void {
    [this.W, this.H] = [W, H];
    const w = Math.max(2, Math.round(W * scale));
    const h = Math.max(2, Math.round(H * scale));
    if (this.canvas.width !== w || this.canvas.height !== h)
      [this.canvas.width, this.canvas.height] = [w, h];
  }

  /** The cover (a square image, 256 px is plenty) into its texture. */
  cover(src: TexImageSource): void {
    const gl = this.gl;
    if (this.lost) return;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.coverTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
  }

  private up(P: Program, rw: number, rh: number, px: number, F: Frame): void {
    const gl = this.gl;
    const { loc } = P;
    const { U, pal } = F;
    gl.uniform2f(loc.uRes, rw, rh);
    gl.uniform1f(loc.uPx, px);
    gl.uniform2f(loc.uSize, this.W, this.H);
    gl.uniform1f(loc.uTime, F.time);
    gl.uniform4fv(loc.uBalls, U.balls);
    gl.uniform1i(loc.uN, U.n);
    gl.uniform4fv(loc.uSegA, U.segA);
    gl.uniform4fv(loc.uSegB, U.segB);
    gl.uniform1i(loc.uNS, U.ns);
    gl.uniform1f(loc.uK, U.k);
    gl.uniform4fv(loc.uCore, U.core);
    gl.uniform4fv(loc.uModeA, U.modeA);
    gl.uniform4fv(loc.uModeP, U.modeP);
    gl.uniform4fv(loc.uRipple, U.ripple);
    gl.uniform2fv(loc.uShear, U.shear);
    gl.uniform4fv(loc.uIsle, U.isle);
    gl.uniform4fv(loc.uIsleR, U.isleR);
    gl.uniform3fv(loc.uC1, pal.c1);
    gl.uniform3fv(loc.uC2, pal.c2);
    gl.uniform4fv(loc.uHalo, U.halo);
    gl.uniform4fv(loc.uRings, U.rings);
    gl.uniform4fv(loc.uPk, U.pk);
    gl.uniform1i(loc.uNPk, U.npk);
    gl.uniform4fv(loc.uWaveA, U.waveA);
    gl.uniform4fv(loc.uWaveB, U.waveB);
    gl.uniform1i(loc.uNW, U.nw);
    gl.uniform1f(loc.uFlash, U.flash);
    gl.uniform1f(loc.uCA, U.ca);
    gl.uniform1f(loc.uGloss, F.gloss);
    gl.uniform1f(loc.uBuild, F.build);
    gl.uniform2fv(loc.uShake, U.shake);
    gl.uniform4fv(loc.uCover, U.cover);
    gl.uniform1i(loc.uCoverTex, 1);
    gl.uniform2fv(loc.uFC, U.fc);
    gl.uniform1f(loc.uLit, F.lit);
    gl.uniform1f(loc.uFade, U.fade);
  }

  render(F: Frame): void {
    const gl = this.gl;
    if (this.lost || gl.isContextLost()) return;
    const [w, h] = [this.canvas.width, this.canvas.height];
    const lw = Math.max(2, Math.ceil(w * 0.5));
    const lh = Math.max(2, Math.ceil(h * 0.5));
    if (!this.fa || this.fa.w !== lw || this.fa.h !== lh) {
      this.drop(this.fa);
      this.drop(this.fb);
      [this.fa, this.fb] = [this.target(lw, lh), this.target(lw, lh)];
    }
    const [fa, fb] = [this.fa, this.fb!];
    const f = F.dt * 60;
    const decay = F.trails < 0.02 ? 0 : Math.pow(0.8 + 0.17 * F.trails, f);
    const zoom = Math.pow(
      1 + 0.003 + 0.014 * F.kick * F.bass + 0.02 * F.crashNow * F.crash - 0.024 * F.build,
      f,
    );
    const rot = (0.0015 + 0.007 * (F.crashNow + 0.4 * F.tail) * F.crash) * f * F.turn;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.SCISSOR_TEST);
    gl.useProgram(this.PL.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb.f);
    gl.viewport(0, 0, lw, lh);
    this.up(this.PL, lw, lh, lw / this.W, F);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fa.t);
    gl.uniform1i(this.PL.loc.uPrev, 0);
    gl.uniform1f(this.PL.loc.uDecay, decay);
    gl.uniform1f(this.PL.loc.uZoom, zoom);
    gl.uniform1f(this.PL.loc.uRot, rot);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Only the box that matters (the rest of the screen stays clear).
    const k = w / this.W;
    const x0 = Math.max(0, Math.floor(F.box.x0 * k));
    const y0 = Math.max(0, Math.floor(F.box.y0 * k));
    const x1 = Math.min(w, Math.ceil(F.box.x1 * k));
    const y1 = Math.min(h, Math.ceil(F.box.y1 * k));
    if (x1 > x0 && y1 > y0) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(x0, h - y1, x1 - x0, y1 - y0);
      gl.useProgram(this.PF.p);
      this.up(this.PF, w, h, k, F);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fb.t);
      gl.uniform1i(this.PF.loc.uLight, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.SCISSOR_TEST);
    }
    [this.fa, this.fb] = [fb, fa];
  }

  /** Nothing shown (a cleared frame). */
  clear(): void {
    const gl = this.gl;
    if (this.lost || gl.isContextLost()) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  dispose(): void {
    const gl = this.gl;
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    if (!gl.isContextLost()) {
      this.drop(this.fa);
      this.drop(this.fb);
      gl.deleteProgram(this.PL.p);
      gl.deleteProgram(this.PF.p);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    [this.fa, this.fb] = [null, null];
    // The canvas as big as the screen lets its memory go, and leaves the page.
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.canvas.remove();
  }

  private onLost = (e: Event): void => {
    e.preventDefault();
    this.lost = true;
  };
}
