import type { IslandFrame, IslandMoment, IslandState } from "../../ipc/bindings";
import { desktopIpc } from "../../ipc/commands";
import { Bubbles, type Point } from "./bubbles";
import {
  SPRING_OF,
  START,
  boxOf,
  kickSquish,
  num,
  topEdgeAt,
  type EngineOptions,
  type Key,
  type Parts,
} from "./engineParts";
import { GLITCH_STEP, Glitch, type Box } from "./glitch";
import { paintIsland } from "./islandPaint";
import {
  CALM,
  STAGE,
  anim,
  atRest,
  paletteFor,
  settle,
  shapeOf,
  stepSpring,
  type Animated,
  type Shape,
  type Values,
} from "./islandShape";
import { humIsland, playIsland } from "./islandSounds";
import { tuckSprings, tuckedAway } from "./islandTuck";

export type { EngineOptions, Parts } from "./engineParts";

const KEYS = Object.keys(SPRING_OF) as Key[];
type Values_ = Record<Key, Animated>;

/**
 * Step 20 (Kysland): drives the island's look. A few springs (on the edge ↔ floating, notch ↔
 * corner, hover, pull, lean, jelly, presence, opened, the screen's lightness), stepped on
 * `requestAnimationFrame` **only while one moves, a bubble lives or the glitch shows**, then the
 * loop stops and the core is told (it cuts the window to the island again). Resting across two
 * screens in « Glitch », the edge keeps glitching on a slow timer (14 held frames a second).
 */
export class IslandEngine {
  private v = Object.fromEntries(KEYS.map((k) => [k, anim(START[k] ?? 0)])) as Values_;
  private parts: Parts = { island: null, layer: null, canvas: null };
  private ctx: CanvasRenderingContext2D | null = null;
  private bubbles = new Bubbles();
  private glitch = new Glitch();
  private raf = 0;
  private restTimer = 0;
  private last = 0;
  private docked = true;
  private closing = false;
  /** A gesture is under way (the core sends its frames). */
  private moving = false;
  /** The window's top-left corner on the desktop (logical), its scale, the island's speed. */
  private origin: Point = { x: 0, y: 0 };
  private scale = 1;
  private speed: Point = { x: 0, y: 0 };
  private seam: { x: number | null; y: number | null } = { x: null, y: null };
  private clip = "none";
  private lastAsked = 0;
  /** Told when the island opens or closes (its panel's content becomes usable). */
  onOpenChange: (open: boolean) => void = () => {};
  /** Its loop stopped (« Cacher l'île » looks whether the island is in the top edge). */
  onSettle: () => void = () => {};

  constructor(private opts: () => EngineOptions) {}

  attach(parts: Parts): void {
    this.parts = parts;
    const canvas = parts.canvas;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(STAGE.width * dpr);
    canvas.height = Math.round(STAGE.height * dpr);
    this.ctx = canvas.getContext("2d");
    this.ctx?.scale(dpr, dpr);
  }

  /** First frame: the island where the core says it is, coming out of the bezel. */
  start(state: IslandState): void {
    this.docked = state.docked;
    const { morph, corner } = this.v;
    morph.x = morph.to = state.docked ? 0 : 1;
    corner.x = corner.to = num(state.corner);
    this.seam = { x: state.seamX, y: state.seamY };
    this.appear();
  }

  /** Shown again: closed, coming out of the bezel, its colours measured anew. */
  appear(): void {
    const { presence: p, open, fade } = this.v;
    [p.x, p.v, p.to] = [0, 0, 1];
    open.x = open.to = 0;
    fade.x = fade.to = 1;
    this.closing = false;
    this.onOpenChange(false);
    void desktopIpc.islandOpen(false, this.opts().calm);
    if (this.opts().calm) settle(p);
    this.askBackdrop(true);
    this.kick();
  }

  /** Hidden (or a program in full screen in front): every loop stops, the effects go. */
  vanish(): void {
    this.bubbles.clear();
    this.glitch.clear();
    this.sendEffects();
    humIsland(false);
    this.stop();
  }

  get isOpen(): boolean {
    return this.v.open.to === 1;
  }

  /** « Cacher l'île » (`islandTuck.ts`): into the top edge, or out of it. */
  tuck(into: boolean): void {
    tuckSprings(this.v, into, this.opts().calm);
    if (!into) this.askBackdrop(true);
    this.kick();
  }

  get tuckedAway(): boolean {
    return tuckedAway(this.v);
  }

  press(): void {
    if (this.isOpen) return;
    void desktopIpc.islandGrab(this.opts().calm);
    kickSquish(this.v.squish, 3);
    this.kick();
  }

