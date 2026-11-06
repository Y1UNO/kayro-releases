import { useEffect, useRef } from "react";
import { onWindowVisibility } from "../../ipc/events";
import type { AppEntry } from "../../ipc/bindings";
import { prefersReducedMotion } from "../../fx/motionPref";
import { hubStore } from "../../store";

/** How the card comes back (step 24, paquet 3): from a little lower and smaller, on a spring. */
const RETURN = {
  rise: 26, // px
  scale: 0.94,
  ms: 900,
  delay: 160, // the window's own fade has begun
  ease: "cubic-bezier(0.34, 1.45, 0.64, 1)", // « rebond »
};

/**
 * Follows the app last started from Kayro: `seen` once it ran, then closed (`take` gives it once).
 * An app that never showed as open (not followed) never counts.
 */
export function gameEnd() {
  let played: string | null = null;
  let ended: string | null = null;
  return {
    update(lastLaunched: string | null, open: (id: string) => boolean): void {
      if (!lastLaunched) return;
      const up = open(lastLaunched);
      if (up && played !== lastLaunched) {
        played = lastLaunched;
        ended = null;
      } else if (!up && played === lastLaunched) {
        played = null;
        ended = lastLaunched;
      }
    },
    take(): string | null {
      const id = ended;
      ended = null;
      return id;
    },
  };
}

/**
 * Back from a game (step 24, paquet 3): a game started from Kayro ran, then closed while Kayro
 * was away; the next time Kayro shows, the home lands on that game's card (`select`: category and
 * card, its colours come back with the tide) and the card rises back to its place — « you pick up
 * where you were ». On the category fan, nothing is chosen for the user (the link is a signature).
 */
export function useGameReturn(
  apps: readonly AppEntry[],
  onFan: boolean,
  select: (app: AppEntry) => void,
): void {
  const latest = useRef({ apps, onFan, select });
  useEffect(() => {
    latest.current = { apps, onFan, select };
  });

  useEffect(() => {
    const end = gameEnd();
    const unsubscribe = hubStore.subscribe((s) =>
      end.update(s.lastLaunched, (id) => s.running[id]?.running === true),
    );
    const unlisten = onWindowVisibility(({ visible }) => {
      const id = visible ? end.take() : null;
      if (!id) return;
      const { apps: list, onFan: fan, select: pick } = latest.current;
      const app = list.find((a) => a.id === id);
      if (!app || app.category !== "jeux" || fan) return;
      pick(app);
      if (prefersReducedMotion()) return;
      // Two frames: the selection is rendered and the card is in its slot.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const slot = document.querySelector(`[data-app-id="${CSS.escape(id)}"]`);
          const box = slot?.querySelector("button[role=option]")?.parentElement;
          box?.animate(
            [
              { transform: `translateY(${RETURN.rise}px) scale(${RETURN.scale})`, opacity: 0 },
              { transform: "none", opacity: 1 },
            ],
            {
              duration: RETURN.ms,
              delay: RETURN.delay,
              easing: RETURN.ease,
              fill: "backwards",
              composite: "add",
            },
          );
        }),
      );
    });
    return () => {
      unsubscribe();
      void unlisten.then((off) => off());
    };
  }, []);
}
