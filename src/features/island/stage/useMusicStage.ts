import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useWindowVisible } from "../../../app/windowVisible";
import type { IslandStage, NowPlaying } from "../../../ipc/bindings";
import { desktopIpc } from "../../../ipc/commands";
import { onIslandStage, onMusicFrame } from "../../../ipc/events";
import { hubStore } from "../../../store";
import { shapeOf } from "../islandShape";
import { rgbOf, trackKey } from "../music";
import { StageEngine, type StageLook, type StageTrack } from "./stageEngine";

/** Paused (or nothing playing) this long, the island goes home (ms). */
export const PAUSE_HOME_MS = 2000;
/** The island's music and bars fade out before the window switches (Island.module.css). */
const FADE_MS = 180;
/** The core may refuse for a moment (the island closing, coming out of the edge): tried again. */
const RETRY_MS = 400;
const RETRIES = 10;
/** Then, while it is still wanted (a long drag, say), more slowly. */
const RETRY_SLOW_MS = 1500;

export interface StageOptions {
  /** « Mode musique » on (the opened island's switch). */
  on: boolean;
  np: NowPlaying | null;
  /** The island is opened, or in the top edge: it stays home. */
  open: boolean;
  tucked: boolean;
  calm: boolean;
  /** The mode's settings (Réglages › Visuel › Mode musique); with the test track, it plays alone. */
  look: StageLook;
}

/**
 * What the window shows: the island (`off`); the island still, the window grown in place or
 * back at its place (`ready`, `back`); the drop, the window covering the screen (`on`).
 */
export type StagePhase = "off" | "ready" | "on" | "back";

export interface StageControls {
  phase: StagePhase;
  /** A click on the drop: the mode is turned off, the island flies home. */
  click: (x: number, y: number) => boolean;
}

export function trackOf(np: NowPlaying | null): StageTrack | null {
  if (!np) return null;
  return {
    key: trackKey(np),
    title: np.title,
    artist: np.artist,
    cover: np.cover,
    accent: rgbOf(np.colors?.[1]),
    dominant: rgbOf(np.colors?.[0]),
    playing: np.playing,
  };
}

/** The island at rest as the page draws it (its real size: the canvas ends on it exactly). */
export function homeSize(docked: boolean, music: boolean): { w: number; h: number } {
  const s = shapeOf({
    morph: docked ? 0 : 1,
    corner: 0,
    hover: 0,
    pullX: 0,
    pullY: 0,
    vx: 0,
    vy: 0,
    squish: 0,
    presence: 1,
    open: 0,
    media: music ? 1 : 0,
    stretch: 0,
    dots: 0,
  });
  return { w: s.width, h: s.height };
}

/** Two frames from now (the page has drawn what it was told). */
const afterPaint = (f: () => void) => requestAnimationFrame(() => requestAnimationFrame(f));

/** The island's colours now (its tone and rim, set by its engine on its element). */
function paletteOf(el: HTMLElement | null): { tone: string; rimA: number } {
  const css = el ? getComputedStyle(el) : null;
  const tone = css?.getPropertyValue("--tone").trim() || "214 236 255";
  const num = (name: string, fallback: number) => {
    const v = parseFloat(css?.getPropertyValue(name) ?? "");
    return Number.isFinite(v) ? v : fallback;
  };
  return { tone, rimA: num("--rim-a", 0.55) };
}

/**
 * Kysland's music mode (the lab's, 2026-11-03): while « Mode musique » is on and music plays (or
 * the test track, in demo mode), the island lets a drop fall to the middle of its screen that
 * becomes the player (`stageEngine.ts`); paused or stopped for 2 s, opened, turned off or
 * hidden, it comes home. The window's switches are the core's
 * (`desktop/island/stage.rs`): it grows in place while the island still shows (`ready`), moves
 * to cover the screen once the drop is drawn where the island is (`on`), and goes back once the
 * island shows again at its place (`back`). Timers only on a change, no loop of its own.
 */
