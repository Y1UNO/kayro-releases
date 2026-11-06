/**
 * « Auto » quality (step 24, proposal of docs/PERF-ETAPE13.md § « Qualité Auto »): watches the
 * screen's frames and steps down the costly effects one rung at a time when frames are missed,
 * then back up once it runs smoothly again. Pure: time and frames are given (tested with fakes).
 *
 * Signal: the intervals between two frames of the app's loop (display rate while anything
 * animates). A frame is « slow » past 1.5 × the screen's period (a missed refresh). Frames of a
 * scripted sequence (opening, category link) do not count: their cost is known and short.
 */

/** Rungs, cheapest change first (costs measured at step 13). */
export const AUTO_RUNGS = ["high", "hover", "float", "balanced", "eco"] as const;
export type AutoRung = (typeof AUTO_RUNGS)[number];

/** Window of the decision (ms). */
export const WINDOW_MS = 2000;
/** Two bad windows in a row step down. */
const BAD_IN_A_ROW = 2;
/** A window is bad past this many slow frames (and this share of its frames). */
const SLOW_MIN = 4;
const SLOW_SHARE = 0.04;
/** Back up after this long without a slow frame… */
const CALM_MS = 30_000;
/** …and never sooner than this after a step down. */
const HOLD_MS = 60_000;
/** Two « up, then down again » within this span: the level stays put until restart. */
const FLAP_SPAN_MS = 10 * 60_000;
/** A gap this long is a pause (window hidden, debugger), not a slow frame. */
const GAP_MS = 250;

export interface AutoState {
  rung: AutoRung;
  /** Why it went down last (« slow » frames), for the settings; null at the top. */
  reason: "slow" | "battery" | null;
  /** Stays where it is until the app restarts (it went back and forth). */
  frozen: boolean;
}

export class AutoQuality {
  private level = 0;
  private floor = 0;
  private winStart = -1;
  private frames = 0;
  private slow = 0;
  private bad = 0;
  private calmSince = -1;
  private downAt = -Infinity;
  private flaps: number[] = [];
  private wentUp = false;
  /** The screen's period: told by Windows, else the median interval of the previous window. */
  private period = 0;
  private screen = 0;
  private readonly seen = new Float32Array(1024);
  private reason: AutoState["reason"] = null;
  frozen = false;

  get state(): AutoState {
    return { rung: AUTO_RUNGS[this.level]!, reason: this.reason, frozen: this.frozen };
  }

  /**
   * The screen's refresh rate (Hz, null = unknown). Known, a frame is late against it: a PC slow
   * on every frame shows. Unknown, the median interval stands for it (only uneven frames show).
   */
  setScreenHz(hz: number | null): void {
    this.screen = hz && hz >= 24 && hz <= 500 ? 1000 / hz : 0;
    if (this.screen) this.period = this.screen;
  }

  /** On battery: Équilibré at most (« balanced » or lower). True when the rung changed. */
  setBattery(onBattery: boolean): boolean {
    const was = this.level;
    this.floor = onBattery ? AUTO_RUNGS.indexOf("balanced") : 0;
    if (this.level < this.floor) {
      this.level = this.floor;
      this.reason = "battery";
    } else if (!onBattery && this.reason === "battery") {
      this.level = 0;
      this.reason = null;
    }
    return this.level !== was;
  }

  /**
   * One frame of the loop: `interval` since the previous one (ms), at `now`; `sequence` while a
   * scripted sequence plays. Returns the new rung when it changed, else null.
   */
  frame(interval: number, now: number, sequence: boolean): AutoRung | null {
    if (interval <= 0 || interval > GAP_MS) {
      this.winStart = -1; // a pause: start a new window
      return null;
    }
    if (this.winStart < 0) {
      this.winStart = now;
      this.frames = this.slow = 0;
      if (this.calmSince < 0) this.calmSince = now;
    }
    if (this.frames < this.seen.length) this.seen[this.frames] = interval;
    if (sequence) {
      this.calmSince = now; // a sequence neither proves nor disproves anything
      return null;
    }
    this.frames++;
    if (this.period > 0 && interval > 1.5 * this.period + 1) {
      this.slow++;
      this.calmSince = now;
    }
    if (now - this.winStart < WINDOW_MS) return this.maybeUp(now);
    const bad = this.period > 0 && this.slow >= SLOW_MIN && this.slow >= this.frames * SLOW_SHARE;
    this.measurePeriod();
    this.winStart = -1;
    this.bad = bad ? this.bad + 1 : 0;
    if (this.bad >= BAD_IN_A_ROW && !this.frozen && this.level < AUTO_RUNGS.length - 1) {
      this.bad = 0;
      if (this.wentUp) {
        this.flaps = this.flaps.filter((t) => now - t < FLAP_SPAN_MS).concat(now);
        this.frozen = this.flaps.length >= 2;
        this.wentUp = false;
      }
      this.level++;
      this.downAt = now;
      this.calmSince = now;
      this.reason = "slow";
      return AUTO_RUNGS[this.level]!;
    }
    return this.maybeUp(now);
  }

  /** The median interval of the window that ends (missed refreshes stay a minority). */
  private measurePeriod(): void {
    if (this.screen) return;
    const n = Math.min(this.frames, this.seen.length);
    if (n < 20) return;
    const sorted = Array.from(this.seen.subarray(0, n)).sort((x, y) => x - y);
    this.period = Math.max(4, Math.min(sorted[n >> 1]!, 50));
  }

  private maybeUp(now: number): AutoRung | null {
    const calm = now - this.calmSince >= CALM_MS && now - this.downAt >= HOLD_MS;
    if (!calm || this.frozen || this.level <= this.floor) return null;
    this.level--;
    this.wentUp = true;
    this.calmSince = now;
    if (this.level === 0) this.reason = null;
    return AUTO_RUNGS[this.level]!;
  }
}
