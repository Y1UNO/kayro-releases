import type { GlassKind } from "../../design/glass/glassRegistry";

/**
 * Frame budget of the glass engine. The engine's ticks are timed; over each window, if the 95th
 * percentile is more than twice the median (frames are being dropped, not just jittering) for two
 * windows in a row, the engine steps one rung down the ladder: the posters drawn as textures go
 * back to their DOM image first (round 2b), then lower resolution, then each kind of glass falls
 * back to its CSS look (least visible first), then the whole engine (CSS).
 */
export const LADDER = [
  "poster",
  "scale",
  "button",
  "dock",
  "bar",
  "pill",
  "card",
  "ring",
  "off",
] as const;
export type Rung = (typeof LADDER)[number];

export const WINDOW = 120;
const BAD_WINDOWS = 2;

export class BudgetWatch {
  private readonly ticks = new Float32Array(WINDOW);
  private readonly sorted = new Float32Array(WINDOW);
  private n = 0;
  private bad = 0;
  /** Number of rungs taken (0 = everything on, at full resolution). */
  level = 0;

  reset(): void {
    this.n = 0;
    this.bad = 0;
  }

  /** Feeds one tick; returns the rung just taken, if any. */
  push(dt: number): Rung | null {
    this.ticks[this.n++] = dt;
    if (this.n < WINDOW) return null;
    this.n = 0;
    this.sorted.set(this.ticks);
    this.sorted.sort();
    const median = this.sorted[WINDOW >> 1]!;
    const p95 = this.sorted[Math.floor(WINDOW * 0.95)]!;
    this.bad = p95 > 2 * median ? this.bad + 1 : 0;
    if (this.bad < BAD_WINDOWS || this.level >= LADDER.length) return null;
    this.bad = 0;
    return LADDER[this.level++]!;
  }

  /** Resolution factor left by the ladder. */
  scale(): number {
    return this.level > LADDER.indexOf("scale") ? 0.75 : 1;
  }

  /** False once this kind has fallen back to CSS ("ring" included). */
  allows(kind: GlassKind | "ring" | "poster"): boolean {
    const i = LADDER.indexOf(kind);
    return i < 0 || this.level <= i;
  }

  /** True once the whole engine has given up. */
  get off(): boolean {
    return this.level >= LADDER.length;
  }
}
