import { useId, useLayoutEffect, useRef } from "react";
import type { WheelEvent } from "react";
import type { AppEntry, AppRunState } from "../../ipc/bindings";
import { useFxTarget } from "../../fx";
import { t } from "../../i18n";
import { AppCard } from "./AppCard";
import { SLOT, mountedRange } from "./carouselGeometry";
import styles from "./Carousel.module.css";

interface Props {
  apps: readonly AppEntry[];
  focus: number;
  running: Readonly<Record<string, AppRunState>>;
  onFocus: (index: number) => void;
  onMove: (delta: number) => void;
  onLaunch: (app: AppEntry) => void;
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
export function Carousel({ apps, focus, running, onFocus, onMove, onLaunch }: Props) {
  const wheel = useRef({ acc: 0, last: 0 });
  const stage = useRef<HTMLDivElement>(null);
  const fast = useRef({ last: 0, timer: 0 });
  const listId = useId();
  const active = apps[focus];

  // The active card always sits at the centre of the stage: the light stays there while the
  // cards slide under it (measured from the stage, not the moving card).
  useFxTarget(() => {
    const el = stage.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const top = r.top + (r.height - SLOT.h) / 2;
    return { x: r.left + r.width / 2, top, bottom: top + SLOT.h };
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

  function onWheel(e: WheelEvent) {
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

  return (
    <div
      ref={stage}
      className={styles.stage}
      role="listbox"
      tabIndex={0}
      aria-label={t("home.apps")}
      aria-orientation="horizontal"
      aria-activedescendant={active ? `${listId}-${active.id}` : undefined}
      onWheel={onWheel}
    >
      {mounted.map((app, k) => {
        const i = from + k;
        return (
          <AppCard
            key={app.id}
            app={app}
            mode="stage"
            d={i - focus}
            active={i === focus}
            running={running[app.id]?.running === true}
            domId={`${listId}-${app.id}`}
            onClick={() => (i === focus ? onLaunch(app) : onFocus(i))}
          />
        );
      })}
    </div>
  );
}