  hover(on: boolean): void {
    this.v.hover.to = on ? 1 : 0;
    if (on) this.askBackdrop(false);
    this.kick();
  }

  /** Opens the island into its panel (the core first gives the window the panel's region). */
  openPanel(): void {
    if (this.isOpen) return;
    void desktopIpc.islandOpen(true, this.opts().calm);
    this.v.open.to = 1;
    this.closing = false;
    playIsland("open", this.opts().passage);
    this.onOpenChange(true);
    this.kick();
  }

  /** The opened island's size follows its content (closed: it opens at that size). */
  panelSize(w: number, h: number): void {
    const { openW, openH } = this.v;
    [openW.to, openH.to] = [w, h];
    if (!this.isOpen) [openW.x, openH.x] = [w, h];
    this.kick();
  }

  closePanel(): void {
    if (!this.isOpen) return;
    this.v.open.to = 0;
    this.closing = true;
    playIsland("close", this.opts().passage);
    this.onOpenChange(false);
    this.kick();
  }

  /** What the island shows at rest: music, a launch stretching it, the running apps' dots. */
  activity(a: { media: boolean; stretch: boolean; dots: boolean }): void {
    const v = this.v;
    const to = (x: Animated, on: boolean) => void (x.to = on ? 1 : 0);
    to(v.media, a.media);
    to(v.stretch, a.stretch);
    to(v.dots, a.dots);
    if (a.stretch) kickSquish(v.squish, -4);
    this.kick();
  }

  /** Another track: a small jolt, and in « Glitch » the island glitches for a moment. */
  trackChanged(): void {
    kickSquish(this.v.squish, -4);
    const { effects, calm, passage } = this.opts();
    if (effects && !calm && passage === "glitch") this.glitch.trigger(undefined, 0.7);
    this.kick();
  }

  /** The lightness of the screen around the island (0–1): its colours follow it. */
  backdrop(lightness: number | null): void {
    if (lightness === null || !Number.isFinite(lightness)) return;
    this.v.light.to = lightness;
    this.kick();
  }

  frame(f: IslandFrame): void {
    const v = this.v;
    this.moving = true;
    v.pullX.to = num(f.pullX);
    v.pullY.to = num(f.pullY);
    v.vx.to = num(f.vx);
    v.vy.to = num(f.vy);
    this.speed = { x: num(f.vx), y: num(f.vy) };
    v.corner.to = num(f.corner);
    // Near the top edge, the capsule already squares its top a little (the magnet).
    const near = num(f.near);
    this.glitch.threads.approach(this.opts().passage === "glitch" ? near : 0, f.holding);
    v.morph.to = f.holding ? 0 : this.docked ? v.morph.to : 1 - 0.35 * near * near;
    this.scale = num(f.scale) || 1;
    this.origin = { x: f.x / this.scale, y: f.y / this.scale };
    this.seam = { x: f.seamX, y: f.seamY };
    const [t, r, b, l] = f.clip.map((c) => Math.max(0, num(c)));
    this.clip = `inset(${t}px ${r}px ${b}px ${l}px)`;
    this.backdrop(f.backdrop);
    this.kick();
  }

