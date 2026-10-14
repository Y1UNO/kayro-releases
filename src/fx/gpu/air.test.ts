import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE } from "../../design/da";
import { MAX_BOUNCE, pillAt, springAt, SPRINGS } from "../../design/glass/pillMotion";
import { PointerLight } from "./pointer";

describe("round 2b catalogue", () => {
  it("keeps only the posters in the glass, off by default (the others were retired)", () => {
    expect(CATALOGUE.find((e) => e.id === "posterGlass")?.defaultOn).toBe(false);
    for (const id of ["particleLight", "matter", "cardSheen"]) {
      expect(CATALOGUE.find((e) => e.id === id)).toBeUndefined();
    }
  });
});

describe("cursor light", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fades in under the pointer, then asks for no more frames", () => {
    const handlers: Record<string, (e: unknown) => void> = {};
    vi.stubGlobal("window", {
      addEventListener: (t: string, h: (e: unknown) => void) => (handlers[t] = h),
      removeEventListener: () => {},
    });
    const p = new PointerLight();
    p.attach();
    handlers.pointermove!({ clientX: 900, clientY: 100 });
    expect(p.step(16)).toBe(true);
    for (let i = 0; i < 40; i++) p.step(16);
    expect(p.level).toBe(1);
    expect(p.step(16)).toBe(false);
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
