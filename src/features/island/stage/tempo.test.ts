import { describe, expect, it } from "vitest";
import { fold, Tempo, votePeriod, type Tick } from "./tempo";

/** A seeded random (mulberry32), so the tests are the same every run. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

interface Run {
  ticks: Tick[];
  /** The true sound times of the bass hits. */
  hits: number[];
  lockedAt: number | null;
}

/**
 * Plays a bass pattern into the clock: a hit every `beat` s (accented every 4th, starting on the
 * 3rd hit), heard 55 ms late, levels arriving at ~30 Hz (with `jitter` s of random delay), and the
 * clock advanced at 60 Hz.
 */
function play(
  tempo: Tempo,
  opts: {
    from?: number;
    to: number;
    beat?: number;
    jitter?: number;
    seed?: number;
    rest?: number;
    accent?: boolean;
  },
): Run {
  const beat = opts.beat ?? 0.5;
  const from = opts.from ?? 0;
  const rest = opts.rest ?? 0.3;
  const r = rng(opts.seed ?? 1);
  const run: Run = { ticks: [], hits: [], lockedAt: null };
  for (let h = Math.ceil(from / beat) * beat; h < opts.to; h += beat) run.hits.push(h);
  let nextFeed = from;
  for (let t = from; t < opts.to; t += 1 / 60) {
    while (nextFeed <= t) {
      // What the levels show at this arrival: the sound of 55 ms before.
      const heard = nextFeed - 0.055;
      const since = heard - Math.floor(heard / beat) * beat;
      const n = Math.round((heard - since) / beat);
      const hit = heard >= 0 && since < 0.1;
      const loud = opts.accent !== false && mod(n - 2, 4) === 0 ? 0.98 : 0.88;
      const bass = hit ? loud : rest;
      tempo.feed([bass, 0.4, 0.4, 0.3, 0.2], nextFeed);
      nextFeed += 1 / 30 + (opts.jitter ?? 0) * (r() - 0.5);
    }
    run.ticks.push(...tempo.advance(t));
    if (tempo.locked && run.lockedAt === null) run.lockedAt = t;
  }
  return run;
}

const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** The distance from `at` to the nearest of `hits` (s). */
function nearest(at: number, hits: readonly number[]): number {
  let best = Infinity;
  for (const h of hits) best = Math.min(best, Math.abs(h - at));
  return best;
}

describe("period vote", () => {
  it("folds intervals by octaves into [0.35, 0.75)", () => {
    expect(fold(1)).toBeCloseTo(0.5);
    expect(fold(0.25)).toBeCloseTo(0.5);
    expect(fold(0.75)).toBeCloseTo(0.375);
    expect(fold(0.6)).toBeCloseTo(0.6);
  });

  it("finds a steady beat and refuses a random one", () => {
    const steady = Array.from({ length: 16 }, (_, i) => i * 0.46);
    expect(votePeriod(steady)).toBeCloseTo(0.46, 3);
    const r = rng(7);
    let t = 0;
    const loose = Array.from({ length: 16 }, () => (t += 0.2 + r() * 0.9));
    expect(votePeriod(loose)).toBeNull();
    expect(votePeriod([0, 0.5])).toBeNull();
  });
});

