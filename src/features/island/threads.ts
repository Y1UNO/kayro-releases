/**
 * 2026-11-02 (Notion « APP à faire »): Capri stays discreet at the top edge. No more spikes
 * bursting from it: thin glitch threads join the edge and the island, each one whole from end to
 * end, of its own thickness, flickering in held frames.
 * - Docking: they show one after the other as the island flies up to the edge; when it touches,
 *   the island crushes them (a short spark along its top), then nothing.
 * - Tearing off: they hold on, stretched, as the island is pulled away, then snap: each one breaks
 *   and its two ends spring back, to the edge and to the island.
 * Drawn on the island's canvas, in window coordinates (logical pixels).
 */
import { CAPRI, CAPRI_STEP, css, type Rand } from "../capri/capri";

/** The top edge's zone: the core's `DOCK_ZONE` (desktop/island/physics.rs). */
export const DOCK_ZONE = 90;
/** Threads at most, and where they may be along the island (fractions of its width). */
export const COUNT = 7;
const SPREAD: readonly [number, number] = [0.1, 0.9];
/** How long the crush and the snap last (s). */
const CRUSH = 0.18;
const SNAP = 0.22;
/** Torn off, they snap this far from the edge (as `near`), or after this long held (s). */
const SNAP_AT = 0.08;
const HOLD_MAX = 1.2;
/** Below this, nothing shows. */
const QUIET = 0.02;

export interface Island {
  x: number;
  /** Its top edge. */
  y: number;
  width: number;
}

/** One thread (or a broken piece of one): a jagged line (x, y pairs), its colour and width. */
export interface Thread {
  pts: number[];
  colour: number;
  width: number;
}

/** Where a thread is along the island, how far its edge end leans, its thickness and colour. */
interface Seed {
  at: number;
  lean: number;
  width: number;
  colour: number;
}

type Mode = "dock" | "tear" | "crush" | "snap";

/** How far the docking threads have come from 0 to 1, from how near the island is (0–1). */
export function reach(near: number): number {
  const t = Math.min(1, Math.max(0, (near - 0.15) / 0.8));
  return t * t * (3 - 2 * t);
}

/** The gap between the island's top and the top edge (logical), from how near it is. */
export const gapAt = (near: number): number => (1 - Math.min(1, Math.max(0, near))) * DOCK_ZONE;

export class Threads {
  level = 0;
  lines: Thread[] = [];
  /** The crush: sparks along the island's top (x from, x to, y), and its progress (0–1). */
  sparks: number[][] = [];
  crushed = 0;
  private mode: Mode = "dock";
  private near = 0;
  /** Time in the crush, the snap or the tear (s). */
  private clock = 0;
  private held = Infinity;
  private seeds: Seed[] = [];
  /** Where each thread breaks (fraction from the edge), when they snap. */
  private breaks: number[] = [];

  constructor(private rand: Rand = Math.random) {}

  /** Torn off (the island pulled away from the edge), they hold on until they snap. */
  get tearing(): boolean {
    return this.mode === "tear";
  }

  /** How near the top edge the island is now (0 far from it): flying to it, or held torn off it
   * (held otherwise, there is nothing). */
  approach(near: number, holding = false): void {
    if (this.mode !== "crush") this.near = holding && this.mode === "dock" ? 0 : near;
  }

  /** The island is torn off the edge: the threads hold on, stretched, all of them. */
  tear(): void {
    this.clear();
    this.mode = "tear";
    this.level = 1;
    this.near = 1;
  }

  /** The island touched the edge: it crushes the threads. */
  crush(): void {
    this.near = 0;
    if (this.level > QUIET && this.mode !== "crush") {
      this.mode = "crush";
      this.clock = 0;
      this.held = Infinity;
    }
  }

  clear(): void {
    [this.level, this.near, this.crushed, this.clock] = [0, 0, 0, 0];
    this.mode = "dock";
    this.lines = [];
    this.sparks = [];
    this.seeds = [];
    this.breaks = [];
  }

  /** Advances by `dt` seconds; true while they show. */
  step(dt: number, island: Island): boolean {
    if (this.mode === "crush" || this.mode === "snap") {
      this.clock += dt;
      const done = this.clock / (this.mode === "crush" ? CRUSH : SNAP);
      this.crushed = Math.min(1, done);
      if (done >= 1) {
        this.clear();
        return false;
      }
    } else if (this.mode === "tear") {
      this.clock += dt;
      if (this.near < SNAP_AT || this.clock > HOLD_MAX) this.snap();
    } else {
      const target = reach(this.near);
      const tau = target > this.level ? 0.06 : 0.12;
      this.level += (target - this.level) * (1 - Math.exp(-dt / tau));
      if (this.level < QUIET) {
        if (this.lines.length > 0 || this.seeds.length > 0) this.clear();
        return false;
      }
    }
    this.held += dt;
    if (this.held >= CAPRI_STEP) {
      this.held = 0;
      this.redraw(island);
    }
    return true;
  }

