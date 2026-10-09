import type { AppEntry } from "../../ipc/bindings";
import type { MessageKey } from "../../i18n";

/** Category ids as stored in apps.json (`category`), in tab order. */
export const CATEGORY_IDS = ["jeux", "stream", "creativite", "logiciels", "autres"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const CATEGORY_LABELS: Record<CategoryId, MessageKey> = {
  jeux: "home.categories.jeux",
  stream: "home.categories.stream",
  creativite: "home.categories.creativite",
  logiciels: "home.categories.logiciels",
  autres: "home.categories.autres",
};

const KNOWN = new Set<string>(CATEGORY_IDS);

/** An unknown category (hand-edited file, future version) lands in "autres": the app is never hidden. */
export function categoryOf(app: Pick<AppEntry, "category">): CategoryId {
  return KNOWN.has(app.category) ? (app.category as CategoryId) : "autres";
}

/** Apps of each category: favourites first, otherwise the order of apps.json. */
export function groupByCategory(apps: readonly AppEntry[]): Record<CategoryId, AppEntry[]> {
  const groups: Record<CategoryId, AppEntry[]> = {
    jeux: [],
    stream: [],
    creativite: [],
    logiciels: [],
    autres: [],
  };
  for (const app of apps) groups[categoryOf(app)].push(app);
  for (const id of CATEGORY_IDS) {
    // Array.prototype.sort is stable: only the favourite flag reorders.
    groups[id].sort((a, b) => Number(b.favorite) - Number(a.favorite));
  }
  return groups;
}
