import { halo, type Drive } from "./disc";
import { homeCentre, type Home } from "./home";
import type { Body, Effects } from "./jelly";
import { clamp, lerp, Sp } from "./motion";
import type { HitKind, Music } from "./music";
import { Neck } from "./neck";
import type { Uniforms } from "./uniforms";

/**
 * Kysland's island leaving and coming home (the lab's Île, 2026-11-03), on the real island (its
 * size and place: docked in the middle or a corner, or floating). Leaving: it squashes for an
 * eighth (lower, wider), then on the next kick (600 ms at most) a drop leaves downwards, held by
 * a neck of five balls that thins in its middle like honey; the neck breaks, its upper pieces go
 * back up, the lower ones join the ball, a little satellite drop falls into it; the island goes
 * back into the edge. The ball stretches with its speed as it falls, squashes as it lands on the
 * disc's place, the cover appears and it becomes the player (`disc.ts` takes its body). Coming
 * home: the ball crouches (lower, wider), on the next kick it leaps, stretched, shrinking; the
 * island comes down to fetch it; at the touch a liquid bridge forms and the ball empties into the
 * island, which takes its width back with a bounce. Logical px, s.
 */

export type IslePhase = "island" | "antic1" | "fall" | "antic2" | "rise";

export class Isle {
  phase: IslePhase = "island";
  /** Time in the phase (s), the cover's turn. */
  tau = 0;
  spin = 0;
  private bx = new Sp();
  private by = new Sp();
  private bR = new Sp(0);
  private sq = new Sp(0);
  private cov = new Sp(0);
  private hw = new Sp(0);
  private bot = new Sp(0);
  private neck = new Neck();
  private pinched = true;
  private contact = false;
  private landed = true;

  constructor(
    private home: Home,
    private W: () => number,
    private H: () => number,
    private body: Body,
    private M: Music,
    private fx: Effects,
    private drive: () => Drive,
    /** Where the ball lands (the disc's middle) and its size there. */
    private target: () => { x: number; y: number; r: number },
    private random: () => number = Math.random,
  ) {
    this.placeIsland();
  }

  /** The island's middle (x; in a corner it stays flush with its side), half width, bottom. */
  private ix(): number {
    return homeCentre(this.home).x;
  }

  private restHw(): number {
    return this.home.w / 2;
  }

  private restBot(): number {
    return this.home.y + this.home.h;
  }

  /** The lab's island was 0.19 H wide and 0.085 H tall: its moves scaled to this one. */
  private sW(): number {
    return this.restHw() / (0.19 * this.H());
  }

  private sB(): number {
    return this.home.h / (0.085 * this.H());
  }

  /** The island's top when it is out of sight (above the edge, or shrunk to nothing). */
  private hidden(): number {
    return this.home.docked ? this.home.y - 0.07 * this.H() * this.sB() : this.home.y;
  }

  placeIsland(): void {
    this.hw.set(this.restHw());
    this.bot.set(this.restBot());
    this.bR.set(0);
    this.cov.set(0);
    this.neck.clear();
    [this.pinched, this.contact, this.phase, this.tau] = [true, true, "island", 0];
  }

  /** The ball where the player is (to come home from it): its body is the disc's. */
  placeBall(x: number, y: number, r: number, spin: number): void {
    this.hw.set(0);
    this.bot.set(this.hidden());
    this.bx.set(x);
    this.by.set(y);
    this.bR.set(r);
    this.cov.set(1);
    this.sq.set(0);
    this.neck.clear();
    [this.pinched, this.landed, this.tau, this.spin] = [true, true, 9, spin];
  }

  /** Squashes, waiting for the kick that sends the drop. */
  leave(): void {
    if (this.phase === "island") [this.phase, this.tau] = ["antic1", 0];
  }

  /** Crouches, waiting for the kick that sends it home. */
  comeHome(): void {
    [this.phase, this.tau] = ["antic2", 0];
  }

  /** The kick (or the wait's end): the drop leaves, or the ball leaps. */
  go(): void {
    const H = this.H();
    if (this.phase === "antic1") {
      [this.phase, this.pinched, this.landed, this.tau] = ["fall", false, false, 0];
      this.bx.set(this.ix());
      this.by.set(this.bot.x - H * 0.01 * this.sB());
      this.by.v = H * 2.6;
      this.bR.set(H * 0.07 * this.sB());
      this.sq.set(-0.1);
      this.cov.set(0);
    } else if (this.phase === "antic2") {
      [this.phase, this.contact, this.tau] = ["rise", false, 0];
      this.by.v = -H * 3.4;
      this.sq.v -= 8;
      this.hw.set(Math.max(this.hw.x, H * 0.02 * this.sW()));
      this.bot.set(Math.max(this.bot.x, this.home.y - H * 0.03 * this.sB()));
    }
  }

