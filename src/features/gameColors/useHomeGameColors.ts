import { useEffect, useLayoutEffect } from "react";
import { useTheme } from "../../design";
import { currentMotion } from "../../design/motion/current";
import { focusShadow } from "../../design/motion/tokens";
import { GAME_COLORS, tideReach, tideReachPx } from "../../design/motion/tokens14";
import type { FxTarget } from "../../fx";
import { useHub } from "../../store";
import { selectGame } from "./store";
import { useGameColors, type GameColorsView } from "./useGameColors";

/** Centre of the selected card (viewport px); the middle of the screen when there is none. */
function locate(id: string | null): FxTarget {
  const slot = id ? document.querySelector(`[data-app-id="${CSS.escape(id)}"][data-active]`) : null;
  const card = slot?.querySelector("button[role='option']") ?? slot;
  if (card) {
    const r = card.getBoundingClientRect();
    return { x: r.left + r.width / 2, top: r.top, bottom: r.bottom };
  }
  const H = window.innerHeight;
  return { x: window.innerWidth / 2, top: H * 0.45, bottom: H * 0.65 };
}

/** The home's containers that take the game's accents: title, cards, tabs (`data-game-accents`). */
const targets = () => document.querySelectorAll<HTMLElement>("[data-game-accents]");

/** What each container holds now: an identical write is skipped (no restyle for nothing). */
const written = new WeakMap<HTMLElement, string>();

/** Writes the accents (V2 b) on the home's containers, or gives them back to the theme. */
function write(view: GameColorsView): void {
  const c = view.colors;
  const ring = c ? focusShadow(currentMotion().focus, c.a, c.b) : null;
  const key = c ? `${c.a}|${c.b}|${ring}` : "";
  for (const el of targets()) {
    if ((written.get(el) ?? "") === key) continue;
    written.set(el, key);
    const s = el.style;
    if (c && ring) {
      s.setProperty("--game-a", c.a);
      s.setProperty("--game-b", c.b);
      s.setProperty("--m-focus", ring);
    } else {
      s.removeProperty("--game-a");
      s.removeProperty("--game-b");
      s.removeProperty("--m-focus");
    }
  }
}

/**
 * When the accents change (ms from now): as the tide's edge reaches the first target, halfway
 * through a fade, at once for « Direct ».
 */
function waitFor(view: GameColorsView, first: HTMLElement | null): number {
  const speed = currentMotion().speed;
  const elapsed = performance.now() - view.since;
  if (view.passage === "direct") return 0;
  if (view.passage === "fade") return Math.max(0, GAME_COLORS.fade.ms / speed / 2 - elapsed);
  const o = view.origin;
  if (!o || !first) return 0;
  const ms = GAME_COLORS.tide.ms / speed;
  const oy = (o.top + o.bottom) / 2;
  const r = first.getBoundingClientRect();
  const d = Math.hypot(r.left + r.width / 2 - o.x, r.top + r.height / 2 - oy);
  const at = tideReach(d, ms, tideReachPx(o.x, oy, window.innerWidth, window.innerHeight));
  return Math.max(0, at - elapsed);
}

/**
 * Step 14 on the home screen: publishes the selected app (`null` on the fan; with the setting « Au
 * lancement seulement », the last app started from Kayro instead), and writes the game's
 * accents (title rule, focus ring, hover rims) once, on the containers marked `data-game-accents`
 * only: never on `:root`, so the dialogs and the settings keep the theme (V4 a). With the tide, they
 * change when its edge reaches the first one (the title); otherwise at once, in the same frame.
 */
export function useHomeGameColors(activeId: string | null): void {
  const { theme } = useTheme();
  const view = useGameColors(theme);
  const trigger = useHub((s) => s.settings?.colorTrigger ?? "select");
  const launched = useHub((s) => s.lastLaunched);
  const shown = activeId === null ? null : trigger === "launch" ? launched : activeId;

  useEffect(() => selectGame(shown, () => locate(shown), trigger === "select"), [shown, trigger]);
  // Leaving the home (scenes, editor): back to the theme's colours.
  useEffect(() => () => selectGame(null, () => locate(null)), []);

  useLayoutEffect(() => {
    const wait = view.tide ? waitFor(view, targets()[0] ?? null) : 0;
    if (wait <= 0) return write(view);
    const id = window.setTimeout(() => write(view), wait);
    return () => window.clearTimeout(id);
  }, [view]);
}
