import { ECO_MAX_FPS, FX_MAX_FPS } from "../../fx/budget";
import { frameLoop, type FrameLoop } from "../../fx/loop";

/**
 * Scripted sequences (art direction round 3: opening, category links). ONE driver per sequence
 * kind, on the app's frame loop:
 *
 * - `render(t)` is a pure function of the sequence time (ms) that writes `transform` / `opacity`
 *   straight on the elements (no React render per frame). The elements it moves must be on their
 *   own compositor layer while it runs (`will-change`), or each frame repaints the whole window
 *   (measured round 3: tab change p95 7.2 ms until the animated layers were promoted).
 * - Capped on the same time grid as the glass engine (FX_MAX_FPS, 30 in Eco): the DOM and the
 *   engine's canvas change on the same screen frames. The engine reads the same clock (`time`).
 * - One sequence at a time: `play` cancels the one under way (cancellation token); the promise of
 *   the cancelled one resolves `false`.
 * - Reduced motion: `render(duration)` at once (final state), no frame loop at all.
 * - `seek(t)`: renders one moment and stays there (dev captures, tests).
 */
export interface PlayOptions {
  /** Eco quality: 30 frames per second. */
  eco?: boolean;
  /** Reduced motion: jump to the end. */
  reduced?: boolean;
  /** Start the sequence this many ms in (skips the beginning). */
  from?: number;
}

let running = 0;

/** Number of sequences under way (read by the dev bench to time frames during transitions). */
export function activeSequences(): number {
  return running;
}

export class Choreo {
  private token = 0;
  private unsubscribe: (() => void) | null = null;
  private settle: ((done: boolean) => void) | null = null;
  /** Frame-loop time of t = 0 (−1 = not ticked yet). */
  private start = -1;
  private from = 0;
  private duration = 0;
  /** Fixed time while seeking / at rest (the last rendered moment). */
  private still = 0;

  constructor(private readonly loop: FrameLoop = frameLoop()) {}

  get active(): boolean {
    return this.unsubscribe !== null;
  }

  /** Sequence time at frame-loop time `now` (what `render` gets on that frame). */
  time(now: number): number {
    if (!this.active) return this.still;
    if (this.start < 0) return this.from;
    return Math.min(now - this.start, this.duration);
  }

  play(duration: number, render: (t: number) => void, opts: PlayOptions = {}): Promise<boolean> {
    this.cancel();
    const token = ++this.token;
    if (opts.reduced || duration <= 0) {
      this.still = Math.max(0, duration);
      render(this.still);
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve) => {
      this.settle = resolve;
      this.start = -1;
      this.duration = duration;
      this.from = Math.min(Math.max(0, opts.from ?? 0), duration);
      render(this.from);
      running++;
      this.unsubscribe = this.loop.subscribe(
        (_dt, now) => {
          if (token !== this.token) return;
          if (this.start < 0) this.start = now - this.from;
          const t = this.time(now);
          this.still = t;
          render(t);
          if (t >= duration) this.finish(true);
        },
        opts.eco ? ECO_MAX_FPS : FX_MAX_FPS,
        true, // before the glass engine: it measures what this frame wrote
      );
    });
  }

  /** Renders the moment `t` and stops whatever was playing. */
  seek(t: number, render: (t: number) => void): void {
    this.cancel();
    this.token++;
    this.still = t;
    render(t);
  }

  /** Stops the sequence under way where it is (its promise resolves `false`). */
  cancel(): void {
    if (this.unsubscribe) this.finish(false);
  }

  private finish(done: boolean): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    running = Math.max(0, running - 1);
    const s = this.settle;
    this.settle = null;
    s?.(done);
  }
}
