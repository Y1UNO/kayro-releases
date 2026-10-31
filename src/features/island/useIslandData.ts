import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useWindowVisible } from "../../app/windowVisible";
import type { AppEntry, NowPlaying } from "../../ipc/bindings";
import { mediaIpc } from "../../ipc/commands";
import { onMediaBeat, onMediaChanged } from "../../ipc/events";
import { hubStore } from "../../store";

/** Step 20 (Kysland): the music playing (null: none), followed live. */
export function useNowPlaying(): NowPlaying | null {
  const [np, setNp] = useState<NowPlaying | null>(null);
  useEffect(() => {
    let live = true;
    void mediaIpc.now().then((r) => {
      if (live && r.ok) setNp(r.value);
    });
    const off = onMediaChanged(setNp);
    return () => {
      live = false;
      void off.then((u) => u());
    };
  }, []);
  return np;
}

/**
 * Step 20: while music plays and the island shows, the core listens to the beat; each level
 * goes straight to the island's style (`--b0`…`--b4`, `--breath` for the bass): no render, no
 * loop of ours. Until the first beat (or if the sound cannot be listened to), the bars dance on
 * their own (`data-beat="fake"`).
 */
export function useBeat(island: RefObject<HTMLElement | null>, playing: boolean): void {
  const visible = useWindowVisible();
  const active = playing && visible;
  useEffect(() => {
    const el = island.current;
    if (!el) return;
    if (!active) {
      el.setAttribute("data-beat", "off");
      el.style.setProperty("--breath", "0");
      return;
    }
    el.setAttribute("data-beat", "fake");
    void mediaIpc.beat(true);
    // The record turns a step at each beat (one turn in 7 s): redrawn at the beat's rate only.
    let angle = 0;
    let last = performance.now();
    const off = onMediaBeat((levels) => {
      const now = performance.now();
      angle = (angle + (Math.min(now - last, 200) / 7000) * 360) % 360;
      last = now;
      el.setAttribute("data-beat", "live");
      levels.forEach((l, i) => el.style.setProperty(`--b${i}`, l.toFixed(3)));
      el.style.setProperty("--breath", (levels[0] ?? 0).toFixed(3));
      el.style.setProperty("--spin", `${angle.toFixed(1)}deg`);
    });
    return () => {
      void mediaIpc.beat(false);
      void off.then((u) => u());
      el.setAttribute("data-beat", "off");
      el.style.setProperty("--breath", "0");
    };
  }, [island, active]);
}

/** How long a launch stretches the island. */
export const LAUNCH_MS = 2400;

/**
 * Step 20: an app that starts (from the island's search, or anywhere: it is seen running)
 * stretches the island with its logo and name for a moment. `announce` shows it at once (the
 * process is seen a little later; the same app is not shown twice in a row).
 */
export interface Stretch {
  /** The app that starts (its logo); none for a message of Kayro's own (its logo). */
  app: AppEntry | null;
  text: string;
}

export function useLaunchStretch(): {
  stretch: Stretch | null;
  announce: (app: AppEntry) => void;
  /** A message of Kayro's own (an update ready), for a little longer. */
  say: (text: string) => void;
} {
  const [stretch, setStretch] = useState<Stretch | null>(null);
  const timer = useRef(0);
  const lastShown = useRef<{ id: string; at: number } | null>(null);
  const show = useRef((next: AppEntry) => {
    const now = performance.now();
    const last = lastShown.current;
    if (last && last.id === next.id && now - last.at < 6000) return;
    lastShown.current = { id: next.id, at: now };
    window.clearTimeout(timer.current);
    setStretch({ app: next, text: next.name });
    timer.current = window.setTimeout(() => setStretch(null), LAUNCH_MS);
  });
  const say = useRef((text: string) => {
    window.clearTimeout(timer.current);
    setStretch({ app: null, text });
    timer.current = window.setTimeout(() => setStretch(null), LAUNCH_MS * 2);
  });
  useEffect(() => {
    const off = hubStore.subscribe((s, before) => {
      if (s.running === before.running) return;
      for (const [id, state] of Object.entries(s.running)) {
        if (state.running && !before.running[id]?.running) {
          const found = s.apps.find((a) => a.id === id);
          if (found) show.current(found);
        }
      }
    });
    return () => {
      off();
      window.clearTimeout(timer.current);
    };
  }, []);
  return { stretch, announce: (a) => show.current(a), say: (text) => say.current(text) };
}
