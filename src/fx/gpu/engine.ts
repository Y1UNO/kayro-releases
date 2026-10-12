import type { Quality } from "../../design";
import { markGlassDirty, type GlassKind } from "../../design/glass/glassRegistry";
import { budgetFor, ECO_MAX_FPS, FX_MAX_FPS, fxFps } from "../budget";
import type { FxLayer, FxPalette, FxParams } from "../FxLayer";
import { frameLoop, type FrameLoop } from "../loop";
import { prefersReducedMotion } from "../motionPref";
import { BudgetWatch } from "./budgetWatch";
import {
  cueVersion,
  introCue,
  sameIntro,
  sameRing,
  stageCue,
  type IntroFrame,
  type StageFrame,
} from "./cues";
import { rgb01 } from "./gl";
import { GlassFrame } from "./glassFrame";
import { posterPassOf, shapeUniforms } from "./glassPass";
import { PosterTextures } from "./posterTextures";
import { PointerLight } from "./pointer";
import { Renderer } from "./renderer";
import { Scene } from "./scene";
import {
  bgUniforms,
  glassUniforms,
  introVeilUniform,
  kindOn,
  kindUniform,
  kindTint,
  lightOf,
  liquidRingOn,
  parallaxPx,
  sheenPos,
  sheenUniforms,
  ringUniforms,
  spriteUniforms,
  type View,
} from "./uniforms";

/** What the engine draws, for the layers it replaces (see createFx). */
export interface EngineState {
  active: boolean;
  ring: boolean;
}

const AUTO_SCALE: Record<Quality, number> = { ultra: 1, high: 1, balanced: 0.75, eco: 0.5 };

/**
 * Liquid glass engine (art direction `glassEngine`, step 12b round 2): ONE full-window WebGL2
 * canvas under the interface. Each frame: the rich background into a texture (with the crystal
 * ring), then the glass pass that refracts it under every element registered as glass
 * (src/design/glass/glassRegistry.ts), measured in the DOM at each frame it draws.
 *
 * Cadence: ambient frames at the atmosphere's rate (60, 30 in Eco) while something drifts; the
 * display rate (≤ 144) while a glass element moves or the pointer moves, so the glass follows the
 * DOM; nothing at all when still. Fallbacks: WebGL2 missing, shader refused or context lost → the
 * CSS look of round 1, reason in `data-glass-fallback` on <html>; frames dropped → see BudgetWatch.
 */
export class GlassEngine implements FxLayer {
  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private renderer: Renderer | null = null;
  private params: FxParams = {};
  private palette: FxPalette | null = null;
  private quality: Quality = "balanced";
  private intensity = 1;
  private wanted = false;
  private failed: string | null = null;
  private paused = false;
  private dirty = true;
  private ambientFps = 60;
  private ambientSlot = -1;
  private parallax = 0;
  private reduced = false;
  private sheen = -1;
  private intro: IntroFrame | null = null;
  private stage: StageFrame | null = null;
  private cueSeen = -1;
  private bg: number[][] = [];
  private view: View = { W: 1, H: 1, w: 1, h: 1 };
  private state: EngineState = { active: false, ring: false };
  private unsubscribe: (() => void) | null = null;
  private themeTimer = 0;
  private readonly scene = new Scene();
  private readonly frame = new GlassFrame();
  private posters: PosterTextures | null = null;
  private readonly pointer = new PointerLight();
  private readonly watch = new BudgetWatch();
  private readonly onResize = () => {
    markGlassDirty();
    this.layout();
  };
  private readonly onLost = (e: Event) => {
    e.preventDefault();
    this.fail("contexte WebGL perdu");
  };

  constructor(
    private readonly onState: (s: EngineState) => void = () => {},
    private readonly loop: FrameLoop = frameLoop(),
  ) {}

  mount(host: HTMLElement): void {
    this.host = host;
    this.apply();
  }

  setParams(p: FxParams): void {
    const was = this.params.glassEngine?.on === true;
    this.params = p;
    if ((p.glassEngine?.on === true) !== was) this.watch.level = 0;
    this.watch.reset();
    markGlassDirty(); // radii and tints may come from the art direction
    this.apply();
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.apply();
  }

