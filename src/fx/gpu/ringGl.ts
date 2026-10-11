import type { Quality } from "../../design";
import { budgetFor, ECO_MAX_FPS, fxFps } from "../budget";
import { pingPong } from "../css/drift";
import type { FxLayer, FxPalette, FxParams } from "../FxLayer";
import { frameLoop, type FrameLoop } from "../loop";
import { prefersReducedMotion } from "../motionPref";
import { FRAGMENT, VERTEX } from "./ringShader";

/**
 * Crystal ring drawn with WebGL2 (art direction element `ringGpu`, step 12b spike): a glass tube
 * that really refracts the lights behind it (see ringShader.ts). Geometry comes from the CSS
 * ring's values (`crystalRing`), so both versions match and can be compared.
 *
 * While it draws, it sets `data-gpu-ring` on the atmosphere host, which hides the CSS ring
 * (Ring.module.css). Automatic fallback to the CSS ring: no WebGL2, context lost, or the frame
 * budget missed (more than a quarter of the last 120 ticks later than 1.5 × their interval).
 */

type Values = Readonly<Record<string, number | boolean | string>>;
const num = (v: Values | undefined, k: string, d: number) =>
  typeof v?.[k] === "number" ? (v[k] as number) : d;

/** Room around the ring for the glow (CSS px). */
const MARGIN = 40;
const WINDOW = 120;
const SCALE: Record<string, number> = { high: 1, balanced: 0.75, eco: 0.5 };

const UNIFORMS = [
  "uRes",
  "uOrigin",
  "uPx",
  "uView",
  "uRing",
  "uBg0",
  "uBg1",
  "uBg2",
  "uRadial",
  "uA",
  "uB",
  "uMoon",
  "uVeilA",
  "uVeilB",
  "uVeil",
  "uP",
  "uE",
  "uMouse",
] as const;
type Uniform = (typeof UNIFORMS)[number];

function rgb01(css: string): [number, number, number] {
  const m = css.match(/[\d.]+/g);
  if (!m || m.length < 3) return [0, 0, 0];
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
}

export class RingGlLayer implements FxLayer {
  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private loc = {} as Record<Uniform, WebGLUniformLocation | null>;
  private params: FxParams = {};
  private palette: FxPalette | null = null;
  private quality: Quality = "balanced";
  private wanted = false;
  /** Why the CSS ring is shown instead (null = the GPU ring is drawing or not wanted). */
  private fallback: string | null = null;
  private fps = 60;
  private paused = false;
  private time = 0;
  private mouse: [number, number] = [0, 0];
  private ticks = new Float32Array(WINDOW);
  private tickIndex = 0;
  private bg: [number, number, number][] = [];
  private unsubscribe: (() => void) | null = null;
  private readonly onPointer = (e: PointerEvent) => {
    this.mouse = [e.clientX, e.clientY];
  };
  private readonly onResize = () => this.layout();
  private readonly onLost = (e: Event) => {
    e.preventDefault();
    this.fail("contexte WebGL perdu");
  };

  constructor(private readonly loop: FrameLoop = frameLoop()) {}

  mount(host: HTMLElement): void {
    this.host = host;
    this.mouse = [window.innerWidth / 2, 0];
    this.apply();
  }

  setParams(p: FxParams): void {
    this.params = p;
    this.apply();
  }

  setQuality(quality: Quality): void {
    this.quality = quality;
    this.apply();
  }

  setPalette(palette: FxPalette): void {
    this.palette = palette;
    this.readBackground();
    // The theme cross-fades for 0.9 s: read the background again once it has settled.
    window.setTimeout(() => this.readBackground(), 1000);
  }

  setIntensity(): void {}

  setFocusTarget(): void {}

  pause(): void {
    this.paused = true;
    this.stop();
  }

  resume(): void {
    this.paused = false;
    this.start();
  }

  dispose(): void {
    this.teardown();
    this.host = null;
  }

  private apply(): void {
    const on = this.params.ringGpu?.on === true;
    if (on !== this.wanted) {
      this.wanted = on;
      this.fallback = null;
      if (!on) this.teardown();
    }
    if (!this.wanted || this.fallback || !this.host) return;
    if (!this.gl && !this.create()) return;
    const q = String(this.params.ringGpu?.quality ?? "high");
    const b = budgetFor(this.quality, prefersReducedMotion());
    this.fps = q === "eco" ? ECO_MAX_FPS : fxFps(b);
    this.layout();
    this.stop();
    this.start();
  }

