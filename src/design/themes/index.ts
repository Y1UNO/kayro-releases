import boreale from "./boreale.json";
import crepuscule from "./crepuscule.json";
import graphite from "./graphite.json";
import ocean from "./ocean.json";
import rose from "./rose.json";
import { parseTheme, type Theme } from "../theme";

function checked(raw: unknown): Theme {
  const r = parseTheme(raw);
  if (!r.ok) throw new Error(`Built-in theme invalid: ${r.error}`);
  return r.theme;
}

/** The 5 built-in themes, in display order. The first one is the default. */
export const BUILTIN_THEMES: readonly Theme[] = [
  checked(crepuscule),
  checked(boreale),
  checked(ocean),
  checked(rose),
  checked(graphite),
];

export const DEFAULT_THEME: Theme = BUILTIN_THEMES[0] as Theme;
