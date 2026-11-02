import { atRest, type Animated } from "./islandShape";
import { kickSquish } from "./engineParts";

/**
 * « Cacher l'île » (2026-11-02). Docked and left alone (the pointer gone, closed, nothing
 * moving it, no launch announced), the island goes into the top edge after the chosen delay:
 * drawn up like a drop (`presence` → 0 with a jelly kick), or a plain fade with « reduce
 * motion ». Once in, the core empties its window's region and watches the top of its place
 * (`desktop/island/tuck.rs`); the cursor held there brings it out (`peeked`). A launch or an
 * announcement brings it out too, for as long as it lasts. Timers only: no loop.
 */

/** What decides whether the island may go in. */
export interface TuckInputs {
  /** « Cacher l'île » on (and the island always there). */
  enabled: boolean;
  /** On screen (Kayro hidden, no program in full screen in front). */
  visible: boolean;
  docked: boolean;
  open: boolean;
  /** A gesture is under way (from its first frame until the island is at rest). */
  moving: boolean;
  hovered: boolean;
  /** A launch or an announcement stretches it: it shows until that is over. */
  stretched: boolean;
}

export const mayTuck = (s: TuckInputs): boolean =>
  s.enabled && s.visible && s.docked && !s.open && !s.moving && !s.hovered && !s.stretched;

/** Out, going in (its springs moving), in (the core told). */
export type TuckPhase = "out" | "going" | "in";

/** « Se cache après », when the settings are not there yet (the core's default). */
export const DEFAULT_DELAY_MS = 1500;
/** Shown again (Kayro gone, out of the edge by itself), it stays at least this long. */
export const SHOWN_AT_LEAST_MS = 1200;

/** The springs of « Cacher l'île »: into the top edge (`into`) or out of it. */
export function tuckSprings(
  v: { presence: Animated; fade: Animated; squish: Animated },
  into: boolean,
  calm: boolean,
): void {
  v.fade.to = into && calm ? 0 : 1;
  v.presence.to = into && !calm ? 0 : 1;
  // A drop: it stretches down a little as it is drawn up, and as it comes out.
  if (!calm) kickSquish(v.squish, into ? -5 : -4);
}

/** In the top edge and still: nothing of it shows. */
export function tuckedAway(v: { presence: Animated; fade: Animated }): boolean {
  const gone = (a: Animated) => a.to === 0 && a.x < 0.01 && atRest(a);
  return gone(v.presence) || gone(v.fade);
}

export interface TuckIo {
  /** Draws it going in (`true`) or coming out. */
  draw: (into: boolean) => void;
  /** Tells the core; going in, it answers whether the island may stay in. */
  tell: (into: boolean) => Promise<boolean>;
  onPhase: (phase: TuckPhase) => void;
}

export class Tucker {
  phase: TuckPhase = "out";
  private s: TuckInputs = {
    enabled: false,
    visible: true,
    docked: true,
    open: false,
    moving: false,
    hovered: false,
    stretched: false,
  };
  private timer: ReturnType<typeof setTimeout> | null = null;
  private delayMs = DEFAULT_DELAY_MS;
  private holdUntil = 0;

  constructor(
    private io: TuckIo,
    private now: () => number = () => Date.now(),
  ) {
    // The page starts with the island coming out of the edge.
    this.holdUntil = now() + SHOWN_AT_LEAST_MS;
  }

  /** How long after the pointer has left it the island goes in (ms). */
  setDelay(ms: number): void {
    const d = Math.max(0, Number.isFinite(ms) ? ms : 0);
    if (d === this.delayMs) return;
    this.delayMs = d;
    this.clear();
    this.update({});
  }

  update(change: Partial<TuckInputs>): void {
    const appeared = change.visible === true && !this.s.visible;
    this.s = { ...this.s, ...change };
    if (!this.s.visible) {
      // Hidden: the core has let it out of the edge, the page draws it coming back on screen.
      this.clear();
      this.set("out");
      return;
    }
    if (appeared) this.holdUntil = this.now() + SHOWN_AT_LEAST_MS;
    if (!mayTuck(this.s)) {
      this.clear();
      if (this.phase !== "out") this.comeOut();
      return;
    }
    if (this.phase === "out" && this.timer === null) this.schedule();
  }

  /** The engine's loop stopped; `away`: nothing of the island shows any more. */
  settled(away: boolean): void {
    if (this.phase !== "going" || !away) return;
    this.set("in");
    void this.io.tell(true).then((ok) => {
      if (!ok && this.phase === "in") this.comeOut(false);
    });
  }

  /** The core brought it out (the cursor touched the top of its place). */
  peeked(): void {
    if (this.phase !== "in") return;
    this.set("out");
    this.io.draw(false);
    this.holdUntil = this.now() + SHOWN_AT_LEAST_MS;
    this.update({});
  }

  dispose(): void {
    this.clear();
  }

  private schedule(): void {
    const wait = Math.max(this.delayMs, this.holdUntil - this.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.phase !== "out" || !mayTuck(this.s)) return;
      this.set("going");
      this.io.draw(true);
    }, wait);
  }

  /** Out again; the core is told when it had been told the island was in. */
  private comeOut(tell = true): void {
    const was = this.phase;
    this.set("out");
    this.io.draw(false);
    if (was === "in" && tell) void this.io.tell(false);
  }

  private clear(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private set(phase: TuckPhase): void {
    if (phase === this.phase) return;
    this.phase = phase;
    this.io.onPhase(phase);
  }
}
