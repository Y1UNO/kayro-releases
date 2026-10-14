import type { Quality } from "../../design";
import { currentMotion } from "../../design/motion/current";
import { markGlassDirty, type GlassKind } from "../../design/glass/glassRegistry";
import { cadenceFor, underDialog, type Cadence } from "../budget";
import { dialogOpen } from "../cadenceCap";
import type { FxLayer, FxPalette, FxParams, FxTarget } from "../FxLayer";
import { frameLoop, type FrameLoop, type Unsubscribe } from "../loop";
import { prefersReducedMotion } from "../motionPref";
import { BudgetWatch } from "./budgetWatch";
import { engineFps, Pacer } from "./cadence";
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
import { HeroTextures } from "./heroTexture";
import { PaletteTween } from "./paletteTween";
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
 * Cadence: see src/fx/gpu/cadence.ts (step 13, `CADENCE`); nothing at all when still. Fallbacks:
 * WebGL2 missing, shader refused or context lost → the CSS look of round 1, reason in
 * `data-glass-fallback` on <html>; frames dropped → see BudgetWatch.
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
  private cadence: Cadence = cadenceFor("balanced");
  private readonly pacer = new Pacer();
  private intro: IntroFrame | null = null;
  private stage: StageFrame | null = null;
  private cueSeen = -1;
  private bg: number[][] = [];
  private view: View = { W: 1, H: 1, w: 1, h: 1 };
  private state: EngineState = { active: false, ring: false };
  private unsubscribe: Unsubscribe | null = null;
  private readonly scene = new Scene();
  private readonly frame = new GlassFrame();
  private posters: PosterTextures | null = null;
  /** Step 14: passage between palettes (the tide) and the immersive hero. */
  private readonly tween = new PaletteTween();
  private hero: HeroTextures | null = null;
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
    const reduced = prefersReducedMotion();
    const { W, H } = this.view;
    this.tween.set(p, W, H, currentMotion().speed, reduced, performance.now());
    this.hero?.set(p.hero ?? null, this.tween.running, reduced, () => (this.dirty = true));
    // Step 13: the theme's own colours, not the page's computed style (each read forced a restyle).
    // A game's tide leaves the glass alone: its tints come from the palette at each frame.
    if (p.bg) this.setBg(p.bg.map(rgb01), p.passage !== "tide");
    else this.readTheme();
  }

  setIntensity(k: number): void {
    this.intensity = k;
    this.dirty = true;
  }

  setFocusTarget(t: FxTarget | null): void {
    this.tween.focus(t);
  }

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
    this.cadence = cadenceFor(this.quality);
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
    this.hero = new HeroTextures(gl);
    this.hero.set(this.palette?.hero ?? null, false, true, () => (this.dirty = true));
    if (!this.palette?.bg) this.readTheme();
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
    this.hero?.dispose();
    this.hero = null;
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
    this.setBg(["--bg-top", "--bg-mid", "--bg-bottom"].map((n) => rgb01(s.getPropertyValue(n))));
  }

  private setBg(bg: number[][], glass = true): void {
    this.bg = bg;
    if (glass) markGlassDirty();
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
    this.pacer.fps = engineFps(this.live(), false);
    this.unsubscribe = this.loop.subscribe((dt, now) => this.tick(dt, now), this.pacer.fps);
  }

  /** The quality's cadences, held lower while a dialog covers the scene. */
  private live(): Cadence {
    return dialogOpen() ? underDialog(this.cadence) : this.cadence;
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
    if (this.tween.step(now)) this.dirty = true;
    this.hero?.step(now);
    if (!this.tween.running) this.hero?.settle();
    const fading = this.pointer.step(dt);
    const pass = posterPassOf(this.params, this.posters, this.watch);
    pass?.textures.begin();
    // The category fan / deck gives the poses of its cards (round 3b).
    const sc = stageCue();
    const stage = sc ? sc(now) : null;
    const poses = stage?.poses ?? null;
    const hoverEl = stage?.hover?.el ?? null;
    const tw = this.tween;
    let moved = this.frame.measure(this.drawn, this.tint, pass, poses, hoverEl, tw);
    // A poster just became a texture: draw (the DOM picture was hidden in this same frame).
    if (this.posters?.end())
      moved = this.frame.measure(this.drawn, this.tint, pass, poses, hoverEl, tw) || true;
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
    // A stage sequence (category link, tab) ticks on its own grid: the engine follows it.
    const why = {
      moved,
      // The tide and a hero fading in are sequences too: every frame of their cadence.
      cued: cued || tw.running || this.hero?.fading === true,
      dirty: this.dirty,
      ambient: this.scene.animated,
      pointer: fading || this.pointer.moved,
    };
    if (!this.pacer.frame(why, now, this.live(), stage !== null, this.unsubscribe)) return;
    this.pointer.moved = false;
    this.dirty = false;
    this.draw();
  }

  private draw(): void {
    const { renderer, palette, params: p, view: v } = this;
    if (!renderer || !palette) return;
    const light = lightOf(p, this.pointer);
    this.scene.fill(p, palette, v.W, v.H, this.intensity, this.tween);
    const ringAllowed = this.watch.allows("ring");
    const intro = this.intro;
    const liquid = ringAllowed && liquidRingOn(p);
    const f = this.frame;
    const bg = {
      ...bgUniforms(
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
      ),
      ...this.tween.uniforms(),
      ...this.hero?.uniforms(v.H),
    };
    const su = { ...spriteUniforms(p, v), uKind: kindUniform(intro) };
    renderer.render(
      bg,
      { data: this.scene.sprites, count: this.scene.count, u: su },
      {
        ...glassUniforms(p, light, palette, v),
        ...shapeUniforms(f, p, this.stage),
        ...introVeilUniform(intro),
      },
      this.posters ? () => this.posters!.bind() : null,
      this.hero ? () => this.hero!.bind() : null,
    );
    this.setState({ active: true, ring: liquid });
  }
}
