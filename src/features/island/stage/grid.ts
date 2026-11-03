/**
 * Kysland's music mode: the beat grid (2026-11-03). From the AI's beats and downbeats (rhythm.rs,
 * every 8 s on the last 10 s) or the test track's, it keeps the period (the median gap), the phase
 * (fitted on all the beats) and the bar (beats between downbeats), and runs on between them: the
 * next beats are known before they come. Stale after 12 s without news. The period of each song
 * is remembered (`localStorage`, 300 songs), so a song heard before turns at its tempo from its
 * first second. Times on the music's clock (s).
 */

const STALE_S = 12;
/** The AI's beats of its window's last this-many seconds are left out (s). */
const UNSURE_S = 0.6;
const SONGS_KEY = "kysland.tempo";
const SONGS_MAX = 300;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1]!;
}

export class Grid {
  /** A beat's length (s); 0 while unknown. */
  period = 0;
  private anchor = 0;
  private down = 0;
  private bar = 4;
  private updated = -Infinity;
  private marks: { t: number; down: boolean }[] = [];
  private song: string | null = null;

  /** It knows where the beats are now. */
  fresh(t: number): boolean {
    return this.period > 0 && t - this.updated < STALE_S;
  }

  /** The AI's news: how long ago (s) each beat and downbeat was, the clock now. */
  heard(beatsAgo: number[], downAgo: number[], now: number): void {
    // The last half second of its window, without what follows, is unsure: left out.
    const sure = (xs: number[]) => xs.filter((a) => a > UNSURE_S).map((a) => now - a);
    const beats = sure(beatsAgo).sort((a, b) => a - b);
    const downs = sure(downAgo).sort((a, b) => a - b);
    this.fit(beats, downs, now);
  }

  /** One beat of the test track, as it plays. */
  mark(t: number, down: boolean): void {
    this.marks.push({ t, down });
    if (this.marks.length > 24) this.marks.shift();
    const beats = this.marks.map((m) => m.t);
    this.fit(
      beats,
      this.marks.filter((m) => m.down).map((m) => m.t),
      t,
    );
  }

  private fit(beats: number[], downs: number[], now: number): void {
    const gaps = beats
      .slice(1)
      .map((b, i) => b - beats[i]!)
      .filter((g) => g > 0.25 && g < 1.5);
    if (gaps.length < 3) return;
    const period = median(gaps);
    // The phase that suits the beats best: the median of their offsets from the last one.
    const last = beats[beats.length - 1]!;
    this.anchor = median(beats.map((b) => b - Math.round((b - last) / period) * period));
    this.period = period;
    if (downs.length) {
      this.down = this.onGrid(downs[downs.length - 1]!);
      const bars = downs.slice(1).map((d, i) => Math.round((d - downs[i]!) / period));
      if (bars.length) this.bar = Math.min(8, Math.max(2, median(bars)));
    }
    this.updated = now;
    this.remember();
  }

  /** The grid's beat nearest `t`. */
  private onGrid(t: number): number {
    return this.anchor + Math.round((t - this.anchor) / this.period) * this.period;
  }

  /** A beat between `from` (excluded) and `to`: whether it is a downbeat; null for none. */
  crossed(from: number, to: number): { down: boolean } | null {
    if (!this.fresh(to)) return null;
    const k = Math.floor((to - this.anchor) / this.period);
    const at = this.anchor + k * this.period;
    if (at <= from || at > to) return null;
    const n = Math.round((at - this.down) / this.period);
    return { down: ((n % this.bar) + this.bar) % this.bar === 0 };
  }

  /** How far `t` is from the grid's beats and half-beats (s); 0 while unknown (all on it). */
  offBeat(t: number): number {
    if (!this.fresh(t)) return 0;
    const half = this.period / 2;
    const x = (((t - this.anchor) % half) + half) % half;
    return Math.min(x, half - x);
  }

  /** A new song: its period if heard before (its phase comes with its first beats). */
  songIs(key: string | null): void {
    if (key === this.song) return;
    this.song = key;
    this.marks = [];
    this.updated = -Infinity;
    const known = key ? songs()[key] : undefined;
    this.period = typeof known === "number" && known > 0.25 && known < 1.5 ? known : 0;
  }

  /** How fast it turns, a turn every 8 beats (rad/s); null while unknown. */
  spin(): number | null {
    return this.period > 0 ? (2 * Math.PI) / (8 * this.period) : null;
  }

  private remember(): void {
    if (!this.song) return;
    const all = songs();
    delete all[this.song];
    all[this.song] = Math.round(this.period * 1000) / 1000;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - SONGS_MAX))) delete all[k];
    try {
      localStorage.setItem(SONGS_KEY, JSON.stringify(all));
    } catch {
      // No storage: the grid still works, it only forgets.
    }
  }
}

function songs(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(SONGS_KEY) ?? "{}") as unknown;
    return v && typeof v === "object" ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
}
