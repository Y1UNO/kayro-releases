import type { Music, Section } from "./music";

/**
 * Kysland's music mode: the big moments and their spacing (2026-11-03, the user's wish: « two more
 * reactions like the crash », then « make the big moments adaptive »).
 * - « Éclosion »: a voice comes in after 3 s or more without one.
 * - « Souffle »: the music settles (a break, no kick, after a drop or a build), on the next
 *   downbeat of the beat grid (2.5 s at most).
 * - The drop (« Supernova »): the drums back after 2 s or more without a kick (strong, or with the
 *   bass there), or a crash right after a build or a silence; never the very first kick heard.
 * Their spacing follows the music, in bars of the beat grid (2 s while it is unknown) and by
 * rank (Supernova, then crash, then Éclosion and Souffle): a bigger one may come a quarter of a bar
 * after a smaller, an equal one after a bar, a smaller one after two; the same one again after 4
 * (a crash after 1). Times on the music's clock (s).
 */

export type Moment = "bloom" | "breath";
export type Big = "nova" | "crash" | Moment;

const VOICE_OFF = 0.12;
const VOICE_IN = 0.35;
const VOICE_QUIET_S = 3;
const WAIT_S = 2.5;
/** A bar's length while the grid is unknown (s). */
const BAR_S = 2;
const RANK: Record<Big, number> = { nova: 3, crash: 2, bloom: 1, breath: 1 };
/** Bars between two of the same. */
const SAME: Record<Big, number> = { nova: 4, crash: 1, bloom: 4, breath: 4 };

export class Moments {
  private quiet = 0;
  private section: Section = "unknown";
  private settling = -1;
  /** The last time the music was tense (a build, or the silence before a drop), the last kick. */
  private tense = -Infinity;
  private kickAt = -Infinity;
  private at: Record<Big, number> = {
    nova: -Infinity,
    crash: -Infinity,
    bloom: -Infinity,
    breath: -Infinity,
  };
  private lastKind: Big | null = null;
  private lastT = -Infinity;

  /** Whether `kind` may play now (then it counts as played): see the spacing above. */
  allow(kind: Big, t: number, M: Music): boolean {
    const bar = M.grid.fresh(t) ? M.grid.barLength() : BAR_S;
    if (t - this.at[kind] < SAME[kind] * bar) return false;
    if (this.lastKind) {
      const [a, b] = [RANK[kind], RANK[this.lastKind]];
      const bars = a > b ? 0.25 : a === b ? 1 : 2;
      if (t - this.lastT < bars * bar) return false;
    }
    [this.at[kind], this.lastKind, this.lastT] = [t, kind, t];
    return true;
  }

  /** Whether a hit now is the drop (kick or crash, its strength, the sub now). */
  isDrop(t: number, kind: "kick" | "crash", v: number, sub: number): boolean {
    const back = kind === "kick" && this.kickAt > -Infinity && t - this.kickAt >= 2;
    if (kind === "kick") this.kickAt = t;
    const ends = kind === "crash" && t - this.tense < 1.5;
    return (back && (v >= 0.55 || sub > 0.5)) || ends;
  }

  /** `h` s more; `downbeat`: a downbeat of the grid now. The moment to play, if any. */
  step(h: number, M: Music, downbeat: boolean): Moment | null {
    const t = M.t;
    if (M.build > 0.3 || M.gap) this.tense = t;
    let out: Moment | null = null;
    if (M.voice < VOICE_OFF) this.quiet += h;
    else if (M.voice > VOICE_IN && this.quiet >= VOICE_QUIET_S) {
      if (this.allow("bloom", t, M)) out = "bloom";
      this.quiet = 0;
    } else this.quiet = 0;
    const was = this.section;
    this.section = M.section;
    if (M.section === "break" && (was === "drop" || was === "build")) this.settling = t;
    if (this.settling >= 0) {
      const due = downbeat || !M.grid.fresh(t) || t - this.settling > WAIT_S;
      if (!out && due && this.allow("breath", t, M)) {
        out = "breath";
        this.settling = -1;
      } else if (t - this.settling > WAIT_S + 1.5 || M.section !== "break") this.settling = -1;
    }
    return out;
  }
}
