import type { Theme } from "./theme";

const rgb = ([r, g, b]: [number, number, number]) => `rgb(${r}, ${g}, ${b})`;

/** CSS variables of a theme (tokens.css registers them so they can cross-fade). */
export function themeVariables(theme: Theme): Record<string, string> {
  return {
    "--bg-top": theme.bg[0],
    "--bg-mid": theme.bg[1],
    "--bg-bottom": theme.bg[2],
    "--accent": theme.accent,
    "--glow": theme.glow,
    "--fog-a": theme.fog[0],
    "--fog-b": theme.fog[1],
    "--fog-c": theme.fog[2],
    "--card": rgb(theme.card),
    "--beam": rgb(theme.beam),
  };
}

/** Writes the theme on <html>. `instant` skips the fade (first paint, restored theme). */
export function applyTheme(theme: Theme, instant: boolean): void {
  const root = document.documentElement;
  if (instant) root.style.setProperty("transition", "none");
  for (const [name, value] of Object.entries(themeVariables(theme))) {
    root.style.setProperty(name, value);
  }
  root.dataset.theme = theme.id;
  if (instant) {
    void getComputedStyle(root).getPropertyValue("--accent"); // flush styles while transitions are off
    root.style.removeProperty("transition");
  }
}