describe("tempo clock", () => {
  it("locks onto a 120 BPM bass within a few seconds, on the beat", () => {
    const tempo = new Tempo();
    const run = play(tempo, { to: 20 });
    expect(run.lockedAt).not.toBeNull();
    expect(run.lockedAt!).toBeLessThan(5);
    expect(tempo.period).toBeGreaterThan(0.49);
    expect(tempo.period).toBeLessThan(0.51);
    const late = run.ticks.filter((k) => k.at > 8);
    expect(late.length).toBeGreaterThan(20);
    for (const k of late) expect(nearest(k.at, run.hits)).toBeLessThan(0.03);
    // Beats count up from 0 with no gap or repeat.
    run.ticks.forEach((k, i) => expect(k.beat).toBe(i));
  });

  it("puts the downbeat on the accent, 4 beats apart, phrases on downbeats", () => {
    const tempo = new Tempo();
    const run = play(tempo, { to: 24 });
    const downs = run.ticks.filter((k) => k.at > 10 && k.inBar === 0);
    expect(downs.length).toBeGreaterThan(4);
    for (let i = 1; i < downs.length; i++) expect(downs[i]!.beat - downs[i - 1]!.beat).toBe(4);
    // Accents fall on hits 2, 6, 10…: at 1 s, 3 s, 5 s…
    for (const k of downs) expect(mod(k.at - 1, 2) < 0.05 || mod(k.at - 1, 2) > 1.95).toBe(true);
    for (const k of run.ticks) expect(k.inPhrase % 4).toBe(k.inBar);
    const starts = run.ticks.filter((k) => k.at > 10 && k.inPhrase === 0);
    for (let i = 1; i < starts.length; i++) expect(starts[i]!.beat - starts[i - 1]!.beat).toBe(8);
  });

  it("still locks with jittery 30 Hz levels", () => {
    const tempo = new Tempo();
    const run = play(tempo, { to: 24, jitter: 0.02, seed: 3 });
    expect(run.lockedAt).not.toBeNull();
    expect(run.lockedAt!).toBeLessThan(8);
    expect(Math.abs(tempo.period - 0.5)).toBeLessThan(0.01);
    const late = run.ticks.filter((k) => k.at > 12);
    for (const k of late) expect(nearest(k.at, run.hits)).toBeLessThan(0.04);
  });

  it("follows another tempo (100 BPM)", () => {
    const tempo = new Tempo();
    play(tempo, { to: 20, beat: 0.6 });
    expect(tempo.locked).toBe(true);
    expect(Math.abs(tempo.period - 0.6)).toBeLessThan(0.012);
  });

  it("never locks on random levels", () => {
    for (const seed of [1, 2, 3, 4]) {
      const tempo = new Tempo();
      const r = rng(seed);
      let ticks = 0;
      let t = 0;
      for (let f = 0; f < 30 * 60; f++) {
        t += 1 / 30 + 0.01 * (r() - 0.5);
        tempo.feed([r(), r(), r(), r(), r()], t);
        ticks += tempo.advance(t).length;
        expect(tempo.locked).toBe(false);
      }
      expect(ticks).toBe(0);
    }
  });

  it("lets the lock go when the bass stops, and after a long gap", () => {
    const tempo = new Tempo();
    play(tempo, { to: 12 });
    expect(tempo.locked).toBe(true);
    for (let t = 12; t < 18; t += 1 / 30) {
      tempo.feed([0.3, 0.3, 0.3, 0.3, 0.3], t);
      tempo.advance(t);
    }
    expect(tempo.locked).toBe(false);

    const again = new Tempo();
    play(again, { to: 12 });
    expect(again.locked).toBe(true);
    expect(again.advance(40)).toEqual([]);
    expect(again.locked).toBe(false);
  });

  it("answers untilTick / untilDownbeat: null unlocked, consistent locked", () => {
    const tempo = new Tempo();
    expect(tempo.untilTick(0)).toBeNull();
    expect(tempo.untilDownbeat(0)).toBeNull();
    play(tempo, { to: 15 });
    expect(tempo.locked).toBe(true);
    const t = 15;
    const tick = tempo.untilTick(t)!;
    const down = tempo.untilDownbeat(t)!;
    expect(tick).toBeGreaterThan(0);
    expect(tick).toBeLessThanOrEqual(tempo.period + 1e-9);
    expect(down).toBeGreaterThanOrEqual(tick - 1e-9);
    expect(down).toBeLessThan(4 * tempo.period + 1e-9);
    // Down is a whole number of beats after the next tick.
    const beats = (down - tick) / tempo.period;
    expect(Math.abs(beats - Math.round(beats))).toBeLessThan(1e-6);
    // The tick comes when promised, and the downbeat on its place in the bar.
    const ticks = tempo.advance(t + down + 0.001);
    expect(ticks.length).toBe(Math.round(beats) + 1);
    expect(ticks[0]!.at).toBeCloseTo(t + tick, 6);
    expect(ticks[ticks.length - 1]!.inBar).toBe(0);
  });

  it("smooths the bands: quick attack, slow release", () => {
    const tempo = new Tempo();
    tempo.advance(0);
    tempo.feed([1, 0, 0, 0, 0], 0);
    tempo.advance(0.025);
    expect(tempo.env[0]).toBeCloseTo(1 - Math.exp(-1), 5);
    tempo.advance(0.2);
    tempo.feed([0, 0, 0, 0, 0], 0.2);
    tempo.advance(0.38);
    expect(tempo.env[0]).toBeGreaterThan(0.3);
    expect(tempo.env[0]).toBeLessThan(0.4);
  });

  it("finds bass and snare hits with their refractory times", () => {
    const tempo = new Tempo();
    expect(tempo.feed([0.3, 0, 0, 0.3, 0], 0)).toEqual({ bass: false, snare: false, level: 0 });
    expect(tempo.feed([0.9, 0, 0, 0.9, 0], 0.033)).toEqual({ bass: true, snare: true, level: 0.9 });
    tempo.feed([0.3, 0, 0, 0.3, 0], 0.066);
    // 100 ms after: too soon for either.
    expect(tempo.feed([0.9, 0, 0, 0.9, 0], 0.133)).toEqual({ bass: false, snare: false, level: 0 });
    tempo.feed([0.3, 0, 0, 0.3, 0], 0.166);
    // 166 ms after the first: a snare again, not yet a bass.
    expect(tempo.feed([0.95, 0, 0, 0.9, 0], 0.2)).toEqual({ bass: false, snare: true, level: 0 });
    tempo.feed([0.3, 0, 0, 0.3, 0], 0.233);
    expect(tempo.feed([0.95, 0, 0, 0.3, 0], 0.266).bass).toBe(true);
  });
});

