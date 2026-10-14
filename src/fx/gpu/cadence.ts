import type { Cadence } from "../budget";
import type { Unsubscribe } from "../loop";

/**
 * When the glass engine draws (step 13, `CADENCE` in budget.ts). Each reason to draw has its own
 * time grid, shared with whatever moves the DOM for the same reason, so both change on the same
 * screen frames:
 * - a glass element moved in the DOM, a cue changed (sequence, opening), or a forced redraw:
 *   at once (the subscription's cap already sets the rate: `engineFps`);
 * - the ambience alone (particles, bokeh, ring, moon): on the `ambient` grid;
 * - the pointer alone (cursor light, its fade): on the `pointer` grid.
 */
export interface Triggers {
  moved: boolean;
  cued: boolean;
  dirty: boolean;
  ambient: boolean;
  pointer: boolean;
}

/** Last grid slots drawn; updated by `shouldDraw` when it says yes. */
export interface Slots {
  ambient: number;
  pointer: number;
}

const slot = (now: number, fps: number) => Math.floor(now / (1000 / fps));

export function shouldDraw(t: Triggers, now: number, c: Cadence, last: Slots): boolean {
  const a = slot(now, c.ambient);
  const p = slot(now, c.pointer);
  const draw =
    t.moved ||
    t.cued ||
    t.dirty ||
    (t.ambient && a !== last.ambient) ||
    (t.pointer && p !== last.pointer);
  if (draw) {
    last.ambient = a;
    last.pointer = p;
  }
  return draw;
}

/**
 * Cap of the engine's own frame-loop subscription: the sequence's rate while a scripted sequence
 * poses the cards (the choreography ticks on the same grid, just before), else the rate that
 * follows the DOM. The opening is not a stage sequence: it keeps the display rate.
 */
export function engineFps(c: Cadence, sequence: boolean): number {
  return sequence ? c.sequence : c.glass;
}

/** The engine's pace: retunes its subscription's cap, then says whether this frame draws. */
export class Pacer {
  fps = 0;
  private readonly slots: Slots = { ambient: -1, pointer: -1 };

  frame(t: Triggers, now: number, c: Cadence, sequence: boolean, sub: Unsubscribe | null): boolean {
    const fps = engineFps(c, sequence);
    if (fps !== this.fps && sub?.setFps) {
      this.fps = fps;
      sub.setFps(fps);
    }
    return shouldDraw(t, now, c, this.slots);
  }
}
