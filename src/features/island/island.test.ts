import { describe, expect, it } from "vitest";
import { Bubbles, MAX_BUBBLES } from "./bubbles";
import {
  CALM,
  DOCKED,
  FLOATING,
  INK,
  OPEN,
  SNOW,
  SPRINGS,
  SQUISH_LIMIT,
  anim,
  atRest,
  paletteFor,
  shapeOf,
  stepSpring,
  type Values,
} from "./islandShape";

const rest: Values = {
  morph: 0,
  corner: 0,
  hover: 0,
  pullX: 0,
  pullY: 0,
  vx: 0,
  vy: 0,
  squish: 0,
  presence: 1,
  open: 0,
  media: 0,
  stretch: 0,
  dots: 0,
};

/** Steps a spring at 144 Hz until it rests; returns its farthest point and the time taken. */
function run(spring: typeof CALM, to: number) {
  const a = anim(0);
  a.to = to;
  let peak = 0;
  let t = 0;
  while (!atRest(a) && t < 5) {
    stepSpring(a, spring, 1 / 144);
    peak = Math.max(peak, a.x);
    t += 1 / 144;
  }
  return { peak, t, x: a.x };
}

/** The island's left and right edges (relative to its anchor) for a shape. */
const edges = (v: Values) => {
  const s = shapeOf(v);
  return [s.x - (s.width * s.scaleX) / 2, s.x + (s.width * s.scaleX) / 2] as const;
};

describe("island shape (step 20, Kysland)", () => {
  it("on the top edge, it is a notch flush with the bezel, with its two shoulders", () => {
    const s = shapeOf(rest);
    expect([s.width, s.height]).toEqual([DOCKED.width, DOCKED.height]);
    expect(s.radii).toEqual([0, 0, 16, 16]);
    expect(s.shoulders).toEqual({ topLeft: 1, topRight: 1, sideLeft: 0, sideRight: 0 });
    expect(s.rim).toBe(0);
    expect(s.originY).toBe(0);
  });

  it("in the left corner, it is flush with the top and the left bezels", () => {
    const s = shapeOf({ ...rest, corner: -1 });
    expect(s.radii).toEqual([0, 0, 16, 0]);
    expect(s.shoulders).toEqual({ topLeft: 0, topRight: 1, sideLeft: 1, sideRight: 0 });
    // Hovered or coming out of the bezel, its left side stays on the bezel.
    expect(edges({ ...rest, corner: -1, hover: 1 })[0]).toBeCloseTo(-DOCKED.width / 2, 5);
    expect(edges({ ...rest, corner: -1, presence: 0.4 })[0]).toBeCloseTo(-DOCKED.width / 2, 5);
    const r = shapeOf({ ...rest, corner: 1 });
    expect(r.radii).toEqual([0, 0, 0, 16]);
    expect(edges({ ...rest, corner: 1, hover: 1 })[1]).toBeCloseTo(DOCKED.width / 2, 5);
  });

  it("floating, it is a capsule with a rim and no shoulders", () => {
    const s = shapeOf({ ...rest, morph: 1, corner: -1 });
    expect([s.width, s.height]).toEqual([FLOATING.width, FLOATING.height]);
    expect(s.radii).toEqual([22, 22, 22, 22]);
    expect(Object.values(s.shoulders)).toEqual([0, 0, 0, 0]);
    expect(s.rim).toBe(1);
  });

  it("pulled down on the edge, it stretches and narrows", () => {
    const s = shapeOf({ ...rest, pullY: 40 });
    expect(s.height).toBeGreaterThan(DOCKED.height + 15);
    expect(s.width).toBeLessThan(DOCKED.width);
  });

  it("pushed on an edge, it flattens with its side on the edge, never past it", () => {
    const left = -FLOATING.width / 2;
    const s = { ...rest, morph: 1, pullX: -20 };
    expect(shapeOf(s).width).toBeLessThan(FLOATING.width - 10);
    expect(shapeOf(s).height).toBeGreaterThan(FLOATING.height);
    expect(edges(s)[0]).toBeCloseTo(left, 5);
    // In a corner, pushed further into it: same, against the side bezel.
    expect(edges({ ...rest, corner: -1, pullX: -20 })[0]).toBeCloseTo(-DOCKED.width / 2, 5);
  });

  it("moving, it leans (floating) or trails like jelly (on the edge), within bounds", () => {
    const s = shapeOf({ ...rest, morph: 1, vx: 50_000 });
    expect(s.rotate).toBe(7);
    expect(Math.abs(s.skew)).toBe(0);
    expect(s.scaleX).toBeGreaterThan(1);
    expect(s.scaleX).toBeLessThan(1.1);
    const d = shapeOf({ ...rest, vx: 50_000 });
    expect(Math.abs(d.rotate)).toBe(0);
    expect(d.skew).toBe(-12);
  });

  it("taps in a row never fold it over", () => {
    const s = shapeOf({ ...rest, squish: 50 });
    expect(s.scaleY).toBeCloseTo(1 - SQUISH_LIMIT * 0.1, 5);
    expect(s.scaleY).toBeGreaterThan(0.8);
  });

  it("coming out of the bezel, it grows from a sliver and fades in", () => {
    const s = shapeOf({ ...rest, presence: 0 });
    expect(s.width).toBeLessThan(DOCKED.width / 2);
    expect(s.opacity).toBe(0);
  });
});

