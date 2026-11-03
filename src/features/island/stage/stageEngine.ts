import { Demo } from "./demo";
import { Disc, type Drive } from "./disc";
import { homeBounds, type Home, type HomeLook } from "./home";
import { Isle } from "./isle";
import { Body, Effects } from "./jelly";
import { clamp, STEP, type Box } from "./motion";
import { Music, type HitKind } from "./music";
import { DEFAULT_PALETTE, paletteOfImage, paletteOfRgb, type Palette } from "./palette";
import { boundsOf, fadeInside, RegionSender, type Part } from "./region";
import { squareCover } from "./cover";
import { StageView } from "./stageView";
import type { SoundFrame, StageLook, StageStart, StageTrack } from "./stageTypes";
import { clearUniforms, uniforms } from "./uniforms";

export type { SoundFrame, StageLook, StageStart, StageTrack } from "./stageTypes";

/**
 * Kysland's music mode (the lab's, 2026-11-03): the page's side. The island waits at its place
 * (drawn exactly as the page draws it), squashes, and on the next kick (600 ms at most) lets a
 * drop go that falls to the middle of the screen and becomes the player (`isle.ts`, then
 * `disc.ts`); leaving, the player crouches, leaps home on the next kick and the island drinks it.
 * Here: the music (the analysed sound, delayed as set, or the test track), the physics in steps
 * of 1/480 s, the drawing (`stageView.ts`), the window's region around what is drawn
 * (`region.ts`). Reduced motion: the island and the player cross-fade. Logical px, s.
 */

type Phase = "home" | "leaving" | "show" | "returning" | "done";

/** The player and the island fade (the light, the exact island) this long (s). */
const FADE = 0.3;
/** The island waits for a kick this long at most, and squashes this long at least (s). */
const WAIT = 0.6;
const SQUASH = 0.15;

