/**
 * Named timing curves of the art direction (CSS `cubic-bezier()`), shared by the catalogue's
 * selects, the motion token table (tokens.ts) and the scripted sequences (curve.ts → `curveOf`).
 * Kept apart from catalogue.ts so that the token table can use it without an import cycle.
 */
export const EASES: Readonly<Record<string, string>> = {
  douce: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  premium: "cubic-bezier(0.22, 1, 0.36, 1)",
  // Round 3 (letters of the opening), round 4a "apparition": leaves fast, settles long.
  vive: "cubic-bezier(0.16, 1, 0.3, 1)",
  ressort: "cubic-bezier(0.34, 1.36, 0.64, 1)",
  // Round 3b (the category fan turns): slow start, slow end.
  bascule: "cubic-bezier(0.65, 0, 0.35, 1)",
  // Round 4a "disparition": leaves slowly, ends fast.
  sortie: "cubic-bezier(0.7, 0, 0.84, 0)",
  // Round 4a "déplacement" = the "liaison" spring of SPRINGS (passes its target by 3.4 %).
  liaison: "cubic-bezier(0.34, 1.32, 0.64, 1)",
  // Round 4a "rebond" = the "rebond" spring of SPRINGS (6.6 %), cards of the carousel only.
  rebond: "cubic-bezier(0.34, 1.45, 0.64, 1)",
  lineaire: "linear",
};
