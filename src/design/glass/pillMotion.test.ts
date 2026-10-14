import { describe, expect, it } from "vitest";
import { holeAt, holeOrigin, type PillBox } from "./pillMotion";

/** Screen box of a pill placed at `b` in a parent at (px, py), the whole scaled by k. */
const screen = (b: PillBox, px: number, py: number, k: number) => ({
  left: px + b.x * k,
  top: py + b.y * k,
  width: b.w * k,
  height: b.h * k,
});

describe("pill hole (step 13: the pill's frames only write)", () => {
  it("a hole computed from one reading equals a reading at each frame", () => {
    const host = { left: 100, top: 40 };
    for (const k of [1, 0.74]) {
      const from: PillBox = { x: 12, y: 4, w: 90, h: 34 };
      const o = holeOrigin(screen(from, 130, 52, k), host, from);
      for (const b of [from, { x: 60, y: 3, w: 140, h: 31 }, { x: 210, y: 4, w: 96, h: 34 }]) {
        const r = screen(b, 130, 52, k);
        const hole = holeAt(o, b);
        expect(hole.x).toBeCloseTo(r.left - host.left, 9);
        expect(hole.y).toBeCloseTo(r.top - host.top, 9);
        expect(hole.w).toBeCloseTo(r.width, 9);
        expect(hole.h).toBeCloseTo(r.height, 9);
      }
    }
  });
});