describe("island colours", () => {
  it("snow blue on a dark screen, ink blue on a light one, a smooth turn between", () => {
    expect(paletteFor(0.05).tone).toEqual(SNOW);
    expect(paletteFor(0.95).tone).toEqual(INK);
    const mid = paletteFor(0.53).tone;
    expect(mid[0]).toBeLessThan(SNOW[0]);
    expect(mid[0]).toBeGreaterThan(INK[0]);
    expect(paletteFor(0.05).glowAlpha).toBeGreaterThan(0);
    expect(paletteFor(0.95).glowAlpha).toBe(0);
  });
});

describe("island springs", () => {
  it("the jelly springs wobble, « reduce motion » never overshoots", () => {
    expect(run(SPRINGS.squish, 1).peak).toBeGreaterThan(1.2);
    expect(run(SPRINGS.morph, 1).peak).toBeGreaterThan(1.01);
    const calm = run(CALM, 1);
    expect(calm.peak).toBeLessThanOrEqual(1.0001);
    expect(calm.t).toBeLessThan(1);
  });

  it("every spring comes to rest (the loop can stop)", () => {
    for (const s of Object.values(SPRINGS)) {
      const r = run(s, 1);
      expect(r.t).toBeLessThan(3);
      expect(r.x).toBeCloseTo(1, 2);
    }
  });
});

describe("the opened island", () => {
  it("grows into its panel, its corners those of the panel, flush where it is docked", () => {
    const s = shapeOf({ ...rest, open: 1 });
    expect([s.width, s.height]).toEqual([OPEN.width, OPEN.height]);
    expect(s.radii).toEqual([0, 0, OPEN.radius, OPEN.radius]);
    expect(s.content).toBe(1);
    const corner = shapeOf({ ...rest, corner: -1, open: 1 });
    expect(corner.radii).toEqual([0, 0, OPEN.radius, 0]);
    expect(edges({ ...rest, corner: -1, open: 1 })[0]).toBeCloseTo(-DOCKED.width / 2, 5);
    const floating = shapeOf({ ...rest, morph: 1, open: 1 });
    expect(floating.radii).toEqual([OPEN.radius, OPEN.radius, OPEN.radius, OPEN.radius]);
  });

  it("shows its content only once it has grown, and hovering no longer grows it", () => {
    expect(shapeOf({ ...rest, open: 0.5 }).content).toBe(0);
    expect(shapeOf({ ...rest, open: 1, hover: 1 }).width).toBe(OPEN.width);
  });
});

describe("island bubbles", () => {
  const seeded = () => {
    let seed = 1;
    return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  };

  it("a crossing bursts around the island and lasts long enough to be seen", () => {
    const b = new Bubbles(seeded());
    b.crossed({ x: 176, y: 44 }, { x: -1, y: 0 });
    expect(b.list.length).toBe(36);
    expect(b.list.filter((p) => p.vx > 0).length).toBeGreaterThan(18);
    let t = 0;
    while (b.step(1 / 60)) t += 1 / 60;
    expect(t).toBeGreaterThan(1.2);
    expect(t).toBeLessThan(1.8);
  });

  it("moving fast, they trail behind the island instead of piling up on an edge", () => {
    const b = new Bubbles(seeded());
    b.crossed({ x: 176, y: 44 }, { x: -1, y: 0 });
    const start = b.list.map((p) => p.x);
    // The island goes left at 3000 px/s for a quarter of a second.
    for (let i = 0; i < 15; i++) b.step(1 / 60, { x: -3000, y: 0 });
    const behind = b.list.filter((p, i) => p.x > (start[i] ?? 0)).length;
    expect(behind).toBeGreaterThan(b.list.length * 0.8);
    // Spread out, not stacked on one line.
    const xs = new Set(b.list.map((p) => Math.round(p.x / 10)));
    expect(xs.size).toBeGreaterThan(10);
  });

  it("fade before the window's edge rather than stopping on it", () => {
    const b = new Bubbles(seeded());
    b.crossed({ x: 176, y: 44 }, { x: 1, y: 0 });
    const alphas: number[] = [];
    const ctx = {
      globalAlpha: 1,
      fillStyle: "",
      beginPath() {},
      arc() {
        alphas.push(ctx.globalAlpha);
      },
      fill() {},
    } as unknown as CanvasRenderingContext2D & { globalAlpha: number };
    const stage = { width: 720, height: 420 };
    // Out past the edge: not drawn at all. Just inside it: faint.
    for (const p of b.list) p.x = 2000;
    b.draw(ctx, { x: 360, y: 172 }, stage, SNOW, SNOW);
    expect(alphas).toEqual([]);
    for (const p of b.list) p.x = 340;
    b.list.forEach((p) => (p.age = p.life * 0.3));
    b.draw(ctx, { x: 360, y: 172 }, stage, SNOW, SNOW);
    expect(alphas.length).toBeGreaterThan(0);
    expect(Math.max(...alphas)).toBeLessThan(0.5);
  });

  it("never holds more than its ceiling", () => {
    const b = new Bubbles();
    for (let i = 0; i < 5; i++) b.crossed({ x: 176, y: 44 }, { x: 1, y: 0 });
    expect(b.list.length).toBe(MAX_BUBBLES);
  });

  it("drops fall from the edge and splash along it", () => {
    const b = new Bubbles();
    b.detached({ x: 184, y: 32 });
    expect(b.list.every((p) => p.drop && p.vy > 0)).toBe(true);
    b.clear();
    b.touched({ x: 184, y: 32 });
    expect(b.list.every((p) => p.drop && Math.abs(p.vx) >= 90)).toBe(true);
  });
});
