import { Attach } from "./attach";
import { BeatInput } from "./beat";
import { Dance } from "./dance";
import { Detach } from "./detach";
import { Disk } from "./disk";
import { homeBounds, paintHome, type Home, type HomeLook } from "./home";
import type { TitleDeps } from "./letters";
import { Metaballs } from "./metaballs";
import { clamp, union, type Box } from "./motion";
import { Pace } from "./pace";
import { RegionSender, type Part } from "./region";
import { metricsOf, type Metrics } from "./scale";
import { atRest, type Look, type Scene, type SceneTrack } from "./scene";

/**
 * Kysland's music mode (2026-11-03): the page's side. The island lets go of its place, falls to
 * the middle of its screen as a ball of jelly and becomes the scene the user chose (« Disk »:
 * a record of black jelly; « Dancing »: drops of ink dancing), then gathers into a ball again and
 * flies home (`detach.ts`, `attach.ts`). Here: the canvas as big as the screen, a loop in short steps (the same
 * motion at any screen rate) that runs while the music plays or something moves, every frame
 * cleared where anything was or is drawn (and wholly twice a second: nothing stale can stay),
 * and the window's region kept around what is drawn (`region.ts`).
 */

export type StageMode = "disk" | "dancing";

export interface StageTrack {
  key: string;
  title: string;
  artist: string;
  cover: string | null;
  /** The album's accent and dominant colours, as « r g b » (none: the island's tone). */
  accent: string | null;
  dominant: string | null;
  playing: boolean;
}

export interface StageStart {
  /** The stage (the screen), logical. */
  width: number;
  height: number;
  /** The island's anchor (middle of its top edge), its size, docked or floating, its corner. */
  homeX: number;
  homeY: number;
  homeW: number;
  homeH: number;
  docked: boolean;
  corner: number;
  calm: boolean;
  /** Effects on (off in Éco: fewer drops, no glow, no escaping colours). */
  effects: boolean;
  /** The island's tone and glows now (Island.module.css): « r g b », 0–1. */
  tone: string;
  rimA: number;
  glowA: number;
}

export type EngineDeps = TitleDeps;

type Phase = "home" | "intro" | "show" | "outro" | "done";

/** Motion is stepped at most this long at a time (s). */
const STEP = 1 / 240;
/** Reduced motion: the island and the scene cross-fade this long (s). */
const FADE = 0.35;
/** Wholly cleared at least this often (s). */
const WIPE = 0.5;

const sceneTrack = (t: StageTrack | null): SceneTrack | null =>
  t ? { title: t.title, cover: t.cover, accent: t.accent, dominant: t.dominant } : null;

export class StageEngine {
  /** Where it draws changed: the window's region follows (it shows and takes clicks there). */
  onArea: (rects: Box[]) => void = () => {};
  private ctx: CanvasRenderingContext2D | null = null;
  private m: Metrics | null = null;
  private home: Home | null = null;
  private s: StageStart | null = null;
  private look: HomeLook = { tone: "214 236 255", rimA: 0.55, dpr: 1 };
  private scene: Scene | null = null;
  private detach: Detach | null = null;
  private attach: Attach | null = null;
  private beatIn = new BeatInput();
  private sender: RegionSender | null = null;
  private track: StageTrack | null = null;
  private phase: Phase = "home";
  private sceneOn = false;
  /** Reduced motion: 0 the island, 1 the scene. */
  private fade = 0;
  private raf = 0;
  private last = 0;
  private t = 0;
  private done: ((home: boolean) => void) | null = null;
  private asked: Promise<boolean> | null = null;
  private wantOut = false;
  private drawn: Box | null = null;
  private wiped = -Infinity;
  private wipe = true;
  private forced: Box | null = null;
  /** Too slow while it shows: the scene draws more cheaply. */
  private pace = new Pace();

  constructor(
    private canvas: HTMLCanvasElement,
    private deps: EngineDeps,
  ) {}

