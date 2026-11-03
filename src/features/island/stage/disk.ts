import type { Pulse } from "./beat";
import {
  discPath,
  drawEscape,
  drawGloss,
  drawHalo,
  drawShine,
  drawStrings,
  ESCAPE,
  HALO,
  REACH,
  REACH_BIG,
  type Escape,
  type Mode,
} from "./diskArt";
import { stringColours } from "./hues";
import { Labels } from "./labels";
import { Title, type TitleDeps } from "./letters";
import { clamp, lerp, spring, still, sv, TAU, type Sv } from "./motion";
import type { Part } from "./region";
import type { Metrics } from "./scale";
import type { Body, Drop, Look, Scene, SceneTrack } from "./scene";
import { Strings } from "./strings";

/**
 * Kysland's « Disk » (2026-11-03): the island becomes a disc of black jelly, the album's cover
 * turning in its middle like a record (no grooves, no vinyl), starting up like a turntable and
 * slowing to a stop when paused; slow ripples always run round its edge. The bass pumps it: it
 * swells with every bass note (measured against the song itself, so none is missed), a halo of
 * the bass's colour breathing round it; each bass hit thumps it (squashed wide, a hop), on the
 * beat itself once the clock has it, the bar's first beat hardest. The snare stretches it tall
 * (the two alternate like a dance), a crash shivers it and flashes its edge. All of it scales
 * with how lively the song is: gentle in a quiet verse, huge in a chorus. Inside, a string per
 * instrument in the album's colours glows while its instrument pulses; on the bar's big hits a
 * ring of colour escapes. It throws the title and later sucks it back (`letters.ts`). Logical
 * px, s.
 */

/** The cover's radius and the hole's (of the disc's). */
const LABEL = 0.44;
const HOLE = 0.04;
/** At most this many escaping rings at once. */
const ESCAPES = 4;
/** The title rests this long before it is sucked back (s), then comes back after a while. */
const REST = [6, 9] as const;
const AGAIN = [40, 60] as const;
/** Two thumps at least this far apart (s); the bass's pump falls back this fast (s). */
const THUMP_GAP = 0.16;
const PUMP_S = 0.14;

/** The disc's size and place on a stage. */
export function diskLayout(m: Metrics): { R: number; C: { x: number; y: number } } {
  return { R: clamp(0.19 * m.U, 90, 290), C: { x: m.W / 2, y: m.yTop + 0.54 * (m.H - m.yTop) } };
}

export class Disk implements Scene {
  readonly drop: Drop;
  private readonly R: number;
  private readonly C: { x: number; y: number };
  private cx: Sv;
  private cy: Sv;
  private base: Sv;
  private scale = sv(1);
  private modes: Mode[];
  private spin = sv(0);
  private ang = 0;
  private label = sv(0);
  private labels: Labels;
  private strings: Strings;
  private cols: string[];
  private escapes: Escape[] = [];
  private lastEscape = [-9, -9, -9];
  private flash = 0;
  /** The bass's pump (0–1), and when it last thumped. */
  private pump = 0;
  private thumped = -9;
  private fade = 0;
  private entered = false;
  private enteredAt = 0;
  private closing = false;
  private closingAt = 0;
  private t = 0;
  private env: readonly number[] = [0, 0, 0, 0, 0];
  private lift: readonly number[] = [0, 0, 0, 0, 0];
  private energy = 0;
  private playing = false;
  private period = 0.5;
  private title: Title;
  private text = "";
  private pending: string | null = null;
  private nextThrow = Infinity;
  private accent: string;

  constructor(
    m: Metrics,
    private look: Look,
    deps: TitleDeps,
    private random: () => number = Math.random,
  ) {
    const { R, C } = diskLayout(m);
    [this.R, this.C] = [R, C];
    this.drop = { x: C.x, y: C.y, r: 0.55 * R };
    [this.cx, this.cy, this.base] = [sv(C.x), sv(C.y), sv(R)];
    this.modes = [2, 3, 4, 5].map((k) => ({ m: k, a: sv(0), ph: random() * TAU }));
    this.accent = look.accent;
    this.cols = stringColours(look.accent, null);
    this.strings = new Strings(random);
    this.title = new Title({ cx: C.x, cy: C.y, R, W: m.W, top: m.yTop }, look, deps);
    const side = Math.ceil(2 * LABEL * R * 1.25 * look.dpr);
    this.labels = new Labels(side, deps.canvas, () => this.entered && this.label.x > 0.05);
  }