  /** Landed and turned into the player (the disc may take over). */
  get played(): boolean {
    const t = this.target();
    return (
      this.phase === "fall" &&
      this.landed &&
      this.pinched &&
      this.tau > 1.4 &&
      Math.abs(this.by.x - t.y) < 0.5 &&
      Math.abs(this.by.v) < 20 &&
      Math.abs(this.bR.x - t.r) < 0.5 &&
      Math.abs(this.sq.x) < 0.01
    );
  }

  /** Leaping home, it has touched the island (it is emptying into it). */
  get touched(): boolean {
    return this.phase === "rise" && this.contact;
  }

  /** Home again, exactly the island. */
  get atHome(): boolean {
    const settled =
      Math.abs(this.hw.x - this.restHw()) < 0.3 &&
      Math.abs(this.bot.x - this.restBot()) < 0.3 &&
      Math.abs(this.hw.v) + Math.abs(this.bot.v) < 4 &&
      this.bR.x < 0.5;
    return this.phase === "rise" && this.contact && (settled || this.tau > 1.8);
  }

  on(ty: HitKind, v: number): void {
    const { bass, crash } = this.drive();
    const [g, gc] = [v * bass, v * crash];
    const H = this.H();
    const { phase: ph, body, fx } = this;
    if (ty === "kick") {
      if (ph === "island" || ph === "antic1") {
        this.hw.v += H * 0.9 * g * this.sW();
        this.bot.v += H * 0.35 * g * this.sB();
      } else if (ph === "fall" && this.landed) {
        body.kick(g, [1]);
        this.sq.v += (this.random() < 0.5 ? -1 : 1) * 3 * g;
        fx.wave(
          this.bx.x,
          this.by.x,
          this.bR.x * 1.02,
          this.bR.x * 1.9,
          0.55,
          0.5 * g,
          0,
          H * 0.012,
          H * 0.003,
          4 * g,
        );
      }
    } else if (ty === "snare") body.snare(v);
    else if (ty === "hat") body.hat(v);
    else {
      fx.crash(gc);
      body.crash(gc * 0.8);
      const ball = ph === "fall" || ph === "antic2";
      const cy = ball ? this.by.x : this.bot.x * 0.5;
      fx.wave(
        this.ix(),
        cy,
        ball ? this.bR.x : H * 0.1,
        H * 0.8,
        1.2,
        1.4 * gc,
        0.25,
        H * 0.04,
        H * 0.006,
        14 * gc,
      );
    }
  }

  step(h: number): void {
    this.tau += h;
    this.spin += 3.4 * h;
    const H = this.H();
    const { M, body, hw, bot, bx, by, bR, sq, cov, neck } = this;
    const [sW, sB] = [this.sW(), this.sB()];
    const ix = this.ix();
    const t = this.target();
    const ph = this.phase;
    if (ph === "island" || ph === "antic1") {
      const a = ph === "antic1";
      hw.to(a ? this.restHw() * 1.1 : this.restHw(), 260, 0.32, h);
      bot.to(a ? this.home.y + this.home.h * 0.7 : this.restBot(), 320, 0.35, h);
      bR.to(0, 200, 0.9, h);
      neck.shrink(h);
      body.step(h, 1);
    } else if (ph === "fall") {
      body.step(h, 1 + 0.04 * M.sub * this.drive().bass - 0.1 * M.build);
      if (!this.pinched) {
        hw.to(H * 0.055 * sW, 160, 0.55, h);
        bot.to(this.home.y + H * 0.075 * sB, 260, 0.5, h);
      } else {
        hw.to(H * 0.03 * sW, 220, 0.4, h);
        bot.to(this.hidden(), 140, 0.38, h);
      }
      by.to(t.y, 58, 0.42, h);
      bx.to(t.x, 80, 0.8, h);
      bR.to(t.r, 46, 0.62, h);
      sq.to(-clamp(Math.abs(by.v) / (H * 6), 0, 0.3), 520, 0.42, h);
      if (!this.landed && by.x > t.y && by.v > 0) {
        this.landed = true;
        sq.v += 7;
      }
      if (!this.pinched) {
        this.pinched = neck.stretch(bot.x - H * 0.012 * sB, ix, bx.x, by.x, bR.x, H, sB);
      } else neck.settle(h, ix, bot.x, bx.x, by.x, bR.x, H, sB);
      if (this.tau > 0.55) cov.to(1, 25, 1, h);
    } else if (ph === "antic2") {
      body.step(h, 1);
      by.to(t.y + H * 0.045, 300, 0.5, h);
      sq.to(0.22, 300, 0.45, h);
      cov.to(0, 60, 1, h);
      bR.to(t.r, 100, 0.8, h);
      hw.to(0, 200, 0.8, h);
      bot.to(this.hidden(), 200, 0.8, h);
      neck.shrink(h);
    } else this.rise(h, ix, sW, sB);
  }

