import { parseColor } from "../lib/color";
import type { Theme } from "./theme";

const rgb = ([r, g, b]: readonly [number, number, number]) => `rgb(${r}, ${g}, ${b})`;

/**
 * The two colours of the gradient (built-in themes: their own; a theme file without one: fog A and
 * the beam, the pair its atmosphere already uses).
 */
export function themeGradient(theme: Theme): [string, string] {
  if (theme.gradient) return theme.gradient;
  const fog = parseColor(theme.fog[0]);
  return [fog ? rgb([fog.r, fog.g, fog.b]) : theme.accent, rgb(theme.beam)];
}

/** CSS variables of a theme (tokens.css registers them so they can cross-fade). */
export function themeVariables(theme: Theme): Record<string, string> {
  return {
    "--bg-top": theme.bg[0],
    "--bg-mid": theme.bg[1],
    "--bg-bottom": theme.bg[2],
    "--accent": theme.accent,
    "--glow": theme.glow,
    "--card": rgb(theme.card),
    "--grad-a": themeGradient(theme)[0],
    "--grad-b": themeGradient(theme)[1],
    "--text-soft": theme.soft ?? "var(--accent-light)",
  };
}

/** The cross-fade of `:root[data-theme-fade]` (`--dur-theme` in tokens.css, 0.9 s), plus a margin. */
export const THEME_FADE_MS = 1000;
let fadeEnd = 0;

/**
 * Writes the theme on <html>. `instant` skips the fade (first paint, restored theme, the swaps of
 * Réglages › Thèmes). Step 13: the colours' transition is only declared while a cross-fade runs
 * (`data-theme-fade`), so an instant change restyles the page once, with no forced flush.
 */
export function applyTheme(theme: Theme, instant: boolean): void {
  const root = document.documentElement;
  window.clearTimeout(fadeEnd);
  if (instant) delete root.dataset.themeFade;
  else {
    root.dataset.themeFade = "";
    fadeEnd = window.setTimeout(() => delete root.dataset.themeFade, THEME_FADE_MS);
  }
  for (const [name, value] of Object.entries(themeVariables(theme))) {
    root.style.setProperty(name, value);
  }
  root.dataset.theme = theme.id;
}