  enter(b: Body): void {
    const calm = this.look.calm;
    this.cx = { x: b.x, v: b.vx };
    this.cy = { x: b.y, v: b.vy };
    // It blooms from the ball to its size, wobbling as it lands (calm: it is there already).
    this.base = calm ? sv(this.R) : { x: b.r, v: b.vr + 1.8 * this.R };
    const [two, three] = [this.modes[0]!, this.modes[1]!];
    two.a = { x: b.oval, v: b.ovalV };
    two.ph = b.axis;
    if (!calm) three.a.v += 0.9 * this.R;
    [this.entered, this.closing, this.enteredAt] = [true, false, this.t];
    this.spin = sv(0);
    if (this.text && !this.title.out) this.title.throw(this.t + 0.9);
  }

  track(s: SceneTrack | null): void {
    if (s?.accent) this.accent = s.accent;
    this.cols = stringColours(s?.accent ?? null, s?.dominant ?? null);
    this.labels.ask(s?.cover ?? null);
    const text = s?.title.trim() ?? "";
    if (text === this.text) return;
    this.text = text;
    if (!text || this.title.out) {
      // The old title goes back into the disc first.
      this.pending = text || null;
      this.title.suck(true);
      return;
    }
    this.title.set(text);
    if (this.entered) this.title.throw(this.t + 0.4);
  }

  frame(p: Pulse, playing: boolean): void {
    [this.env, this.lift, this.playing, this.period] = [p.env, p.lift, playing, p.period];
    this.energy = p.energy;
    if (!this.entered || this.closing || !playing || this.look.calm) return;
    const { R, cols, strings } = this;
    const L = clamp(p.lift[0] ?? 0, 0, 1);
    const lively = 0.6 + 0.8 * p.energy;
    // The bass: on the beat itself once the clock has it (with bass under it), else on the hit.
    const onBeat = p.locked && p.beat && L > 0.35;
    if ((p.kick || onBeat) && this.t - this.thumped > THUMP_GAP) {
      this.thump(Math.min(1.4, Math.max(0.35, L) * (p.bar === 0 ? 1.25 : 1) * lively));
    }
    if (p.snare) {
      // Stretched tall (the bass squashed it wide): the two alternate like a dance.
      const two = this.modes[0]!;
      two.ph = Math.PI / 2;
      two.a.v += 1.1 * R * lively;
      this.ripple(this.modes[2]!, 0.5 * R * lively);
      strings.pluck(2, 4 * R);
    }
    if (p.hat) strings.pluck(3, 1.3 * R);
    if (p.crash) {
      // A shiver, a flash of its edge, a ring of light.
      this.flash = 1;
      this.ripple(this.modes[2]!, 0.9 * R * lively);
      this.ripple(this.modes[3]!, 0.9 * R * lively);
      this.scale.v += 1.3 * lively;
      this.spin.v += 9;
      for (let i = 0; i < 4; i++) strings.pluck(i, 3 * R);
      if (this.look.effects) this.escape(2, cols[3]!, true);
    }
    if (!this.look.effects) return;
    if (p.beat && p.bar === 0 && L > 0.5) this.escape(0, cols[0]!);
    if (p.snare && p.bar === 3) this.escape(1, cols[2]!);
  }

  /** A bass hit of strength `s` (≈ 0.3–1.4): squashed wide, a hop, a swell, a pluck. */
  private thump(s: number): void {
    const { R } = this;
    this.thumped = this.t;
    const [two, three] = [this.modes[0]!, this.modes[1]!];
    two.ph = 0;
    two.a.v += 1.75 * R * s;
    this.ripple(three, 0.6 * R * s);
    this.scale.v += 1.1 * s;
    this.cy.v -= 0.55 * R * s;
    this.spin.v += 6 * s;
    this.strings.pluck(0, 5 * R * s);
    this.strings.pluck(1, 2.2 * R * s);
    this.title.kick(this.random);
  }

  private ripple(md: Mode, v: number): void {
    md.ph = this.random() * TAU;
    md.a.v += v;
  }

