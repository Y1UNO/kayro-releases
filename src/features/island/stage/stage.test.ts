import { describe, expect, it, vi } from "vitest";
import { BAR, Demo, hitsAt } from "./demo";
import { Disc } from "./disc";
import { Grid } from "./grid";
import { Moments } from "./moments";
import { Swirl } from "./swirl";
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
    M.levels({
      sub: 0.8,
      build: 0,
      gap: false,
      section: "drop",
      melody: 0,
      pitch: 0.5,
      voice: 0,
      sharp: 0,
      heavy: 0,
    });
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
      sharp: 0,
      heavy: 0,
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

describe("Music mode: one string per source, at its place while it plays (2026-11-03)", () => {
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
    sharp: 0,
    heavy: 0,
  } as const;

  it("raises the voice's string with a voice, the sub's with the sub, and rests the others on the disc", () => {
    const M = new Music();
    const d = disc(M);
    const U = uniforms();
    // How far each string rests (0 at its place – 0.99 on the disc), from its R.w.
    const rest = () => [0, 1, 2].map((i) => U.rings[i * 4 + 3]! - i);
    for (let i = 0; i < 480; i++) d.step(STEP);
    d.fill(U);
    expect(rest().every((r) => r > 0.95)).toBe(true);
    expect(U.rings[1]!).toBeLessThan(0.3);
    M.levels({ ...quiet, voice: 0.8 });
    for (let i = 0; i < 480; i++) d.step(STEP);
    d.fill(U);
    expect(U.rings[9]!).toBeGreaterThan(0.7);
    expect(rest()[2]).toBeLessThan(0.05);
    expect(U.rings[8]!).toBeGreaterThan(d.radius() * 1.5);
    expect(rest()[0]! > 0.95 && rest()[1]! > 0.95).toBe(true);
    M.levels({ ...quiet, sub: 0.6 });
    for (let i = 0; i < 960; i++) d.step(STEP);
    d.fill(U);
    expect(U.rings[1]!).toBeGreaterThan(0.5);
    expect(rest()[2]).toBeGreaterThan(0.85);
    expect(U.rings[8]!).toBeLessThan(d.radius() * 1.1);
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

  it("keep the cover's exact hue, and its second colour or a shade of the first", () => {
    const hue = ([r, g, b]: number[]) => {
      const [mx, mn] = [Math.max(r!, g!, b!), Math.min(r!, g!, b!)];
      const c = mx - mn;
      const h = mx === r ? ((g! - b!) / c) % 6 : mx === g ? (b! - r!) / c + 2 : (r! - g!) / c + 4;
      return (h * 60 + 360) % 360;
    };
    // An orange-brown cover (hue 26°): not the bin's 22.5°, not a neon orange.
    const brown = paletteOf(new Array(64).fill([200, 110, 40, 255]).flat());
    expect(Math.abs(hue(brown.c1) - 26.25)).toBeLessThan(1.5);
    expect(Math.abs(hue(brown.c2) - hue(brown.c1) - 12)).toBeLessThan(1.5);
    // Teal and yellow: both, the more voted first (saturation counts as much as area).
    const two = paletteOf([
      ...new Array(48).fill([40, 170, 160, 255]).flat(),
      ...new Array(16).fill([230, 200, 40, 255]).flat(),
    ]);
    expect(Math.abs(hue(two.c1) - 175.4)).toBeLessThan(2);
    expect(Math.abs(hue(two.c2) - 50.5)).toBeLessThan(2);
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

describe("Music mode: the big moments besides the crash (2026-11-03)", () => {
  const lv = {
    sub: 0,
    build: 0,
    gap: false,
    section: "drop",
    melody: 0.5,
    pitch: 0.5,
    voice: 0,
    sharp: 0,
    heavy: 0,
  } as const;
  const run = (m: Moments, M: Music, secs: number, down = () => false) => {
    const out: string[] = [];
    for (let i = 0; i < secs * 100; i++) {
      M.advance(0.01);
      const got = m.step(0.01, M, down());
      if (got) out.push(got);
    }
    return out;
  };

  it("blooms when a voice comes in after 3 s without one, and not right after a crash", () => {
    const [m, M] = [new Moments(), new Music()];
    M.levels(lv);
    expect(run(m, M, 3.5)).toEqual([]);
    M.levels({ ...lv, voice: 0.6 });
    expect(run(m, M, 1)).toEqual(["bloom"]);
    M.levels(lv);
    run(m, M, 3.5);
    expect(m.allow("crash", M.t, M)).toBe(true);
    M.levels({ ...lv, voice: 0.6 });
    expect(run(m, M, 1)).toEqual([]);
  });

  it("breathes when the music settles after a drop, on the next downbeat", () => {
    const [m, M] = [new Moments(), new Music()];
    M.levels(lv);
    run(m, M, 7);
    M.levels({ ...lv, section: "break" });
    let n = 0;
    // No grid: at once; a grid: on its downbeat.
    expect(run(m, M, 0.5)).toEqual(["breath"]);
    M.levels(lv);
    run(m, M, 7);
    for (let i = 0; i < 8; i++) M.grid.mark(M.t - 4 + i * 0.5, i % 4 === 0);
    M.levels({ ...lv, section: "break" });
    const out = run(m, M, 2, () => ++n === 120);
    expect(out).toEqual(["breath"]);
  });
});

describe("Music mode: sharp or soft notes, and a big bass (2026-11-03)", () => {
  const lv = {
    sub: 0,
    build: 0,
    gap: false,
    section: "drop",
    melody: 0.7,
    pitch: 0.4,
    voice: 0,
  } as const;
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

  it("marks a chopped note's pluck as sharp and a soft one's as round", () => {
    for (const sharp of [0, 1]) {
      const M = new Music();
      M.levels({ ...lv, sharp, heavy: 0 });
      const d = disc(M);
      for (let i = 0; i < 300; i++) d.step(STEP);
      const U = uniforms();
      d.fill(U);
      expect(U.npk).toBeGreaterThan(0);
      const mark = U.pk[0]! - Math.floor(U.pk[0]!);
      expect(mark).toBeCloseTo(0.09 * sharp, 3);
    }
  });

  it("rumbles when the bass crushes the mix, less under a sub merely strong, not under a light one", () => {
    const wobble = (sub: number, heavy: number) => {
      const M = new Music();
      M.levels({ ...lv, melody: 0, sub, sharp: 0, heavy });
      M.advance(1);
      const d = disc(M);
      let most = 0;
      for (let i = 0; i < 960; i++) {
        d.step(STEP);
        if (i > 480) most = Math.max(most, Math.abs(d.body.m[0]!.a.x));
      }
      return most;
    };
    expect(wobble(0.95, 1)).toBeGreaterThan(0.008);
    expect(wobble(0.95, 1)).toBeLessThan(0.05);
    expect(wobble(0.95, 0)).toBeLessThan(wobble(0.95, 1) * 0.5);
    expect(wobble(0.3, 0)).toBeLessThan(0.002);
  });
});

describe("Music mode: the Milky Way and the Supernova (2026-11-03)", () => {
  const [cx, cy, R] = [960, 460, 200];
  const far = (U: ReturnType<typeof uniforms>, from: number, n: number) => {
    let d = 0;
    for (let i = from; i < n; i++) {
      const [x, y, r] = [U.balls[i * 4]!, U.balls[i * 4 + 1]!, U.balls[i * 4 + 2]!];
      d = Math.max(d, Math.hypot(x - cx, y - cy) + r);
    }
    return d;
  };

  it("opens into 5 fine arms wound round a smaller bubble, then winds them back in", () => {
    const s = new Swirl(seeded());
    s.galaxy();
    for (let t = 0; t < 0.6; t += STEP) s.step(STEP, cx, cy, R);
    const U = uniforms();
    expect(s.fill(U, 3, cx, cy, R)).toBe(3);
    expect(U.ns).toBe(50);
    let reach = 0;
    let thickest = 0;
    for (let i = 0; i < U.ns; i++) {
      const [x, y] = [U.segA[i * 4 + 2]!, U.segA[i * 4 + 3]!];
      reach = Math.max(reach, Math.hypot(x - cx, y - cy));
      thickest = Math.max(thickest, U.segB[i * 4]!);
    }
    expect(reach).toBeGreaterThan(R * 1.4);
    expect(thickest).toBeLessThan(R * 0.13);
    expect(s.core).toBeLessThan(0.5);
    expect(s.spin).toBeGreaterThan(10);
    for (let t = 0; t < 1.6; t += STEP) s.step(STEP, cx, cy, R);
    expect(s.active).toBe(false);
    U.ns = 0;
    expect([s.core, s.spin, s.fill(U, 3, cx, cy, R), U.ns]).toEqual([1, 0, 3, 0]);
  });

  it("bursts into beads, then swallows them all in its black hole and grows back", () => {
    const s = new Swirl(seeded());
    s.nova(cx, cy, R * 0.9, H, 1);
    for (let t = 0; t < 0.5; t += STEP) s.step(STEP, cx, cy, R);
    const U = uniforms();
    const out = far(U, 0, s.fill(U, 0, cx, cy, R));
    expect(out).toBeGreaterThan(R * 2);
    expect(s.core).toBeLessThan(0.7);
    let t = 0;
    while (s.active && t < 4) {
      s.step(STEP, cx, cy, R);
      t += STEP;
    }
    expect(s.active).toBe(false);
    expect(s.core).toBe(1);
  });

  it("finds the drop: the drums back after a pause, or a crash ending a build", () => {
    const [m, M] = [new Moments(), new Music()];
    const lv = { sub: 0, build: 0, gap: false, section: "drop", melody: 0, pitch: 0.5 } as const;
    // The very first kick is not a drop; one after 3 s without, strong, is.
    expect(m.isDrop(1, "kick", 0.9, 0)).toBe(false);
    expect(m.isDrop(1.5, "kick", 0.9, 0)).toBe(false);
    expect(m.isDrop(4.5, "kick", 0.9, 0)).toBe(true);
    // A weak kick after a pause, without bass: no.
    expect(m.isDrop(13, "kick", 0.3, 0.1)).toBe(false);
    // A crash right after a build is; a lone crash is not.
    M.levels({ ...lv, voice: 0, sharp: 0, heavy: 0, build: 0.8, section: "build" });
    M.advance(20);
    m.step(0.01, M, false);
    expect(m.isDrop(M.t + 0.5, "crash", 1, 0)).toBe(true);
    expect(m.isDrop(M.t + 30, "crash", 1, 0)).toBe(false);
  });
});

describe("Music mode: the big moments' spacing follows the music (2026-11-03)", () => {
  it("lets a bigger moment come soon after a smaller, and spaces the same one by bars", () => {
    const [m, M] = [new Moments(), new Music()];
    // A grid at 120 BPM (a bar: 2 s).
    for (let i = 0; i < 8; i++) M.grid.mark(i * 0.5, i % 4 === 0);
    M.advance(4);
    expect(m.allow("bloom", M.t, M)).toBe(true);
    // A crash 0.6 s later (bigger): yes; another bloom 1 s later (smaller): no.
    expect(m.allow("crash", M.t + 0.6, M)).toBe(true);
    expect(m.allow("bloom", M.t + 1.6, M)).toBe(false);
    // The drop 0.6 s after the crash: yes (bigger); a crash 1.5 s after the drop: no (2 bars).
    expect(m.allow("nova", M.t + 1.2, M)).toBe(true);
    expect(m.allow("crash", M.t + 2.7, M)).toBe(false);
    expect(m.allow("crash", M.t + 5.3, M)).toBe(true);
    // The same drop again within 4 bars: no.
    expect(m.allow("nova", M.t + 7, M)).toBe(false);
  });
});
