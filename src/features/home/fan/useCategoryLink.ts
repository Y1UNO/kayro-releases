import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { daStore, useDa } from "../../../design/da";
import { prefersReducedMotion } from "../../../fx/motionPref";
import { useReducedMotion } from "../../../fx/useReducedMotion";
import { onWindowVisibility } from "../../../ipc/events";
import { useHub } from "../../../store";
import { CATEGORY_IDS, type CategoryId } from "../categories";
import { FanMotion, hoverConfig } from "./fanFloat";
import { linkConfig, type SequenceKind } from "./fanTimeline";
import { LinkDirector } from "./linkDirector";

export type HomeMode = "fan" | "home";

/** `seek` (dev captures): show that moment of the sequence, still. */
type Request = { kind: SequenceKind | "jump" | "fan"; cat: CategoryId; seek?: number };

interface Options {
  category: CategoryId;
  setCategory: (category: CategoryId) => void;
  /** Start of the program: the fan first (round 3b). Can turn true after mount (asked to the core). */
  startOnFan: boolean;
  /** The carousel is shown (the deck sequences need it; grid and empty state just fade). */
  carousel: boolean;
}

/**
 * The home screen's category journey (art direction round 3b, link A): fan → (click) link → carousel;
 * tabs gather the deck and unfold it again; "All categories" plays it backwards; Escape on the fan
 * goes to the last category. React only decides what is mounted and interactive (`mode`,
 * `fanMounted`); every frame is written by the LinkDirector after React committed.
 */
export function useCategoryLink({ category, setCategory, startOnFan, carousel }: Options) {
  const [mode, setMode] = useState<HomeMode>(startOnFan ? "fan" : "home");
  const [fanMounted, setFanMounted] = useState(startOnFan);
  const [request, setRequest] = useState<{ n: number; r: Request }>({
    n: 0,
    r: { kind: startOnFan ? "fan" : "jump", cat: category },
  });
  const shuf = useRef(0);
  const modeRef = useRef(mode);
  const carouselRef = useRef(carousel);
  useLayoutEffect(() => {
    modeRef.current = mode;
    carouselRef.current = carousel;
  });

  const values = useDa((s) => s.values.categoryLink);
  const eco = useHub((s) => s.settings?.quality === "eco");
  const config = useMemo(() => linkConfig(values, eco), [values, eco]);
  // Holds the elements too (its `ref` callbacks), so that React never reads a ref while rendering.
  const [director] = useState(
    () => new LinkDirector(linkConfig(daStore.getState().values.categoryLink)),
  );
  useEffect(() => director.setConfig(config), [director, config]);

  // Floating and hover of the fan (part B): its loop runs only while the fan is shown.
  const hoverValues = useDa((s) => s.values.categoryHover);
  const [motion] = useState(
    () => new FanMotion(hoverConfig(daStore.getState().values.categoryHover, false, false)),
  );
  const reduced = useReducedMotion();
  useEffect(() => {
    director.setMotion(motion, eco, hoverConfig(hoverValues, eco, reduced));
  }, [director, motion, hoverValues, eco, reduced]);
  useLayoutEffect(() => {
    if (fanMounted) director.wake();
  }, [director, fanMounted]);
  useEffect(() => () => director.dispose(), [director]);
  useEffect(() => {
    const onResize = () => director.relayout();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [director]);

  const ask = useCallback((r: Request) => setRequest((q) => ({ n: q.n + 1, r })), []);

  // After React committed the category / the fan: play (or show) what was asked.
  useLayoutEffect(() => {
    const { kind, cat, seek } = request.r;
    const i = CATEGORY_IDS.indexOf(cat);
    if (kind === "fan") return director.rest("choose", i, shuf.current);
    if (kind === "jump") return director.rest("spread", i, shuf.current);
    if (seek !== undefined) return director.seek(kind, i, shuf.current, seek);
    const off = daStore.getState().values.categoryLink?.on === false;
    const reduced = prefersReducedMotion() || off;
    void director.play(kind, i, shuf.current, { eco, reduced }).then((done) => {
      if (done && kind === "link") setFanMounted(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  // The fan left or came: the director forgets / finds its cards.
  useLayoutEffect(() => {
    if (!fanMounted) director.sync();
  }, [fanMounted, director]);

  // Start-up answer from the core arriving after the first render (silent start, opening).
  useEffect(() => {
    if (!startOnFan || modeRef.current === "fan") return;
    setMode("fan");
    setFanMounted(true);
    ask({ kind: "fan", cat: category });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startOnFan]);

  // Hidden while on the fan (shortcut, Escape…): it comes back on the carousel, without motion.
  useEffect(() => {
    const unlisten = onWindowVisibility(({ visible }) => {
      if (visible || modeRef.current !== "fan") return;
      setMode("home");
      setFanMounted(false);
      ask({ kind: "jump", cat: category });
    });
    return () => void unlisten.then((off) => off());
  }, [ask, category]);

  /** A card of the fan (or Escape on the fan: the last category). */
  const pick = useCallback(
    (cat: CategoryId, seek?: number) => {
      director.unhover();
      setCategory(cat);
      setMode("home");
      ask({ kind: "link", cat, seek });
    },
    [ask, setCategory, director],
  );

  /** A tab: the deck gathers with the new apps and unfolds again (grid / empty: plain change). */
  const tab = useCallback(
    (cat: CategoryId, seek?: number) => {
      if (cat === category) return;
      setCategory(cat);
      if (!carouselRef.current) return;
      shuf.current++;
      ask({ kind: "tab", cat, seek });
    },
    [ask, category, setCategory],
  );

  /** "All categories": back to the fan. */
  const back = useCallback(
    (seek?: number) => {
      if (modeRef.current === "fan") return;
      setMode("fan");
      setFanMounted(true);
      ask({ kind: "back", cat: category, seek });
    },
    [ask, category],
  );

  // Development only: the dev page drives the journey (captures, bench, workshop replay).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __categoryLink?: unknown };
    w.__categoryLink = {
      pick,
      tab,
      back,
      mode: () => modeRef.current,
      // Instant moves (the bench measures one kind of sequence at a time).
      fan: () => {
        setMode("fan");
        setFanMounted(true);
        ask({ kind: "fan", cat: category });
      },
      home: () => {
        setMode("home");
        setFanMounted(false);
        ask({ kind: "jump", cat: category });
      },
      // Hover of fan card i (bench, captures): -1 = none.
      hover: (i: number) => {
        director.unhover();
        if (i >= 0) director.hover(i, true, 0.4, -0.3);
      },
    };
    return () => void (w.__categoryLink = undefined);
  }, [pick, tab, back, ask, category, director]);

  return {
    mode,
    fanMounted,
    config,
    bind: director.bind,
    hover: director.hoverFn,
    pick,
    tab,
    back,
  };
}
