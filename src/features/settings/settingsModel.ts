/**
 * Réglages › Visuel (round 5), pure: what each choice writes in the settings, the atmosphere
 * presets, and the « Revenir aux réglages par défaut » reset with its undo.
 */
import type { Quality, Settings, SettingsPatch } from "../../ipc/bindings";

/** Qualities offered, in order (« Auto » = high with the engine's fallback, step 13 does more). */
export const QUALITY_CHOICES: readonly Quality[] = ["auto", "eco", "balanced", "high", "ultra"];

/** « Atmosphère »: Douce · Normale (the validated look) · Forte. */
export const ATMOSPHERE = { soft: 0.6, normal: 1, strong: 1.3 } as const;
export type AtmosphereLevel = keyof typeof ATMOSPHERE;

/** The preset closest to a saved intensity (older files may hold any value in 0.3–1). */
export function atmosphereLevel(intensity: number | null | undefined): AtmosphereLevel {
  const k = intensity ?? ATMOSPHERE.normal;
  let best: AtmosphereLevel = "normal";
  for (const level of Object.keys(ATMOSPHERE) as AtmosphereLevel[]) {
    if (Math.abs(ATMOSPHERE[level] - k) < Math.abs(ATMOSPHERE[best] - k)) best = level;
  }
  return best;
}

/**
 * What « Revenir aux réglages par défaut » puts back: every Visuel choice, except the display
 * mode and the screen (they would move the window at once). Same values as `Settings::default`
 * in schema.rs (tested against the generated defaults).
 */
export const VISUAL_DEFAULTS = {
  quality: "balanced",
  atmosphereIntensity: ATMOSPHERE.normal,
  motionStyle: "lively",
  followSystemMotion: true,
  cardFloat: "visible",
  openingStyle: "pulse",
  themeTransition: "wave",
  widgetUnroll: "unroll",
  widgetSpring: "normal",
  cardHover: "full",
  bokeh: true,
  particles: true,
  cursorLight: true,
  // Step 14, game colours: the decisions of the board (DA-JOURNAL, 14/10).
  colorMode: "light",
  colorIntensity: "normal",
  colorCharacter: "theme",
  colorPick: "dominant",
  colorPassage: "tide",
  colorTrigger: "select",
  colorFromIcon: true,
} as const satisfies SettingsPatch;

type VisualKey = keyof typeof VISUAL_DEFAULTS;
const VISUAL_KEYS = Object.keys(VISUAL_DEFAULTS) as VisualKey[];

/** The current values of what the reset changes (to undo it while the dialog is open). */
export function visualSnapshot(s: Settings): SettingsPatch {
  const out: Record<string, unknown> = {};
  for (const k of VISUAL_KEYS) out[k] = s[k];
  return out as SettingsPatch;
}

/** True when the reset would change nothing. */
export function isVisualDefault(s: Settings): boolean {
  return VISUAL_KEYS.every((k) => s[k] === VISUAL_DEFAULTS[k]);
}

/**
 * Step 17b, Réglages › Sons: the defaults (same values as `Settings::default`, schema.rs).
 * Crystalline « Premium » style, low volume, every family on.
 */
export const SOUND_DEFAULTS = {
  soundsOn: true,
  soundPack: "premium",
  soundVolume: 0.4,
  soundInterface: true,
  soundTransitions: true,
  soundLaunch: true,
} as const satisfies SettingsPatch;

/**
 * What the installer asks (`Settings::default`): no update check unless the user allows it
 * (step 18b); started with Windows, no home screen unless asked (step 19).
 */
export const UPDATE_DEFAULTS = { updateAuto: false, startupHome: false } as const satisfies SettingsPatch;

/** Step 19b: no detected app ignored (`Settings::default`). */
export const DETECT_DEFAULTS = { ignoredDetections: [] as string[] } satisfies SettingsPatch;
