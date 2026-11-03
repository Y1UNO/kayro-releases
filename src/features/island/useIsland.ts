import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { IslandMoment } from "../../ipc/bindings";
import { desktopIpc } from "../../ipc/commands";
import {
  onIslandFrame,
  onIslandMoment,
  onIslandTucked,
  onWindowVisibility,
} from "../../ipc/events";
import { IslandEngine, type EngineOptions } from "./islandEngine";
import { Idler, glint } from "./islandIdle";
import { Tucker } from "./islandTuck";

export interface IslandControls {
  /** Opened into its panel (its content can be used). */
  open: boolean;
  /** « Cacher l'île »: in the top edge, nothing of it shows. */
  tucked: boolean;
  /** The idle may play its gestures (the click region leaves them room). */
  idling: boolean;
  press: () => void;
  /** `keep`: leaving it does not close the opened island (a search is being typed). */
  hover: (on: boolean, keep?: boolean) => void;
  close: () => void;
  /** `playing`: the music plays (paused, the idle may play its gestures). */
  activity: (a: { media: boolean; stretch: boolean; dots: boolean; playing: boolean }) => void;
  trackChanged: () => void;
  /** The opened island's size, which follows its content. */
  panelSize: (width: number, height: number) => void;
}

/** « Cacher l'île » (`islandTuck.ts`), from the settings and what the island shows. */
export interface TuckOptions {
  /** On (and the island always there). */
  enabled: boolean;
  /** How long after the pointer has left it the island goes in (ms). */
  delayMs: number;
  /** A launch or an announcement stretches it: it shows. */
  stretched: boolean;
  /** Its docked width at rest (logical): the place on the top edge that brings it out. */
  width: () => number;
}

interface Refs {
  island: RefObject<HTMLDivElement | null>;
  layer: RefObject<HTMLDivElement | null>;
  canvas: RefObject<HTMLCanvasElement | null>;
}

/** Leaving the opened island, it closes after this long (unless the pointer comes back). */
const CLOSE_AFTER_MS = 700;

/** What a gesture's moment tells « Cacher l'île » and the idle: docked or not, at rest again. */
function followMoment(t: Tucker, i: Idler, m: IslandMoment): void {
  if (m.kind === "settled") t.update({ docked: m.docked, moving: false });
  else if (m.kind === "tap") t.update({ moving: false });
  if (m.kind === "settled" || m.kind === "tap") i.update({ moving: false });
}

/**
 * Step 20 (Kysland): one engine per page (islandEngine.ts), fed by the core's events: the
 * gesture's frames and moments, and the window being shown or hidden. A tap opens the island;
 * the pointer leaving it closes it again. « Cacher l'île » puts it into the top edge.
 */
export function useIsland(refs: Refs, options: EngineOptions, tuck: TuckOptions): IslandControls {
  const opts = useRef(options);
  const tuckOpts = useRef(tuck);
  useEffect(() => {
    opts.current = options;
    tuckOpts.current = tuck;
  });
  const engine = useRef<IslandEngine | null>(null);
  engine.current ??= new IslandEngine(() => opts.current);
  const [open, setOpen] = useState(false);
  const [tucked, setTucked] = useState(false);
  const [idling, setIdling] = useState(false);
  const idler = useRef<Idler | null>(null);
  idler.current ??= new Idler({
    play: (g) => (g === "glint" ? glint(refs.island.current) : engine.current?.idle(g)),
    wake: () => engine.current?.idle("wake"),
    onArmed: setIdling,
  });
  const tucker = useRef<Tucker | null>(null);
  tucker.current ??= new Tucker({
    draw: (into) => engine.current?.tuck(into),
    tell: async (into) => {
      const r = await desktopIpc.islandTuck(into, tuckOpts.current.width());
      return r.ok && r.value;
    },
    onPhase: (phase) => {
      setTucked(phase === "in");
      idler.current?.update({ tucked: phase !== "out" });
    },
  });
  const leaving = useRef(0);
  const { island, layer, canvas } = refs;

  useEffect(() => {
    const e = engine.current;
    const t = tucker.current;
    const i = idler.current;
    if (!e || !t || !i) return;
    e.onOpenChange = (o) => {
      setOpen(o);
      t.update({ open: o });
      i.update({ open: o });
    };
    e.onSettle = () => t.settled(e.tuckedAway);
    e.attach({ island: island.current, layer: layer.current, canvas: canvas.current });
    let live = true;
    void desktopIpc.islandState().then((r) => {
      if (!live) return;
      const state = r.ok ? r.value : { docked: true, corner: 0, seamX: null, seamY: null };
      e.start(state);
      t.update({ docked: state.docked });
    });
    const offs = [
      onIslandFrame((f) => {
        e.frame(f);
        t.update({ moving: true });
        i.update({ moving: true });
      }),
      onIslandMoment((m) => {
        e.moment(m);
        followMoment(t, i, m);
      }),
      onIslandTucked(({ tucked: into }) => {
        if (!into) t.peeked();
      }),
      onWindowVisibility(({ visible }) => {
        if (visible) e.appear();
        else e.vanish();
        t.update({ visible });
        i.update({ visible });
      }),
    ];
    return () => {
      live = false;
      e.stop();
      t.dispose();
      i.dispose();
      window.clearTimeout(leaving.current);
      for (const off of offs) void off.then((u) => u());
    };
  }, [island, layer, canvas]);

  useEffect(() => {
    const t = tucker.current;
    if (!t) return;
    t.setDelay(tuck.delayMs);
    t.update({ enabled: tuck.enabled, stretched: tuck.stretched });
  }, [tuck.enabled, tuck.delayMs, tuck.stretched]);

  // The idle: only with its effects, never with « reduce motion ».
  const idleOn = options.effects && !options.calm;
  useEffect(() => idler.current?.update({ enabled: idleOn }), [idleOn]);

  return {
    open,
    tucked,
    idling,
    press: () => engine.current?.press(),
    hover: (on, keep = false) => {
      window.clearTimeout(leaving.current);
      engine.current?.hover(on);
      tucker.current?.update({ hovered: on });
      idler.current?.update({ hovered: on });
      if (!on && !keep && engine.current?.isOpen) {
        leaving.current = window.setTimeout(() => engine.current?.closePanel(), CLOSE_AFTER_MS);
      }
    },
    close: () => engine.current?.closePanel(),
    activity: (a) => {
      engine.current?.activity(a);
      idler.current?.update({ busy: (a.media && a.playing) || a.stretch });
    },
    // In the top edge, nothing shows: no jolt (it would run frames for nothing).
    trackChanged: () => {
      if (tucker.current?.phase !== "in") engine.current?.trackChanged();
    },
    panelSize: (w, h) => engine.current?.panelSize(w, h),
  };
}