  private escape(kind: number, col: string, big = false): void {
    if (this.t - this.lastEscape[kind]! < 0.5 || this.escapes.length >= ESCAPES) return;
    this.lastEscape[kind] = this.t;
    const r = this.random;
    this.escapes.push({ col, t: 0, p: [r() * TAU, r() * TAU, r() * TAU], rot: r() * TAU, big });
  }

  step(h: number): void {
    this.t += h;
    const { R, C, look } = this;
    const e = this.env;
    const closing = this.closing;
    const on = this.playing && !closing && !look.calm;
    spring(this.cx, C.x, 36, 0.5, h);
    spring(this.cy, C.y, 32, 0.42, h);
    spring(this.base, closing ? 0.62 * R : R, closing ? 70 : 55, closing ? 0.6 : 0.38, h);
    spring(this.scale, 1 + (on ? 0.03 * (e[2] ?? 0) : 0), 260, 0.35, h);
    for (const md of this.modes) spring(md.a, 0, 260 + md.m * 60, closing ? 0.5 : 0.16, h);
    // The bass's pump: up at once with each bass note, falling back within a beat's fraction.
    const bass = on
      ? clamp(this.lift[0] ?? 0, 0, 1) * (0.6 + 0.4 * Math.min(1, (e[0] ?? 0) / 0.6))
      : 0;
    this.pump = Math.max(bass, this.pump * Math.exp(-h / PUMP_S));
    // The record: starting up like a turntable, faster while it throws or sucks, slowing to a
    // stop when paused.
    const boost = this.title.spinning && !closing;
    let aim = boost ? 24 : 3.2 + 1.6 * (e[2] ?? 0);
    if (closing || !this.playing) aim = 0;
    if (look.calm) aim = 0.35;
    spring(this.spin, aim, boost ? 10 : this.playing ? 2.5 : 2, 1, h);
    this.ang = (this.ang + this.spin.x * h) % TAU;
    const swap = this.labels.next !== null;
    const open = this.entered && !closing && !swap && this.t > this.enteredAt + 0.22;
    spring(this.label, open ? 1 : 0, open ? 70 : 160, open ? 0.45 : 0.8, h);
    if (swap && this.label.x < 0.03) this.labels.swap();
    this.fade = clamp(this.fade + (closing || !this.entered ? -h / 0.3 : h / 0.6), 0, 1);
    this.flash *= Math.exp(-h / 0.45);
    this.strings.step(h);
    for (const x of this.escapes) x.t += h;
    this.escapes = this.escapes.filter((x) => x.t < ESCAPE);
    this.title.step(h, this.random);
    const gulps = this.title.takeGulps();
    if (gulps) this.scale.v += 0.35 * gulps;
    this.schedule();
  }

  /** The title: thrown, left a while, sucked back, thrown again later; a new song's waits. */
  private schedule(): void {
    const { title } = this;
    if (!this.entered || this.closing) return;
    if (this.pending !== null && !title.out) {
      title.set(this.pending);
      title.throw(this.t + 0.3);
      this.pending = null;
      return;
    }
    const rest = title.restingFor();
    if (rest !== null && rest > clamp(12 * this.period, REST[0], REST[1]) && this.playing) {
      title.suck();
      this.nextThrow = this.t + lerp(AGAIN[0], AGAIN[1], this.random());
    }
    if (this.t >= this.nextThrow && !title.out && this.text && this.playing) {
      title.throw(this.t);
      this.nextThrow = Infinity;
    }
  }

  close(): void {
    if (this.closing) return;
    [this.closing, this.closingAt] = [true, this.t];
    this.title.away();
    this.pending = null;
  }

  reopen(): void {
    this.closing = false;
    if (!this.title.out && this.text) this.title.throw(this.t + 0.6);
  }

  closed(): Body | null {
    if (!this.closing) return null;
    const settled = this.modes.every((md) => Math.abs(md.a.x) < 0.8) && this.pump < 0.05;
    const shut = this.label.x < 0.02 && !this.title.out && settled;
    if (!shut && this.t - this.closingAt < 1) return null;
    const Rs = this.radius();
    return {
      x: this.cx.x,
      y: this.cy.x,
      r: Rs,
      vx: this.cx.v,
      vy: this.cy.v,
      vr: this.base.v * this.scale.x,
      oval: 0,
      ovalV: 0,
      axis: 0,
    };
  }