export function useMusicStage(
  o: StageOptions,
  canvas: RefObject<HTMLCanvasElement | null>,
  island: RefObject<HTMLElement | null>,
): StageControls {
  const visible = useWindowVisible();
  const engine = useRef<StageEngine | null>(null);
  const [stage, setStage] = useState<IslandStage | null>(null);
  const [phase, setPhase] = useState<StagePhase>("off");
  const opts = useRef(o);
  useEffect(() => {
    opts.current = o;
  });

  // Playing, or paused (or stopped) for less than 2 s.
  const playing = Boolean(o.np?.playing);
  const [held, setHeld] = useState(playing);
  const [wasPlaying, setWasPlaying] = useState(playing);
  if (playing !== wasPlaying) {
    setWasPlaying(playing);
    if (playing) setHeld(true);
  }
  useEffect(() => {
    if (playing) return;
    const id = window.setTimeout(() => setHeld(false), PAUSE_HOME_MS);
    return () => window.clearTimeout(id);
  }, [playing]);

  const want = o.on && (held || o.look.demo) && visible && !o.open && !o.tucked;
  const leaving = useRef(false);
  // The phase now, for answers that come back after a change (the core ended the mode).
  const now = useRef<StagePhase>("off");
  const toPhase = (p: StagePhase) => {
    now.current = p;
    setPhase(p);
  };

  // In: asks the core (again for a moment if it refuses); out: flies home, shows the island
  // again at its place, then tells the core.
  useEffect(() => {
    if (want && !stage) {
      let live = true;
      let tries = 0;
      let timer = 0;
      const ask = () => {
        void desktopIpc.islandStage("enter").then((r) => {
          const got = r.ok ? r.value : null;
          if (!live) {
            // Answered once no longer wanted: the core grew the window for nothing.
            if (got) void desktopIpc.islandStage("done");
            return;
          }
          if (got) {
            setStage(got);
            toPhase("ready");
          } else timer = window.setTimeout(ask, ++tries < RETRIES ? RETRY_MS : RETRY_SLOW_MS);
        });
      };
      ask();
      return () => {
        live = false;
        window.clearTimeout(timer);
      };
    }
    if (!want && stage && !leaving.current) {
      leaving.current = true;
      const e = engine.current;
      // Home as the island is now (without music any more, it is narrower).
      const size = homeSize(stage.docked, opts.current.np !== null);
      void (e ? e.leave(size.w, size.h) : Promise.resolve(true)).then((home) => {
        if (!home || (now.current !== "ready" && now.current !== "on")) return;
        toPhase("back");
        afterPaint(() => void desktopIpc.islandStage("done"));
      });
    }
    // The music came back on the way home: before it touches, the drop turns back.
    if (want && stage && leaving.current && engine.current?.stay()) leaving.current = false;
  }, [want, stage]);

  // The window has grown in place: the drop is drawn where the island is, then the window moves.
  useEffect(() => {
    const el = canvas.current;
    if (!stage?.on || !el) return;
    const { calm, np, look } = opts.current;
    const size = homeSize(stage.docked, np !== null);
    const e = new StageEngine(el);
    engine.current = e;
    leaving.current = false;
    e.onArea = (rects) => void desktopIpc.islandStageArea(rects);
    e.start(
      {
        width: stage.width ?? 0,
        height: stage.height ?? 0,
        homeX: stage.homeX ?? 0,
        homeY: stage.homeY ?? 0,
        homeW: size.w,
        homeH: size.h,
        docked: stage.docked,
        corner: stage.corner ?? 0,
        calm,
        ...paletteOf(island.current),
      },
      trackOf(np),
      look,
    );
    let live = true;
    const id = window.setTimeout(
      () =>
        afterPaint(() => {
          if (!live || leaving.current) return;
          void desktopIpc.islandStage("go").then(() => {
            if (!live || leaving.current) return;
            if (now.current !== "ready") return;
            toPhase("on");
            e.launch();
          });
        }),
      FADE_MS,
    );
    return () => {
      live = false;
      window.clearTimeout(id);
      e.dispose();
      if (engine.current === e) engine.current = null;
    };
  }, [stage, canvas, island]);

  // Back home (or ended by the core: hidden, a program in full screen): the island again.
  useEffect(() => {
    const off = onIslandStage((e) => {
      if (e.on) return;
      setStage(null);
      toPhase("off");
      leaving.current = false;
    });
    return () => void off.then((u) => u());
  }, []);

  // The music, and its beat while the drop shows.
  const track = trackOf(o.np);
  const key = track
    ? `${track.key}|${track.playing}|${track.cover?.length ?? 0}|${track.accent}|${track.dominant}`
    : "";
  useEffect(() => {
    engine.current?.setTrack(trackOf(opts.current.np));
  }, [key]);
  // The settings changed while it shows.
  const lookKey = JSON.stringify(o.look);
  useEffect(() => {
    engine.current?.configure(opts.current.look);
  }, [lookKey]);
  // The sound as analysed (hits and levels, about every 10 ms) while it shows.
  const on = stage?.on === true;
  useEffect(() => {
    if (!on) return;
    const off = onMusicFrame((f) => engine.current?.feed(f));
    return () => void off.then((u) => u());
  }, [on]);

  return {
    phase,
    click: (x, y) => {
      if (phase !== "on" || !engine.current?.hits(x, y)) return false;
      void hubStore.getState().setSettings({ islandMusic: false });
      return true;
    },
  };
}
