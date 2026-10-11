import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE, parsePreset } from "../../design/da";
import aere from "../../design/presets/v4-aere-bleu-gris.json";
import lumineux from "../../design/presets/v4-aere-lumineux.json";
import { PointerLight } from "./pointer";
import { GLIDE_SHARE, sheenAt, sheenCycle } from "./sheen";
import { MAX_BOUNCE, pillAt, springAt, SPRINGS } from "../../design/glass/pillMotion";

/** A stub window that records its listeners (the tests run in Node). */
function stubWindow() {
  const handlers: Record<string, (e: unknown) => void> = {};
  vi.stubGlobal("window", {
    innerWidth: 1000,
    innerHeight: 500,
    addEventListener: (t: string, h: (e: unknown) => void) => (handlers[t] = h),
    removeEventListener: () => {},
  });
  return handlers;
}

describe("round 2b presets and catalogue", () => {
  it("the round 2b presets are valid", () => {
    expect(parsePreset(aere).ok).toBe(true);
    expect(parsePreset(lumineux).ok).toBe(true);
  });

  it("the round 2b elements are off by default (older presets keep their look)", () => {
    for (const id of ["particleLight", "matter", "cardSheen"]) {
      expect(CATALOGUE.find((e) => e.id === id)?.defaultOn).toBe(false);
    }
  });
});

describe("pointer parallax offset", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("drifts after the pointer, never jumps, and returns to the centre when it leaves", () => {
    const on = stubWindow();
    const p = new PointerLight();
    p.parallax = true;
    p.attach();
    on.pointermove!({ clientX: 1000, clientY: 250 });
    expect(p.step(16)).toBe(true);
    expect(p.ox).toBeGreaterThan(0);
    expect(p.ox).toBeLessThan(0.1);
    for (let i = 0; i < 400; i++) p.step(16);
    expect(p.ox).toBeCloseTo(1, 3);
    expect(p.oy).toBeCloseTo(0, 3);
    expect(p.step(16)).toBe(false); // settled: no more frames asked
    on.blur!({});
    for (let i = 0; i < 400; i++) p.step(16);
    expect(p.ox).toBeCloseTo(0, 3);
  });

  it("asks for no frame when the parallax is off", () => {
    const on = stubWindow();
    const p = new PointerLight();
    p.attach();
    on.pointermove!({ clientX: 900, clientY: 100 });
    for (let i = 0; i < 40; i++) p.step(16); // light fade-in done
    expect(p.step(16)).toBe(false);
    expect(p.ox).toBe(0);
  });
});

describe("glossy veil timing", () => {
  it("glides from 0 to 1 in the glide time, then rests for the rest of the cycle", () => {
    const glide = 1800;
    expect(sheenCycle(glide)).toBeCloseTo(glide / GLIDE_SHARE);
    expect(sheenAt(0, glide)).toBe(0);
    let prev = -1;
    for (let t = 0; t < glide; t += 50) {
      const u = sheenAt(t, glide);
      expect(u).toBeGreaterThanOrEqual(prev);
      expect(u).toBeLessThanOrEqual(1);
      prev = u;
    }
    expect(sheenAt(glide + 10, glide)).toBe(-1);
    expect(sheenAt(sheenCycle(glide) - 1, glide)).toBe(-1);
    expect(sheenAt(sheenCycle(glide) + glide / 2, glide)).toBeCloseTo(0.5);
  });
});

describe("selection pill springs", () => {
  const peak = (bounce: number) => {
    let m = 0;
    for (let t = 0; t <= 1; t += 0.002) m = Math.max(m, springAt(t, bounce));
    return m - 1;
  };

  it("named presets: net never overshoots, leger stays a light bounce (≤ 8 %)", () => {
    expect(peak(SPRINGS.net!)).toBeLessThanOrEqual(1e-9);
    for (const b of Object.values(SPRINGS)) expect(b).toBeLessThanOrEqual(MAX_BOUNCE);
    expect(peak(SPRINGS.leger!)).toBeGreaterThan(0.03);
    expect(peak(SPRINGS.leger!)).toBeLessThanOrEqual(MAX_BOUNCE);
    expect(peak(0.5)).toBeLessThanOrEqual(MAX_BOUNCE + 0.005); // clamped
  });

  it("starts and ends exactly on the targets", () => {
    for (const b of Object.values(SPRINGS)) {
      expect(springAt(0, b)).toBeCloseTo(0, 9);
      expect(springAt(1, b)).toBeCloseTo(1, 9);
    }
    const a = { x: 0, y: 0, w: 60, h: 36 };
    const c = { x: 200, y: 0, w: 80, h: 36 };
    expect(pillAt(a, c, 1, 0.35, SPRINGS.leger)).toEqual(c);
    // Mid-way the leading edge passes its target a little (the bounce), never by more than 8 %.
    let far = 0;
    for (let p = 0; p <= 1; p += 0.01) {
      const box = pillAt(a, c, p, 0.35, SPRINGS.leger);
      far = Math.max(far, box.x + box.w);
    }
    expect(far).toBeGreaterThan(c.x + c.w);
    expect(far - (c.x + c.w)).toBeLessThanOrEqual(MAX_BOUNCE * (c.x + c.w - (a.x + a.w)));
  });
});
