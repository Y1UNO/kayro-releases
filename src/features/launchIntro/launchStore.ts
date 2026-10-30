import { createStore } from "zustand";
import type { AppEntry, LaunchStyle } from "../../ipc/bindings";
import { desktopIpc } from "../../ipc/commands";
import { onLaunchLanded } from "../../ipc/events";
import { prefersReducedMotion } from "../../fx/motionPref";
import { parseColor } from "../../lib/color";
import { playSound } from "../../sound";
import { artStore, hubStore, imageOf } from "../../store";
import { artUrl } from "../home/art";
import { moodById } from "../moods/moodsStore";

/** A launch sequence under way (30/10): the app, its card, its colours, what happened since. */
export interface Intro {
  app: AppEntry;
  style: LaunchStyle;
  rect: { x: number; y: number; w: number; h: number };
  a: [number, number, number];
  b: [number, number, number];
  poster: string | null;
  eco: boolean;
  /** `performance.now()` when it started, when the game's window came up, when it failed. */
  since: number;
  landedAt: number | null;
  failed: boolean;
  /** The game was already open (brought to the front): straight to the finale. */
  existing: boolean;
}

export const launchIntro = createStore<{ playing: Intro | null }>(() => ({ playing: null }));

let listening = false;

/** The core tells when the game's window came to the front (during the cover). */
function listen(): void {
  if (listening) return;
  listening = true;
  void onLaunchLanded(() => {
    const p = launchIntro.getState().playing;
    if (p && p.landedAt === null)
      launchIntro.setState({ playing: { ...p, landedAt: performance.now() } });
  });
}

/** The shown card's button (carousel or grid), if it is on screen. */
function cardOf(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-app-id="${CSS.escape(id)}"][data-active] [role="option"]`,
  );
}

/** The game's accents (the home's containers hold them), else the theme's, as 0–1 rgb. */
function colours(): [[number, number, number], [number, number, number]] {
  const el = document.querySelector("[data-game-accents]") ?? document.documentElement;
  const s = getComputedStyle(el);
  const rgb = (names: string[], d: [number, number, number]): [number, number, number] => {
    for (const n of names) {
      const c = parseColor(s.getPropertyValue(n));
      if (c) return [c.r / 255, c.g / 255, c.b / 255];
    }
    return d;
  };
  return [
    rgb(["--game-a", "--grad-a"], [0.43, 0.85, 0.66]),
    rgb(["--game-b", "--grad-b"], [0.75, 0.95, 0.85]),
  ];
}

/**
 * Launches an app from the home. When its ambience has a launch sequence (« Couleurs du jeu »
 * not off, motion not reduced) and its card is on screen: the hub covers the screen (it stays in
 * front of the store's own windows), the game starts at once behind it, and the sequence plays
 * (LaunchIntro.tsx) until the game's window is up; otherwise the game simply starts.
 */
export function startLaunch(app: AppEntry): void {
  const go = () => hubStore.getState().launchApp(app.id);
  const settings = hubStore.getState().settings;
  const style = settings?.colorMode === "off" ? null : moodById(app.moodId)?.launch;
  const card = style && !prefersReducedMotion() ? cardOf(app.id) : null;
  if (launchIntro.getState().playing) return;
  playSound("launch");
  if (!card || !style) return void go();
  listen();
  const r = card.getBoundingClientRect();
  const [a, b] = colours();
  const poster = imageOf(artStore.getState(), app.id, "poster");
  launchIntro.setState({
    playing: {
      app,
      style,
      rect: { x: r.left, y: r.top, w: r.width, h: r.height },
      a,
      b,
      poster: poster ? artUrl(app.id, poster) : null,
      eco: settings?.quality === "eco",
      since: performance.now(),
      landedAt: null,
      failed: false,
      existing: false,
    },
  });
  void desktopIpc.launchCover(true, false).then(() =>
    go().then((r) => {
      const p = launchIntro.getState().playing;
      if (!p) return;
      if (!r.ok) launchIntro.setState({ playing: { ...p, failed: true } });
      else if (r.value.kind === "focusedExisting")
        launchIntro.setState({ playing: { ...p, existing: true } });
    }),
  );
}

/** The sequence ended: the cover drops; `hide` (the game is up) takes the hub off the screen. */
export function endLaunch(hide: boolean): void {
  if (!launchIntro.getState().playing) return;
  void desktopIpc.launchCover(false, hide).finally(() => {
    // The page keeps its last (black) frame until the window is gone.
    window.setTimeout(() => launchIntro.setState({ playing: null }), hide ? 250 : 0);
  });
}
