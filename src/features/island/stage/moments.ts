import type { Music, Section } from "./music";

/**
 * Kysland's music mode: the big moments besides the crash (2026-11-03, the user's wish: « two more
 * reactions like the crash »). « Éclosion »: a voice comes in after 3 s or more without one.
 * « Souffle »: the music settles (a break, no kick, after a drop or a build), on the next downbeat
 * of the beat grid (2.5 s at most). At most one big moment every 6 s, the crash's included.
 * Times on the music's clock (s).
 */

export type Moment = "bloom" | "breath";

const VOICE_OFF = 0.12;
const VOICE_IN = 0.35;
const VOICE_QUIET_S = 3;
const APART_S = 6;
const WAIT_S = 2.5;

export class Moments {
  private quiet = 0;
  private last = -Infinity;
  private section: Section = "unknown";
  private settling = -1;

  /** A crash just went: the next big moment waits. */
  crashed(t: number): void {
    this.last = t;
  }

  /** `h` s more; `downbeat`: a downbeat of the grid now. The moment to play, if any. */
  step(h: number, M: Music, downbeat: boolean): Moment | null {
    const t = M.t;
    let out: Moment | null = null;
    if (M.voice < VOICE_OFF) this.quiet += h;
    else if (M.voice > VOICE_IN && this.quiet >= VOICE_QUIET_S && t - this.last >= APART_S) {
      out = "bloom";
      this.quiet = 0;
    } else if (M.voice >= VOICE_OFF) this.quiet = 0;
    const was = this.section;
    this.section = M.section;
    if (M.section === "break" && (was === "drop" || was === "build")) this.settling = t;
    if (this.settling >= 0) {
      const due = downbeat || !M.grid.fresh(t) || t - this.settling > WAIT_S;
      if (!out && due && t - this.last >= APART_S) {
        out = "breath";
        this.settling = -1;
      } else if (t - this.settling > WAIT_S + 1.5 || M.section !== "break") this.settling = -1;
    }
    if (out) this.last = t;
    return out;
  }
}