  setPalette(p: FxPalette): void {
    this.palette = p;
    this.readTheme();
    // An instant theme (the wave) is applied by the provider's layout effect, which runs after
    // this one in the same commit: read once more before the next frame.
    queueMicrotask(() => this.readTheme());
    // The theme cross-fades for 0.9 s: read the colours again once it has settled.
    window.clearTimeout(this.themeTimer);
    this.themeTimer = window.setTimeout(() => this.readTheme(), 1000);
  }

  setIntensity(k: number): void {
    this.intensity = k;
    this.dirty = true;
  }

  setFocusTarget(): void {}

  pause(): void {
    this.paused = true;
    this.stop();
    this.pointer.detach();
  }

  resume(): void {
    this.paused = false;
    this.watch.reset();
    this.dirty = true;
    this.start();
  }

  dispose(): void {
    window.clearTimeout(this.themeTimer);
    this.teardown();
    this.host = null;
  }

  private apply(): void {
    this.wanted = this.params.glassEngine?.on === true;
    if (!this.wanted || this.failed || !this.host) {
      if (!this.wanted) this.failed = null;
      this.teardown();
      return;
    }
    if (!this.gl && !this.create()) return;
    const reduced = prefersReducedMotion();
    this.scene.configure(this.params, this.quality, reduced);
    this.reduced = reduced;
    this.parallax = parallaxPx(this.params, reduced);
    this.pointer.parallax = this.parallax > 0;
    const b = budgetFor(this.quality, reduced);
    this.ambientFps = fxFps(b);
    this.layout();
    this.dirty = true;
    this.stop();
    this.start();
  }

  private create(): boolean {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.engine = "";
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    if (!gl) {
      this.fail("WebGL2 indisponible");
      return false;
    }
    const renderer = Renderer.create(gl);
    if (!renderer) {
      this.fail("shader refusé");
      return false;
    }
    canvas.addEventListener("webglcontextlost", this.onLost);
    this.host!.prepend(canvas);
    window.addEventListener("resize", this.onResize);
    this.canvas = canvas;
    this.gl = gl;
    this.renderer = renderer;
    this.posters = new PosterTextures(gl);
    this.readTheme();
    return true;
  }

  private fail(reason: string): void {
    console.warn(`Glass engine: CSS fallback (${reason})`);
    this.failed = reason;
    this.teardown();
    document.documentElement.dataset.glassFallback = reason;
  }

  private teardown(): void {
    this.stop();
    this.pointer.detach();
    window.removeEventListener("resize", this.onResize);
    this.canvas?.removeEventListener("webglcontextlost", this.onLost);
    this.posters?.dispose();
    this.posters = null;
    this.renderer?.dispose();
    this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
    this.canvas?.remove();
    this.canvas = this.gl = this.renderer = null;
    GlassFrame.unmarkAll();
    if (!this.failed) delete document.documentElement.dataset.glassFallback;
    this.setState({ active: false, ring: false });
  }

  private setState(s: EngineState): void {
    if (s.active === this.state.active && s.ring === this.state.ring) return;
    this.state = s;
    const root = document.documentElement;
    if (s.active) root.dataset.glassEngine = "";
    else delete root.dataset.glassEngine;
    if (this.host) {
      if (s.active) this.host.dataset.gpu = "";
      else delete this.host.dataset.gpu;
      if (s.ring) this.host.dataset.gpuRing = "";
      else delete this.host.dataset.gpuRing;
    }
    this.onState(s);
  }

  private readTheme(): void {
    const s = getComputedStyle(document.documentElement);
    this.bg = ["--bg-top", "--bg-mid", "--bg-bottom"].map((n) => rgb01(s.getPropertyValue(n)));
    markGlassDirty();
    this.dirty = true;
  }

