import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { applyTheme } from "./applyTheme";
import type { Theme } from "./theme";
import { BUILTIN_THEMES, resolveTheme } from "./themes";

export interface SetThemeOptions {
  /** Skip the 0.9 s cross-fade of `:root` (the theme wave reveals the change itself). */
  instant?: boolean;
}

interface ThemeContextValue {
  theme: Theme;
  themes: readonly Theme[];
  setThemeId: (id: string, options?: SetThemeOptions) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface Props {
  initialThemeId?: string;
  /** Called when the theme is changed by the user (to persist the choice). */
  onThemeChange?: (id: string) => void;
  children: ReactNode;
}

export function ThemeProvider({ initialThemeId, onThemeChange, children }: Props) {
  const themes = BUILTIN_THEMES;
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(initialThemeId));
  // The first application is always instant; later ones only when asked.
  const instant = useRef(true);

  // Layout effect: variables are set before the browser paints, so no flash of the wrong theme.
  useLayoutEffect(() => {
    applyTheme(theme, instant.current);
    instant.current = false;
  }, [theme]);

  const setThemeId = useCallback(
    (id: string, options?: SetThemeOptions) => {
      const next = themes.find((t) => t.id === id);
      if (!next) return;
      instant.current = options?.instant === true;
      setTheme(next);
      onThemeChange?.(next.id);
    },
    [themes, onThemeChange],
  );

  const value = useMemo(() => ({ theme, themes, setThemeId }), [theme, themes, setThemeId]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
