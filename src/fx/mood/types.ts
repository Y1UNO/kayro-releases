import type { ColorRole, Direction, MoodFile, ParticleShape } from "../../ipc/bindings";

/**
 * A game ambience (`.hubmood`, steps 16–17), as the atmosphere reads it. Same shape as the core's
 * `MoodFile` (src-tauri/src/config/moods.rs), which checks every imported file; the built-in packs
 * (packs.ts) are checked by moods.test.ts against the same limits.
 */
export type MoodLayerDef =
  | {
      type: "particles";
      shape: ParticleShape;
      glyph?: string | null;
      count: number;
      size: readonly [number, number];
      speed: readonly [number, number];
      direction: Direction;
      drift: number;
      life: readonly [number, number];
      colorRole: ColorRole;
      opacity: number;
    }
  | {
      type: "glyphRing";
      glyph: string;
      count: number;
      radius: number;
      rotation: number;
      size: number;
      colorRole: ColorRole;
      opacity: number;
    }
  | { type: "mist"; count: number; colorRole: ColorRole; opacity: number; speed: number }
  | { type: "beam"; count: number; sway: number; colorRole: ColorRole; opacity: number }
  | { type: "pulse"; period: number; colorRole: ColorRole; opacity: number };

export interface Mood {
  schemaVersion: number;
  id: string;
  name: string;
  gameHint?: string | null;
  /** SVG path data in a 0–100 box (glyphAtlas.ts draws them in strokes). */
  glyphs: Readonly<Record<string, string>>;
  layers: readonly MoodLayerDef[];
  /** Played before the game starts (30/10, src/features/launchIntro); absent = at once. */
  launch?: "seal" | "gommage" | null;
}

/** What the atmosphere draws: an ambience and the user's dosage (× 0.25–2, 1 = as written). */
export interface FxMood {
  mood: Mood;
  density: number;
  speed: number;
}

/** A file checked by the core: its numbers are never null (NaN is refused there). */
export function moodOf(file: MoodFile): Mood {
  return file as unknown as Mood;
}