  moment(m: IslandMoment): void {
    const v = this.v;
    const { effects, calm, passage } = this.opts();
    const fx = effects && !calm;
    const glitch = fx && passage === "glitch";
    const shape = shapeOf(this.values());
    const size = { x: shape.width, y: shape.height };
    switch (m.kind) {
      case "detached":
        this.docked = false;
        v.morph.to = 1;
        kickSquish(v.squish, 6);
        playIsland("detach", passage);
        if (glitch) this.glitch.threads.tear();
        else if (fx) this.bubbles.detached(size);
        break;
      case "crossed":
        playIsland("cross", passage);
        if (glitch) this.glitch.trigger();
        else {
          kickSquish(v.squish, -8);
          if (fx) this.bubbles.crossed(size, { x: num(m.dirX), y: num(m.dirY) });
        }
        break;
      case "docking":
        this.docked = true;
        v.morph.to = 0;
        break;
      case "touched":
        playIsland("dock", passage);
        kickSquish(v.squish, -7);
        if (glitch) this.glitch.threads.crush();
        else if (fx) this.bubbles.touched(size);
        break;
      case "snapped":
        playIsland("snap", passage);
        kickSquish(v.squish, -5);
        if (glitch) this.glitch.trigger(topEdgeAt(this.origin, shape), 0.6);
        break;
      case "dropped":
        this.docked = false;
        v.morph.to = 1;
        break;
      case "tap":
        kickSquish(v.squish, 6);
        this.openPanel();
        break;
      case "settled":
        this.docked = m.docked;
        v.morph.to = m.docked ? 0 : 1;
        v.corner.to = m.docked ? num(m.corner) : 0;
        break;
    }
    if (m.kind === "tap" || m.kind === "settled" || m.kind === "docking") {
      v.pullX.to = v.pullY.to = v.vx.to = v.vy.to = 0;
      this.speed = { x: 0, y: 0 };
    }
    if (m.kind === "tap" || m.kind === "settled") this.moving = false;
    this.kick();
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.restTimer);
    this.raf = 0;
    this.restTimer = 0;
  }

  /** Untouched across two screens, in « Glitch »: the edge keeps glitching. */
  private restsAcross(): boolean {
    const { effects, calm, passage } = this.opts();
    const across = this.seam.x !== null || this.seam.y !== null;
    return effects && !calm && passage === "glitch" && across && !this.moving && !this.isOpen;
  }

  private stepGlitch(dt: number, island: Box, resting: boolean): boolean {
    const { effects, calm } = this.opts();
    if (!effects || calm) {
      humIsland(false);
      return false;
    }
    const input = { seamX: this.seam.x, seamY: this.seam.y, island, origin: this.origin };
    const shown = this.glitch.step(dt, input, resting);
    // Across two screens, the edge hums under it (« Glitch » only).
    humIsland(shown && this.glitch.across > 0, this.glitch.level);
    return shown;
  }

  /** Sends the glitch's new held frame (its spikes) to the core's effects layer. */
  private sendEffects(): void {
    const shapes = this.glitch.take();
    if (!shapes) return;
    const alpha = Math.min(1, this.glitch.level * 1.4);
    void desktopIpc.islandEffects({ shapes, alpha, scale: this.scale });
  }

  private askBackdrop(always: boolean): void {
    const now = performance.now();
    if (!always && now - this.lastAsked < 1500) return;
    this.lastAsked = now;
    void desktopIpc.islandBackdrop().then((r) => {
      if (r.ok) this.backdrop(r.value);
    });
  }

  private values(): Values {
    return Object.fromEntries(KEYS.map((k) => [k, this.v[k].x])) as unknown as Values;
  }

  private kick(): void {
    window.clearTimeout(this.restTimer);
    this.restTimer = 0;
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    const calm = this.opts().calm;
    let moving = false;
    for (const k of KEYS) {
      const a = this.v[k];
      if (atRest(a)) {
        settle(a);
        continue;
      }
      stepSpring(a, calm && k !== "light" ? CALM : SPRING_OF[k], dt);
      moving = true;
    }
    const shape = shapeOf(this.values());
    const island = boxOf(shape);
    const bubbles = this.bubbles.step(dt, this.speed);
    const resting = this.restsAcross();
    const glitch = this.stepGlitch(dt, island, resting);
    this.paint(shape, island, bubbles, glitch);
    if (this.closing && this.v.open.x < 0.01 && atRest(this.v.open)) {
      this.closing = false;
      void desktopIpc.islandOpen(false, calm);
    }
    if (moving || bubbles || (glitch && !resting)) {
      this.raf = requestAnimationFrame(this.tick);
      return;
    }
    this.raf = 0;
    void desktopIpc.islandRest();
    this.onSettle();
    if (resting) this.restTimer = window.setTimeout(this.restLoop, GLITCH_STEP * 1000);
  };

  private restLoop = (): void => {
    this.restTimer = 0;
    const shape = shapeOf(this.values());
    const island = boxOf(shape);
    const glitch = this.restsAcross() && this.stepGlitch(GLITCH_STEP, island, true);
    if (!glitch) {
      this.glitch.clear();
      humIsland(false);
    }
    this.paint(shape, island, false, glitch);
    if (glitch) this.restTimer = window.setTimeout(this.restLoop, GLITCH_STEP * 1000);
  };

  private paint(shape: Shape, island: Box, bubbles: boolean, glitch: boolean): void {
    const colours = paletteFor(this.v.light.x);
    const { island: el, layer } = this.parts;
    if (layer) layer.style.clipPath = this.clip;
    if (el) paintIsland(el, shape, colours, this.v.hover.x, glitch ? this.glitch.level : 0);
    this.sendEffects();
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, STAGE.width, STAGE.height);
    if (glitch) this.glitch.draw(ctx, island);
    if (bubbles) {
      const centre = { x: island.x + island.width / 2, y: island.y + island.height / 2 };
      this.bubbles.draw(ctx, centre, STAGE, colours.tone, colours.shine);
    }
  }
}
