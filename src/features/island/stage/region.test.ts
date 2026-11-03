import { describe, expect, it } from "vitest";
import { EVERY, MOST, ROOM, RegionSender, merge, reach } from "./region";

const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });

describe("Music mode: the window's region", () => {
  it("never reaches above the island's edge (a taskbar there stays clickable)", () => {
    const s = new RegionSender(20, 40);
    const sent = s.offer([box(100, 0, 200, 100)], 0)!;
    expect(sent[0]!.y0).toBe(40);
    expect(new RegionSender(20, 40).offer([box(100, 0, 200, 10)], 0)).toBeNull();
  });

  it("reaches where a moving part will be, with room", () => {
    const b = reach({ ...box(0, 0, 10, 10), vx: 100, vy: -50 }, 0.1, 5);
    expect(b).toEqual(box(-5, -10, 25, 15));
  });

  it("merges touching boxes and keeps at most a few rectangles", () => {
    expect(merge([box(0, 0, 10, 10), box(5, 5, 20, 20), box(100, 100, 110, 110)])).toHaveLength(2);
    const many = Array.from({ length: 40 }, (_, i) => box(i * 50, 0, i * 50 + 10, 10));
    const merged = merge(many);
    expect(merged.length).toBeLessThanOrEqual(MOST);
    // Everything is still held.
    for (const b of many) {
      expect(merged.some((m) => b.x0 >= m.x0 && b.x1 <= m.x1 && b.y0 >= m.y0 && b.y1 <= m.y1)).toBe(
        true,
      );
    }
  });

  it("sends at once, then only when a part leaves what was sent, at most 20 times a second", () => {
    const s = new RegionSender();
    const drop = { ...box(500, 500, 600, 600), vx: 0, vy: 0 };
    expect(s.offer([drop], 0)).not.toBeNull();
    // Still: nothing to send.
    expect(s.offer([drop], 1)).toBeNull();
    // Moved a little, within the room: nothing.
    expect(s.offer([{ ...drop, x0: 510, x1: 610 }], 1.1)).toBeNull();
    // Moved out: sent, but not twice within the same 1/20 s.
    const far = { ...drop, x0: 800, x1: 900 };
    expect(s.offer([far], 1.2)).not.toBeNull();
    expect(s.offer([{ ...far, x0: 1000, x1: 1100 }], 1.2 + EVERY / 2)).toBeNull();
    expect(s.offer([{ ...far, x0: 1000, x1: 1100 }], 1.2 + EVERY)).not.toBeNull();
  });

  it("shrinks what was sent once it is much too big", () => {
    const s = new RegionSender();
    s.offer([box(0, 0, 1000, 1000)], 0);
    const small = [box(400, 400, 450, 450)];
    // Too big, but held a moment (the next frame may need it again).
    expect(s.offer(small, 1)).toBeNull();
    const sent = s.offer(small, 1.31);
    expect(sent).not.toBeNull();
    expect(sent![0]!.x1 - sent![0]!.x0).toBeLessThan(50 + 2 * ROOM + 2);
  });
});
