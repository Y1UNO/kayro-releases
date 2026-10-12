import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { WheelEvent } from "react";
import type { AppEntry, AppRunState } from "../../ipc/bindings";
import { useFxTarget } from "../../fx";
import { t } from "../../i18n";
import { AppCard } from "./AppCard";
import { cardGeometry, daStore, useDa } from "../../design/da";
import { useMotionTokens } from "../../design/motion/current";
import { useReducedMotion } from "../../fx/useReducedMotion";
import { useHub } from "../../store";
import { CardHoverFx, cardHoverConfig, periodicGlide } from "./rim/cardHoverFx";
import { geometryVars, mountedRange, type Geometry } from "./carouselGeometry";
import { inheritKeys } from "./deckKeys";
import { cssVars } from "./cssVars";
import { useCarouselFloat } from "./float/useCarouselFloat";
import styles from "./Carousel.module.css";

interface Props {
  apps: readonly AppEntry[];
  focus: number;
  running: Readonly<Record<string, AppRunState>>;
  onFocus: (index: number) => void;
  onMove: (delta: number) => void;
  onLaunch: (app: AppEntry) => void;
  /** A card is being dragged towards a tab (no decorative hover meanwhile). */
  dragging?: boolean;
}

const WHEEL_STEP = 60;
const WHEEL_MIN_INTERVAL_MS = 70;
/** Selection changes closer than this are "fast scrolling" (a held arrow key repeats every ~33 ms). */
const FAST_GAP_MS = 180;
const FAST_HOLD_MS = 200;

/**
 * The poster carousel: the active card is centred, two cards on each side are visible, the others
 * are mounted (so they can slide in) but transparent. Only ~7 cards exist at a time, whatever the
 * number of apps.
 *
 * One tab stop for the whole list (a listbox): the keyboard moves the selection, which the screen
 * reader follows through `aria-activedescendant`. No `focus()` call per key press: it would force a
 * style and layout pass while the cards are moving.
 */