  get busy(): boolean {
    const moving = (o: Sv, to: number, eps: number) => !still(o, to, eps);
    return (
      moving(this.cx, this.C.x, 0.3) ||
      moving(this.cy, this.C.y, 0.3) ||
      Math.abs(this.base.v) > 1 ||
      Math.abs(this.scale.v) > 0.01 ||
      this.modes.some((md) => Math.abs(md.a.x) > 0.3 || Math.abs(md.a.v) > 3) ||
      Math.abs(this.spin.x) > 0.02 ||
      Math.abs(this.label.v) > 0.01 ||
      this.flash > 0.01 ||
      this.pump > 0.01 ||
      this.labels.next !== null ||
      this.escapes.length > 0 ||
      this.title.busy ||
      this.strings.moving
    );
  }

  /** Its radius now: at rest, breathing, pumped by the bass (more when the song is lively). */
  private radius(): number {
    const pumped = 1 + (0.08 + 0.08 * this.energy) * this.pump;
    return this.base.x * this.scale.x * pumped;
  }

  /** The ripples always running round the edge (px): livelier with the mids, calmer paused. */
  private flow(): number {
    if (!this.look.effects || this.look.calm) return 0;
    return 0.006 * this.R * (1 + 2 * (this.env[2] ?? 0)) * (this.playing ? 1 : 0.3);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const Rs = this.radius();
    const [x, y] = [this.cx.x, this.cy.x];
    const { effects, tone } = this.look;
    if (effects) drawHalo(ctx, x, y, Rs, this.cols[0]!, this.pump * this.fade);
    for (const e of this.escapes) drawEscape(ctx, e, x, y, Rs, this.R);
    const flow = this.flow();
    const body = discPath(x, y, Rs, this.modes, this.t, flow);
    ctx.fillStyle = "#000";
    ctx.fill(body);
    if (this.fade > 0.01 && this.entered) {
      ctx.save();
      ctx.clip(discPath(x, y, Rs * 0.985, this.modes, this.t, flow));
      const core = clamp(0.012 * this.R, 2.2, 4.5);
      const { rings } = this.strings;
      drawStrings(ctx, rings, this.lift, this.cols, x, y, Rs, core, effects, this.fade);
      if (effects) drawGloss(ctx, x, y, Rs);
      ctx.restore();
    }
    const lr = LABEL * Rs * this.label.x;
    const c = this.labels.now(this.accent);
    if (lr > 0.5 && c.width > 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.ang);
      ctx.drawImage(c, -lr, -lr, 2 * lr, 2 * lr);
      ctx.restore();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(x, y, Math.min(lr * 0.5, HOLE * Rs), 0, TAU);
      ctx.fill();
    }
    if (effects && this.entered) drawShine(ctx, body, x, y, Rs, tone, this.flash);
    this.title.draw(ctx);
  }

  hide(): void {}

  slow(): void {}

  parts(out: Part[]): void {
    const Rs = this.radius();
    const wob = this.modes.reduce((s, md) => s + Math.abs(md.a.x), 0) + 2 * this.flow();
    const [x, y, vx, vy] = [this.cx.x, this.cy.x, this.cx.v, this.cy.v];
    let r = Math.max(Rs, this.base.x) * 1.08 + wob + 10;
    if (this.look.effects && this.pump > 0.02) r = Math.max(r, Rs * HALO + 10);
    out.push({ x0: x - r, y0: y - r, x1: x + r, y1: y + r, vx, vy });
    if (this.escapes.length) {
      // The ring's widest: its reach, its wobble, half its glow.
      const big = this.escapes.some((e) => e.big);
      const re = Rs * (big ? REACH_BIG : REACH) * 1.15 + (big ? 28 : 20);
      out.push({ x0: x - re, y0: y - re, x1: x + re, y1: y + re });
    }
    this.title.parts(out);
  }

  hits(x: number, y: number): boolean {
    return Math.hypot(x - this.cx.x, y - this.cy.x) < this.radius() * 1.02 || this.title.hits(x, y);
  }

  dispose(): void {
    this.title.dispose();
    this.labels.dispose();
  }
}
