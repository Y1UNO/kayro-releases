import type { Palette, PaletteColor } from "../../ipc/bindings";
import { chromaOf, hueGap, type Lab } from "../../lib/oklab";

/**
 * How a game's pictures are arranged in colour (review 2026-10-29, « que les couleurs suivent le
 * visuel de l'app »). The colours of its poster and of its hero are grouped by hue family (within
 * 32° of each other); a family weighs its area × its chroma, the hero half as much as the poster.
 * The strongest family gives A, the next one B: Apex (navy, blue, cyan sky, a little brown) is
 * blue then cyan, not « the grey of its sky ». Greys and near-whites have no family.
 */
export interface HueFamily {
  /** Its most telling colour: the most vivid of its larger members. */
  colour: Lab;
  score: number;
}

/** Below this chroma, a colour has no hue to speak of. */
export const GREY_C = 0.035;
/** Colours within this hue gap (deg) are one family. */
const SPAN = 32;
/** A colour must cover this share of its picture to count at all. */
const MIN_WEIGHT = 0.03;
/** A second family weaker than this share of the first one is noise (B then comes from elsewhere). */
export const SECOND_MIN = 0.22;

const lab = (c: PaletteColor): Lab => [c.l ?? 0, c.a ?? 0, c.b ?? 0];

export function hueFamilies(sources: readonly { palette: Palette; weight: number }[]): HueFamily[] {
  const items = sources
    .flatMap(({ palette, weight }) =>
      palette.colors.map((c) => ({ c: lab(c), w: (c.weight ?? 0) * weight })),
    )
    .filter((x) => x.w >= MIN_WEIGHT * 0.5 && chromaOf(x.c) >= GREY_C)
    .map((x) => ({ ...x, s: x.w * chromaOf(x.c) }))
    .sort((p, q) => q.s - p.s);
  const fams: { seed: Lab; colour: Lab; best: number; score: number }[] = [];
  for (const it of items) {
    const f = fams.find((f) => hueGap(f.seed, it.c) <= SPAN);
    // Its telling colour: vivid, but not a speck (√area × chroma).
    const tell = Math.sqrt(it.w) * chromaOf(it.c);
    if (!f) fams.push({ seed: it.c, colour: it.c, best: tell, score: it.s });
    else {
      f.score += it.s;
      if (tell > f.best) {
        f.best = tell;
        f.colour = it.c;
      }
    }
  }
  return fams.sort((p, q) => q.score - p.score).map(({ colour, score }) => ({ colour, score }));
}
