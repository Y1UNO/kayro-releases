import { useId } from "react";
import type { CSSProperties } from "react";
import { GLYPH_PATH, SYMBOL_VIEWBOX, TILE_PATH } from "./symbol";
import { DEFAULT_LOGO_VARIANT, LOGO_VARS, findVariant } from "./variants";

interface Props {
  /** Variant id. Omitted: the colours set on the page by `setLogoVariant`. */
  variant?: string;
  /** Side in px. */
  size?: number;
  className?: string;
}

const D = DEFAULT_LOGO_VARIANT;

/** The Kayro symbol. Colours come from --logo-top / --logo-bottom / --logo-glyph. */
export function Logo({ variant, size = 24, className }: Props) {
  const gradient = useId();
  const chosen = variant ? findVariant(variant) : undefined;
  const style = chosen
    ? ({
        [LOGO_VARS.haut]: chosen.haut,
        [LOGO_VARS.bas]: chosen.bas,
        [LOGO_VARS.symbole]: chosen.symbole,
      } as CSSProperties)
    : undefined;
  return (
    <svg
      viewBox={SYMBOL_VIEWBOX}
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: `var(${LOGO_VARS.haut}, ${D.haut})` }} />
          <stop offset="1" style={{ stopColor: `var(${LOGO_VARS.bas}, ${D.bas})` }} />
        </linearGradient>
      </defs>
      <path d={TILE_PATH} fill={`url(#${gradient})`} />
      <path d={GLYPH_PATH} style={{ fill: `var(${LOGO_VARS.symbole}, ${D.symbole})` }} />
    </svg>
  );
}