  /** The window has grown: the island is drawn exactly where it is (nothing moves yet). */
  start(s: StageStart, track: StageTrack | null, mode: StageMode): void {
    this.s = s;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(s.width * dpr);
    this.canvas.height = Math.round(s.height * dpr);
    this.ctx = this.canvas.getContext("2d");
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.look = { tone: s.tone, rimA: s.rimA, dpr };
    const m = metricsOf(s.width, s.height, s.homeY, s.docked);
    const home: Home = {
      x: s.homeX,
      y: s.homeY,
      w: s.homeW,
      h: s.homeH,
      docked: s.docked,
      corner: s.corner,
    };
    [this.m, this.home] = [m, home];
    const look: Look = {
      tone: s.tone,
      accent: track?.accent ?? s.tone,
      effects: s.effects,
      calm: s.calm,
      dpr,
    };
    this.scene =
      mode === "dancing"
        ? new Dance(m, look, Metaballs.under(this.canvas, s.width, s.height, dpr, s.effects))
        : new Disk(m, look, this.deps);
    this.track = track;
    this.scene.track(sceneTrack(track));
    this.sender = new RegionSender(Math.max(24, 0.03 * m.U), m.yTop);
    this.paint();
    this.region(true);
  }

  /** The window covers the screen: the island lets go. */
  launch(): void {
    const { scene, home } = this;
    if (!scene || !home || this.phase !== "home") return;
    this.phase = "intro";
    this.wipe = true;
    if (this.s?.calm) {
      const d = scene.drop;
      scene.enter(atRest(d.x, d.y, d.r));
      this.sceneOn = true;
    } else {
      this.detach = new Detach(home, scene.drop);
      this.forced = this.detach.corridor();
    }
    this.kick();
  }

  setTrack(track: StageTrack | null): void {
    this.track = track;
    this.scene?.track(sceneTrack(track));
    this.kick();
  }

  /** The beat: five levels, bass first (about 30 times a second). */
  beat(levels: readonly number[]): void {
    this.beatIn.feed(levels);
    if (this.track?.playing) this.kick();
  }

  /**
   * Flies home onto the island as it is now (`w` × `h`: narrower once the music has gone): true
   * once drawn exactly in its place, false if it stayed.
   */
  leave(w?: number, h?: number): Promise<boolean> {
    if (this.phase === "home" || this.phase === "done" || !this.home) return Promise.resolve(true);
    if (w !== undefined && h !== undefined) this.home = { ...this.home, w, h };
    if (!this.asked) this.asked = new Promise((r) => (this.done = r));
    this.wantOut = true;
    if (this.phase === "show") this.goHome();
    this.kick();
    return this.asked;
  }

  private goHome(): void {
    this.phase = "outro";
    this.wantOut = false;
    this.wipe = true;
    this.scene?.close();
  }

  /** The music came back on the way home: it turns back (false once it has touched). */
  stay(): boolean {
    const back = () => {
      this.done?.(false);
      [this.done, this.asked, this.wantOut] = [null, null, false];
      this.kick();
      return true;
    };
    if (this.phase === "intro" && this.wantOut) return back();
    if (this.phase !== "outro" || !this.scene) return false;
    if (this.sceneOn) {
      this.scene.reopen();
      this.phase = "show";
      return back();
    }
    if (this.attach?.back(this.scene.drop)) return back();
    return false;
  }

  /** A click at (x, y) is on the ink. */
  hits(x: number, y: number): boolean {
    return this.sceneOn && this.phase === "show" && (this.scene?.hits(x, y) ?? false);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.scene?.dispose();
    this.scene = null;
    this.done?.(true);
    this.done = null;
    // The canvas as big as the screen lets its memory go until the next show.
    this.canvas.width = 0;
    this.canvas.height = 0;
  }

  private kick(): void {
    if (this.raf || this.phase === "home" || this.phase === "done" || !this.scene) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.raf = 0;
    const scene = this.scene;
    if (!scene) return;
    // A frame's time may come before the moment it was asked for (its start): never backwards.
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = Math.max(this.last, now);
    this.t += dt;
    const playing = Boolean(this.track?.playing);
    const pulse = this.beatIn.step(dt, playing);
    if (this.sceneOn) scene.frame(pulse, playing);
    const n = Math.max(1, Math.ceil(dt / STEP - 1e-6));
    for (let i = 0; i < n; i++) {
      const h = dt / n;
      this.detach?.step(h);
      this.attach?.step(h);
      if (this.sceneOn) scene.step(h);
    }
    this.advance(dt);
    if (this.phase === "show" && this.pace.frame(dt, this.t)) this.scene?.slow();
    this.paint();
    this.region(false);
    const moving = this.phase === "intro" || this.phase === "outro";
    if (this.phase !== "done" && (moving || playing || scene.busy)) {
      this.raf = requestAnimationFrame(this.tick);
    }
  };

