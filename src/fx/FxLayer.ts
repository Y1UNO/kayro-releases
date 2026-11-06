import type { Quality } from "../design";
import type { FxMood } from "./mood/types";

/**
 * Colours of the atmosphere. By default the theme's (see `themePalette`); step 14 feeds the
 * colours of the selected game here. Only the light, the fog and the halo are tinted.
 */
export interface FxPalette {
  /** Light colour of the palette (beam), rgb: kept for the game's colours (step 14). */
  beam: readonly [number, number, number];
  /** Fog layers A / B / C, CSS colours with alpha. */
  fog: readonly [string, string, string];
  /** The two colours of the theme gradient (moon, veils, ring, embers, stars), rgb. */
  a: readonly [number, number, number];
  b: readonly [number, number, number];
  /**
   * Background top / middle / bottom, CSS colours (step 13: the glass engine takes them from here
   * instead of reading the page's computed style, which forced a full restyle at each theme change).
   */
  bg?: readonly [string, string, string];
  /** Glass tint of the cards, rgb (step 14; the theme's `card`, which is A in the 6 themes). */
  card?: readonly [number, number, number];
  /**
   * Step 14: the game's hero picture (`kayro-art` URL); `blurred` when the picture
   * is already blurred (Steam's), else the engine blurs it. Null or absent = none. Since 30/10 (no
   * immersive mode) only the special card's background (steps 16–17).
   */
  hero?: { url: string; blurred: boolean } | null;
  /**
   * How to go from the previous palette (step 14): « tide » spreads the new colours from the focus
   * target (`setFocusTarget`); « fade » takes the whole screen over to them; « instant » (default)
   * changes them at once (a theme change already plays its own wave, reduced motion: no movement).
   */
  passage?: "tide" | "fade" | "instant";
  /**
   * Steps 16–17: the shown game's ambience (`.hubmood`) and its dosage, drawn with the palette's
   * colours around the focus target; null or absent = none. A new one fades in over the old.
   */
  mood?: FxMood | null;
  /**
   * Steps 16–17, special card: the user's cut-out characters (left / right of the shown card) and
   * the game's logo, `kayro-art` URLs, drawn behind the glass, tinted by the palette, fading into
   * the mist; the background is `hero`. Null or absent = an ordinary card.
   */
  special?: { left: string | null; right: string | null; logo: string | null } | null;
}

/**
 * Tunable values of the visual elements, by element id (catalogue of `src/design/da`, step 12b).
 * Each layer reads the elements it draws; the quality budget still caps what may move.
 */
export type FxParams = Readonly<
  Record<string, Readonly<Record<string, number | boolean | string>>>
>;

/** What the light falls on (the selected card), in viewport pixels. */
export interface FxTarget {
  /** Horizontal centre. */
  x: number;
  top: number;
  bottom: number;
}

/**
 * One layer of the animated atmosphere. Implementations: the WebGL2 glass engine (src/fx/gpu), and
 * its CSS (moon, veils, crystal ring) and Canvas 2D (embers, stars) fallback. The interface never
 * depends on an implementation, and the screens only talk to the composite returned by `createFx`
 * (through `src/fx/index.ts`).
 */
export interface FxLayer {
  /** Inserts the layer's elements into `host` (a full-screen, non-interactive container). */
  mount(host: HTMLElement): void;
  setQuality(quality: Quality): void;
  setPalette(palette: FxPalette): void;
  /** Strength 0.3–1 (setting `atmosphereIntensity`). */
  setIntensity(intensity: number): void;
  /**
   * What the light falls on: the shown app's card, kept current (step 16b: selection, resize).
   * The tide of a palette change starts there (step 14); the game ambiences (16c) and the special
   * cards (17a) place their light and layers around it. `null`: nothing shown (the fan, another
   * screen): what hangs on it fades out. Called before `setPalette` when both change.
   */
  setFocusTarget(target: FxTarget | null): void;
  setParams(params: FxParams): void;
  /** Fades out, then stops every loop and CSS animation: no work at all until `resume`. */
  pause(): void;
  /** Restarts and fades back in. */
  resume(): void;
  dispose(): void;
}