export class StageEngine {
  /** Where it draws changed: the window's region follows (it shows and takes clicks there). */
  onArea: (rects: Box[]) => void = () => {};
  private view: StageView | null = null;
  private music = new Music();
  private fx: Effects;
  private body = new Body();
  private disc: Disc | null = null;
  private isle: Isle | null = null;
  private demo: Demo | null = null;
  private U = uniforms();
  private pal: Palette = DEFAULT_PALETTE;
  private home: Home | null = null;
  private homeLook: HomeLook = { tone: "214 236 255", rimA: 0.55, dpr: 1 };
  private s: StageStart | null = null;
  private look: StageLook | null = null;
  private track: StageTrack | null = null;
  private sender: RegionSender | null = null;
  private phase: Phase = "home";
  private raf = 0;
  private last = 0;
  private acc = 0;
  private t = 0;
  private lit = 0;
  private homeA = 1;
  private waitFrom = 0;
  private kicked = false;
  private wantOut = false;
  private done: ((home: boolean) => void) | null = null;
  private asked: Promise<boolean> | null = null;
  private queue: { at: number; f: SoundFrame }[] = [];
  private loads = 0;
  private cover: string | null = null;
  private W = 1;
  private H = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.fx = new Effects(() => this.s?.height ?? 1);
    this.music.listen = (kind, v) => this.hit(kind, v);
  }

  private drive = (): Drive => {
    const k = this.s?.calm ? 0.35 : 1;
    return { bass: (this.look?.bass ?? 1) * k, crash: (this.look?.crash ?? 1) * k };
  };

  /** The window has grown: the island is drawn exactly where it is (nothing moves yet). */
  start(s: StageStart, track: StageTrack | null, look: StageLook): void {
    [this.s, this.look, this.W, this.H] = [s, look, s.width, s.height];
    const home: Home = {
      x: s.homeX,
      y: s.homeY,
      w: s.homeW,
      h: s.homeH,
      docked: s.docked,
      corner: s.corner,
    };
    this.home = home;
    this.view = new StageView(this.canvas, s.width, s.height, look.quality);
    this.homeLook = { tone: s.tone, rimA: s.rimA, dpr: Math.min(2, window.devicePixelRatio || 1) };
    const W = () => this.W;
    const H = () => this.H;
    this.disc = new Disc(W, H, this.body, this.music, this.fx, this.drive);
    const target = () => {
      const [x, y] = this.disc!.centre();
      return { x, y, r: this.disc!.radius() };
    };
    this.isle = new Isle(home, W, H, this.body, this.music, this.fx, this.drive, target);
    this.sender = new RegionSender(
      Math.max(24, 0.03 * Math.min(s.width, s.height)),
      s.docked ? s.homeY : 0,
    );
    this.configure(look);
    this.setTrack(track);
    this.paint(0);
    this.region(true);
  }

  /** The settings changed while it shows. */
  configure(look: StageLook): void {
    const was = this.look;
    this.look = look;
    this.view?.setQuality(look.quality);
    if (look.demo && !this.demo) {
      this.demo = new Demo(this.music);
      void this.demo.sound(true);
    } else if (!look.demo && this.demo) {
      this.demo.stop();
      this.demo = null;
      this.music.quiet();
    }
    if (!was || was.colors !== look.colors || was.theme.join() !== look.theme.join())
      this.colours();
  }

  /** The window covers the screen: the island squashes and waits for a kick to let go. */
  launch(): void {
    if (this.phase !== "home" || !this.isle) return;
    // Reduced motion: the player simply fades in over the island.
    this.phase = this.s?.calm ? "show" : "leaving";
    [this.waitFrom, this.kicked] = [this.t, false];
    if (!this.s?.calm) this.isle.leave();
    this.kick();
  }

  /** The player is what is drawn (and what moves). */
  private get playing(): boolean {
    return this.phase === "show" || (Boolean(this.s?.calm) && this.phase === "returning");
  }

  setTrack(track: StageTrack | null): void {
    const was = this.track;
    this.track = track;
    if (!track?.playing) this.music.quiet();
    if (track && (track.title !== was?.title || track.artist !== was?.artist))
      this.disc?.title.set(track.title, track.artist);
    if ((track?.cover ?? null) !== this.cover) this.loadCover(track?.cover ?? null);
    else if (track?.accent !== was?.accent || track?.dominant !== was?.dominant) this.colours();
    this.kick();
  }

  /** What the analysed sound says (ignored while the test track plays). */
  feed(f: SoundFrame): void {
    if (this.demo) return;
    this.queue.push({ at: performance.now() + (this.look?.delayMs ?? 0), f });
    if (this.queue.length > 400) this.queue.shift();
    this.kick();
  }

  /** Flies home onto the island (`w` × `h`: its size now): true once it is exactly there. */
  leave(w?: number, h?: number): Promise<boolean> {
    if (this.phase === "home" || this.phase === "done" || !this.home) return Promise.resolve(true);
    if (w !== undefined && h !== undefined && this.isle)
      this.home = Object.assign(this.home, { w, h });
    if (!this.asked) this.asked = new Promise((r) => (this.done = r));
    this.wantOut = true;
    if (this.phase === "show") this.comeHome();
    else if (this.phase === "leaving" && this.isle?.phase === "antic1") {
      // Not gone yet: it simply stays home.
      this.isle.placeIsland();
      this.finish();
    }
    this.kick();
    return this.asked;
  }

  private comeHome(): void {
    const { disc, isle } = this;
    if (!disc || !isle) return;
    this.phase = "returning";
    this.wantOut = false;
    [this.waitFrom, this.kicked] = [this.t, false];
    const [x, y] = disc.centre();
    isle.placeBall(x, y, disc.radius(), disc.spin);
    if (!this.s?.calm) isle.comeHome();
  }

  /** The music came back before it leapt: the player stays (false once it has leapt). */
  stay(): boolean {
    const back = () => {
      this.done?.(false);
      [this.done, this.asked, this.wantOut] = [null, null, false];
      this.kick();
      return true;
    };
    if (this.phase === "leaving" && this.wantOut) return back();
    if (this.phase !== "returning" || !this.disc || !this.isle) return false;
    if (this.isle.phase !== "antic2" && !this.s?.calm) return false;
    const [, y] = this.disc.centre();
    this.disc.nudge(this.isle.ball().y - y);
    this.phase = "show";
    return back();
  }

  /** A click at (x, y) is on the player. */
  hits(x: number, y: number): boolean {
    if (this.phase !== "show" || !this.disc) return false;
    const [cx, cy] = this.disc.centre();
    return Math.hypot(x - cx, y - cy) < this.disc.radius() * this.body.S.x * 1.05;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.demo?.stop();
    this.demo = null;
    this.loads++;
    this.view?.dispose();
    this.view = null;
    this.done?.(true);
    this.done = null;
  }

  private hit(kind: HitKind, v: number): void {
    if (kind === "kick") this.kicked = true;
    if (this.playing) this.disc?.on(kind, v);
    else if (this.phase !== "home" && this.phase !== "done") this.isle?.on(kind, v);
  }

  private kick(): void {
    if (this.raf || this.phase === "home" || this.phase === "done" || !this.view) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.raf = 0;
    if (!this.view || !this.isle || !this.disc) return;
    const raw = (now - this.last) / 1000;
    const dt = clamp(raw, 0, 0.1);
    this.last = Math.max(this.last, now);
    this.t += dt;
    this.listen(now, dt);
    this.acc += dt;
    let n = 0;
    const scene = this.playing ? this.disc : this.isle;
    while (this.acc >= STEP && n < 60) {
      scene.step(STEP);
      this.fx.step(STEP);
      this.acc -= STEP;
      n++;
    }
    if (n >= 60) this.acc = 0;
    this.advance(dt);
    this.view.pace(raw);
    this.paint(dt);
    this.region(false);
    if (this.phase !== "done") this.raf = requestAnimationFrame(this.tick);
  };

  /** The music now: the test track, or the analysed sound once its delay has passed. */
  private listen(now: number, dt: number): void {
    const M = this.music;
    M.advance(dt);
    if (this.demo) {
      this.demo.advance(dt);
      return;
    }
    while (this.queue.length && this.queue[0]!.at <= now) {
      const { f } = this.queue.shift()!;
      if (this.track?.playing) M.heard(f);
    }
  }

  /** From one act to the next (the waits for a kick, the hand-offs, the fades). */
  private advance(dt: number): void {
    const { isle, disc } = this;
    if (!isle || !disc) return;
    const calm = this.s?.calm ?? false;
    const waited = this.t - this.waitFrom;
    const fadeIn = (k: number) => Math.min(1, k + dt / FADE);
    const fadeOut = (k: number) => Math.max(0, k - dt / FADE);
    if (this.phase === "leaving") {
      [this.lit, this.homeA] = [fadeIn(this.lit), fadeOut(this.homeA)];
      if (isle.phase === "antic1" && ((this.kicked && waited > SQUASH) || waited > WAIT)) {
        isle.go();
      } else if (isle.played) {
        disc.spin = isle.spin;
        this.phase = "show";
      }
    } else if (this.phase === "show") {
      [this.lit, this.homeA] = [fadeIn(this.lit), fadeOut(this.homeA)];
      if (this.wantOut) this.comeHome();
    } else if (this.phase === "returning") {
      if (calm) {
        [this.lit, this.homeA] = [fadeOut(this.lit), fadeIn(this.homeA)];
        if (this.lit <= 0) this.finish();
        return;
      }
      if (isle.phase === "antic2" && ((this.kicked && waited > SQUASH) || waited > WAIT)) isle.go();
      if (isle.touched) [this.lit, this.homeA] = [fadeOut(this.lit), fadeIn(this.homeA)];
      if (isle.atHome && this.homeA >= 1) this.finish();
    }
  }

  /** Exactly the island in its place: the page may show it again. */
  private finish(): void {
    this.phase = "done";
    [this.lit, this.homeA] = [0, 1];
    this.isle?.placeIsland();
    this.paint(0);
    this.done?.(true);
    [this.done, this.asked] = [null, null];
  }

  private colours(): void {
    const look = this.look;
    const t = this.track;
    if (look?.colors === "theme") this.pal = paletteOfRgb(look.theme[0], look.theme[1]);
    else if (!this.cover && t?.accent) this.pal = paletteOfRgb(t.accent, t.dominant ?? t.accent);
  }

  /** The cover, drawn square for its texture and its colours. */
  private loadCover(src: string | null): void {
    this.cover = src;
    this.view?.setCover(null);
    const id = ++this.loads;
    if (!src) {
      this.pal = DEFAULT_PALETTE;
      this.colours();
      return;
    }
    void squareCover(src).then((c) => {
      if (id !== this.loads || !this.view || !c) return;
      this.view.setCover(c);
      if (this.look?.colors !== "theme") this.pal = paletteOfImage(c);
    });
  }

  /** The scene's shapes and light, then the island and the title on the 2D canvas. */
  private paint(dt: number): void {
    const { view, isle, disc, home, U, music: M } = this;
    if (!view || !isle || !disc || !home) return;
    clearUniforms(U, this.W, this.H);
    const show = this.playing;
    if (show) disc.fill(U);
    else isle.fill(U);
    this.fx.fill(U, this.drive().crash);
    if (show) U.fade = disc.radius() * this.body.S.x * 2.15;
    const lit = this.phase === "home" || this.phase === "done" ? 0 : this.lit;
    const box = boundsOf(this.parts(), this.W, this.H);
    // The light is gone before the edges of what is drawn (no cut).
    U.fade = Math.min(U.fade, fadeInside(box, U.fc[0]!, U.fc[1]!, this.W, this.H));
    const F = StageView.frame(U, this.pal, this.look!, M, lit, this.t, dt, box);
    const home2d = { h: home, look: this.homeLook, alpha: this.homeA };
    view.draw(F, this.t, home2d, show ? disc.titleBox() : null, (ctx) => {
      if (show) disc.overlay(ctx, this.pal.c1, this.lit);
    });
  }

  private parts(): Part[] {
    const out: Part[] = [];
    const { home, disc, isle } = this;
    if (!home || !disc || !isle) return out;
    const b = homeBounds(home);
    const pad = this.H * 0.15;
    if (this.homeA > 0 || this.phase === "home" || this.phase === "done") {
      out.push({ x0: b.x0 - 12, y0: b.y0 - 6, x1: b.x1 + 12, y1: b.y1 + 16 });
    }
    // The player's light while it plays, and while its trails die out on the way home.
    if (this.playing || (this.phase === "returning" && this.t - this.waitFrom < 0.6)) {
      const [cx, cy] = disc.centre();
      const r = Math.max(disc.radius() * this.body.S.x * 2.15, disc.reach());
      out.push({ x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r });
      const title = this.playing ? disc.titleBox() : null;
      if (title) out.push(title);
    }
    if (this.phase === "leaving" || this.phase === "returning") {
      const r = isle.reach();
      if (Number.isFinite(r.x0))
        out.push({ x0: r.x0 - pad, y0: r.y0 - pad, x1: r.x1 + pad, y1: r.y1 + pad });
      const w = this.fx.reach();
      const [cx, cy] = [this.U.fc[0]!, this.U.fc[1]!];
      if (w > 0) out.push({ x0: cx - w, y0: cy - w, x1: cx + w, y1: cy + w });
    }
    return out;
  }

  /** Sends the region when what is drawn left it. */
  private region(force: boolean): void {
    const rects = this.sender?.offer(this.parts(), this.t, force);
    if (rects) this.onArea(rects);
  }
}
