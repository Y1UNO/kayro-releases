import { useEffect, useRef } from "react";
import { t } from "../../i18n";
import type { Phase } from "./handPose";
import { CARD_FROM, ICON, MENU_AT, type TutorialState } from "./tutorialScript";
import css from "./HandTutorial.module.css";

/** The little screen's size (CSS px). */
export const SCREEN_W = 200;
export const SCREEN_H = 136;
const CARD = [46, 30] as const;
const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;

export interface ScreenEls {
  screen: HTMLDivElement | null;
  cursor: HTMLDivElement | null;
  ripple: HTMLDivElement | null;
  card: HTMLDivElement | null;
  menu: HTMLDivElement | null;
  ring: SVGCircleElement | null;
  hold: SVGSVGElement | null;
  icon: HTMLDivElement | null;
}

export const noEls = (): ScreenEls => ({
  screen: null,
  cursor: null,
  ripple: null,
  card: null,
  menu: null,
  ring: null,
  hold: null,
  icon: null,
});

const px = ([x, y]: [number, number]) => [x * SCREEN_W, y * SCREEN_H] as const;

/**
 * What the gestures do, beside the hand (the tutorial of Réglages › Mains): a little screen with
 * a few icons, a card, the cursor (its glow in the colours of the real one, glow.rs), a click's
 * ripple, a menu, the ring of the thumb up, the camera turned off. Its elements are moved by
 * `paintScreen`, frame by frame, from the tutorial's clock: no React render per frame.
 */
export function MiniScreen({ onEls }: { onEls: (els: ScreenEls) => void }) {
  const els = useRef(noEls());
  useEffect(() => onEls(els.current), [onEls]);
  const [ix, iy] = px(ICON);
  const [mx, my] = px(MENU_AT);
  const [cx, cy] = px(CARD_FROM);
  return (
    <div
      ref={(el) => {
        els.current.screen = el;
      }}
      className={css.screen}
      style={{ width: SCREEN_W, height: SCREEN_H }}
      aria-hidden
    >
      <div className={css.dots}>
        <i />
        <i />
        <i />
      </div>
      <div
        ref={(el) => {
          els.current.icon = el;
        }}
        className={css.tile}
        style={{ left: ix - 13, top: iy - 13 }}
      />
      <div className={css.tile} style={{ left: ix + 23, top: iy - 13 }} />
      <div className={css.tile} style={{ left: ix + 59, top: iy - 13 }} />
      <div
        ref={(el) => {
          els.current.card = el;
        }}
        className={css.card}
        style={{ width: CARD[0], height: CARD[1], left: 0, top: 0, translate: `${cx}px ${cy}px` }}
      />
      <div
        ref={(el) => {
          els.current.menu = el;
        }}
        className={css.menu}
        style={{ left: mx + 6, top: my + 6 }}
      >
        <span />
        <span />
        <span />
      </div>
      <div
        ref={(el) => {
          els.current.ripple = el;
        }}
        className={css.ripple}
      />
      <svg
        ref={(el) => {
          els.current.hold = el;
        }}
        className={css.hold}
        width={RING_R * 2 + 6}
        height={RING_R * 2 + 6}
      >
        <circle
          ref={(el) => {
            els.current.ring = el;
          }}
          cx={RING_R + 3}
          cy={RING_R + 3}
          r={RING_R}
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C}
        />
      </svg>
      <div
        ref={(el) => {
          els.current.cursor = el;
        }}
        className={css.cursor}
      />
      <div className={css.off}>
        <span className={css.offIcon} />
        {t("hands.tuto.cameraOff")}
      </div>
    </div>
  );
}

/** The little screen at the tutorial's state `s`. */
export function paintScreen(els: ScreenEls, s: TutorialState, grip: Phase) {
  const [x, y] = px(s.cursor);
  if (els.cursor) {
    els.cursor.style.translate = `${x}px ${y}px`;
    els.cursor.dataset.grip = s.hand.contact > 0 ? grip : "open";
  }
  if (els.ripple) {
    const age = s.ripple;
    const [rx, ry] = px(ICON);
    els.ripple.style.translate = `${rx}px ${ry}px`;
    els.ripple.style.opacity = age < 0 || age > 0.7 ? "0" : String(0.85 * (1 - age / 0.7));
    els.ripple.style.scale = String(0.3 + (2.4 * Math.min(age, 0.7)) / 0.7);
  }
  if (els.icon) els.icon.dataset.picked = s.picked ? "yes" : "no";
  if (els.card) {
    const [kx, ky] = px(s.card);
    els.card.style.translate = `${kx - CARD[0] / 2}px ${ky - CARD[1] / 2}px`;
    els.card.dataset.grabbed = s.grabbed ? "yes" : "no";
  }
  if (els.menu) {
    els.menu.style.opacity = String(s.menu);
    els.menu.style.scale = String(0.92 + 0.08 * s.menu);
  }
  if (els.hold && els.ring) {
    els.hold.style.translate = `${x - RING_R - 3}px ${y - RING_R - 3}px`;
    els.hold.style.opacity = s.hold > 0 ? "1" : "0";
    els.ring.style.strokeDashoffset = String(RING_C * (1 - s.hold));
  }
  if (els.screen) els.screen.style.setProperty("--camera", String(s.camera));
}
