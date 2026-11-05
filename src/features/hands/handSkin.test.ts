import { describe, expect, it } from "vitest";
import { handModel } from "./handModel";
import type { HandFrame, V3 } from "./handPose";
import { bones, rest } from "./handSkin";

/** The pose's points held by the model's bones (−1: a metacarpal). */
const MODEL_OF_MP = [0, 1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 21, 22, 23, 24];

describe("the tutorial's hand model", () => {
  const model = handModel();

  it("is read from the bundle: 1 360 vertices on 25 bones", () => {
    expect(model).not.toBeNull();
    expect(model?.pos.length).toBe(1360 * 3);
    expect(model?.restT).toHaveLength(25);
    expect(model?.ibm.length).toBe(25 * 16);
  });

  it("posed on its own rest skeleton, comes out as it was modelled", () => {
    if (!model) throw new Error("no model");
    const r = rest(model);
    const joints = MODEL_OF_MP.map((j) => r.at[j] ?? ([0, 0, 0] as V3));
    const lat = MODEL_OF_MP.map((j, i) => {
      const f = r.frame[j] ?? r.frame[(MODEL_OF_MP[i] ?? 1) - 1];
      return f?.[1] ?? ([1, 0, 0] as V3);
    });
    const hand: HandFrame = { joints, lat, phase: "open", contact: 0, touched: 8 };
    const out = new Float32Array(25 * 16);
    bones(model, r, hand, { yaw: 0, pitch: 0 }, [0, 0, 0], out);
    const w = model.restT[0] ?? [0, 0, 0];
    for (const v of [0, 200, 700, 1300]) {
      const p = [model.pos[v * 3] ?? 0, model.pos[v * 3 + 1] ?? 0, model.pos[v * 3 + 2] ?? 0];
      const skinned = [0, 0, 0];
      for (let k = 0; k < 4; k++) {
        const b = model.bones[v * 4 + k] ?? 0;
        const wt = model.weights[v * 4 + k] ?? 0;
        const m = out.subarray(b * 16, b * 16 + 16);
        for (let c = 0; c < 3; c++) {
          skinned[c] =
            (skinned[c] ?? 0) +
            wt *
              ((m[c] ?? 0) * (p[0] ?? 0) +
                (m[4 + c] ?? 0) * (p[1] ?? 0) +
                (m[8 + c] ?? 0) * (p[2] ?? 0) +
                (m[12 + c] ?? 0));
        }
      }
      // The model's metres, in the hand's frame: x = −z, y = −y, z = −x, in cm from the wrist.
      const expected = [-(p[2]! - w[2]) * 100, -(p[1]! - w[1]) * 100, -(p[0]! - w[0]) * 100];
      skinned.forEach((s, c) => expect(s).toBeCloseTo(expected[c] ?? 0, 2));
    }
  });
});
