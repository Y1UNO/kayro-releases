import bleuGris from "./bleu-gris.json";
import cuivre from "./cuivre.json";
import encre from "./encre.json";
import lavandePeche from "./lavande-peche.json";
import opale from "./opale.json";
import sakura from "./sakura.json";
import { parseTheme, type Theme } from "../theme";

function checked(raw: unknown): Theme {
  const r = parseTheme(raw);
  if (!r.ok) throw new Error(`Built-in theme invalid: ${r.error}`);
  return r.theme;
}

/**
 * The built-in themes: the 6 logo themes, in display order. The first one is the default (Bleu-gris
 * since R5). The 5 older ones were retired when the art direction was frozen (settings migrated to
 * Bleu-gris by the core, config/visual.rs; an unknown id resolves to the default here).
 */
export const BUILTIN_THEMES: readonly Theme[] = [
  checked(bleuGris),
  checked(lavandePeche),
  checked(encre),
  checked(sakura),
  checked(opale),
  checked(cuivre),
];

export const DEFAULT_THEME: Theme = BUILTIN_THEMES[0] as Theme;

/** The themes offered in Réglages › Thèmes, in grid order (all the built-in ones). */
export const PICKER_THEMES: readonly Theme[] = BUILTIN_THEMES;

/** Ids that were renamed (the settings file is migrated too; this covers presets and old pages). */
const RENAMED: Readonly<Record<string, string>> = { mauve: "encre" };

/** The built-in theme for an id (renamed ids followed), else the default. */
export function resolveTheme(id: string | undefined): Theme {
  const wanted = id === undefined ? undefined : (RENAMED[id] ?? id);
  return BUILTIN_THEMES.find((t) => t.id === wanted) ?? DEFAULT_THEME;
}
