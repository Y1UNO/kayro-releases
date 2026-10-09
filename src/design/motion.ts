/** Motion constants shared with CSS (tokens.css). Starting values from DESIGN.md, to tune by eye. */
export const EASE = [0.2, 0.8, 0.2, 1] as const;
export const SPRING = { type: "spring", stiffness: 260, damping: 28 } as const;
export const DURATION = { card: 0.6, beam: 0.8, color: 0.9, hover: 0.4, panel: 0.35 } as const;
