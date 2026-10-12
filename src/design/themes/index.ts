import bleuGris from "./bleu-gris.json";
import boreale from "./boreale.json";
import crepuscule from "./crepuscule.json";
import cuivre from "./cuivre.json";
import encre from "./encre.json";
import graphite from "./graphite.json";
import lavandePeche from "./lavande-peche.json";
import ocean from "./ocean.json";
import opale from "./opale.json";
import rose from "./rose.json";
import sakura from "./sakura.json";
import { parseTheme, type Theme } from "../theme";

function checked(raw: unknown): Theme {
  const r = parseTheme(raw);
  if (!r.ok) throw new Error(`Built-in theme invalid: ${r.error}`);
  return r.theme;
}

/** How many of the built-in themes are the logo ones (shown in Réglages › Thèmes). */
const LOGO_COUNT = 6;

/**
 * The built-in themes, in display order. The first one is the default (Bleu-gris since R5). The 6
 * logo themes come first; the 5 older ones stay for the atelier until the art direction is frozen.
 */
export const BUILTIN_THEMES: readonly Theme[] = [
  checked(bleuGris),
  checked(lavandePeche),
  checked(encre),
  checked(sakura),
  checked(opale),
  checked(cuivre),
  checked(crepuscule),
  checked(boreale),
  checked(ocean),
  checked(rose),
  checked(graphite),
];

export const DEFAULT_THEME: Theme = BUILTIN_THEMES[0] as Theme;

/** The themes offered in the settings (the logo ones), in grid order. */
export const PICKER_THEMES: readonly Theme[] = BUILTIN_THEMES.slice(0, LOGO_COUNT);

/** Ids that were renamed (the settings file is migrated too; this covers presets and old pages). */
const RENAMED: Readonly<Record<string, string>> = { mauve: "encre" };

/** The built-in theme for an id (renamed ids followed), else the default. */
export function resolveTheme(id: string | undefined): Theme {
  const wanted = id === undefined ? undefined : (RENAMED[id] ?? id);
  return BUILTIN_THEMES.find((t) => t.id === wanted) ?? DEFAULT_THEME;
}
