import { describe, expect, it, vi } from "vitest";
import { BAR, Demo, hitsAt } from "./demo";
import { Disc } from "./disc";
import { Grid } from "./grid";
import type { Home } from "./home";
import { Isle } from "./isle";
import { Body, Effects } from "./jelly";
import { STEP } from "./motion";
import { Music } from "./music";
import { paletteOf, paletteOfRgb } from "./palette";
import { boundsOf } from "./region";
import { Tempo } from "./tempo";
import { uniforms } from "./uniforms";

/** A repeatable random. */
function seeded(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const W = 1920;
const H = 1080;
const drive = () => ({ bass: 1, crash: 1 });

describe("Music mode: the music's envelopes (SPEC §2)", () => {
  it("follow each hit from its age at once, and the kick pumps the sub down", () => {
    const M = new Music();
    M.levels({ sub: 0.8, build: 0, gap: false, section: "drop", melody: 0, pitch: 0.5, voice: 0 });
    M.advance(1);
    expect(M.sub).toBeCloseTo(0.8, 3);
    M.hit("kick", 1);
    expect(M.kick).toBeCloseTo(1, 6);
    expect(M.sub).toBeCloseTo(0.8 * 0.15, 3);
    M.advance(0.11);
    expect(M.kick).toBeCloseTo(Math.exp(-1), 3);
    M.hit("crash", 0.5);
    M.advance(0.45);
    expect(M.crash).toBeCloseTo(0.5 * Math.exp(-1), 3);
  });

  it("tells each hit as it happens, and turns the trails on each crash", () => {
    const M = new Music();
    const heard: string[] = [];
    M.listen = (k) => heard.push(k);
    const turn = M.turn;
    M.hit("snare", 0.5);
    M.hit("crash", 1);
    expect(heard).toEqual(["snare", "crash"]);
    expect(M.turn).toBe(-turn);
  });

  it("plays the analysed sound's hits at the test track's strengths", () => {
    const M = new Music();
    const lv = {
      sub: 0.4,
      build: 0,
      gap: false,
      section: "drop",
      melody: 0,
      pitch: 0.3,
      voice: 0,
    } as const;
    const hits = (["kick", "snare", "hat", "crash"] as const).map((kind) => ({
      kind,
      velocity: 1,
    }));
    // Cold: a quarter of their strength, no crash.
    M.heard({ ...lv, hits });
    expect([M.vel.kick, M.vel.crash]).toEqual([0.25, 0]);
    for (let i = 0; i < 30; i++) {
      M.advance(0.1);
      M.heard({ ...lv, hits: [] });
    }
    M.heard({ ...lv, melody: 0.5, hits });
    expect([M.vel.kick, M.vel.snare, M.vel.hat, M.vel.crash]).toEqual([1, 0.9, 0.6, 1]);
    expect(M.melody).toBe(0.5);
  });
});

describe("Music mode: the lab's test track", () => {
  it("opens its drop with a kick and a crash, and keeps the build's last beat silent", () => {
    const first = hitsAt(0).map(([k]) => k);
    expect(first).toContain("kick");
    expect(first).toContain("crash");
    for (let st = 12; st < 16; st++) expect(hitsAt(11 * 16 + st)).toEqual([]);
  });

  it("plays its kicks on the music's clock: 28 a loop", () => {
    const M = new Music();
    let kicks = 0;
    M.listen = (k) => {
      if (k === "kick") kicks++;
    };
    const d = new Demo(M);
    for (let t = 0; t < 12 * BAR - 0.05; t += 1 / 120) {
      M.advance(1 / 120);
      d.advance(1 / 120);
    }
    expect(kicks).toBe(28);
  });
});

describe("Music mode: the jelly (SPEC §2, measured on the disc)", () => {
  it("punches +12 % within two frames of a kick, then contracts and rebounds", () => {
    const b = new Body(seeded());
    b.kick(1);
    const frame = 1 / 60;
    let peak = 0;
    let t = 0;
    let low = 2;
    let back = 0;
    while (t < 0.3) {
      b.step(STEP, 1);
      t += STEP;
      if (t <= 2 * frame + 1e-9) peak = Math.max(peak, b.S.x);
      if (t > 0.06 && t < 0.14) low = Math.min(low, b.S.x);
      if (t > 0.14 && t < 0.24) back = Math.max(back, b.S.x);
    }
    expect(peak).toBeGreaterThan(1.09);
    expect(peak).toBeLessThan(1.16);
    expect(low).toBeLessThan(1);
    expect(back).toBeGreaterThan(1);
  });

  it("flashes on a crash, at most 1.4, and sends shock waves", () => {
    const fx = new Effects(() => H, seeded());
    fx.crash(2);
    expect(fx.flash).toBe(1.4);
    fx.wave(0, 0, 10, 100, 1, 1, 0, 5, 1, 1);
    const U = uniforms();
    fx.step(0.1);
    fx.fill(U, 1);
    expect(U.nw).toBe(1);
    expect(fx.reach()).toBeGreaterThan(10);
  });
});

describe("Music mode: one string per source, showing only while it plays (2026-11-03)", () => {
  const disc = (M: Music) =>
    new Disc(
      () => W,
      () => H,
      new Body(seeded()),
      M,
      new Effects(() => H),
      drive,
      seeded(),
    );
  const quiet = {
    sub: 0,
    build: 0,
    gap: false,
    section: "drop",
    melody: 0,
    pitch: 0.5,
    voice: 0,
  } as const;

  it("shows the voice's string with a voice, the sub's with the sub, and none in silence", () => {
    const M = new Music();
    const d = disc(M);
    const U = uniforms();
    for (let i = 0; i < 480; i++) d.step(STEP);
    d.fill(U);
    expect([U.rings[1], U.rings[5], U.rings[9]]).toEqual([0, 0, 0]);
    M.levels({ ...quiet, voice: 0.8 });
    for (let i = 0; i < 480; i++) d.step(STEP);
    d.fill(U);
    expect(U.rings[9]!).toBeGreaterThan(0.7);
    expect(U.rings[1]! + U.rings[5]!).toBe(0);
    M.levels({ ...quiet, sub: 0.6 });
    for (let i = 0; i < 960; i++) d.step(STEP);
    d.fill(U);
    expect(U.rings[1]!).toBeGreaterThan(0.5);
    expect(U.rings[9]!).toBeLessThan(0.05);
  });

  it("plucks a string on each of its notes", () => {
    const M = new Music();
    const d = disc(M);
    M.levels({ ...quiet, melody: 0.7, pitch: 0.2 });
    for (let i = 0; i < 200; i++) d.step(STEP);
    const U = uniforms();
    d.fill(U);
    const before = U.npk;
    M.levels({ ...quiet, melody: 0.7, pitch: 0.6 });
    for (let i = 0; i < 70; i++) d.step(STEP);
    d.fill(U);
    expect(U.npk).toBeGreaterThan(before);
    expect(U.pk[(U.npk - 1) * 4]).toBe(1);
  });
});

describe("Music mode: the cover turns with the tempo (2026-11-03)", () => {
  it("finds the beat from kicks on and off it, and keeps it in a break", () => {
    const tempo = new Tempo();
    const beat = 60 / 116;
    for (let bar = 0; bar < 4; bar++)
      for (const at of [0, 2, 3.5]) tempo.beat(bar * 4 * beat + at * beat);
    for (let i = 0; i < 20; i++) tempo.beat(16 * beat + i * beat);
    expect(tempo.bpm).toBeGreaterThan(110);
    expect(tempo.bpm).toBeLessThan(122);
  });
});

describe("Music mode: the island leaves and comes home (the lab's Île)", () => {
  const home: Home = { x: 960, y: 0, w: 228, h: 32, docked: true, corner: 0 };
  const make = () => {
    const M = new Music();
    const b = new Body(seeded());
    const target = () => ({ x: W / 2, y: H * 0.43, r: H * 0.22 });
    return new Isle(
      { ...home },
      () => W,
      () => H,
      b,
      M,
      new Effects(() => H),
      drive,
      target,
      seeded(),
    );
  };

  it("squashes, lets its drop go, breaks the neck and lands as the player", () => {
    const isle = make();
    isle.leave();
    for (let i = 0; i < 48; i++) isle.step(STEP);
    isle.go();
    let t = 0;
    while (!isle.played && t < 4) {
      isle.step(STEP);
      t += STEP;
    }
    expect(isle.played).toBe(true);
    expect(isle.box()).toBeNull();
    const ball = isle.ball();
    expect(Math.abs(ball.y - H * 0.43)).toBeLessThan(0.5);
    expect(ball.cover).toBeGreaterThan(0.95);
  });

  it("leaps home from the player and ends exactly as the island", () => {
    const isle = make();
    isle.placeBall(W / 2, H * 0.43, H * 0.22, 0);
    isle.comeHome();
    for (let i = 0; i < 80; i++) isle.step(STEP);
    isle.go();
    let t = 0;
    while (!isle.atHome && t < 5) {
      isle.step(STEP);
      t += STEP;
    }
    expect(isle.atHome).toBe(true);
    const b = isle.box()!;
    expect(b.y1).toBeCloseTo(home.y + home.h, 0);
    expect(b.x1 - b.x0).toBeCloseTo(home.w, 0);
  });
});

describe("Music mode: colours and region", () => {
  it("take the cover's most coloured hue, and a red for a grey cover", () => {
    const red = paletteOf(new Array(64).fill([220, 30, 40, 255]).flat());
    expect(red.c1[0]).toBeGreaterThan(red.c1[2]);
    const grey = paletteOf(new Array(64).fill([128, 128, 128, 255]).flat());
    expect(grey.c1[0]).toBeGreaterThan(grey.c1[1]);
    const theme = paletteOfRgb("61 140 255", "214 236 255");
    expect(theme.c1[2]).toBeGreaterThan(theme.c1[0]);
  });

  it("hold every part in one box inside the stage", () => {
    const b = boundsOf(
      [
        { x0: -20, y0: 10, x1: 100, y1: 50 },
        { x0: 300, y0: 200, x1: 2500, y1: 400 },
      ],
      W,
      H,
    );
    expect(b).toEqual({ x0: 0, y0: 10, x1: W, y1: 400 });
  });
});

describe("Music mode: the beat grid (the AI's, 2026-11-03)", () => {
  it("fits the beats, runs on between them, and tells the downbeats", () => {
    const g = new Grid();
    const p = 60 / 120;
    // Beats of the last 6 s, sent at t = 10 (how long ago each was), downbeats every 4.
    const beats = Array.from({ length: 12 }, (_, i) => 10 - (4 + i * p));
    const downs = beats.filter((_, i) => i % 4 === 0);
    g.heard(
      beats.map((b) => 10 - b),
      downs.map((d) => 10 - d),
      10,
    );
    expect(g.period).toBeCloseTo(p, 6);
    // On its own, 3 s later: still on the beats.
    let seen = 0;
    let downbeats = 0;
    for (let t = 10; t < 13; t += 0.01) {
      const c = g.crossed(t, t + 0.01);
      if (c) {
        seen++;
        if (c.down) downbeats++;
      }
    }
    expect(seen).toBe(6);
    expect(downbeats).toBeGreaterThanOrEqual(1);
    expect(g.offBeat(10 + 4 * p)).toBeLessThan(0.01);
    expect(g.offBeat(10 + 4 * p + p / 4)).toBeCloseTo(p / 4, 3);
  });

  it("weighs nothing while unknown, and remembers a song's tempo", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    const g = new Grid();
    expect(g.offBeat(3)).toBe(0);
    g.songIs("a|b");
    for (let i = 0; i < 8; i++) g.mark(i * 0.4, i % 4 === 0);
    const other = new Grid();
    other.songIs("a|b");
    expect(other.period).toBeCloseTo(0.4, 3);
    vi.unstubAllGlobals();
  });
});
