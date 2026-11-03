import { describe, expect, it } from "vitest";
import { Attach } from "./attach";
import { homeCorners, traceBall } from "./ball";
import { BeatInput } from "./beat";
import { Dance } from "./dance";
import { Detach } from "./detach";
import { Disk } from "./disk";
import {
  BEATS,
  FIGURES,
  nextFigure,
  orbit,
  place,
  type FigureKind,
  type FigureState,
} from "./figures";
import { dimsOf, homeBox, homeCentre, type Home } from "./home";
import { CAPRI_STRINGS, stringColours, toHsl } from "./hues";
import { fitTitle } from "./letterKit";
import type { Part } from "./region";
import { metricsOf } from "./scale";
import { atRest, type Look } from "./scene";

/** Records a traced outline's points (moveTo / lineTo only: what the ball traces). */
function recorder() {
  const pts: [number, number][] = [];
  const ctx = {
    moveTo: (x: number, y: number) => pts.push([x, y]),
    lineTo: (x: number, y: number) => pts.push([x, y]),
    closePath: () => undefined,
    arc: () => undefined,
    arcTo: () => undefined,
  };
  return { pts, ctx: ctx as unknown as Path2D };
}

/** A repeatable random. */
function seeded(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const middle: Home = { x: 960, y: 0, w: 228, h: 32, docked: true, corner: 0 };
const corner: Home = { ...middle, x: 92, corner: -1 };
const floating: Home = { ...middle, y: 40, h: 44, docked: false };
const STEP = 1 / 240;

describe("Music mode: the ball's shape", () => {
  it("is a circle with all corners round and equal sides", () => {
    const { pts, ctx } = recorder();
    traceBall(ctx, 100, 50, 40, 40, [1, 1, 1, 1]);
    for (const [x, y] of pts) expect(Math.hypot(x - 100, y - 50)).toBeCloseTo(40, 5);
  });

  it("starts as the island: a square top, its flush side square in a corner", () => {
    expect(homeCorners(middle)).toEqual([0, 0, 1, 1]);
    expect(homeCorners(corner)).toEqual([0, 0, 1, 0]);
    expect(homeCorners({ ...middle, corner: 1 })).toEqual([0, 0, 0, 1]);
    expect(homeCorners(floating)).toEqual([1, 1, 1, 1]);
  });
});

describe("Music mode: leaving and coming home", () => {
  const drop = { x: 960, y: 560, r: 150 };

  it("squashes, sags, lets go and is a round ball near the middle within a second", () => {
    for (const home of [middle, corner, floating]) {
      const d = new Detach(home, drop, seeded());
      let t = 0;
      while (!d.ready && t < 2) {
        d.step(STEP);
        t += STEP;
      }
      expect(t).toBeGreaterThan(Detach.SQUASH + Detach.SAG);
      expect(t).toBeLessThan(1);
      const b = d.body();
      expect(Number.isFinite(b.r + b.x + b.y + b.vx + b.vy)).toBe(true);
      expect(Math.hypot(b.x - drop.x, b.y - drop.y)).toBeLessThan(0.35 * Math.hypot(drop.y, 1));
    }
  });

  it("comes home as the island exactly, its top on the edge from the touch on", () => {
    for (const home of [middle, corner, floating]) {
      const a = new Attach(home, { ...atRest(960, 560, 160), vy: -40 });
      let t = 0;
      let touched = false;
      while (!a.settled && t < 4) {
        a.step(STEP);
        t += STEP;
        if (a.phase === "spread" && home.docked) {
          touched = true;
          // Glued: drawn as the island at a growing size, its top on the edge.
          expect(homeBox(home, a.dims()).y0).toBe(home.y);
        }
      }
      expect(a.settled).toBe(true);
      expect(t).toBeLessThan(3.2);
      expect(a.dims()).toEqual(dimsOf(home));
      if (home.docked) expect(touched).toBe(true);
      else expect(a.look).toBe(1);
    }
  });

  it("turns back to the show before the touch, not after", () => {
    const a = new Attach(middle, atRest(960, 560, 160));
    for (let i = 0; i < 20; i++) a.step(STEP);
    expect(a.back({ x: 960, y: 560, r: 150 })).toBe(true);
    let t = 0;
    while (!a.returned && t < 4) {
      a.step(STEP);
      t += STEP;
    }
    expect(a.returned).toBe(true);
    const late = new Attach(middle, atRest(960, 560, 160));
    while (late.phase === "crouch" || late.phase === "rise") late.step(STEP);
    expect(late.back({ x: 960, y: 560, r: 150 })).toBe(false);
  });

  it("aims at the middle of its place (in a corner, against its side)", () => {
    const a = new Attach(corner, atRest(960, 560, 160));
    while (a.phase === "crouch" || a.phase === "rise") a.step(STEP);
    const c = homeCentre(corner);
    expect(Math.abs(a.body().x - c.x)).toBeLessThan(110);
  });
});

describe("Music mode: the title", () => {
  const measure = (s: string, size: number) => s.length * size * 0.62;

  it("fits one line at the largest size it can", () => {
    const fit = fitTitle("La Sangre", measure, 160, 70, 2000);
    expect(fit.lines).toEqual(["La Sangre"]);
    expect(fit.size).toBe(160);
  });

  it("goes on two lines, cut near the middle, when one would be too small", () => {
    const fit = fitTitle("Never Gonna Give You Up Remastered Edition", measure, 160, 70, 900);
    expect(fit.lines).toHaveLength(2);
    expect(fit.size).toBeGreaterThanOrEqual(70);
    for (const l of fit.lines) expect(measure(l, fit.size)).toBeLessThanOrEqual(900 + 1e-6);
  });

  it("shortens what still does not fit, and draws nothing for no title", () => {
    const fit = fitTitle("A".repeat(80), measure, 160, 70, 900);
    expect(fit.lines[0]!.endsWith("…")).toBe(true);
    expect(measure(fit.lines[0]!, fit.size)).toBeLessThanOrEqual(900 + 1e-6);
    expect(fitTitle("   ", measure, 160, 70, 900).lines).toEqual([]);
  });
});

describe("Music mode: the music", () => {
  it("says a band pulses when it rises above its own recent level, whatever the loudness", () => {
    for (const loud of [0.35, 1]) {
      const b = new BeatInput();
      let top = 0;
      let low = 1;
      for (let i = 0; i < 300; i++) {
        const t = i / 30;
        const f = (t / 0.5) % 1;
        b.feed([loud * (0.2 + 0.8 * Math.exp(-f * 8)), 0, 0, 0, 0]);
        const p = b.step(1 / 30, true);
        if (i > 150) {
          top = Math.max(top, p.lift[0]!);
          if (f > 0.6) low = Math.min(low, p.lift[0]!);
        }
      }
      expect(top).toBeGreaterThan(0.8);
      expect(low).toBeLessThan(0.15);
    }
  });

  it("falls back to rest when paused", () => {
    const b = new BeatInput();
    for (let i = 0; i < 60; i++) {
      b.feed([0.9, 0.5, 0.5, 0.5, 0.5]);
      b.step(1 / 30, true);
    }
    let p = b.step(1 / 30, false);
    for (let i = 0; i < 60; i++) p = b.step(1 / 30, false);
    expect(Math.max(...p.env)).toBeLessThan(0.01);
    expect(p.kick || p.snare || p.hat || p.crash).toBe(false);
    expect(p.energy).toBe(0);
  });

  it("hears a crash: the highs far above their usual peaks, not the hi-hats", () => {
    const b = new BeatInput();
    let crashes = 0;
    let crashAt = -1;
    for (let i = 0; i < 600; i++) {
      const t = i / 30;
      const f = (t / 0.25) % 1;
      // Hi-hats on every eighth, then a crash at 15 s.
      const hats = 0.2 + 0.25 * Math.exp(-f * 10);
      const crash = t >= 15 ? 0.95 * Math.exp(-(t - 15) * 1.5) : 0;
      b.feed([0.3, 0.3, 0.3, 0.3, Math.min(1, hats + crash)]);
      const p = b.step(1 / 30, true);
      if (p.crash) {
        crashes++;
        crashAt = t;
      }
    }
    expect(crashes).toBe(1);
    expect(crashAt).toBeGreaterThanOrEqual(15);
    expect(crashAt).toBeLessThan(15.3);
  });

  it("throbs on each beat and lets the throb fade over it", () => {
    const b = new BeatInput();
    let after = 1;
    for (let i = 0; i < 120; i++) {
      const f = (i / 30 / 0.5) % 1;
      b.feed([0.2 + 0.8 * Math.exp(-f * 8), 0, 0, 0, 0]);
      const p = b.step(1 / 30, true);
      if (p.beat) expect(p.throb).toBe(1);
      else after = Math.min(after, p.throb);
    }
    expect(after).toBeLessThan(0.2);
  });
});

describe("Music mode: the strings' colours", () => {
  it("are Capri's without an album, and bright enough on black with one", () => {
    expect(stringColours(null, null)).toEqual([...CAPRI_STRINGS]);
    const cols = stringColours("40 10 60", "20 20 30");
    expect(cols).toHaveLength(4);
    for (const c of cols) expect(toHsl(c)[2]).toBeGreaterThanOrEqual(0.55);
  });

  it("are whites for a grey cover, and set apart when the two colours are alike", () => {
    for (const c of stringColours("128 128 128", "60 60 60"))
      expect(toHsl(c)[1]).toBeLessThan(0.12);
    const [bass, low] = stringColours("200 30 30", "180 40 35");
    const apart = Math.abs(toHsl(bass!)[0] - toHsl(low!)[0]);
    expect(Math.min(apart, 360 - apart)).toBeGreaterThan(20);
  });
});

describe("Music mode: Dancing's figures", () => {
  const state = (kind: FigureKind, ft: number): FigureState => {
    const r = seeded(3);
    return {
      kind,
      ft,
      td: ft,
      P: 0.5,
      e0: 0.6,
      n: 24,
      orbits: [0, 1, 2, 3].map(() => orbit(r)),
    };
  };

  it("places every drop somewhere near the middle, at a size, at any time", () => {
    for (const kind of ["heart", ...FIGURES] as FigureKind[]) {
      for (let ft = 0; ft < BEATS[kind] * 0.5 + 1; ft += 0.13) {
        for (let i = 0; i < 24; i++) {
          const [x, y, r] = place(state(kind, ft), i);
          expect(Number.isFinite(x + y + r)).toBe(true);
          expect(Math.abs(x)).toBeLessThan(3.6);
          expect(Math.abs(y)).toBeLessThan(2.2);
          expect(r).toBeGreaterThan(0.1);
        }
      }
    }
  });

  it("never dances one of the last two figures again", () => {
    const r = seeded(11);
    for (let k = 0; k < 50; k++) {
      const next = nextFigure(["mirror", "bloom"], r);
      expect(["mirror", "bloom"]).not.toContain(next);
    }
  });
});

const look: Look = { tone: "214 236 255", accent: "255 31 77", effects: true, calm: false, dpr: 1 };
const deps = {
  canvas: () => ({ getContext: () => null, width: 0, height: 0 }) as unknown as HTMLCanvasElement,
  font: () => Promise.resolve(),
};
const m = metricsOf(1920, 1080, 0, true);

describe("Music mode: the scenes take the ball and give it back", () => {
  it("Disk blooms from the ball to its size, then closes into a ball", () => {
    const d = new Disk(m, look, deps, seeded());
    const b = new BeatInput();
    d.enter({ ...atRest(d.drop.x, d.drop.y - 40, d.drop.r), vy: 300 });
    for (let i = 0; i < 240; i++) {
      d.frame(b.step(STEP, true), true);
      d.step(STEP);
    }
    const parts: Part[] = [];
    d.parts(parts);
    const width = parts[0]!.x1 - parts[0]!.x0;
    expect(width).toBeGreaterThan((2 * d.drop.r) / 0.55);
    d.close();
    let t = 0;
    let body = d.closed();
    while (!body && t < 2) {
      d.step(STEP);
      t += STEP;
      body = d.closed();
    }
    expect(t).toBeLessThanOrEqual(1.02);
    expect(body!.r).toBeGreaterThan(0);
    expect(Number.isFinite(body!.x + body!.y)).toBe(true);
  });

  it("Dancing bursts into drops, then gathers them into a ball", () => {
    const d = new Dance(m, look, null, seeded());
    const b = new BeatInput();
    d.enter(atRest(d.drop.x, d.drop.y, d.drop.r));
    for (let i = 0; i < 480; i++) {
      d.frame(b.step(STEP, true), true);
      d.step(STEP);
    }
    expect(d.hits(d.drop.x, d.drop.y)).toBe(true);
    d.close();
    let t = 0;
    let body = d.closed();
    while (!body && t < 2) {
      d.step(STEP);
      t += STEP;
      body = d.closed();
    }
    expect(t).toBeLessThanOrEqual(1.32);
    expect(body!.r).toBeGreaterThan(0.5 * d.drop.r);
  });
});
