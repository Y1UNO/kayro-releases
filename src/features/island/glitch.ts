/**
 * Step 20 (Kysland), « Glitch » passage: where the island meets an edge — the one between two
 * screens it sits across, or the top edge it docks to or tears off — that edge glitches. Jagged
 * spikes shoot out of it (hot red with a glitter of white specks, neon green, black outlined in
 * violet), the island splits into red and green ghosts and a few torn slices. The look of the
 * user's references (a jagged, glittering digital creature), drawn in held frames (redrawn about
 * 14 times a second, not smoothly), the way limited animation glitches.
 *
 * The spikes live on the **edge** (desktop coordinates): they stay there and fade out when the
 * island leaves it, shown by the core's click-through effects layer (never cut by the island's
 * window). Ghosts and slices follow the island (its canvas). Resting across two screens, the
 * edge keeps glitching, quietly, with a burst now and then.
 */
import type { FxShape } from "../../ipc/bindings";
import { CAPRI, css, spikes, type Edge } from "../capri/capri";

export interface Point {
  x: number;
  y: number;
}

/** The island in the window (logical pixels). */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GlitchInput {
  /** The edge between two screens cutting through the island (window coordinates). */
  seamX: number | null;
  seamY: number | null;
  island: Box;
  /** The window's top-left corner on the desktop. */
  origin: Point;
}

export type { Edge } from "../capri/capri";

interface Offset {
  dx: number;
  dy: number;
}

interface Slice {
  y: number;
  h: number;
  dx: number;
}

export const GLITCH_COLOURS = CAPRI;

/** A held frame lasts this long (s). */
export const GLITCH_STEP = 0.07;
/** Below this, the glitch is gone. */
const QUIET = 0.04;
/** Resting across two screens: its quiet level, and how often it bursts (s). */
const REST_LEVEL = 0.3;
const REST_BURSTS: readonly [number, number] = [1.4, 4];
/** Slices may stick out this far at rest (inside the island's click region). */
const REST_SLICE = 14;

type Rand = () => number;

/** How much the island sits across the edge: 1 when centred on it, 0 when clear of it. */
export function straddle(input: GlitchInput): number {
  const { island, seamX, seamY } = input;
  const across = (seam: number | null, centre: number, half: number) =>
    seam === null || half <= 0 ? 0 : Math.max(0, 1 - Math.abs(centre - seam) / half);
  const cx = island.x + island.width / 2;
  const cy = island.y + island.height / 2;
  return Math.max(across(seamX, cx, island.width / 2), across(seamY, cy, island.height / 2));
}

export class Glitch {
  level = 0;
  shapes: FxShape[] = [];
  ghosts: Offset[] = [];
  slices: Slice[] = [];
  /** A new held frame was drawn since the last `take`. */
  fresh = false;
  /** How much the island sits across an edge now (0–1). */
  across = 0;
  private edge: Edge | null = null;
  private burst = 0;
  private held = Infinity;
  private restClock = 0;
  private nextBurst = 0;

  constructor(private rand: Rand = Math.random) {}

  /** A burst at once: on `edge` when given (docking, tearing off), else on the last one. */
  trigger(edge?: Edge, strength = 1): void {
    if (edge) this.edge = edge;
    this.burst = Math.max(this.burst, strength);
    this.held = Infinity;
  }

  clear(): void {
    this.level = this.burst = 0;
    this.edge = null;
    this.shapes = [];
    this.ghosts = [];
    this.slices = [];
    this.fresh = true;
  }

  /** Advances by `dt` seconds (`resting`: across two screens, untouched); true while it shows. */
  step(dt: number, input: GlitchInput, resting = false): boolean {
    const across = straddle(input);
    this.across = across;
    if (across > 0) this.edge = edgeOf(input, this.level);
    this.burst *= Math.exp(-dt / 0.32);
    let target = Math.max(across, this.burst);
    if (resting && across > 0) {
      this.restClock += dt;
      if (this.restClock >= this.nextBurst) {
        this.burst = 0.85;
        const [lo, hi] = REST_BURSTS;
        this.nextBurst = this.restClock + lo + (hi - lo) * this.rand();
      }
      // However little of it is across, the edge glitches (a sliver across still counts).
      target = Math.max(REST_LEVEL, this.burst);
    }
    const tau = target > this.level ? 0.04 : 0.14;
    this.level += (target - this.level) * (1 - Math.exp(-dt / tau));
    if (this.level < QUIET) {
      if (this.shapes.length > 0 || this.edge) this.clear();
      return false;
    }
    this.held += dt;
    if (this.held >= GLITCH_STEP) {
      this.held = 0;
      this.redraw(input.island, resting);
    }
    return true;
  }

  /** The shapes of the last held frame for the effects layer, once (null: nothing new). */
  take(): FxShape[] | null {
    if (!this.fresh) return null;
    this.fresh = false;
    return this.shapes;
  }

  /** A new held frame: spikes along the edge, ghosts and slices. */
  private redraw(island: Box, resting: boolean): void {
    const r = this.rand;
    const level = this.level;
    this.fresh = true;
    this.shapes = [];
    if (this.edge) this.shapes = spikes(this.edge, level, r);
    const jitter = () => (2 + r() * 7) * level * (r() < 0.5 ? -1 : 1);
    this.ghosts = [
      { dx: jitter(), dy: (r() - 0.5) * 3 * level },
      { dx: jitter(), dy: (r() - 0.5) * 3 * level },
    ];
    const reach = resting ? REST_SLICE : 34;
    this.slices = Array.from({ length: 1 + Math.round(3 * level) }, () => ({
      y: r() * island.height,
      h: 2 + r() * 5,
      dx: Math.min(reach, (6 + r() * 28) * level) * (r() < 0.5 ? -1 : 1),
    }));
  }

  /** Draws the island's part of the held frame (ghosts and slices) around `island`. */
  draw(ctx: CanvasRenderingContext2D, island: Box): void {
    if (this.level < QUIET) return;
    const radius = Math.min(island.width, island.height) / 2;
    const ghostColours = [css(GLITCH_COLOURS.red), css(GLITCH_COLOURS.green)];
    this.ghosts.forEach((g, i) => {
      ctx.globalAlpha = 0.85 * this.level;
      ctx.fillStyle = ghostColours[i % 2] ?? css(GLITCH_COLOURS.red);
      ctx.beginPath();
      ctx.roundRect(island.x + g.dx, island.y + g.dy, island.width, island.height, radius);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    for (const s of this.slices) {
      ctx.fillStyle = css(GLITCH_COLOURS.black);
      ctx.fillRect(island.x + s.dx, island.y + s.y, island.width, s.h);
      ctx.fillStyle = css(GLITCH_COLOURS.violet);
      ctx.fillRect(island.x + s.dx, island.y + s.y, island.width, 1);
    }
  }
}

/** The edge cutting through the island, on the desktop, its glitching stretch around it. */
function edgeOf({ seamX, seamY, island, origin }: GlitchInput, level: number): Edge {
  const reach = 20 + 40 * level;
  if (seamX !== null) {
    const y = island.y + origin.y;
    return {
      vertical: true,
      at: seamX + origin.x,
      from: y - reach,
      to: y + island.height + reach,
      sides: 0,
    };
  }
  const x = island.x + origin.x;
  return {
    vertical: false,
    at: (seamY ?? 0) + origin.y,
    from: x - reach,
    to: x + island.width + reach,
    sides: 0,
  };
}
