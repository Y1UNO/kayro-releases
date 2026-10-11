import type { Quality } from "../design";

/**
 * Colours of the atmosphere. By default the theme's (see `themePalette`); step 14 feeds the
 * colours of the selected game here. Only the light, the fog and the halo are tinted.
 */
export interface FxPalette {
  /** Light beam, halo and dust, rgb. */
  beam: readonly [number, number, number];
  /** Fog layers A / B / C, CSS colours with alpha. */
  fog: readonly [string, string, string];
  /** The two colours of the theme gradient (moon, veils, ring, embers, stars), rgb. */
  a: readonly [number, number, number];
  b: readonly [number, number, number];
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
 * One layer of the animated atmosphere. Implementations: CSS (fog, beam, halo, moon, veils,
 * crystal ring) and Canvas 2D (dust, embers, stars); a WebGL one comes with step 12b. The interface never depends on an implementation, and the
 * screens only talk to the composite returned by `createFx` (through `src/fx/index.ts`).
 */
export interface FxLayer {
  /** Inserts the layer's elements into `host` (a full-screen, non-interactive container). */
  mount(host: HTMLElement): void;
  setQuality(quality: Quality): void;
  setPalette(palette: FxPalette): void;
  /** Strength 0.3–1 (setting `atmosphereIntensity`). */
  setIntensity(intensity: number): void;
  /** `null`: nothing selected (empty screen), the light fades out. */
  setFocusTarget(target: FxTarget | null): void;
  setParams(params: FxParams): void;
  /** Fades out, then stops every loop and CSS animation: no work at all until `resume`. */
  pause(): void;
  /** Restarts and fades back in. */
  resume(): void;
  dispose(): void;
}
