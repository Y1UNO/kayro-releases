// Simple mode: a list of apps becomes ordinary steps (launch / wait / waitReady). Nothing here is
// stored: the editor keeps the list and regenerates the steps, so the file format is unchanged.
import type { AppEntry, Step } from "../../ipc/bindings";
import { WAIT_READY_MS } from "./model";

/** How the apps are started: all at once, or each one ready before the next. */
export type Sequence = "together" | "oneByOne";

export interface SimpleItem {
  appId: string;
  /** Start it, then wait until it is ready (otherwise just start it). */
  ready: boolean;
}

export interface SimpleDraft {
  items: SimpleItem[];
  sequence: Sequence;
}

/** Apps and the slot each one gets in the generated steps. */
export interface SimpleContext {
  apps: readonly AppEntry[];
  /** slot name → app id: updated with the slots the generated steps need. */
  links: Readonly<Record<string, string>>;
}

export const LIGHT_DELAY_MS = 2000;
export const HEAVY_DELAY_MS = 8000;
export const MAX_SIMPLE_ITEMS = 12;

type Launcher = "steam" | "epic" | "other";

const HEAVY_LAUNCHERS = [
  "steam",
  "epicgameslauncher",
  "epic games launcher",
  "battle.net",
  "battlenet",
  "galaxyclient",
  "gog galaxy",
  "riotclientservices",
  "riot client",
  "ubisoft connect",
  "upc.exe",
  "ealauncher",
  "eadesktop",
  "ea app",
  "origin",
  "unity hub",
];

function lower(app: AppEntry): string {
  const target =
    app.launch.kind === "exe" || app.launch.kind === "lnk"
      ? app.launch.path
      : app.launch.kind === "uri"
        ? app.launch.uri
        : "";
  return `${app.name} ${target}`.toLowerCase();
}

/** A store's own program (Steam itself, the Epic launcher…), as opposed to one of its games. */
export function launcherOf(app: AppEntry): Launcher | null {
  if (app.source.kind === "steam" || app.source.kind === "epic") return null;
  const text = lower(app);
  if (/(^|[\\/\s])steam(\.exe)?(\s|$)|steam:\/\/open/.test(text)) return "steam";
  if (text.includes("epicgameslauncher") || text.includes("epic games launcher")) return "epic";
  return HEAVY_LAUNCHERS.some((h) => text.includes(h)) ? "other" : null;
}

/** A game started through its store's protocol: the store starts itself when needed. */
function storeOf(app: AppEntry): "steam" | "epic" | null {
  if (app.launch.kind !== "uri") return null;
  if (app.launch.uri.startsWith("steam://")) return "steam";
  return app.launch.uri.startsWith("com.epicgames.launcher://") ? "epic" : null;
}

/** An app whose process Kayro can recognise (and so wait for). */
export function isFollowed(app: AppEntry): boolean {
  return app.match.exe !== null && app.match.exe !== "";
}

/** Fixed delay for an app that cannot be followed: heavy launchers need longer. */
export function fixedDelayMs(app: AppEntry): number {
  return launcherOf(app) === null ? LIGHT_DELAY_MS : HEAVY_DELAY_MS;
}

/** Slot for an app: the one already linked to it, else its own id, else `id-2`… */
function slotFor(app: AppEntry, links: Record<string, string>): string {
  const existing = Object.keys(links).find((s) => links[s] === app.id);
  if (existing) return existing;
  for (let n = 1; ; n += 1) {
    const slot = n === 1 ? app.id : `${app.id.slice(0, 36)}-${n}`;
    if (links[slot] === undefined) return slot;
  }
}

export interface Generated {
  steps: Step[];
  /** The links the steps rely on (the given ones plus any new slot). */
  links: Record<string, string>;
}

/** The step that waits for `app` to be ready, or null when nothing needs waiting. */
function readiness(app: AppEntry, slot: string, followedByStoreGame: boolean): Step | null {
  if (followedByStoreGame) return null;
  if (isFollowed(app)) return { type: "waitReady", slot, timeoutMs: WAIT_READY_MS };
  return { type: "wait", ms: fixedDelayMs(app) };
}

/**
 * Steps for a list of apps. Together: every launch, then the waits of the apps marked « ready ».
 * One by one: each wait right after its launch. A launcher is not waited for when the next app
 * is one of its games (the game starts the store itself). The last app of a one-by-one scene
 * is waited for only when marked « ready », and a fixed delay after the very last launch is
 * dropped (nothing comes after it).
 */
export function generateSteps(draft: SimpleDraft, ctx: SimpleContext): Generated {
  const links = { ...ctx.links };
  const steps: Step[] = [];
  const deferred: Step[] = [];
  const entries = draft.items.flatMap((item) => {
    const app = ctx.apps.find((a) => a.id === item.appId);
    return app ? [{ item, app }] : [];
  });
  entries.forEach(({ item, app }, i) => {
    const slot = slotFor(app, links);
    links[slot] = app.id;
    steps.push({ type: "launch", slot });
    if (!item.ready) return;
    const next = entries[i + 1]?.app;
    const launcher = launcherOf(app);
    const storeGameNext =
      next !== undefined && (launcher === "steam" || launcher === "epic")
        ? storeOf(next) === launcher
        : false;
    const wait = readiness(app, slot, storeGameNext);
    if (!wait) return;
    const isLast = i === entries.length - 1;
    if (wait.type === "wait" && isLast) return;
    (draft.sequence === "oneByOne" ? steps : deferred).push(wait);
  });
  return { steps: [...steps, ...deferred], links };
}

const same = (a: readonly Step[], b: readonly Step[]) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The simple draft that generates exactly `steps`, or null when the steps contain anything the
 * simple mode cannot produce (a focus or close step, a required flag, a custom delay, a slot
 * linked to nothing, an app twice…). Never loses information: it only answers when regenerating
 * gives back the very same steps.
 */
export function toSimple(
  steps: readonly Step[],
  ctx: SimpleContext,
): { draft: SimpleDraft; links: Record<string, string> } | null {
  const launches = steps.filter((s) => s.type === "launch");
  if (launches.length === 0 || launches.length > MAX_SIMPLE_ITEMS) return null;
  const appIds: string[] = [];
  for (const s of launches) {
    const id = ctx.links[s.slot];
    if (!id || appIds.includes(id) || !ctx.apps.some((a) => a.id === id)) return null;
    appIds.push(id);
  }
  // The generator links an app to the slot it already has, so the links must stay as they are.
  const slots = launches.map((s) => s.slot);
  for (let flags = 0; flags < 1 << appIds.length; flags += 1) {
    for (const sequence of ["oneByOne", "together"] as const) {
      const draft: SimpleDraft = {
        sequence,
        items: appIds.map((appId, i) => ({ appId, ready: (flags & (1 << i)) !== 0 })),
      };
      const out = generateSteps(draft, ctx);
      if (same(out.steps, steps) && slots.every((s) => out.links[s] === ctx.links[s])) {
        return { draft, links: out.links };
      }
    }
  }
  return null;
}
