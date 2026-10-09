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
import { BUILTIN_THEMES, DEFAULT_THEME } from "./themes";

interface ThemeContextValue {
  theme: Theme;
  themes: readonly Theme[];
  setThemeId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface Props {
  initialThemeId?: string;
  children: ReactNode;
}

export function ThemeProvider({ initialThemeId, children }: Props) {
  const themes = BUILTIN_THEMES;
  const [theme, setTheme] = useState<Theme>(
    () => themes.find((t) => t.id === initialThemeId) ?? DEFAULT_THEME,
  );
  const first = useRef(true);

  // Layout effect: variables are set before the browser paints, so no flash of the wrong theme.
  useLayoutEffect(() => {
    applyTheme(theme, first.current);
    first.current = false;
  }, [theme]);

  const setThemeId = useCallback(
    (id: string) => {
      const next = themes.find((t) => t.id === id);
      if (next) setTheme(next);
    },
    [themes],
  );

  const value = useMemo(() => ({ theme, themes, setThemeId }), [theme, themes, setThemeId]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
