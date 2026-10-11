import bleuGris from "./bleu-gris.json";
import boreale from "./boreale.json";
import crepuscule from "./crepuscule.json";
import cuivre from "./cuivre.json";
import graphite from "./graphite.json";
import lavandePeche from "./lavande-peche.json";
import mauve from "./mauve.json";
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

/**
 * The built-in themes, in display order. The first one is the default. The 6 logo themes come
 * first (step 12b); the 5 older ones stay until the art direction is frozen.
 */
export const BUILTIN_THEMES: readonly Theme[] = [
  checked(lavandePeche),
  checked(mauve),
  checked(sakura),
  checked(bleuGris),
  checked(opale),
  checked(cuivre),
  checked(crepuscule),
  checked(boreale),
  checked(ocean),
  checked(rose),
  checked(graphite),
];

export const DEFAULT_THEME: Theme = BUILTIN_THEMES[0] as Theme;