  private snap(): void {
    const r = this.rand;
    this.mode = "snap";
    this.clock = 0;
    this.held = Infinity;
    this.breaks = this.seeds.map(() => 0.3 + 0.4 * r());
  }

  /** A new held frame: the threads, broken pieces of them, or the sparks of the crush. */
  private redraw(island: Island): void {
    const r = this.rand;
    const [lo, hi] = SPREAD;
    if (this.seeds.length === 0)
      this.seeds = Array.from({ length: COUNT }, (_, i) => ({
        // Spread evenly, then shaken: never all bunched up.
        at: lo + ((hi - lo) * (i + 0.2 + 0.6 * r())) / COUNT,
        lean: (r() - 0.5) * 16,
        width: 0.6 + 1.6 * r() * r(),
        colour: r() < 0.15 ? CAPRI.violet : i % 2 === 0 ? CAPRI.red : CAPRI.green,
      }));
    this.seeds = this.seeds.map((s) => ({
      ...s,
      at: Math.min(hi, Math.max(lo, s.at + (r() - 0.5) * 0.03)),
    }));
    const xs = this.seeds.map((s) => island.x + s.at * island.width);
    if (this.mode === "crush") {
      // Flattened under the island: short jagged sparks along its top, spreading out.
      const spread = 6 + 26 * this.crushed;
      this.lines = [];
      this.sparks = xs.map((x) => [x - spread * (0.5 + r()), x + spread * (0.5 + r()), island.y]);
      return;
    }
    this.sparks = [];
    const edge = island.y - gapAt(this.near);
    const taut = this.mode !== "dock";
    const jag = (amp: number) => (r() - 0.5) * amp;
    // Whole from the edge (x0, y0) to the island (x1, y1): its ends never move, its middle jags.
    const thread = (x0: number, y0: number, x1: number, y1: number, amp: number): number[] => {
      const pts = [x0, y0];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(1, Math.round(len / (5 + r() * 4)));
      for (let k = 1; k < steps; k++) {
        const t = k / steps;
        pts.push(x0 + (x1 - x0) * t + jag(amp * Math.sin(Math.PI * t)), y0 + (y1 - y0) * t);
      }
      pts.push(x1, y1);
      return pts;
    };
    if (this.mode === "snap") {
      // Broken: each end springs back to where it holds (the edge, the island).
      const left = 1 - this.crushed;
      this.lines = xs.flatMap((x, i) => {
        const s = this.seeds[i];
        if (!s) return [];
        const top = x + s.lean;
        const cut = (this.breaks[i] ?? 0.5) * left;
        const back = (1 - (this.breaks[i] ?? 0.5)) * left;
        const yTop = edge + (island.y - edge) * cut;
        const yBottom = island.y - (island.y - edge) * back;
        const amp = 2 + 5 * this.crushed;
        return [
          {
            pts: thread(top, edge, top + (x - top) * cut, yTop, amp),
            colour: s.colour,
            width: s.width,
          },
          {
            pts: thread(x - (x - top) * back, yBottom, x, island.y, amp),
            colour: s.colour,
            width: s.width,
          },
        ];
      });
      return;
    }
    // Docking, they show one after the other as it nears; torn off, all of them, taut.
    const shown = taut ? COUNT : Math.ceil(this.level * COUNT);
    const amp = taut ? 1 + 2.5 * (1 - this.near) : 1.5 + 3 * this.level;
    this.lines = xs.flatMap((x, i) => {
      const s = this.seeds[i];
      if (!s || i >= shown) return [];
      if (r() < 0.1) return []; // a thread missing for a frame: it flickers
      return [
        { pts: thread(x + s.lean, edge, x, island.y, amp), colour: s.colour, width: s.width },
      ];
    });
  }

  /** Draws the last held frame (black outlined in violet under each line, the line on top). */
  draw(ctx: CanvasRenderingContext2D): void {
    if (this.lines.length === 0 && this.sparks.length === 0) return;
    const fading = this.mode === "crush" || this.mode === "snap";
    const alpha = fading ? 0.8 * (1 - this.crushed) : 0.3 + 0.5 * this.level;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.globalAlpha = alpha;
    const stroke = (pts: number[], colour: number, width: number, dx: number) => {
      ctx.strokeStyle = css(colour);
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i + 1 < pts.length; i += 2) {
        const [x, y] = [(pts[i] ?? 0) + dx, pts[i + 1] ?? 0];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    for (const t of this.lines) {
      if (t.colour !== CAPRI.violet) stroke(t.pts, CAPRI.violet, t.width * 2, 1);
      stroke(t.pts, t.colour, t.width, 0);
    }
    for (const [x0 = 0, x1 = 0, y = 0] of this.sparks) {
      const pts = [x0, y, (x0 + x1) / 2, y - 1.5, x1, y];
      stroke(pts, CAPRI.violet, 2.4, 0);
      stroke(pts, CAPRI.red, 1, 0);
    }
    ctx.restore();
  }
}
