import type { Pulse } from "./beat";
import type { Part } from "./region";

/**
 * Kysland's music mode: what the engine asks of a scene (« Disk », « Dancing »). The island falls
 * to the scene as a ball and hands it its body (`enter`); the scene plays with the music; asked
 * to close, it gathers into a ball again and hands that body back for the flight home.
 */

/** A round body handed from one shape to the next, with its motion (logical px, px/s). */
export interface Body {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  vr: number;
  /** Its squash: half the difference of its axes (px), its speed, and the long axis's angle. */
  oval: number;
  ovalV: number;
  axis: number;
}

/** Where the island falls to: the middle and the radius of the ball it becomes. */
export interface Drop {
  x: number;
  y: number;
  r: number;
}

/** What the scenes are drawn with. */
export interface Look {
  /** « r g b »: the island's tone; the album's accent (the tone without one). */
  tone: string;
  accent: string;
  /** Effects on (off in Éco: no escaping colours, fewer drops, no gloss). */
  effects: boolean;
  /** Reduced motion: things fade instead of flying. */
  calm: boolean;
  dpr: number;
}

export interface SceneTrack {
  title: string;
  cover: string | null;
  /** The album's accent and dominant colours, « r g b » (none: keep or fall back). */
  accent: string | null;
  dominant: string | null;
}

export interface Scene {
  readonly drop: Drop;
  /** The falling ball becomes the scene. */
  enter(b: Body): void;
  /** The song (its cover, its title). */
  track(t: SceneTrack | null): void;
  /** The music this frame (its hits come once a frame), playing or paused. */
  frame(p: Pulse, playing: boolean): void;
  /** Its motion over `h` s (a short step). */
  step(h: number): void;
  close(): void;
  reopen(): void;
  /** Once closed: the ball it has become, to fly home. */
  closed(): Body | null;
  draw(ctx: CanvasRenderingContext2D): void;
  /** Not drawn any more for a while (what it drew elsewhere is wiped). */
  hide(): void;
  /** The frames come too slowly: it draws more cheaply. */
  slow(): void;
  /** What it draws, as boxes with their speed (the window's region). */
  parts(out: Part[]): void;
  hits(x: number, y: number): boolean;
  /** Something still moves (paused, the loop runs until nothing does). */
  readonly busy: boolean;
  dispose(): void;
}

/** A body at rest. */
export const atRest = (x: number, y: number, r: number): Body => ({
  x,
  y,
  r,
  vx: 0,
  vy: 0,
  vr: 0,
  oval: 0,
  ovalV: 0,
  axis: 0,
});