describe("energy", () => {
  it("rises to high and surges on a loud passage, then calms down", () => {
    const tempo = new Tempo();
    let surged = false;
    for (let t = 0; t < 10; t += 1 / 30) {
      tempo.feed([0.1, 0.1, 0.1, 0.1, 0.1], t);
      tempo.advance(t);
    }
    expect(tempo.klass).toBe("low");
    expect(tempo.surge).toBe(false);
    for (let t = 10; t < 20; t += 1 / 30) {
      const hit = mod(t, 0.5) < 0.1;
      tempo.feed([hit ? 0.98 : 0.5, 0.9, 0.9, hit ? 0.95 : 0.4, 0.8], t);
      tempo.advance(t);
      if (t < 11 && tempo.surge) surged = true;
    }
    expect(surged).toBe(true);
    expect(tempo.klass).toBe("high");
    expect(tempo.energy).toBeGreaterThan(0.64);
    expect(tempo.surge).toBe(false);
    let calmAt: number | null = null;
    for (let t = 20; t < 30; t += 1 / 30) {
      tempo.feed([0.1, 0.1, 0.1, 0.1, 0.1], t);
      tempo.advance(t);
      if (tempo.calm && calmAt === null) calmAt = t;
    }
    expect(calmAt).not.toBeNull();
    expect(calmAt! - 20).toBeGreaterThan(3.5);
    expect(calmAt! - 20).toBeLessThan(6);
  });

  it("holds its class inside the hysteresis band", () => {
    const tempo = new Tempo();
    let now = 0;
    const level = (v: number, from: number, to: number): void => {
      for (let t = from; t < to; t += 1 / 30) {
        // A slow glide to the new level, so no hit is found.
        now += Math.max(-0.01, Math.min(0.01, v - now));
        tempo.feed([now, now, now, now, now], t);
        tempo.advance(t);
      }
    };
    // E = level / 2 here (no hits): 0.76 → 0.38, below the low → mid edge (0.39).
    level(0.76, 0, 10);
    expect(tempo.klass).toBe("low");
    level(0.82, 10, 20);
    expect(tempo.klass).toBe("mid");
    // 0.66 → 0.33: still mid (it drops at 0.31).
    level(0.66, 20, 30);
    expect(tempo.klass).toBe("mid");
    level(0.5, 30, 40);
    expect(tempo.klass).toBe("low");
  });

  it("forgets everything on reset", () => {
    const tempo = new Tempo();
    play(tempo, { to: 12 });
    tempo.reset();
    expect(tempo.locked).toBe(false);
    expect(tempo.energy).toBe(0);
    expect(tempo.env.every((v) => v === 0)).toBe(true);
    expect(tempo.untilTick(12)).toBeNull();
    const run = play(tempo, { from: 30, to: 42 });
    expect(run.lockedAt).not.toBeNull();
    expect(run.ticks[0]!.beat).toBe(0);
  });
});
