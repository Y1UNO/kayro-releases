/**
 * Kysland's music mode: the tempo clock. Band levels come in (5, bass first, ~30 times a second);
 * out come smooth envelopes, the bass and snare hits, a beat clock that locks onto the bass
 * (period voted from the last hits, phase pulled onto each new hit), the downbeat and the phrase,
 * and how lively the music is (energy class, surge, calm). Time is the caller's (s), so it is
 * pure and tested; memory is bounded (rings).
 */

export type EnergyClass = "low" | "mid" | "high";

export interface Tick {
  /** The beat's number since the clock locked (0, 1, 2…). */
  beat: number;
  /** When it falls (s, the caller's clock). */
  at: number;
  /** Its place in the bar (0 = downbeat, 4 beats a bar) and in the 8-beat phrase (0 = phrase start). */
  inBar: number;
  inPhrase: number;
}

export interface Hits {
  bass: boolean;
  snare: boolean;
  /** the bass level of the hit (0–1) */
  level: number;
}

export const BANDS = 5;
const SNARE_BAND = 3;
/** Envelope attack and release (s). */
const ATTACK_S = 0.025;
const RELEASE_S = 0.18;
/** The levels arrive this late after the sound (s). */
const LATENCY_S = 0.055;

/** A hit: the level above `level`, risen by more than `jump`, `refractory` s after the last. */
type OnsetRule = Record<"level" | "jump" | "refractory", number>;
const BASS: OnsetRule = { level: 0.7, jump: 0.2, refractory: 0.2 };
const SNARE: OnsetRule = { level: 0.75, jump: 0.25, refractory: 0.12 };

/** The period: votes from the last 16 bass hits, folded into [MIN, MAX), 10 ms bins. */
const VOTE_HITS = 16;
const VOTE_SPAN_S = 3;
const P_MIN = 0.35;
const P_MAX = 0.75;
const BIN_S = 0.01;
const BINS = Math.round((P_MAX - P_MIN) / BIN_S);
/** A period counts only when its bins hold this share of the votes (and this many). */
const VOTE_SHARE = 0.25;
const VOTE_MIN = 4;
/** A voted period this far from the clock's replaces it (a new tempo). */
const RETEMPO = 0.04;

/** Phase correction and lock. */
const PULL_WINDOW = 0.2;
const PULL_PHASE = 0.35;
const PULL_PERIOD = 0.08;
const HIT_WINDOW = 0.12;
const LOCK_ON = 0.55;
const LOCK_OFF = 0.35;
/** Beats without a bass hit before the lock fades. */
const QUIET_BEATS = 4;
/** A gap this long between two calls loses the lock (s). */
const GAP_S = 1;
/** Another slot of the bar becomes the downbeat when it outweighs the current one by this. */
const DOWN_MARGIN = 1.05;

/** Energy: windows (s), class edges and their hysteresis. */
const LONG_S = 8;
const SHORT_S = 0.6;
const BUCKET_S = 0.1;
const BUCKETS = Math.round(LONG_S / BUCKET_S) + 1;
const MID_AT = 0.35;
const HIGH_AT = 0.6;
const HYST = 0.04;
const SURGE_RATIO = 1.35;
const CALM_RATIO = 0.7;
const CALM_BEATS = 8;
const CALM_UNLOCKED_S = 4;
/** Onsets kept for the rate (bounded: well over 8 s of the fastest hits). */
const ONSET_RING = 128;

const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** Folds an interval by octaves into [P_MIN, P_MAX). */
export function fold(i: number): number {
  let v = i;
  while (v >= P_MAX) v /= 2;
  while (v < P_MIN) v *= 2;
  return v;
}

/**
 * The period voted from hit times (s, oldest first): every pair under 3 s apart, folded, into
 * 10 ms bins; the best run of three bins wins and the mean of its votes refines it. Null when no
 * run holds enough of the votes (no steady beat).
 */
export function votePeriod(hits: readonly number[]): number | null {
  const count = new Array<number>(BINS).fill(0);
  const sum = new Array<number>(BINS).fill(0);
  let votes = 0;
  for (let i = 0; i < hits.length; i++) {
    for (let j = i + 1; j < hits.length; j++) {
      const d = hits[j]! - hits[i]!;
      if (d <= 0 || d >= VOTE_SPAN_S) continue;
      const v = fold(d);
      const b = Math.min(BINS - 1, Math.floor((v - P_MIN) / BIN_S));
      count[b]!++;
      sum[b]! += v;
      votes++;
    }
  }
  if (votes < VOTE_MIN) return null;
  let best = -1;
  let bestN = 0;
  for (let b = 0; b < BINS; b++) {
    const n = count[b]! + (count[b - 1] ?? 0) + (count[b + 1] ?? 0);
    if (count[b]! > 0 && n > bestN) {
      bestN = n;
      best = b;
    }
  }
  if (best < 0 || bestN < VOTE_MIN || bestN < votes * VOTE_SHARE) return null;
  const s = sum[best]! + (sum[best - 1] ?? 0) + (sum[best + 1] ?? 0);
  return s / bestN;
}