  /** From one act to the next: the ball becomes the scene, the scene a ball, the ball the island. */
  private advance(dt: number): void {
    const { scene, home } = this;
    if (!scene || !home) return;
    const calm = this.s?.calm ?? false;
    if (calm && this.phase === "show") this.fade = Math.min(1, this.fade + dt / FADE);
    if (this.phase === "intro") {
      if (calm) {
        this.fade = Math.min(1, this.fade + dt / FADE);
        if (this.fade >= 1) this.phase = "show";
      } else if (this.detach?.ready) {
        scene.enter(this.detach.body());
        [this.sceneOn, this.detach, this.phase] = [true, null, "show"];
      }
      if (this.phase === "show" && this.wantOut) this.goHome();
      return;
    }
    if (this.phase !== "outro") return;
    if (calm) {
      this.fade = Math.max(0, this.fade - dt / FADE);
      if (this.fade <= 0) this.finish();
      return;
    }
    const body = this.sceneOn ? scene.closed() : null;
    if (body) {
      this.attach = new Attach(home, body);
      this.forced = this.attach.corridor();
      scene.hide();
      this.sceneOn = false;
    }
    const a = this.attach;
    if (a?.returned) {
      scene.enter(a.body());
      [this.sceneOn, this.attach, this.phase] = [true, null, "show"];
    } else if (a?.settled) this.finish();
  }

  /** Exactly the island in its place: the page may show it again. */
  private finish(): void {
    this.phase = "done";
    this.sceneOn = false;
    this.scene?.hide();
    this.wipe = true;
    this.done?.(true);
    [this.done, this.asked] = [null, null];
  }

  /** What is drawn now, as boxes (with their speed). */
  private parts(): Part[] {
    const out: Part[] = [];
    if (this.sceneOn) this.scene?.parts(out);
    if (this.detach) out.push(this.detach.part());
    if (this.attach) out.push(this.attach.part());
    const home = this.home;
    const showsHome = this.phase === "home" || this.phase === "done" || (this.s?.calm ?? false);
    if (home && (showsHome || (this.phase === "intro" && !this.sceneOn))) {
      const b = homeBounds(home);
      out.push({ x0: b.x0 - 12, y0: b.y0 - 6, x1: b.x1 + 12, y1: b.y1 + 16 });
    }
    return out;
  }

  /** Sends the region when what is drawn left it (or a corridor must be there at once). */
  private region(force: boolean): void {
    const sender = this.sender;
    if (!sender) return;
    const drawn = this.parts();
    const forced = this.forced;
    if (forced) drawn.push(forced);
    this.forced = null;
    const rects = sender.offer(drawn, this.t, force || forced !== null);
    if (rects) this.onArea(rects);
  }

  private paint(): void {
    const { ctx, m, home } = this;
    if (!ctx || !m || !home) return;
    const parts = this.parts();
    let box: Box | null = null;
    for (const p of parts) box = box ? union(box, p) : { x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1 };
    if (box) box = { x0: box.x0 - 12, y0: box.y0 - 12, x1: box.x1 + 12, y1: box.y1 + 12 };
    // Cleared where anything was or is drawn; wholly at each change of act, and now and then.
    if (this.wipe || !this.drawn || !box || this.t - this.wiped >= WIPE) {
      ctx.clearRect(0, 0, m.W, m.H);
      [this.wipe, this.wiped] = [false, this.t];
    } else {
      const c = union(this.drawn, box);
      ctx.clearRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
    }
    this.drawn = box;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, m.yTop, m.W, m.H - m.yTop);
    ctx.clip();
    const calm = this.s?.calm ?? false;
    const p = this.phase;
    if (p === "home" || p === "done") {
      paintHome(ctx, home, this.look);
    } else if (calm) {
      if (this.fade < 1) paintHome(ctx, home, this.look, 1 - this.fade);
      ctx.globalAlpha = clamp(this.fade, 0, 1);
      if (this.sceneOn) this.scene?.draw(ctx);
      ctx.globalAlpha = 1;
    } else {
      const d = this.detach;
      // Floating, its shadow and rim fade as it lets go.
      if (d && !home.docked) paintHome(ctx, home, this.look, 1 - clamp(d.t / 0.3, 0, 1), true);
      if (this.sceneOn) this.scene?.draw(ctx);
      const shape = d ?? this.attach;
      if (shape) {
        const path = new Path2D();
        shape.trace(path);
        ctx.fillStyle = "#000";
        ctx.fill(path);
      }
      const look = this.attach && !home.docked ? this.attach.look : 0;
      if (look > 0) paintHome(ctx, home, this.look, look);
    }
    ctx.restore();
  }
}
