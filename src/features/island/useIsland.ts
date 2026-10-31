import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { desktopIpc } from "../../ipc/commands";
import { onIslandFrame, onIslandMoment, onWindowVisibility } from "../../ipc/events";
import { IslandEngine, type EngineOptions } from "./islandEngine";

export interface IslandControls {
  /** Opened into its panel (its content can be used). */
  open: boolean;
  press: () => void;
  /** `keep`: leaving it does not close the opened island (a search is being typed). */
  hover: (on: boolean, keep?: boolean) => void;
  close: () => void;
  activity: (a: { media: boolean; stretch: boolean; dots: boolean }) => void;
  trackChanged: () => void;
  /** The opened island's size, which follows its content. */
  panelSize: (width: number, height: number) => void;
}

interface Refs {
  island: RefObject<HTMLDivElement | null>;
  layer: RefObject<HTMLDivElement | null>;
  canvas: RefObject<HTMLCanvasElement | null>;
}

/** Leaving the opened island, it closes after this long (unless the pointer comes back). */
const CLOSE_AFTER_MS = 700;

/**
 * Step 20 (Kysland): one engine per page (islandEngine.ts), fed by the core's events: the
 * gesture's frames and moments, and the window being shown or hidden. A tap opens the island;
 * the pointer leaving it closes it again.
 */
export function useIsland(refs: Refs, options: EngineOptions): IslandControls {
  const opts = useRef(options);
  useEffect(() => {
    opts.current = options;
  });
  const engine = useRef<IslandEngine | null>(null);
  engine.current ??= new IslandEngine(() => opts.current);
  const [open, setOpen] = useState(false);
  const leaving = useRef(0);
  const { island, layer, canvas } = refs;

  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.onOpenChange = setOpen;
    e.attach({ island: island.current, layer: layer.current, canvas: canvas.current });
    let live = true;
    void desktopIpc.islandState().then((r) => {
      if (live) e.start(r.ok ? r.value : { docked: true, corner: 0, seamX: null, seamY: null });
    });
    const offs = [
      onIslandFrame((f) => e.frame(f)),
      onIslandMoment((m) => e.moment(m)),
      onWindowVisibility(({ visible }) => {
        if (visible) e.appear();
        else e.vanish();
      }),
    ];
    return () => {
      live = false;
      e.stop();
      window.clearTimeout(leaving.current);
      for (const off of offs) void off.then((u) => u());
    };
  }, [island, layer, canvas]);

  return {
    open,
    press: () => engine.current?.press(),
    hover: (on, keep = false) => {
      window.clearTimeout(leaving.current);
      engine.current?.hover(on);
      if (!on && !keep && engine.current?.isOpen) {
        leaving.current = window.setTimeout(() => engine.current?.closePanel(), CLOSE_AFTER_MS);
      }
    },
    close: () => engine.current?.closePanel(),
    activity: (a) => engine.current?.activity(a),
    trackChanged: () => engine.current?.trackChanged(),
    panelSize: (w, h) => engine.current?.panelSize(w, h),
  };
}
