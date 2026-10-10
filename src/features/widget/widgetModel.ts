import type { AppEntry, AppRunState, SceneFile } from "../../ipc/bindings";
import { categoryOf, type CategoryId } from "../home/categories";
import { normalize } from "../home/search";

/** Recent apps shown in the bottom row (the mock-up shows four). */
export const RECENT_SLOTS = 4;
export const RESULT_LIMIT = 8;

/** Apps whose process is currently running, in the order of the app list. */
export function runningApps(
  apps: readonly AppEntry[],
  running: Readonly<Record<string, AppRunState>>,
): AppEntry[] {
  return apps.filter((a) => running[a.id]?.running);
}

/** The recent ids as apps, newest first; an id of a removed app is skipped. */
export function recentApps(
  apps: readonly AppEntry[],
  recents: readonly string[],
  limit = RECENT_SLOTS,
): AppEntry[] {
  const byId = new Map(apps.map((a) => [a.id, a]));
  const out: AppEntry[] = [];
  for (const id of recents) {
    const app = byId.get(id);
    if (app) out.push(app);
    if (out.length === limit) break;
  }
  return out;
}

/** Apps of one category, favourites first (same order as the home screen). */
export function categoryApps(
  apps: readonly AppEntry[],
  category: CategoryId,
  limit = RECENT_SLOTS,
): AppEntry[] {
  return apps
    .filter((a) => categoryOf(a) === category)
    .sort((a, b) => Number(b.favorite) - Number(a.favorite))
    .slice(0, limit);
}

export type WidgetHit =
  { kind: "app"; app: AppEntry } | { kind: "scene"; scene: SceneFile };

/** Search of the panel: scenes first, then apps; a name starting with the query ranks first. */
export function searchPanel(
  query: string,
  apps: readonly AppEntry[],
  scenes: readonly SceneFile[],
  limit = RESULT_LIMIT,
): WidgetHit[] {
  const q = normalize(query);
  if (q === "") return [];
  const rank = (name: string) => {
    const n = normalize(name);
    return n.startsWith(q) ? 0 : n.includes(q) ? 1 : -1;
  };
  const hits = [
    ...scenes.map((scene) => ({ hit: { kind: "scene", scene } as WidgetHit, r: rank(scene.name) })),
    ...apps.map((app) => ({ hit: { kind: "app", app } as WidgetHit, r: rank(app.name) })),
  ].filter((h) => h.r >= 0);
  // Stable sort: within one rank, scenes stay before apps and the list order is kept.
  hits.sort((a, b) => a.r - b.r);
  return hits.slice(0, limit).map((h) => h.hit);
}
