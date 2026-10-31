import { describe, expect, it } from "vitest";
import type { NowPlaying } from "../../ipc/bindings";
import { DOCKED, shapeOf, type Values } from "./islandShape";
import { REST_GROW, footprint, progressAt, rgbOf, trackKey } from "./music";

const np = (over: Partial<NowPlaying> = {}): NowPlaying => ({
  title: "Song",
  artist: "Artist",
  player: "Spotify.exe",
  playing: true,
  positionMs: 30_000,
  durationMs: 120_000,
  atMs: 1_000_000,
  cover: null,
  colors: null,
  ...over,
});

const rest: Values = {
  morph: 0,
  corner: 0,
  hover: 0,
  pullX: 0,
  pullY: 0,
  vx: 0,
  vy: 0,
  squish: 0,
  presence: 1,
  open: 0,
  media: 0,
  stretch: 0,
  dots: 0,
};

describe("Kysland's music (step 20)", () => {
  it("moves the track on while it plays, holds it while paused, never past its end", () => {
    expect(progressAt(np(), 1_000_000 + 30_000)).toEqual({ pct: 0.5, remainingMs: 60_000 });
    expect(progressAt(np({ playing: false }), 1_000_000 + 30_000).pct).toBe(0.25);
    expect(progressAt(np(), 1_000_000 + 999_000)).toEqual({ pct: 1, remainingMs: 0 });
    expect(progressAt(np({ durationMs: 0 }), 0)).toEqual({ pct: 0, remainingMs: 0 });
  });

  it("reads the album's colours, and knows a track by its title, artist and player", () => {
    expect(rgbOf("#ff1f4d")).toBe("255 31 77");
    expect(rgbOf("nope")).toBeNull();
    expect(trackKey(np())).not.toBe(trackKey(np({ title: "Other" })));
    expect(trackKey(null)).toBe("");
  });

  it("the island widens for the music and a launch, and its dots show on hover only", () => {
    expect(shapeOf({ ...rest, media: 1 }).width).toBe(DOCKED.width + REST_GROW.media);
    expect(shapeOf({ ...rest, media: 1, stretch: 1 }).rest.music).toBe(0);
    expect(shapeOf({ ...rest, stretch: 1 }).rest.stretch).toBe(1);
    expect(shapeOf({ ...rest, dots: 1 }).rest.dots).toBe(0);
    const hovered = shapeOf({ ...rest, dots: 1, hover: 1 });
    expect(hovered.rest.dots).toBe(1);
    expect(hovered.height).toBeGreaterThan(hovered.band + 20);
    // Floating, the island stays a plain capsule: no dots.
    expect(shapeOf({ ...rest, morph: 1, dots: 1, hover: 1 }).rest.dots).toBe(0);
    // Opened, none of it shows.
    expect(shapeOf({ ...rest, media: 1, open: 1 }).rest.music).toBe(0);
  });

  it("the click region holds the widest island at rest", () => {
    const plain = footprint({ media: false, stretch: false, dots: false });
    const all = footprint({ media: true, stretch: true, dots: true });
    expect(all.width - plain.width).toBe(REST_GROW.media + REST_GROW.stretch);
    expect(all.height - plain.height).toBe(REST_GROW.dots);
  });
});