export class Tempo {
  /** Band envelopes 0–1 (attack 25 ms, release 180 ms), bass first (5 bands). */
  readonly env: number[] = new Array<number>(BANDS).fill(0);
  energy = 0;
  klass: EnergyClass = "low";
  surge = false;
  calm = false;
  locked = false;
  /** s */
  period = 0.5;
  /** beats, continuous */
  phase = 0;

  /** Whether the period has been voted at least once (the clock runs). */
  private running = false;
  private conf = 0;
  /** The time the phase refers to (s); NaN before the first call. */
  private clockT = NaN;
  private lastTick = 0;
  private lockBase = 0;
  private readonly acc = [0, 0, 0, 0];
  private down = 0;
  private readonly last = new Array<number>(BANDS).fill(0);
  private readonly prev = new Array<number>(BANDS).fill(0);
  private bassAt = -Infinity;
  private snareAt = -Infinity;
  /** The last bass hit stamps (s), oldest first, for the vote. */
  private readonly bassHits: number[] = [];
  /** Every hit stamp (s), a ring, for the rate. */
  private readonly onsets = new Float64Array(ONSET_RING);
  private onsetN = 0;
  /** Mean level, by 0.1 s buckets (a ring keyed by bucket id). */
  private readonly bucketId = new Float64Array(BUCKETS).fill(-1);
  private readonly bucketSum = new Float64Array(BUCKETS);
  private readonly bucketN = new Float64Array(BUCKETS);
  private calmSince: number | null = null;

  /** New band levels (5, 0–1, bass first; arrive ~30 times a second) at time t (s): the hits found (stamped 55 ms earlier; they feed the clock). */
  feed(levels: readonly number[], t: number): Hits {
    if (Number.isNaN(this.clockT)) this.clockT = t;
    let mean = 0;
    for (let b = 0; b < BANDS; b++) {
      const v = Math.min(1, Math.max(0, levels[b] ?? 0));
      this.prev[b] = this.last[b]!;
      this.last[b] = v;
      mean += v / BANDS;
    }
    this.addLevel(mean, t);

    const stamp = t - LATENCY_S;
    const bass = this.onset(0, BASS, stamp, this.bassAt);
    const snare = this.onset(SNARE_BAND, SNARE, stamp, this.snareAt);
    if (bass) {
      this.bassAt = stamp;
      this.pushOnset(stamp);
      this.onBass(stamp, this.last[0]!);
    }
    if (snare) {
      this.snareAt = stamp;
      this.pushOnset(stamp);
    }
    return { bass, snare, level: bass ? this.last[0]! : 0 };
  }

  /** Moves the clock to t (s): envelopes, phase, energy, surge/calm; returns the beat ticks crossed since the last call (only while locked). */
  advance(t: number): Tick[] {
    if (Number.isNaN(this.clockT)) this.clockT = t;
    const dt = Math.max(0, t - this.clockT);
    this.clockT = t;

    const de = Math.min(dt, 0.25);
    for (let b = 0; b < BANDS; b++) {
      const target = this.last[b]!;
      const was = this.env[b]!;
      const tau = target > was ? ATTACK_S : RELEASE_S;
      this.env[b] = was + (target - was) * (1 - Math.exp(-de / tau));
    }

    const ticks: Tick[] = [];
    if (this.running) {
      this.phase += dt / this.period;
      const top = Math.floor(this.phase);
      if (dt > GAP_S) {
        // Hidden or stalled: the beats in between are not played, and the lock is gone.
        this.lastTick = top;
        this.conf = 0;
        this.locked = false;
      }
      for (let k = this.lastTick + 1; k <= top; k++) {
        this.acc[mod(k, 4)]! *= 0.9;
        if (t - this.bassAt > QUIET_BEATS * this.period) {
          this.conf *= 0.85;
          this.relock();
        }
        if (this.locked) {
          const inBar = mod(k - this.down, 4);
          ticks.push({
            beat: k - this.lockBase,
            at: t - (this.phase - k) * this.period,
            inBar,
            inPhrase: mod(k - this.down, 8),
          });
        }
      }
      if (top > this.lastTick) this.lastTick = top;
    }
    this.updateEnergy(t);
    return ticks;
  }

  /** Seconds until the next tick (null while unlocked). */
  untilTick(t: number): number | null {
    if (!this.locked) return null;
    const ph = this.phaseAt(t);
    const next = Math.max(Math.floor(ph), this.lastTick) + 1;
    return Math.max(0, (next - ph) * this.period);
  }

  /** Seconds until the next downbeat (null while unlocked). */
  untilDownbeat(t: number): number | null {
    if (!this.locked) return null;
    const ph = this.phaseAt(t);
    let next = Math.max(Math.floor(ph), this.lastTick) + 1;
    next += mod(this.down - next, 4);
    return Math.max(0, (next - ph) * this.period);
  }

