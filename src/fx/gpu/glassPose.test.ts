import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { registerGlass } from "../../design/glass/glassRegistry";
import { setStageCue, stageCue, sameRing, cueVersion, type GlassPose } from "./cues";
import { GlassFrame } from "./glassFrame";
import { GLASS_FRAGMENT } from "./glassShader";

// Minimal DOM for the glass frame (the tests run in node).
beforeAll(() => {
  const style = {
    borderTopLeftRadius: "24px",
    visibility: "visible",
    opacity: "1",
    overflowX: "visible",
    overflowY: "visible",
    getPropertyValue: () => "",
  };
  Object.assign(globalThis, {
    getComputedStyle: () => style,
    document: { documentElement: {}, body: {} },
  });
});

function fakeEl(x: number, y: number, w: number, h: number) {
  return {
    dataset: {} as Record<string, string>,
    offsetWidth: w,
    parentElement: null,
    getBoundingClientRect: () => ({ left: x, top: y, width: w, height: h }),
    getAttribute: () => null,
    hasAttribute: () => false,
  } as unknown as HTMLElement;
}

const pose = (x: number, z: number, a = 0.1): GlassPose => ({
  x,
  y: 100,
  hw: 50,
  hh: 70,
  r: 12,
  a,
  soft: 2,
  z,
});

const offs: (() => void)[] = [];
afterEach(() => offs.splice(0).forEach((f) => f()));

describe("glass engine, round 3b: posed and stacked shapes", () => {
  it("draws a posed element from its pose (rotation, softness), measured ones from the DOM", () => {
    const a = fakeEl(0, 0, 100, 140);
    const b = fakeEl(300, 0, 100, 140);
    offs.push(registerGlass(a, "card"), registerGlass(b, "card"));
    const f = new GlassFrame();
    f.measure(
      () => true,
      () => 0.2,
      null,
      new Map([[b, pose(500, 0, 0.3)]]),
    );
    expect(f.n).toBe(2);
    expect(f.ns).toBe(2); // z = 0: merged as usual
    expect(Array.from(f.R.subarray(0, 4))).toEqual([50, 70, 50, 70]);
    expect(Array.from(f.R.subarray(4, 8))).toEqual([500, 100, 50, 70]);
    expect(f.X[4]).toBeCloseTo(Math.cos(0.3));
    expect(f.X[5]).toBeCloseTo(Math.sin(0.3));
    expect(f.X[6]).toBe(2);
    expect(Array.from(f.X.subarray(0, 4))).toEqual([1, 0, 0, 0]);
  });

  it("stacked shapes come last, back to front, never merged", () => {
    const els = [0, 1, 2].map((i) => fakeEl(i * 10, 0, 100, 140));
    const plain = fakeEl(900, 0, 50, 50);
    offs.push(...els.map((e) => registerGlass(e, "card")), registerGlass(plain, "pill"));
    const f = new GlassFrame();
    const poses = new Map([
      [els[0]!, pose(10, 14)],
      [els[1]!, pose(20, 11)],
      [els[2]!, pose(30, 12)],
    ]);
    const changed = f.measure(
      () => true,
      () => 0.2,
      null,
      poses,
    );
    expect(changed).toBe(true);
    expect(f.n).toBe(4);
    expect(f.ns).toBe(1); // the pill only
    expect([f.X[7], f.X[11], f.X[15]]).toEqual([11, 12, 14]);
    expect([f.R[4], f.R[8], f.R[12]]).toEqual([20, 30, 10]);
    // Same poses again: nothing to draw.
    expect(
      f.measure(
        () => true,
        () => 0.2,
        null,
        poses,
      ),
    ).toBe(false);
    poses.set(els[1]!, pose(20, 11, 0.2));
    expect(
      f.measure(
        () => true,
        () => 0.2,
        null,
        poses,
      ),
    ).toBe(true);
  });

  it("the stage cue changes the cue version only when set or cleared", () => {
    const v = cueVersion();
    setStageCue(() => ({ poses: new Map(), ring: [0, 1, 1] }));
    expect(cueVersion()).toBe(v + 1);
    expect(stageCue()?.(0)?.ring).toEqual([0, 1, 1]);
    expect(
      sameRing({ poses: new Map(), ring: [1, 1, 1] }, { poses: new Map(), ring: [1, 1, 1] }),
    ).toBe(true);
    expect(sameRing({ poses: new Map(), ring: [1, 1, 1] }, null)).toBe(false);
    setStageCue(null);
    expect(stageCue()).toBeNull();
  });

  it("the glass pass stays within WebGL2's minimum of 224 fragment uniform vectors", () => {
    const max = Number(/#define MAXS (\d+)/.exec(GLASS_FRAGMENT)?.[1]);
    const kinds = Number(/#define NK (\d+)/.exec(GLASS_FRAGMENT)?.[1]);
    let vectors = 0;
    for (const m of GLASS_FRAGMENT.matchAll(/^uniform (\w+) \w+(?:\[(\w+)\])?;/gm)) {
      if (m[1]!.startsWith("sampler")) continue;
      const n = m[2] === "MAXS" ? max : m[2] === "NK" ? kinds : Number(m[2] ?? 1);
      vectors += n; // every uniform takes at least one vector slot
    }
    expect(vectors).toBeGreaterThan(6 * max);
    expect(vectors).toBeLessThanOrEqual(224);
  });
});
