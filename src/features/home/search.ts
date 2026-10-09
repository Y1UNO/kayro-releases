import type { AppEntry } from "../../ipc/bindings";
import { CATEGORY_IDS, categoryOf, type CategoryId } from "./categories";

export type SearchResult =
  { kind: "app"; app: AppEntry; category: CategoryId } | { kind: "category"; id: CategoryId };

/** Lower case without accents: "Créativité" matches "creativ". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .trim();
}

const MAX_RESULTS = 60;

/**
 * Command-palette results: categories first, then apps. Name starting with the query ranks
 * before a name containing it; ties keep the order of the list. An empty query lists everything.
 * `labelOf` gives the displayed category name (the catalogue lives in the UI layer).
 */
export function searchHome(
  query: string,
  apps: readonly AppEntry[],
  labelOf: (id: CategoryId) => string,
): SearchResult[] {
  const q = normalize(query);
  const rank = (name: string): number => {
    if (q === "") return 2;
    const n = normalize(name);
    if (n.startsWith(q)) return 0;
    return n.includes(q) ? 1 : -1;
  };

  const categories = CATEGORY_IDS.map((id) => ({ id, r: rank(labelOf(id)) }))
    .filter((c) => c.r >= 0)
    .sort((a, b) => a.r - b.r)
    .map((c): SearchResult => ({ kind: "category", id: c.id }));

  const matched = apps
    .map((app) => ({ app, r: rank(app.name) }))
    .filter((a) => a.r >= 0)
    .sort((a, b) => a.r - b.r)
    .map((a): SearchResult => ({ kind: "app", app: a.app, category: categoryOf(a.app) }));

  return [...categories, ...matched].slice(0, MAX_RESULTS);
}
