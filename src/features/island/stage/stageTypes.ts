import type { HitKind, Section } from "./music";
import type { Quality } from "./stageView";

/** Kysland's music mode: what the page gives the engine (`stageEngine.ts`). Logical px. */

export interface StageTrack {
  key: string;
  title: string;
  artist: string;
  cover: string | null;
  /** The album's accent and dominant colours, « r g b » (none: the island's tone). */
  accent: string | null;
  dominant: string | null;
  playing: boolean;
}

export interface StageStart {
  /** The stage (the screen), logical. */
  width: number;
  height: number;
  /** The island's anchor (middle of its top edge), its size, docked or floating, its corner. */
  homeX: number;
  homeY: number;
  homeW: number;
  homeH: number;
  docked: boolean;
  corner: number;
  calm: boolean;
  /** The island's tone and rim (Island.module.css): « r g b », 0–1. */
  tone: string;
  rimA: number;
}

/** The music mode's settings (Réglages › Visuel › Mode musique). */
export interface StageLook {
  bass: number;
  crash: number;
  trails: number;
  gloss: number;
  quality: Quality;
  demo: boolean;
  colors: "cover" | "theme";
  delayMs: number;
  /** Kayro's theme colours (« r g b »), for `colors: "theme"`. */
  theme: [string, string];
}

/** What the analysed sound says, about every 10 ms. */
export interface SoundFrame {
  hits: { kind: HitKind; velocity: number }[];
  sub: number;
  melody: number;
  pitch: number;
  build: number;
  gap: boolean;
  section: Section;
}