export function Carousel({
  apps,
  focus,
  running,
  onFocus,
  onMove,
  onLaunch,
  dragging = false,
}: Props) {
  const wheel = useRef({ acc: 0, last: 0 });
  const stage = useRef<HTMLDivElement>(null);
  const fast = useRef({ last: 0, timer: 0 });
  const listId = useId();
  const active = apps[focus];
  // Card sizes come from the art direction (`cards` element, live in the workshop).
  const cards = useDa((s) => s.values.cards);
  const geometry = useMemo<Geometry>(() => {
    const c = cardGeometry(cards);
    return { slotW: c.activeW, slotH: c.activeH, sideW: c.sideW, gap: c.gap };
  }, [cards]);

  // Level 3 of the motion table (round 4a): hover of the cards (veil, light threads), launch flash.
  const motion = useMotionTokens();
  const cardHover = useDa((s) => s.values.cardHover);
  const fanHover = useDa((s) => s.values.categoryHover);
  const sheen = useDa((s) => s.values.cardSheen);
  const eco = useHub((s) => s.settings?.quality === "eco");
  const windowMode = useHub((s) => s.settings?.displayMode === "window");
  const reduced = useReducedMotion();
  const hoverCfg = useMemo(
    () =>
      cardHoverConfig(cardHover, fanHover, motion, {
        eco,
        windowMode,
        reduced,
      }),
    [cardHover, fanHover, motion, eco, windowMode, reduced],
  );
  const fx = useRef<CardHoverFx | null>(null);
  useLayoutEffect(() => {
    if (!stage.current) return;
    const f = new CardHoverFx(stage.current, hoverCfg, periodicGlide(sheen));
    fx.current = f;
    return () => {
      f.dispose();
      fx.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (fx.current) fx.current.config = hoverCfg;
  }, [hoverCfg]);
  // The selected card's periodic veil follows its settings (review B5: it was read once).
  useEffect(() => {
    if (fx.current) fx.current.periodicGlide = periodicGlide(sheen);
  }, [sheen]);
  useEffect(() => {
    if (fx.current) fx.current.dragging = dragging;
  }, [dragging]);
  // Round 5: the cards float at the settings' level (paused on hover, wheel, fast scroll, drag).
  const float = useCarouselFloat(stage, dragging);
  const cardOf = (app: AppEntry) =>
    stage.current?.querySelector<HTMLElement>(
      `[data-app-id="${CSS.escape(app.id)}"] [data-stage]`,
    ) ?? null;

  // The active card always sits at the centre of the stage: the light stays there while the
  // cards slide under it (measured from the stage, not the moving card).
  useFxTarget(() => {
    const el = stage.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const h = cardGeometry(daStore.getState().values.cards).activeH;
    const top = r.top + (r.height - h) / 2;
    return { x: r.left + r.width / 2, top, bottom: top + h };
  }, []);

  // Fast scrolling: while the selection changes faster than the eye can follow, the dimming, the
  // glow and the name plate switch instantly (`data-fast`, see AppCard.module.css) and only the
  // sliding of the cards is animated. Each card that becomes active for 30 ms would otherwise
  // start five transitions that nobody sees, hundreds per second. A single press, or a slow one,
  // keeps the full animation. The timer only exists while the selection is moving.
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const now = performance.now();
    if (now - fast.current.last < FAST_GAP_MS) {
      el.dataset.fast = "";
      window.clearTimeout(fast.current.timer);
      fast.current.timer = window.setTimeout(() => delete el.dataset.fast, FAST_HOLD_MS);
    }
    fast.current.last = now;
  }, [focus]);
  useLayoutEffect(() => {
    const state = fast.current;
    return () => window.clearTimeout(state.timer);
  }, []);

  // « Mouvement : Complet » (round 5): the card chosen with the keyboard lights up as if hovered.
  const complete = motion.style === "complete";
  useEffect(() => {
    const st = stage.current;
    if (!complete || !st || !active || document.activeElement !== st || st.matches(":hover"))
      return;
    fx.current?.pointer(cardOf(active));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on a new selection only
  }, [focus, complete]);

  function onWheel(e: WheelEvent) {
    fx.current?.wheel();
    float.current?.wheel();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const w = wheel.current;
    if (Math.sign(delta) !== Math.sign(w.acc)) w.acc = 0;
    w.acc += delta;
    const now = performance.now();
    if (Math.abs(w.acc) >= WHEEL_STEP && now - w.last >= WHEEL_MIN_INTERVAL_MS) {
      onMove(Math.sign(w.acc));
      w.acc = 0;
      w.last = now;
    }
  }

  const [from, to] = mountedRange(focus, apps.length);
  const mounted = apps.slice(from, to + 1);
  // Same cards across a tab change (round 3b): the deck gathers and unfolds these elements.
  // Derived state, updated during render when the list or the selection changes.
  const [keyed, setKeyed] = useState(() => ({
    apps,
    focus,
    s: inheritKeys(
      null,
      apps.map((a) => a.id),
      focus,
    ),
  }));
  let keys = keyed.s.keys;
  if (keyed.apps !== apps || keyed.focus !== focus) {
    const s = inheritKeys(
      keyed.s,
      apps.map((a) => a.id),
      focus,
    );
    keys = s.keys;
    setKeyed({ apps, focus, s });
  }

  return (
    <div
      ref={stage}
      className={styles.stage}
      style={cssVars(geometryVars(geometry))}
      role="listbox"
      data-carousel-stage=""
      tabIndex={0}
      aria-label={t("home.apps")}
      aria-orientation="horizontal"
      aria-activedescendant={active ? `${listId}-${active.id}` : undefined}
      data-motion-cap={
        (windowMode && motion.style !== "complete") || cardHover?.style === "simple"
          ? "2"
          : undefined
      }
      data-hover-off={cardHover?.style === "none" ? "" : undefined}
      data-no-pointer-sheen={hoverCfg.magic && cardHover?.pointerSheen !== true ? "" : undefined}
      onWheel={onWheel}
      onPointerOver={(e) => {
        const card = (e.target as Element).closest<HTMLElement>("[data-stage]");
        fx.current?.pointer(card);
        float.current?.hover(card);
      }}
      onPointerLeave={() => {
        fx.current?.pointer(null);
        float.current?.hover(null);
      }}
      onBlur={() => {
        if (complete && !stage.current?.matches(":hover")) fx.current?.pointer(null);
      }}
    >
      {mounted.map((app, k) => {
        const i = from + k;
        return (
          <AppCard
            key={keys.get(app.id) ?? app.id}
            app={app}
            mode="stage"
            d={i - focus}
            geometry={geometry}
            active={i === focus}
            running={running[app.id]?.running === true}
            domId={`${listId}-${app.id}`}
            onClick={() => {
              if (i !== focus) return onFocus(i);
              const card = cardOf(app);
              if (card) fx.current?.launch(card);
              onLaunch(app);
            }}
          />
        );
      })}
    </div>
  );
}
