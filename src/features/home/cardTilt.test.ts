import type { PointerEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { cardTilt, tiltFrame } from "./cardTilt";

describe("card tilt (step 13: once per frame)", () => {
  it("1 000 pointer moves in a frame: the box is read once and the styles written once", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    let boxes = 0;
    let writes = 0;
    const el = {
      getBoundingClientRect: () => {
        boxes++;
        return { left: 0, top: 0, width: 200, height: 300 };
      },
      style: {
        setProperty: () => writes++,
        set rotate(_v: string) {
          writes++;
        },
      },
      parentElement: null,
    } as unknown as HTMLElement;
    for (let i = 0; i < 1000; i++)
      cardTilt.onPointerMove({
        currentTarget: el,
        clientX: i % 200,
        clientY: 150,
      } as PointerEvent<HTMLElement>);
    expect(boxes).toBe(0);
    tiltFrame.flush();
    expect(boxes).toBe(1);
    expect(writes).toBe(2); // --sheen-x, --sheen-y (the eased rotate is written on the next frames)
    tiltFrame.dispose();
    vi.unstubAllGlobals();
  });
});

describe("eased 3D tilt (review 2026-10-29)", () => {
  it("eases towards the pointer, the glass follows, then settles flat and lets go", async () => {
    const { applyTilt, step } = await import("./cardTilt");
    const { glassTiltOf, tiltBoxGrowth } = await import("../../design/glass/glassRegistry");
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const style: Record<string, string> = {};
    const el = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 300 }),
      style: {
        setProperty: () => {},
        set rotate(v: string) {
          style.rotate = v;
        },
      },
      parentElement: null,
    } as unknown as HTMLElement;
    applyTilt(el, 200, 150); // right edge: about y only
    step(16);
    const first = glassTiltOf(el)!;
    expect(first.y).toBeGreaterThan(0);
    expect(Math.abs(first.x)).toBeLessThan(1e-6);
    for (let i = 0; i < 60; i++) step(16);
    expect(glassTiltOf(el)!.y).toBeGreaterThan(first.y);
    expect(style.rotate).toMatch(/deg$/);
    cardTilt.onPointerLeave({ currentTarget: el } as PointerEvent<HTMLElement>);
    for (let i = 0; i < 120; i++) step(16);
    expect(glassTiltOf(el)).toBeUndefined();
    expect(style.rotate).toBe("");
    const [gx, gy] = tiltBoxGrowth({ x: 0, y: 0.1, persp: 900 }, 200, 300);
    expect(gx).toBeGreaterThan(0.99);
    expect(gx).toBeLessThan(1.05);
    expect(gy).toBeGreaterThan(1); // the near side grows
    expect(tiltBoxGrowth({ x: 0, y: 0, persp: 900 }, 200, 300)).toEqual([1, 1]);
    vi.unstubAllGlobals();
  });
});
