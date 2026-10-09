import type { CSSProperties } from "react";

/** Inline CSS custom properties, typed (React's CSSProperties does not know `--name`). */
export function cssVars(vars: Record<`--${string}`, string | number>): CSSProperties {
  return vars as CSSProperties;
}