  reset(): void {
    this.env.fill(0);
    this.energy = 0;
    this.klass = "low";
    this.surge = false;
    this.calm = false;
    this.locked = false;
    this.period = 0.5;
    this.phase = 0;
    this.running = false;
    this.conf = 0;
    this.clockT = NaN;
    this.lastTick = 0;
    this.lockBase = 0;
    this.acc.fill(0);
    this.down = 0;
    this.last.fill(0);
    this.prev.fill(0);
    this.bassAt = -Infinity;
    this.snareAt = -Infinity;
    this.bassHits.length = 0;
    this.onsetN = 0;
    this.bucketId.fill(-1);
    this.bucketSum.fill(0);
    this.bucketN.fill(0);
    this.calmSince = null;
  }

  private phaseAt(t: number): number {
    return this.phase + (t - this.clockT) / this.period;
  }

  private onset(b: number, rule: OnsetRule, stamp: number, lastAt: number): boolean {
    const v = this.last[b]!;
    return v > rule.level && v - this.prev[b]! > rule.jump && stamp - lastAt >= rule.refractory;
  }

  /** A bass hit: votes the period, pulls the phase onto it, weighs the downbeat. */
  private onBass(stamp: number, level: number): void {
    this.bassHits.push(stamp);
    if (this.bassHits.length > VOTE_HITS) this.bassHits.shift();
    const voted = votePeriod(this.bassHits);

    if (!this.running) {
      if (voted === null) return;
      // The clock starts on this hit: it is beat 0.
      this.running = true;
      this.period = voted;
      this.phase = (this.clockT - stamp) / voted;
      this.lastTick = Math.floor(this.phase);
    } else if (voted !== null && Math.abs(voted / this.period - 1) > RETEMPO) {
      this.period = voted;
    }

    const at = this.phaseAt(stamp);
    const near = Math.round(at);
    const e = at - near;
    if (Math.abs(e) < PULL_WINDOW) {
      this.phase -= PULL_PHASE * e;
      this.period = Math.min(P_MAX, Math.max(P_MIN, this.period * (1 + PULL_PERIOD * e)));
      this.acc[mod(near, 4)]! += level;
      this.pickDownbeat();
    }
    this.conf = 0.85 * this.conf + 0.15 * (Math.abs(e) < HIT_WINDOW ? 1 : 0);
    // Without a steady vote the clock may run but never locks.
    if (voted === null) this.conf = Math.min(this.conf, LOCK_ON);
    this.relock();
  }

  private relock(): void {
    if (!this.locked && this.conf > LOCK_ON) {
      this.locked = true;
      // The next tick is beat 0.
      this.lockBase = Math.max(Math.floor(this.phaseAt(this.clockT)), this.lastTick) + 1;
    } else if (this.locked && this.conf < LOCK_OFF) {
      this.locked = false;
    }
  }

  /** The heaviest slot of the bar, kept unless another clearly outweighs it. */
  private pickDownbeat(): void {
    let best = this.down;
    for (let i = 0; i < 4; i++) if (this.acc[i]! > this.acc[best]!) best = i;
    if (best !== this.down && this.acc[best]! > DOWN_MARGIN * this.acc[this.down]!)
      this.down = best;
  }

  private pushOnset(stamp: number): void {
    this.onsets[this.onsetN % ONSET_RING] = stamp;
    this.onsetN++;
  }

  private addLevel(v: number, t: number): void {
    const id = Math.floor(t / BUCKET_S);
    const i = mod(id, BUCKETS);
    if (this.bucketId[i] !== id) {
      this.bucketId[i] = id;
      this.bucketSum[i] = 0;
      this.bucketN[i] = 0;
    }
    this.bucketSum[i]! += v;
    this.bucketN[i]!++;
  }

  /** Mean level over the last `w` seconds before t (0 with no level in it). */
  private meanOver(w: number, t: number): number {
    const now = Math.floor(t / BUCKET_S);
    const from = Math.floor((t - w) / BUCKET_S);
    let s = 0;
    let n = 0;
    for (let i = 0; i < BUCKETS; i++) {
      const id = this.bucketId[i]!;
      if (id > from && id <= now) {
        s += this.bucketSum[i]!;
        n += this.bucketN[i]!;
      }
    }
    return n > 0 ? s / n : 0;
  }

  private updateEnergy(t: number): void {
    const long = this.meanOver(LONG_S, t);
    const short = this.meanOver(SHORT_S, t);
    let hits = 0;
    const kept = Math.min(this.onsetN, ONSET_RING);
    for (let i = 0; i < kept; i++) if (this.onsets[i]! > t - LONG_S) hits++;
    this.energy = 0.5 * long + 0.5 * Math.min(1, hits / LONG_S / 4);

    const e = this.energy;
    const midUp = this.klass === "low" ? MID_AT + HYST : MID_AT - HYST;
    const highUp = this.klass === "high" ? HIGH_AT - HYST : HIGH_AT + HYST;
    this.klass = e >= highUp ? "high" : e >= midUp ? "mid" : "low";

    const ratio = long > 0.02 ? short / long : 1;
    this.surge = ratio > SURGE_RATIO;
    if (ratio < CALM_RATIO) {
      if (this.calmSince === null) this.calmSince = t;
      const need = this.locked ? CALM_BEATS * this.period : CALM_UNLOCKED_S;
      this.calm = t - this.calmSince >= need;
    } else {
      this.calmSince = null;
      this.calm = false;
    }
  }
}
