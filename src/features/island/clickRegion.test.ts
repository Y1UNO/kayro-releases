import { describe, expect, it } from "vitest";
import { islandRoom, roomPlan, type RestState } from "./clickRegion";
import { DOCKED, FLOATING, HOVER_GROW } from "./islandShape";
import { REST_GROW } from "./music";

const idle: RestState = { media: false, stretch: false, dots: false, hover: false, breath: false };

describe("Kysland's click region (step 20)", () => {
  it("holds the island as drawn now: bare at rest, wider with music or a launch", () => {
    expect(islandRoom(idle)).toEqual([
      DOCKED.width,
      DOCKED.height,
      FLOATING.width,
      FLOATING.height,
    ]);
    const music = islandRoom({ ...idle, media: true });
    expect(music[0]).toBe(DOCKED.width + REST_GROW.media);
    expect(music[2]).toBe(FLOATING.width + REST_GROW.media);
    const launch = islandRoom({ ...idle, media: true, stretch: true });
    expect(launch[0]).toBe(DOCKED.width + REST_GROW.media + REST_GROW.stretch);
  });

  it("grows on hover, with the dots on the top edge only, and with the music's breath", () => {
    const hovered = islandRoom({ ...idle, hover: true, dots: true });
    expect(hovered[0]).toBe(DOCKED.width + HOVER_GROW.docked[0]);
    expect(hovered[1]).toBe(DOCKED.height + HOVER_GROW.docked[1] + REST_GROW.dots);
    expect(hovered[3]).toBe(FLOATING.height + HOVER_GROW.floating[1]);
    // The dots show only hovered.
    expect(islandRoom({ ...idle, dots: true })[1]).toBe(DOCKED.height);
    const breathing = islandRoom({ ...idle, media: true, breath: true });
    expect(breathing[0]).toBeCloseTo((DOCKED.width + REST_GROW.media) * 1.03);
  });

  it("grows at once with room for the overshoot, shrinks only later", () => {
    const small = islandRoom(idle);
    const big = islandRoom({ ...idle, media: true, stretch: true });
    expect(roomPlan(null, small)).toEqual({ now: small, later: null });
    const up = roomPlan(small, big);
    expect(up.now?.[0]).toBeGreaterThan(big[0]);
    expect(up.now?.[0]).toBeLessThan(big[0] * 1.07);
    expect(up.later).toEqual(big);
    expect(roomPlan(big, small)).toEqual({ now: null, later: small });
    expect(roomPlan(big, big)).toEqual({ now: null, later: null });
    // One side grows, the other shrinks: the larger of each now, the exact room later.
    const mixed = roomPlan([200, 40, 180, 50], [210, 30, 180, 50]);
    expect(mixed.now?.slice(1)).toEqual([40, 180, 50]);
    expect(mixed.later).toEqual([210, 30, 180, 50]);
  });
});
