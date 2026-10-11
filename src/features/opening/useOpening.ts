import { useCallback, useEffect, useState } from "react";
import { daStore } from "../../design/da";
import { setIntroCue, type IntroFrame } from "../../fx/gpu/cues";
import { desktopIpc } from "../../ipc/commands";
import { onWindowVisibility } from "../../ipc/events";

/** Dark page, nothing drawn: the engine waits for an opening that starts at the next show. */
const WAITING: IntroFrame = {
  fade: 0,
  home: 0,
  embers: 0,
  halo: [0, 0, 1, 0],
  ring: [0, 0, 1, 0],
  draw: [0, 0, 0, 1],
};

/**
 * When the opening plays (art direction round 3): once per run of the program, the first time the
 * main window is on screen (the core keeps the count, see `opening_due`). A silent start keeps the
 * home screen hidden and the page dark until the first show, so nothing flashes before it.
 *
 * `hidden`: keep the home screen hidden (opening playing or waiting). `play`: mount <Opening>.
 */
export function useOpening(): { hidden: boolean; play: boolean; finish: () => void } {
  const [state, setState] = useState<"ask" | "later" | "play" | "off">(() =>
    daStore.getState().values.opening?.on === false ? "off" : "ask",
  );

  useEffect(() => {
    if (state === "off") setIntroCue(null);
    if (state !== "ask" && state !== "later") return;
    let alive = true;
    const ask = () =>
      void desktopIpc.openingDue().then((r) => {
        if (!alive) return;
        const due = r.ok ? r.value : "no";
        setState(due === "now" ? "play" : due === "later" ? "later" : "off");
      });
    if (state === "ask") ask();
    if (state !== "later") return () => void (alive = false);
    setIntroCue(() => WAITING);
    const unlisten = onWindowVisibility(({ visible }) => visible && ask());
    return () => {
      alive = false;
      void unlisten.then((off) => off());
    };
  }, [state]);

  const finish = useCallback(() => setState("off"), []);
  return { hidden: state !== "off", play: state === "play", finish };
}
