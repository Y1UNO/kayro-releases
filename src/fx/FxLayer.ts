import type { Quality } from "../design";

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
   * Immersive mode (step 14): the game's hero picture (`kayro-art` URL); `blurred` when the picture
   * is already blurred (Steam's), else the engine blurs it. Null or absent = none.
   */
  hero?: { url: string; blurred: boolean } | null;
  /**
   * How to go from the previous palette (step 14): « tide » spreads the new colours from the focus
   * target (`setFocusTarget`); « instant » (default) changes them at once (a theme change already
   * plays its own wave, a reduced-motion user gets no movement).
   */
  passage?: "tide" | "instant";
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
   * `null`: nothing selected (empty screen), the light fades out. No layer uses it since the art
   * direction freeze (the step 8 beam is gone): an extension point for the game ambiences (16).
   */
  setFocusTarget(target: FxTarget | null): void;
  setParams(params: FxParams): void;
  /** Fades out, then stops every loop and CSS animation: no work at all until `resume`. */
  pause(): void;
  /** Restarts and fades back in. */
  resume(): void;
  dispose(): void;
}
