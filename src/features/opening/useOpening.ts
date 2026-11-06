import { useCallback, useEffect, useRef, useState } from "react";
import { daStore } from "../../design/da";
import { setIntroCue, type IntroFrame } from "../../fx/gpu/cues";
import { desktopIpc } from "../../ipc/commands";
import { onWindowVisibility } from "../../ipc/events";
import { startExpressMode } from "./expressMode";
import { afterIntro } from "./afterIntro";

/** Dark page, nothing drawn: the engine waits for an opening that starts at the next show. */
const WAITING: IntroFrame = {
  fade: 0,
  home: 0,
  embers: 0,
  halo: [0, 0, 1, 0],
  ring: [0, 0, 1, 0],
  draw: [0, 0, 0, 1],
};

/** The opening plays, or will at this window's first show (see `openingOwnsEntrance`). */
let owns = false;

/**
 * The opening brings this page in itself: a page built for a passage (start in widget mode, then
 * « ↗ ») does not fade in under it (review A6).
 */
export function openingOwnsEntrance(): boolean {
  return owns;
}

/**
 * When the opening plays (art direction round 3): once per run of the program, the first time the
 * main window is on screen (the core keeps the count, see `opening_due`). A window built hidden
 * keeps the home screen hidden and the page dark until the first show, so nothing flashes before
 * it. A silent start (Windows login, round 4b) plays none: answered `quiet` at once, the home
 * screen is ready under the first show (still on the fan: it is the program's start).
 *
 * Express start (step 19, « Écran d'accueil » at login): answered `express` at once, the opening
 * waits on its still logo for a click or Enter (`express`), then goes on.
 *
 * `hidden`: keep the home screen hidden (opening playing or waiting). `play`: mount <Opening>.
 * `fan` (round 3b): this is the program's start (first show), the home screen opens on the
 * category fan, even with the opening turned off; a recreated window (economy mode) does not.
 */
export function useOpening(): {
  hidden: boolean;
  play: boolean;
  express: boolean;
  fan: boolean;
  finish: () => void;
} {
  const [state, setState] = useState<"ask" | "later" | "play" | "express" | "off">("ask");
  const [fan, setFan] = useState(false);

  useEffect(() => {
    if (state === "off") setIntroCue(null);
    if (state !== "ask" && state !== "later") return;
    let alive = true;
    // Only the first answer other than « later » counts (the core answers `no` after it).
    let settled = false;
    const on = daStore.getState().values.opening?.on !== false;
    const ask = () =>
      void desktopIpc.openingDue().then((r) => {
        if (!alive || settled) return;
        const due = r.ok ? r.value : "no";
        if (due === "later") return setState("later");
        settled = true;
        if (due !== "no") setFan(true);
        if (due === "express") {
          startExpressMode();
          return setState("express");
        }
        setState(on && due === "now" ? "play" : "off");
      });
    if (state === "ask") ask();
    if (state !== "later") return () => void (alive = false);
    if (on) setIntroCue(() => WAITING);
    const unlisten = onWindowVisibility(({ visible }) => visible && ask());
    // The page announces itself two frames after mounting: the core may have shown the window
    // before this listener was in place (its event then lost: the page stayed dark). Once
    // listening, ask again: shown meanwhile → the opening plays; still hidden → the event will.
    void unlisten.then(() => alive && ask());
    return () => {
      alive = false;
      void unlisten.then((off) => off());
    };
  }, [state]);

  useEffect(() => {
    const on = daStore.getState().values.opening?.on !== false;
    owns = state === "play" || state === "express" || (state === "later" && on);
    return () => void (owns = false);
  }, [state]);

  // « Après l'intro »: once the intro's opening is over, the hub stays, the island comes, or it hides.
  const current = useRef(state);
  useEffect(() => {
    current.current = state;
  }, [state]);
  const finish = useCallback(() => {
    const wasIntro = current.current === "express";
    setState("off");
    if (wasIntro) afterIntro();
  }, []);
  return {
    hidden: state !== "off",
    play: state === "play" || state === "express",
    express: state === "express",
    fan,
    finish,
  };
}
