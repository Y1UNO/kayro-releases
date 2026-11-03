/**
 * Kysland's music mode: the song's tempo, from its kicks (2026-11-03, for the cover's turn, which
 * follows the beat and never the hits' strength). The gaps between the last 8 s of kicks, each
 * folded into one beat of 80–160 BPM (halved or doubled), their median; smoothed, and kept when
 * the kicks stop (a break). Times in s.
 */

const KEEP_S = 8;
const [SLOW, FAST] = [60 / 80, 60 / 160];

export class Tempo {
  /** Beats per minute now (smoothed). */
  bpm = 110;
  private times: number[] = [];

  /** A kick at `t`. */
  beat(t: number): void {
    this.times.push(t);
    while (this.times.length && this.times[0]! < t - KEEP_S) this.times.shift();
    const gaps: number[] = [];
    for (let i = 1; i < this.times.length; i++) {
      let g = this.times[i]! - this.times[i - 1]!;
      if (g < 0.08 || g > 2.5) continue;
      while (g < FAST) g *= 2;
      while (g > SLOW) g /= 2;
      gaps.push(g);
    }
    if (gaps.length < 4) return;
    gaps.sort((a, b) => a - b);
    const beat = gaps[gaps.length >> 1]!;
    this.bpm += (60 / beat - this.bpm) * 0.25;
  }
}