  private create(): boolean {
    const host = this.host!;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;pointer-events:none";
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false });
    if (!gl) {
      this.fail("WebGL2 indisponible");
      return false;
    }
    const program = link(gl);
    if (!program) {
      this.fail("shader refusé");
      return false;
    }
    gl.useProgram(program);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    for (const u of UNIFORMS) this.loc[u] = gl.getUniformLocation(program, u);
    canvas.addEventListener("webglcontextlost", this.onLost);
    host.appendChild(canvas);
    host.dataset.gpuRing = "";
    window.addEventListener("pointermove", this.onPointer, { passive: true });
    window.addEventListener("resize", this.onResize);
    this.canvas = canvas;
    this.gl = gl;
    this.ticks.fill(0);
    this.readBackground();
    return true;
  }

  private fail(reason: string): void {
    console.warn(`GPU ring: CSS fallback (${reason})`);
    this.fallback = reason;
    this.teardown();
    if (this.host) this.host.dataset.gpuRingFallback = reason;
  }

  private teardown(): void {
    this.stop();
    window.removeEventListener("pointermove", this.onPointer);
    window.removeEventListener("resize", this.onResize);
    this.canvas?.removeEventListener("webglcontextlost", this.onLost);
    this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
    this.canvas?.remove();
    this.canvas = this.gl = null;
    if (this.host) {
      delete this.host.dataset.gpuRing;
      if (!this.fallback) delete this.host.dataset.gpuRingFallback;
    }
  }

  private readBackground(): void {
    const s = getComputedStyle(document.documentElement);
    this.bg = ["--bg-top", "--bg-mid", "--bg-bottom"].map((n) => rgb01(s.getPropertyValue(n)));
  }

  /** Ring geometry (same as the CSS ring), canvas box and resolution. */
  private layout(): void {
    const { canvas, gl } = this;
    if (!canvas || !gl) return;
    const c = this.params.crystalRing;
    const size = num(c, "size", 680);
    const box = size + 2 * MARGIN;
    const left = window.innerWidth / 2 + num(c, "offsetX", 0) - box / 2;
    const top = num(c, "top", -230) - MARGIN;
    const scale = SCALE[String(this.params.ringGpu?.quality ?? "high")] ?? 1;
    const dpr = Math.min(2, window.devicePixelRatio || 1) * scale;
    canvas.style.left = `${left}px`;
    canvas.style.top = `${top}px`;
    canvas.style.width = canvas.style.height = `${box}px`;
    canvas.width = canvas.height = Math.round(box * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  private start(): void {
    if (this.unsubscribe || this.paused || !this.gl) return;
    this.unsubscribe = this.loop.subscribe((dt) => this.frame(dt), this.fps);
  }

  private stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private frame(dt: number): void {
    // Budget watch: a capped subscriber normally ticks every 1000/fps ms.
    this.ticks[this.tickIndex++ % WINDOW] = dt;
    if (this.tickIndex >= WINDOW && this.tickIndex % 30 === 0) {
      const late = this.ticks.filter((t) => t > 1.5 * (1000 / this.fps)).length;
      if (late > WINDOW / 4) return this.fail(`budget d'image dépassé (${late}/${WINDOW})`);
    }
    this.time += dt;
    this.draw();
  }

  private draw(): void {
    const { gl, canvas, palette, loc } = this;
    if (!gl || !canvas || !palette) return;
    const p = this.params;
    const ring = p.crystalRing;
    const g = p.ringGpu;
    const moon = p.moonHalo;
    const veils = p.veils;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const size = num(ring, "size", 680);
    const box = size + 2 * MARGIN;
    const left = W / 2 + num(ring, "offsetX", 0) - box / 2;
    const top = num(ring, "top", -230) - MARGIN;
    const moving = budgetFor(this.quality, prefersReducedMotion()).fog === "animated";
    const t = moving ? this.time : 0;
    const period = num(ring, "period", 40) * 1000;
    const amp = veils?.on ? num(veils, "amplitude", 80) : 0;
    const ua = moving ? pingPong(t, num(veils, "periodA", 30) * 1000) : 0;
    const ub = moving ? pingPong(t, num(veils, "periodB", 36) * 1000) : 0;
    const mSize = num(moon, "size", 600);
    const [b0, b1, b2] = this.bg;
    const a = palette.a.map((x) => x / 255) as [number, number, number];
    const b = palette.b.map((x) => x / 255) as [number, number, number];

    gl.uniform2f(loc.uRes, canvas.width, canvas.height);
    gl.uniform2f(loc.uOrigin, left, top);
    gl.uniform1f(loc.uPx, box / canvas.width);
    gl.uniform2f(loc.uView, W, H);
    gl.uniform4f(
      loc.uRing,
      W / 2 + num(ring, "offsetX", 0),
      top + MARGIN + size / 2,
      size / 2,
      num(ring, "band", 12),
    );
    if (b0 && b1 && b2) {
      gl.uniform3f(loc.uBg0, ...b0);
      gl.uniform3f(loc.uBg1, ...b1);
      gl.uniform3f(loc.uBg2, ...b2);
    }
    gl.uniform1f(loc.uRadial, p.backdrop?.on !== false && p.backdrop?.shape !== "lineaire" ? 1 : 0);
    gl.uniform3f(loc.uA, ...a);
    gl.uniform3f(loc.uB, ...b);
    gl.uniform4f(
      loc.uMoon,
      W / 2,
      num(moon, "top", -170) + mSize / 2,
      mSize / 2,
      moon?.on ? num(moon, "intensity", 0.34) : 0,
    );
    gl.uniform4f(
      loc.uVeilA,
      W / 2 + (-amp + 2 * amp * ua),
      (num(veils, "topA", 43) / 100 + 0.145) * H,
      0.66 * W,
      0.145 * H,
    );
    gl.uniform4f(
      loc.uVeilB,
      W / 2 + (amp - 2 * amp * ub),
      (num(veils, "topB", 60) / 100 + 0.16) * H,
      0.66 * W,
      0.16 * H,
    );
    gl.uniform4f(
      loc.uVeil,
      (-6 * Math.PI) / 180,
      (5 * Math.PI) / 180,
      veils?.on ? num(veils, "intensityA", 0.16) : 0,
      veils?.on ? num(veils, "intensityB", 0.14) : 0,
    );
    gl.uniform4f(
      loc.uP,
      num(g, "refraction", 0.5),
      num(g, "dispersion", 0.35),
      num(g, "blur", 0),
      num(g, "spec", 0.8),
    );
    gl.uniform4f(
      loc.uE,
      num(ring, "edge", 0.42),
      num(ring, "fringe", 0.5),
      num(ring, "glow", 0.18),
      (2 * Math.PI * (t % period)) / period,
    );
    gl.uniform2f(loc.uMouse, this.mouse[0], this.mouse[1]);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

function link(gl: WebGL2RenderingContext): WebGLProgram | null {
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const vs = shader(gl.VERTEX_SHADER, VERTEX);
  const fs = shader(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}
