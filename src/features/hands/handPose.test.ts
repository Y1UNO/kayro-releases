import { describe, expect, it } from "vitest";
import { pose, thumbUp, type V3 } from "./handPose";
import { LOOP_S, SCENES, tutorialAt } from "./tutorialScript";

const dist = (a: V3 | undefined, b: V3 | undefined) =>
  a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : Infinity;

describe("the hand of the tutorial", () => {
  it("has the webcam model's 21 points", () => {
    expect(pose("index", 0).joints).toHaveLength(21);
  });

  it("keeps the thumb's bones their length: a metacarpal, then two phalanges", () => {
    for (const { joints } of [pose("index", 0), pose("index", 1), pose("ring", 1), thumbUp(1)]) {
      expect(dist(joints[1], joints[2])).toBeCloseTo(3.25, 1);
      expect(dist(joints[2], joints[3])).toBeCloseTo(3.38, 1);
      expect(dist(joints[3], joints[4])).toBeCloseTo(1.49, 1);
    }
  });

  it("has the proportions of a hand: the middle finger longest, the pinky shortest", () => {
    const open = pose("index", 0).joints;
    const reach = (base: number) => dist(open[base], open[base + 3]);
    expect(reach(9)).toBeGreaterThan(reach(5));
    expect(reach(9)).toBeGreaterThan(reach(13));
    expect(reach(17)).toBeLessThan(reach(5));
  });

  it("brings the thumb's pad onto the finger of each pinch, the others staying up", () => {
    for (const [which, tip] of [
      ["index", 8],
      ["middle", 12],
      ["ring", 16],
    ] as const) {
      const open = pose(which, 0).joints;
      const pinched = pose(which, 1).joints;
      // Pad against pad: the two tips about a finger's width apart.
      expect(dist(pinched[4], pinched[tip])).toBeLessThan(1.5);
      expect(dist(open[4], open[tip])).toBeGreaterThan(4);
      // The right click keeps the index away from the thumb (as pointer.rs asks).
      if (which !== "index") expect(dist(pinched[4], pinched[8])).toBeGreaterThan(4);
    }
    // The fingers that do not pinch stay up: their tips above their knuckles.
    const ok = pose("index", 1).joints;
    for (const base of [9, 13, 17])
      expect(ok[base + 3]?.[1] ?? 0).toBeGreaterThan(ok[base]?.[1] ?? 0);
  });

  it("closes the fist under a thumb up", () => {
    const up = thumbUp(1).joints;
    for (const base of [5, 9, 13, 17])
      expect(up[base + 3]?.[1] ?? 99).toBeLessThan(up[base]?.[1] ?? 0);
  });
});

describe("the tutorial's clock", () => {
  it("plays the five scenes in turn and loops", () => {
    expect(SCENES.map((s) => s.id)).toEqual(["move", "click", "drag", "right", "off"]);
    expect(tutorialAt(1, "ring").scene).toBe(0);
    const click = tutorialAt(4.8, "ring");
    expect([click.scene, click.hand.phase, click.picked]).toEqual([1, "left", true]);
    const drag = tutorialAt(8.5, "ring");
    expect([drag.scene, drag.grabbed]).toEqual([2, true]);
    const right = tutorialAt(11.0, "middle");
    expect([right.scene, right.hand.phase, right.hand.touched]).toEqual([3, "right", 12]);
    expect(tutorialAt(11.6, "ring").menu).toBeCloseTo(1);
    const off = tutorialAt(15.9, "ring");
    expect([off.scene, off.camera]).toEqual([4, 0]);
    expect(tutorialAt(1 + LOOP_S, "ring").scene).toBe(0);
  });

  it("moves the cursor with the hand", () => {
    const a = tutorialAt(0.4, "ring");
    const b = tutorialAt(1.2, "ring");
    const handDx = (b.hand.joints[0]?.[0] ?? 0) - (a.hand.joints[0]?.[0] ?? 0);
    expect(Math.sign(b.cursor[0] - a.cursor[0])).toBe(Math.sign(handDx));
  });
});
