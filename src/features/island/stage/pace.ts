/**
 * Kysland's music mode: are the frames coming much more slowly than they can? Their average
 * length against the best average seen; 1.7 times longer for 1.5 s, it says so (once, then it
 * takes that pace as the new best). Times in s.
 */
export class Pace {
  private avg = 0;
  private best = Infinity;
  private since = -1;
  private frames = 0;

  /** A frame `dt` long, at `t`: true when the frames have been too slow for a while. */
  frame(dt: number, t: number): boolean {
    if (dt <= 0) return false;
    this.avg = this.frames++ ? this.avg + (dt - this.avg) * 0.1 : dt;
    if (this.frames > 30) this.best = Math.min(this.best, this.avg);
    if (this.avg < 1.7 * this.best) {
      this.since = -1;
      return false;
    }
    if (this.since < 0) this.since = t;
    if (t - this.since <= 1.5) return false;
    this.best = this.avg;
    this.since = -1;
    return true;
  }
}
