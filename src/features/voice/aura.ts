/**
 * Step 21: the island's aura colour while the voice listens. The user's colour if they chose one;
 * else « Auto », the island's colour of the moment: the brighter of the album's two colours, when
 * it is bright enough to glow on a dark screen (a near-black cover gives none); else nothing, and
 * the CSS takes the theme's accent.
 */
export function auraColour(
  user: string,
  album: readonly (string | undefined)[] | null | undefined,
): string | null {
  if (user) return user;
  const lit = (album ?? [])
    .filter((c): c is string => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c))
    .map((c) => ({ c, l: luminance(c) }))
    .sort((a, b) => b.l - a.l)[0];
  return lit && lit.l >= MIN_GLOW ? lit.c : null;
}

/** Below this relative luminance a colour does not glow on a dark screen. */
const MIN_GLOW = 0.12;

/** WCAG relative luminance of « #rrggbb » (0 black, 1 white). */
export function luminance(hex: string): number {
  const ch = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
}