  /** Leaping home: the island comes down to fetch it, then drinks it. */
  private rise(h: number, ix: number, sW: number, sB: number): void {
    const H = this.H();
    const { body, cov, hw, bot, bx, by, bR, sq, neck } = this;
    body.step(h, 1);
    cov.to(0, 80, 1, h);
    bx.to(ix, 60, 0.8, h);
    if (!this.contact) {
      by.to(bot.x + bR.x * 0.9, 34, 0.25, h);
      bR.to(H * 0.075 * sB, 60, 0.6, h);
      sq.to(-clamp(Math.abs(by.v) / (H * 6), 0, 0.32), 420, 0.45, h);
      hw.to(H * 0.05 * sW, 200, 0.45, h);
      bot.to(this.home.y + H * 0.055 * sB, 220, 0.45, h);
      if (by.x - bR.x * (1 + Math.abs(sq.x)) <= bot.x + H * 0.012 * sB) {
        [this.contact, this.tau] = [true, 0];
        neck.bridge(ix, bot.x, by.x, H, sB);
      }
      return;
    }
    hw.to(this.restHw(), 150, 0.26, h);
    bot.to(this.restBot(), 240, 0.3, h);
    bR.to(0, 160, 0.85, h);
    by.to(lerp(this.home.y, bot.x, 0.5), 120, 0.7, h);
    sq.to(0, 300, 0.5, h);
    neck.drink(h, ix, bot.x, by.x);
  }

  /** The island's box now (none when it is out of sight). */
  box(): { x0: number; y0: number; x1: number; y1: number } | null {
    const hw = this.hw.x;
    if (hw <= 1 || this.bot.x <= this.home.y + 0.5) return null;
    const h = this.home;
    const ix = this.ix();
    const reach = 80;
    const x0 = h.docked && h.corner < -0.5 ? -reach : ix - hw;
    const x1 = h.docked && h.corner > 0.5 ? this.W() + reach : ix + hw;
    const y0 = h.docked ? h.y - reach : h.y;
    return { x0, y0, x1, y1: this.bot.x };
  }

  fill(U: Uniforms): void {
    const H = this.H();
    const { body, bR, bx, by, sq, cov } = this;
    if (bR.x > 1) {
      const R = bR.x * body.S.x;
      U.core.set([bx.x, by.x, R, 1]);
      U.modeA.set([sq.x, body.m[1]!.a.x, body.m[2]!.a.x, body.m[3]!.a.x]);
      U.modeP.set([0, body.m[1]!.ph, body.m[2]!.ph, body.m[3]!.ph]);
      U.shear[0] = body.shx.x;
      U.ripple.set([body.rip, 16, body.ripPh, 0]);
      if (cov.x > 0.01) U.cover.set([R * 0.44, this.spin, clamp(cov.x, 0, 1), R * 0.035]);
    }
    const b = this.box();
    if (b) {
      U.isle.set([b.x0, b.y0, b.x1, b.y1]);
      const h = this.home;
      const side = h.docked ? (h.corner < -0.5 ? -1 : h.corner > 0.5 ? 1 : 0) : 0;
      U.isleR.set([Math.min(h.h / 2, (b.y1 - b.y0) / 2), h.docked ? 20 : 0, h.y, side]);
    }
    U.k = H * 0.045;
    U.n = this.neck.fill(U, 0);
    halo(U, this.M, this.drive(), H);
    U.fc[0] = this.ix();
    U.fc[1] = lerp(this.restBot(), this.target().y, 0.45);
  }

  /** What it covers now (for the window's region): the island, the neck, the ball. */
  reach(): { x0: number; y0: number; x1: number; y1: number } {
    const b = this.box();
    const pad = this.H() * 0.05;
    const r = this.bR.x * (1.3 + Math.abs(this.sq.x)) + pad;
    const out = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    if (this.bR.x > 1) {
      [out.x0, out.y0] = [this.bx.x - r, this.by.x - r];
      [out.x1, out.y1] = [this.bx.x + r, this.by.x + r];
    }
    if (b) {
      [out.x0, out.y0] = [Math.min(out.x0, b.x0 - pad), Math.min(out.y0, b.y0)];
      [out.x1, out.y1] = [Math.max(out.x1, b.x1 + pad), Math.max(out.y1, b.y1 + pad)];
    }
    this.neck.reach(out, pad);
    return out;
  }

  /** The cover's presence (0–1) and the ball (for the hand-off to the disc). */
  ball(): { x: number; y: number; r: number; cover: number } {
    return { x: this.bx.x, y: this.by.x, r: this.bR.x, cover: this.cov.x };
  }
}
