/**
 * Framer Motion constants kept for two places outside the round 4a token table
 * (src/design/motion/tokens.ts): the category title, part of the round 3 signature sequences, and
 * the widget's panel (reworked in round 3c with the same tokens). Everything else uses the table.
 */
export const EASE = [0.2, 0.8, 0.2, 1] as const;
export const SPRING = { type: "spring", stiffness: 260, damping: 28 } as const;
