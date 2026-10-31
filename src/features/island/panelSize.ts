/**
 * 2026-10-31: the opened island is as big as what it shows. Always the search; under it, the
 * results while something is typed (or « nothing found »), else the music when some plays, else
 * nothing. Sizes in logical pixels, those of IslandPanel.module.css.
 */
export const PANEL = {
  width: 360,
  /** Padding above and below the content. */
  pad: 14,
  /** The search's row. */
  row: 38,
  /** Between the search and what is under it. */
  gap: 10,
  /** One result, and the space between two. */
  result: 30,
  resultGap: 2,
  /** The music's row (its cover). */
  music: 64,
  /** « Rien trouvé ». */
  none: 30,
} as const;

export interface PanelContent {
  /** Something is typed in the search. */
  searching: boolean;
  /** Results found for it. */
  hits: number;
  /** Music is playing (or paused). */
  music: boolean;
}

export function panelSize(c: PanelContent): { width: number; height: number } {
  const base = PANEL.pad * 2 + PANEL.row;
  let below = 0;
  if (c.searching) {
    below = c.hits > 0 ? c.hits * PANEL.result + (c.hits - 1) * PANEL.resultGap : PANEL.none;
  } else if (c.music) {
    below = PANEL.music;
  }
  return { width: PANEL.width, height: base + (below > 0 ? PANEL.gap + below : 0) };
}
