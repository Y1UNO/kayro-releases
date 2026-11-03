import { clamp } from "./motion";
import type { HitKind, Music, Section } from "./music";

/**
 * Kysland's music mode: the lab's test track, to tune and compare with `reference-labo.html`
 * (Réglages › Mode musique › Avancé › Mode démo). 116 BPM, 12 bars looped: 8 of drop (a crash on
 * bars 1 and 5), 2 of break (pads, a soft crash), 2 of build (snare roll, a riser, a silent last
 * beat). Its hits are given to `Music` on each sixteenth they fall on; its sub, build and silence
 * follow the timeline. A lead plays chord tones in eighths during the drop (added 2026-11-03 so
 * the strings have a melody to follow). With sound on, the same track is synthesised and
 * scheduled ahead on the audio clock, and the timeline follows what is heard. Times in s.
 */

export const BPM = 116;
export const BEAT = 60 / BPM;
const SIXTEENTH = BEAT / 4;
export const BAR = BEAT * 4;
const BARS = 12;
const STEPS = BARS * 16;
const LOOP = BARS * BAR;

const sectionOf = (bar: number): Section => (bar < 8 ? "drop" : bar < 10 ? "break" : "build");

/** The hits on sixteenth `ls` of the loop. */
export function hitsAt(ls: number): [HitKind, number][] {
  const bar = ls >> 4;
  const st = ls & 15;
  const sec = sectionOf(bar);
  const H: [HitKind, number][] = [];
  if (sec === "drop") {
    if (st === 0) H.push(["kick", bar % 4 === 0 ? 1 : 0.9]);
    if (st === 8) H.push(["kick", 0.85]);
    if (st === 14) H.push(["kick", 0.72]);
    if (st === 4 || st === 12) H.push(["snare", 0.9]);
    if (st % 2 === 0) H.push(["hat", st % 4 === 2 ? 0.75 : 0.45]);
    if (st === 0 && bar === 0) H.push(["crash", 1]);
    if (st === 0 && bar === 4) H.push(["crash", 0.62]);
  } else if (sec === "break") {
    if (bar === 8 && st === 0) H.push(["crash", 0.45]);
    if (st % 4 === 2) H.push(["hat", 0.3]);
  } else {
    const b = bar - 10;
    if (b === 0) {
      if (st % 4 === 0) H.push(["kick", 0.62]);
      if (st % 2 === 0) H.push(["snare", 0.3 + (0.3 * st) / 16]);
    } else if (st < 12) H.push(["snare", 0.6 + (0.4 * st) / 12]);
    if (st % 2 === 0 && !(b === 1 && st >= 12)) H.push(["hat", 0.25 + 0.25 * b]);
  }
  return H;
}

/** The lead's notes (Hz) for a bar: chord tones of its root (A, A, F, G), in eighths. */
const CHORDS: Record<string, number[]> = {
  A: [440, 523.25, 659.25],
  F: [349.23, 440, 523.25],
  G: [392, 493.88, 587.33],
};
const ROOT = (bar: number) =>
  bar < 8 ? ["A", "A", "F", "G"][bar % 4]! : bar === 8 ? "F" : bar === 9 ? "G" : "A";
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];
export const leadAt = (bar: number, eighth: number): number =>
  CHORDS[ROOT(bar)]![ARP[eighth % 8]!]!;

export class Demo {
  /** The track's time (s), starting in the build: its drop comes a few seconds in. */
  t = 10 * BAR;
  private step: number;
  private mel = 0;
  private synth: import("./demoSound").DemoSound | null = null;

  constructor(private music: Music) {
    this.step = Math.floor(this.t / SIXTEENTH) - 1;
  }

  /** Plays the track aloud too (the timeline then follows what is heard). */
  async sound(on: boolean): Promise<void> {
    if (!on) {
      this.synth?.stop();
      this.synth = null;
      return;
    }
    const { DemoSound } = await import("./demoSound");
    this.synth = DemoSound.start(this.t);
  }

  /** `dt` s later: its hits, then its levels. */
  advance(dt: number): void {
    this.t += dt;
    const heard = this.synth?.heard();
    if (heard !== undefined) {
      const err = heard - this.t;
      this.t += Math.abs(err) > 0.08 ? err : err * 0.15;
    }
    const g = Math.floor(this.t / SIXTEENTH);
    if (g < this.step || g - this.step > 48) this.step = g;
    while (this.step < g) {
      this.step++;
      const ls = ((this.step % STEPS) + STEPS) % STEPS;
      for (const [kind, v] of hitsAt(ls)) this.music.hit(kind, v);
    }
    this.levels(dt);
  }

  private levels(dt: number): void {
    const lp = ((this.t % LOOP) + LOOP) % LOOP;
    const bar = Math.min(11, Math.floor(lp / BAR));
    const sec = sectionOf(bar);
    let [build, gap] = [0, false];
    let sub: number;
    let mel: number;
    let pitch: number;
    if (sec === "drop") {
      sub = 0.8;
      const e = (lp / (BEAT / 2)) % 1;
      const eighth = Math.floor((lp % BAR) / (BEAT / 2));
      mel = 0.35 + 0.45 * Math.exp(-e * 3);
      pitch = clamp(Math.log2(leadAt(bar, eighth) / 300) / 1.3, 0, 1);
    } else if (sec === "break") {
      const u = (lp - 8 * BAR) / (2 * BAR);
      sub = 0.15 + 0.75 * Math.pow(Math.sin(Math.PI * u), 1.4);
      mel = 0.6 * Math.pow(Math.sin(Math.PI * ((lp / BAR) % 1)), 0.8);
      pitch = 0.45;
    } else {
      build = clamp((lp - 10 * BAR) / (2 * BAR - BEAT), 0, 1);
      gap = bar === 11 && lp - 11 * BAR >= 3 * BEAT;
      sub = bar === 10 ? 0.55 : 0;
      mel = gap ? 0 : 0.25 + 0.5 * build;
      pitch = 0.3 + 0.6 * build;
    }
    // The melody as the analyser gives it: quick to rise, slow to fall.
    this.mel += (mel - this.mel) * (1 - Math.exp(-dt / (mel > this.mel ? 0.04 : 0.3)));
    this.music.levels({ sub, build, gap, section: sec, melody: this.mel, pitch, voice: 0 });
  }

  stop(): void {
    this.synth?.stop();
    this.synth = null;
  }
}
