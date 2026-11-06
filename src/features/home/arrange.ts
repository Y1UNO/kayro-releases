/**
 * Step 19b: putting the apps in order. The order of the cards is the order of `apps.json`
 * (favourites first inside each category, `groupByCategory`); these pure functions give the new
 * full order of ids, which the core saves (`apps_reorder`).
 */

/** The full order with `id` moved just before `target` (or just after it). */
export function placeNear(
  order: readonly string[],
  id: string,
  target: string,
  after: boolean,
): string[] {
  if (id === target || !order.includes(id) || !order.includes(target)) return [...order];
  const rest = order.filter((x) => x !== id);
  const at = rest.indexOf(target) + (after ? 1 : 0);
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

/**
 * « Avancer » / « Reculer »: `id` swaps places with its neighbour in `visible` (the cards of its
 * category, in their order). Null at an edge: nothing to do.
 */
export function nudge(
  order: readonly string[],
  visible: readonly string[],
  id: string,
  dir: -1 | 1,
): string[] | null {
  const at = visible.indexOf(id);
  const neighbour = at < 0 ? undefined : visible[at + dir];
  if (!neighbour) return null;
  return placeNear(order, id, neighbour, dir === 1);
}
