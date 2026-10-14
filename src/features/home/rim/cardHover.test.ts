import { describe, expect, it } from "vitest";
import { motionTokens } from "../../../design/motion/tokens";
import { CARD_SPARKS, cardHoverConfig, hoverBlocked, threadLevel } from "./cardHoverFx";
import { renderRim, SEGMENTS, type RimEls } from "./rimRender";

const tokens = motionTokens(undefined);
const ctx = { eco: false, reduced: false, windowMode: false };

describe("carousel card hover, level 3 (round 4a)", () => {
  it("by default: veil, threads of the fan, 4 sparks at most, launch flash, 120 ms of presence", () => {
    const c = cardHoverConfig(undefined, undefined, tokens, ctx);
    expect([c.magic, c.veil, c.threads, c.flash]).toEqual([true, true, true, true]);
    expect(c.delay).toBe(120);
    expect(c.look.sparks).toBe(CARD_SPARKS);
    expect(
      cardHoverConfig({ on: true, sparks: 9 } as never, undefined, tokens, ctx).look.sparks,
    ).toBeLessThanOrEqual(4);
    expect(c.flashMs).toBeCloseTo(1.6 * 540);
  });

  it("Eco: lift + veil only (no threads, no sparks, no flash)", () => {
    const c = cardHoverConfig(undefined, undefined, tokens, { ...ctx, eco: true });
    expect([c.veil, c.threads, c.flash, c.look.sparks]).toEqual([true, false, false, 0]);
  });

  it("window mode, level 3 off, reduced motion: no level 3 at all", () => {
    const off = (c: ReturnType<typeof cardHoverConfig>) => [c.magic, c.veil, c.threads, c.flash];
    const none = [false, false, false, false];
    expect(
      off(cardHoverConfig(undefined, undefined, tokens, { ...ctx, windowMode: true })),
    ).toEqual(none);
    expect(off(cardHoverConfig(undefined, undefined, tokens, { ...ctx, reduced: true }))).toEqual(
      none,
    );
    const noL3 = motionTokens({ on: true, level3: false });
    expect(off(cardHoverConfig(undefined, undefined, noL3, ctx))).toEqual(none);
  });

  it("threads: nothing before the delay, then in; out after the pointer left", () => {
    const c = { delay: 120, fadeIn: 240, fadeOut: 168 };
    expect(threadLevel(100, 0, c)).toBe(0);
    expect(threadLevel(120, 0, c)).toBe(0);
    expect(threadLevel(200, 0, c)).toBeGreaterThan(0);
    expect(threadLevel(360, 0, c)).toBe(1);
    expect(threadLevel(500 + 84, 0, c, 500, 1)).toBeCloseTo(0.5);
    expect(threadLevel(500 + 200, 0, c, 500, 1)).toBe(0);
  });

  it("no decorative effect while scrolling, dragging or during a sequence", () => {
    const stage = (d: Record<string, string>) => ({ dataset: d }) as unknown as HTMLElement;
    expect(hoverBlocked(stage({}), false, 1e9)).toBe(false);
    expect(hoverBlocked(stage({ fast: "" }), false, 1e9)).toBe(true);
    expect(hoverBlocked(stage({ seq: "" }), false, 1e9)).toBe(true);
    expect(hoverBlocked(stage({}), true, 1e9)).toBe(true);
    expect(hoverBlocked(stage({}), false, 100)).toBe(true);
  });
});

describe("rim renderer (shared by the fan and the carousel)", () => {
  const fake = () => ({ style: {} as Record<string, string> }) as unknown as HTMLElement;
  const els = (): RimEls => ({
    threads: Array.from({ length: 2 * SEGMENTS }, fake),
    sparks: Array.from({ length: 4 }, fake),
    heads: [fake(), fake()],
    flash: fake(),
  });
  const look = {
    threads: true,
    threadLength: 0.14,
    threadWidth: 1.8,
    threadIntensity: 1.4,
    threadGlow: 0.7,
    sparks: 4,
    sparkSize: 2.4,
    reduced: false,
  };
  const box = { w: 240, h: 336, r: 30 };

  it("level 0 hides everything; level 1 places the strokes on the rim and lights the sparks", () => {
    const e = els();
    renderRim(e, box, 0, look, 0, () => 0, 1000);
    expect(e.threads.every((t) => t.style.opacity === "0")).toBe(true);
    renderRim(e, box, 1, look, 0, () => 0.25, 1000);
    expect(Number(e.threads[0]!.style.opacity)).toBeGreaterThan(0.5);
    expect(e.threads[0]!.style.offsetDistance).toMatch(/px$/);
    expect(e.sparks.some((s) => Number(s.style.opacity) > 0)).toBe(true);
    expect(e.flash!.style.opacity).toBe("0.000");
  });
});
