/**
 * The app's single animation loop. Everything that animates per frame from script subscribes here
 * instead of calling `requestAnimationFrame` itself.
 *
 * - Real time: each subscriber gets the milliseconds elapsed since *its* previous tick, so motion
 *   speed does not depend on the screen (60, 144, 279 Hz…).
 * - Per-subscriber frame cap (`maxFps`, 0 = every frame). Capped subscribers tick on a shared
 *   time grid (slots of 1000/maxFps ms): two layers with the same cap update on the *same* screen
 *   frames, so the compositor produces maxFps images per second, not twice as many.
 * - No idle work: the `requestAnimationFrame` chain only exists while there is at least one
 *   subscriber and the loop is not paused.
 */
export type Tick = (dt: number, now: number) => void;

/**
 * Stops the subscription. `setFps` (the app's loop; optional for test fakes) changes its cap in
 * place: no frame is skipped, unlike unsubscribing and subscribing again.
 */
export type Unsubscribe = (() => void) & { setFps?: (maxFps: number) => void };

export interface FrameLoop {
  /**
   * Returns the unsubscribe function. `first`: ticks before the others on each frame (scripted
   * sequences write the DOM before the glass engine measures it, so both show the same moment).
   */
  subscribe(tick: Tick, maxFps?: number, first?: boolean): Unsubscribe;
  pause(): void;
  resume(): void;
  /** True while a frame is requested (for tests and the bench). */
  readonly active: boolean;
}

/** A long gap (tab hidden, debugger, resume) is not replayed as one huge step. */
export const MAX_DT_MS = 100;
interface Sub {
  tick: Tick;
  interval: number;
  /** Time of the previous tick; -1 = not ticked since (re)start. */
  last: number;
  /** Grid slot of the previous tick (capped subscribers). */
  slot: number;
}

export function createFrameLoop(
  raf: (cb: FrameRequestCallback) => number = (cb) => requestAnimationFrame(cb),
  caf: (id: number) => void = (id) => cancelAnimationFrame(id),
): FrameLoop {
  const subs: Sub[] = [];
  let paused = false;
  let frame = 0;

  const frameCb = (now: number) => {
    frame = 0;
    for (const s of subs) {
      const slot = s.interval > 0 ? Math.floor(now / s.interval) : 0;
      if (s.last < 0) {
        s.last = now; // first frame after a (re)start: nothing elapsed yet
        s.slot = slot;
        continue;
      }
      if (s.interval > 0 && slot === s.slot) continue;
      const elapsed = now - s.last;
      s.last = now;
      s.slot = slot;
      s.tick(Math.min(elapsed, MAX_DT_MS), now);
    }
    schedule();
  };

  function schedule() {
    if (frame === 0 && !paused && subs.length > 0) frame = raf(frameCb);
  }

  function stop() {
    if (frame !== 0) caf(frame);
    frame = 0;
  }

  return {
    subscribe(tick, maxFps = 0, first = false) {
      const sub: Sub = { tick, interval: maxFps > 0 ? 1000 / maxFps : 0, last: -1, slot: 0 };
      if (first) subs.unshift(sub);
      else subs.push(sub);
      schedule();
      const off = () => {
        const i = subs.indexOf(sub);
        if (i >= 0) subs.splice(i, 1);
        if (subs.length === 0) stop();
      };
      return Object.assign(off, {
        setFps(fps: number) {
          const interval = fps > 0 ? 1000 / fps : 0;
          if (interval === sub.interval) return;
          sub.interval = interval;
          sub.slot = -1; // the next frame ticks, then the new grid applies
        },
      });
    },
    pause() {
      paused = true;
      stop();
    },
    resume() {
      if (!paused) return;
      paused = false;
      for (const s of subs) s.last = -1;
      schedule();
    },
    get active() {
      return frame !== 0;
    },
  };
}

let shared: FrameLoop | null = null;

/** The app-wide loop (created on first use: never at import time, so tests stay DOM-free). */
export function frameLoop(): FrameLoop {
  shared ??= createFrameLoop();
  return shared;
}