  private layout(): void {
    const { canvas, renderer } = this;
    if (!canvas || !renderer) return;
    const res = String(this.params.glassEngine?.resolution ?? "auto");
    const base = res === "auto" ? AUTO_SCALE[this.quality] : Number(res) || 1;
    const scale = base * this.watch.scale();
    const dpr = Math.min(2, window.devicePixelRatio || 1) * scale;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const w = Math.max(1, Math.round(W * dpr));
    const h = Math.max(1, Math.round(H * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (!renderer.resize(w, h)) return this.fail("texture refusée");
    this.view = { W, H, w, h };
    this.dirty = true;
  }

  private start(): void {
    if (this.unsubscribe || this.paused || !this.gl) return;
    this.pointer.attach();
    const cap = this.quality === "eco" ? ECO_MAX_FPS : FX_MAX_FPS;
    this.unsubscribe = this.loop.subscribe((dt, now) => this.tick(dt, now), cap);
  }

  private stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private drawn = (kind: GlassKind): boolean =>
    kindOn(this.params, kind) && this.watch.allows(kind);
  private tint = (kind: GlassKind): number => kindTint(this.params, kind);

  private tick(dt: number, now: number): void {
    const rung = this.watch.push(dt);
    if (rung) {
      console.warn(`Glass engine: frame budget missed, step down (${rung})`);
      document.documentElement.dataset.glassRung = rung; // last rung taken (logs, dev bench)
      if (this.watch.off) return this.fail("budget d'image dépassé");
      if (rung === "scale") this.layout();
      this.dirty = true;
    }
    this.scene.step(dt);
    const fading = this.pointer.step(dt);
    const pass = posterPassOf(this.params, this.posters, this.watch);
    pass?.textures.begin();
    // The category fan / deck gives the poses of its cards (round 3b).
    const sc = stageCue();
    const stage = sc ? sc(now) : null;
    const poses = stage?.poses ?? null;
    const hoverEl = stage?.hover?.el ?? null;
    let moved = this.frame.measure(this.drawn, this.tint, pass, poses, hoverEl);
    // A poster just became a texture: draw (the DOM picture was hidden in this same frame).
    if (this.posters?.end())
      moved = this.frame.measure(this.drawn, this.tint, pass, poses, hoverEl) || true;
    const slot = Math.floor(now / (1000 / this.ambientFps));
    // The glossy veil asks for frames only while it glides (and once more when it stops).
    const sheen = this.frame.hasSel ? sheenPos(this.params, now, this.reduced) : -1;
    const gliding = !this.reduced && (sheen >= 0 || this.sheen >= 0);
    this.sheen = sheen;
    const ambient = (this.scene.animated || gliding) && slot !== this.ambientSlot;
    // A sequence of the interface (the opening) asks for every frame while its picture changes.
    const cue = introCue();
    const intro = cue ? cue(now) : null;
    const cued =
      cueVersion() !== this.cueSeen ||
      !sameIntro(intro, this.intro) ||
      !sameRing(stage, this.stage);
    this.cueSeen = cueVersion();
    this.intro = intro;
    this.stage = stage;
    if (!(moved || ambient || fading || cued || this.pointer.moved || this.dirty)) return;
    this.ambientSlot = slot;
    this.pointer.moved = false;
    this.dirty = false;
    this.draw();
  }

  private draw(): void {
    const { renderer, palette, params: p, view: v } = this;
    if (!renderer || !palette) return;
    const light = lightOf(p, this.pointer);
    this.scene.fill(p, palette, v.W, v.H, this.intensity);
    const ringAllowed = this.watch.allows("ring");
    const intro = this.intro;
    const homeRing = !intro || intro.home > 0.01;
    const ring = ringAllowed && homeRing ? ringUniforms(p, palette, this.scene, light, v) : null;
    const liquid = ringAllowed && liquidRingOn(p);
    const f = this.frame;
    const bg = bgUniforms(
      p,
      palette,
      this.bg,
      this.scene,
      light,
      v,
      this.intensity,
      ringAllowed,
      intro,
      this.stage?.ring ?? null,
    );
    // Lit particles receive the same lights as the background (moon, liquid ring, cursor).
    const par = [-this.pointer.ox * this.parallax, -this.pointer.oy * this.parallax * 0.6];
    const su = {
      ...spriteUniforms(p, v),
      uMoon: bg.uMoon!,
      uLight: light,
      uLRing: bg.uLRing!,
      uPar: par,
      uKind: kindUniform(intro),
    };
    renderer.render(
      bg,
      { data: this.scene.sprites, count: this.scene.count, u: su },
      ring,
      {
        ...glassUniforms(p, light, palette, v),
        ...sheenUniforms(p, this.sheen, f.hasSel ? f.sel : null, this.reduced),
        ...shapeUniforms(f, p, this.stage),
        ...introVeilUniform(intro),
      },
      this.posters ? () => this.posters!.bind() : null,
    );
    this.setState({ active: true, ring: ring !== null || liquid });
  }
}
