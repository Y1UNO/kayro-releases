import { kickSquish } from "./engineParts";
import type { Animated } from "./islandShape";

/**
 * Kysland's idle (2026-11-02). Left alone (closed, no music, no launch, not hovered, out of the
 * top edge), the island looks alive: once in a while, one small gesture of about a second (it
 * breathes, looks aside, a glint runs along its bottom, rarely it stretches like a cat), then it
 * stays still. After a while alone it grows drowsy (rarer gestures), then sleeps (none) until
 * the pointer comes back. One timer at a time, none while hidden: the engine's loop only runs
 * for the gesture. Off with « reduce motion » and in Éco.
 */

export type IdleGesture = "breathe" | "look" | "glint" | "stretch";
/** What the engine plays: a gesture's springs, or the jolt of waking up. */
export type IdleKick = Exclude<IdleGesture, "glint"> | "wake";

export interface IdleInputs {
  /** Effects on and no « reduce motion ». */
  enabled: boolean;
  /** On screen (Kayro hidden, no program in full screen in front). */
  visible: boolean;
  open: boolean;
  moving: boolean;
  hovered: boolean;
  /** Music playing or a launch stretching it: it is alive already (paused music is not). */
  busy: boolean;
  /** « Cacher l'île »: going into the top edge, or in it. */
  tucked: boolean;
}

export const mayIdle = (s: IdleInputs): boolean =>
  s.enabled && s.visible && !s.open && !s.moving && !s.hovered && !s.busy && !s.tucked;

/** Alone this long, the idle starts (its first gesture comes one gap later). */
export const ARM_MS = 4000;
/** Between two gestures, awake and drowsy (ms). */
export const GAP: readonly [number, number] = [8000, 15000];
export const DROWSY_GAP: readonly [number, number] = [30000, 60000];
/** Alone this long, it grows drowsy, then sleeps. */
export const DROWSY_AFTER_MS = 120_000;
export const SLEEP_AFTER_MS = 600_000;

/** How often each gesture comes (the stretch is rare). */
const WEIGHTS: readonly (readonly [IdleGesture, number])[] = [
  ["breathe", 3],
  ["look", 3],
  ["glint", 3],
  ["stretch", 1],
];

/** One gesture, never the one before. */
export function pickGesture(last: IdleGesture | null, random: () => number): IdleGesture {
  const choices = WEIGHTS.filter(([g]) => g !== last);
  const total = choices.reduce((s, [, w]) => s + w, 0);
  let r = random() * total;
  for (const [g, w] of choices) {
    r -= w;
    if (r < 0) return g;
  }
  return choices[choices.length - 1]![0];
}

/** The springs of a gesture (the glint is the page's, in CSS): kicks only, they come back. */
export function idleSprings(
  v: { idle: Animated; look: Animated; squish: Animated },
  g: IdleKick,
  random: () => number = Math.random,
): void {
  if (g === "breathe") v.idle.v += 6;
  if (g === "stretch") {
    v.idle.v += 13;
    kickSquish(v.squish, 1.6);
  }
  if (g === "look") v.look.v += random() < 0.5 ? -9 : 9;
  if (g === "wake") kickSquish(v.squish, -3);
}

/** Restarts the glint along the island's bottom (`Island.module.css`, `[data-glint]`). */
export function glint(el: HTMLElement | null): void {
  if (!el) return;
  el.removeAttribute("data-glint");
  void el.offsetWidth;
  el.setAttribute("data-glint", "");
}

export interface IdleIo {
  play: (g: IdleGesture) => void;
  /** Back from its sleep (the pointer came): a small jolt. */
  wake: () => void;
  /** It may play gestures (the click region leaves them room). */
  onArmed: (armed: boolean) => void;
}

export class Idler {
  private s: IdleInputs = {
    enabled: false,
    visible: true,
    open: false,
    moving: false,
    hovered: false,
    busy: false,
    tucked: false,
  };
  private timer: ReturnType<typeof setTimeout> | null = null;
  private aloneSince = 0;
  private asleep = false;
  private armed = false;
  private last: IdleGesture | null = null;

  constructor(
    private io: IdleIo,
    private now: () => number = () => Date.now(),
    private random: () => number = Math.random,
  ) {}

  update(change: Partial<IdleInputs>): void {
    const was = mayIdle(this.s);
    this.s = { ...this.s, ...change };
    const may = mayIdle(this.s);
    if (!may) {
      this.clear();
      if (this.asleep && this.s.hovered) {
        this.asleep = false;
        this.io.wake();
      }
      if (!this.s.visible || !this.s.enabled) this.asleep = false;
    } else if (!was && !this.asleep) {
      this.aloneSince = this.now();
      this.schedule(ARM_MS + this.gap(GAP));
    }
    this.arm(may && !this.asleep);
  }

  dispose(): void {
    this.clear();
  }

  private fire = (): void => {
    this.timer = null;
    if (!mayIdle(this.s)) return;
    const alone = this.now() - this.aloneSince;
    if (alone >= SLEEP_AFTER_MS) {
      this.asleep = true;
      this.arm(false);
      return;
    }
    this.last = pickGesture(this.last, this.random);
    this.io.play(this.last);
    this.schedule(this.gap(alone >= DROWSY_AFTER_MS ? DROWSY_GAP : GAP));
  };

  private gap([lo, hi]: readonly [number, number]): number {
    return lo + (hi - lo) * this.random();
  }

  private schedule(ms: number): void {
    this.clear();
    this.timer = setTimeout(this.fire, ms);
  }

  private clear(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private arm(on: boolean): void {
    if (on === this.armed) return;
    this.armed = on;
    this.io.onArmed(on);
  }
}
