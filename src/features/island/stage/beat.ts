import { Tempo } from "./tempo";

/**
 * Kysland's music mode: what the music does this frame, for the scenes. The core sends the five
 * bands' levels about 30 times a second; the tempo clock (`tempo.ts`) turns them into envelopes
 * and, once it has locked onto the beat, into beats placed in their bar. Without the clock, a hit
 * of the bass counts as a beat. Each band is also measured against its own recent level (what
 * pulses, however loud the song), a crash is a burst of the highs well above their usual peaks,
 * and each beat leaves a throb that fades over the beat. Paused, all falls back to rest. Times s.
 */

export interface Pulse {
  /** The bands' envelopes (0–1, bass first). */
  env: readonly number[];
  /** Each band above its own recent level (0–1): what pulses now, however loud the song. */
  lift: readonly number[];
  /** Hits this frame: the bass, the snare, the hi-hats, a crash (cymbal). */
  kick: boolean;
  snare: boolean;
  hat: boolean;
  crash: boolean;
  /** A beat began this frame, and its place in the bar (0: the downbeat). */
  beat: boolean;
  bar: number;
  /** 1 on a beat, fading over it (0–1). */
  throb: number;
  /** How lively the music is (0–1, slow). */
  energy: number;
  /** The beat's length (s), and whether the clock has locked onto it (bars are real then). */
  period: number;
  locked: boolean;
}

const SILENCE = [0, 0, 0, 0, 0] as const;
/** A band's recent level follows it this slowly (s); its recent peak falls back to it so. */
const FLOOR_S = 1.5;
const PEAK_S = 2;
/** A band pulses fully only this far above its recent level at least. */
const RANGE = 0.12;
/** The highs' usual height above their level is learnt this slowly (s); a crash goes far past it. */
const USUAL_S = 4;
const CRASH = 1.7;
const CRASH_GAP = 0.8;
const WARM_S = 2.5;

export class BeatInput {
  private tempo = new Tempo();
  private t = 0;
  private kick = false;
  private snare = false;
  private hatArmed = true;
  private lastHat = -1;
  private lastCrash = -9;
  private usual = 0.1;
  private hiWas = 0;
  private bars = 0;
  private wasPlaying = false;
  private floor = [0, 0, 0, 0, 0];
  private peak = [0, 0, 0, 0, 0];
  private lift = [0, 0, 0, 0, 0];
  readonly pulse: Pulse;

  constructor() {
    this.pulse = {
      env: this.tempo.env,
      lift: this.lift,
      kick: false,
      snare: false,
      hat: false,
      crash: false,
      beat: false,
      bar: 0,
      throb: 0,
      energy: 0,
      period: 0.5,
      locked: false,
    };
  }

  /** New levels from the core (bass first, 0–1). */
  feed(levels: readonly number[]): void {
    const hits = this.tempo.feed(levels, this.t);
    if (hits.bass) this.kick = true;
    if (hits.snare) this.snare = true;
  }

  /** The music `dt` s later: the envelopes, and what happened since the last frame. */
  step(dt: number, playing: boolean): Pulse {
    this.t += dt;
    // Paused: the bands fall back to rest (the core sends nothing more).
    if (!playing && this.wasPlaying) this.tempo.feed(SILENCE, this.t);
    this.wasPlaying = playing;
    const ticks = this.tempo.advance(this.t);
    const p = this.pulse;
    p.kick = playing && this.kick;
    p.snare = playing && this.snare;
    this.kick = this.snare = false;
    if (this.tempo.locked) {
      p.beat = ticks.length > 0;
      if (p.beat) p.bar = ticks[ticks.length - 1]!.inBar;
    } else {
      p.beat = p.kick;
      if (p.beat) p.bar = this.bars++ % 4;
    }
    this.lifts(dt);
    p.locked = this.tempo.locked;
    p.period = p.locked ? this.tempo.period : 0.5;
    p.throb = p.beat && playing ? 1 : p.throb * Math.exp(-dt / (0.3 * p.period));
    p.energy = playing ? this.tempo.energy : 0;
    this.highs(playing, dt);
    return p;
  }

  /** Hi-hats (the highs pulsing), and crashes (the highs far above their usual peaks). */
  private highs(playing: boolean, dt: number): void {
    const p = this.pulse;
    const lift = this.lift[4] ?? 0;
    p.hat = false;
    if (playing && lift > 0.7 && this.hatArmed && this.t - this.lastHat > 0.09) {
      p.hat = true;
      this.hatArmed = false;
      this.lastHat = this.t;
    }
    if (lift < 0.35) this.hatArmed = true;
    const env = this.tempo.env;
    const hi = 0.7 * (env[4] ?? 0) + 0.3 * (env[3] ?? 0);
    const above = hi - (0.7 * this.floor[4]! + 0.3 * this.floor[3]!);
    const rising = hi > this.hiWas + 0.015;
    this.hiWas = hi;
    p.crash = false;
    // Not before the highs' usual height has been heard a moment.
    const known = this.t > WARM_S;
    if (playing && known && rising && hi > 0.35 && above > CRASH * this.usual + 0.05) {
      if (this.t - this.lastCrash > CRASH_GAP) {
        p.crash = true;
        this.lastCrash = this.t;
      }
    }
    // The usual height of the highs above their level (their peaks, learnt slowly).
    const range = 0.7 * (this.peak[4]! - this.floor[4]!) + 0.3 * (this.peak[3]! - this.floor[3]!);
    this.usual += (Math.max(0.04, range) - this.usual) * (1 - Math.exp(-dt / USUAL_S));
  }

  private lifts(dt: number): void {
    const f = 1 - Math.exp(-dt / FLOOR_S);
    const fall = Math.exp(-dt / PEAK_S);
    this.tempo.env.forEach((e, b) => {
      const floor = this.floor[b]! + (e - this.floor[b]!) * f;
      const peak = Math.max(e, floor + (this.peak[b]! - floor) * fall);
      this.floor[b] = floor;
      this.peak[b] = peak;
      this.lift[b] = Math.min(1, Math.max(0, (e - floor) / Math.max(RANGE, peak - floor)));
    });
  }
}
