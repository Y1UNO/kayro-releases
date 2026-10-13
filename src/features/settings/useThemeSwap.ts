import { useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "../../design";
import { currentMotion } from "../../design/motion/current";
import { OPENING_C } from "../../design/motion/tokens4b";
import { THEME_SWAP as S } from "../../design/motion/tokens5";
import { isEco } from "../../design/quality";
import { prefersReducedMotion } from "../../fx/motionPref";
import { hubStore } from "../../store";
import { cardKeyframes, easing, swapWay, waveGeometry, type SwapWay } from "./themeSwap";
import styles from "./ThemeCard.module.css";

const WAYS: Record<string, SwapWay> = { wave: "wave", fade: "fade", direct: "direct" };
const CARD_NAME = "kayro-swap-card";
const WAVE_NAME = "kayro-swap-wave";
/** The wave's box: its ring sits at S.wave.size / 2, its outer glow needs room around it. */
const WAVE_BOX = S.wave.size * 1.2;

const part = (card: HTMLElement, name: string) =>
  card.querySelector<HTMLElement | SVGElement>(`[data-swap="${name}"]`);

/**
 * The card's own impact: rise, squash, settle, its sheen and its moon (Eco and « Fondu » too).
 * `crisp` (« Mouvement : Net », review A5): the springs on the entrance curve.
 */
function playCard(card: HTMLElement, speed: number, impact: boolean, crisp: boolean): void {
  const at = (delay: number, duration: number, ease: string, fill: FillMode = "backwards") => ({
    delay: delay / speed,
    duration: duration / speed,
    easing: easing(ease, crisp),
    fill,
  });
  const k = cardKeyframes(crisp);
  card.animate(k.transform, { duration: k.ms / speed });
  part(card, "face")?.animate(k.filter, { duration: k.ms / speed });
  part(card, "sheen")?.animate(
    [
      { transform: "translateX(-130%)", opacity: 1 },
      { transform: "translateX(130%)", opacity: 1 },
    ],
    at(S.sheen.at, S.sheen.ms, S.sheen.ease),
  );
  part(card, "moon")?.animate(
    [
      { opacity: 0, transform: "scale(1)" },
      { opacity: 1, transform: `scale(${S.moon.scale})`, offset: 0.35 },
      { opacity: 0, transform: "scale(1)" },
    ],
    at(S.moon.at, S.moon.ms, "standard"),
  );
  if (!impact) return;
  // The shockwave on the card itself (box-shadow: the depth is a filter, on the face).
  const a = `color-mix(in srgb, var(--grad-a) ${S.shock.alpha * 100}%, transparent)`;
  card.animate(
    [
      { boxShadow: `0 0 0 0 ${a}, 0 0 0 0 ${a}` },
      {
        boxShadow: `0 0 0 ${S.shock.spread}px transparent, 0 0 ${S.shock.halo}px ${S.shock.spread}px transparent`,
      },
    ],
    at(S.shock.at, S.shock.ms, S.shock.ease, "none"),
  );
  const sparks = card.querySelectorAll<HTMLElement>(`[data-swap="sparks"] > span`);
  sparks.forEach((el) => {
    const dx = Number(el.dataset.dx);
    const dy = Number(el.dataset.dy);
    el.animate(
      [
        { transform: "translate(0px, 0px) scale(1)", opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0 },
      ],
      at(S.sparks.at + Number(el.dataset.delay), S.sparks.ms, S.sparks.ease, "none"),
    );
  });
  const frame = part(card, "frame");
  frame?.animate(
    [
      { strokeDashoffset: 1, opacity: 1 },
      { strokeDashoffset: 0, opacity: 1 },
    ],
    at(S.frame.at, S.frame.ms, S.frame.ease),
  );
  frame?.animate(
    [{ opacity: 1 }, { opacity: 0 }],
    at(S.frame.at + S.frame.ms + 150, 300, "standard", "none"),
  );
}

/** The check pops on the card once it is the active theme (after the commit); `crisp`: no pop. */
function popCheck(card: HTMLElement, speed: number, delay: number, crisp: boolean): void {
  const peak = crisp ? [] : [{ transform: `scale(${S.check.peak})`, offset: 0.55 }];
  part(card, "check")?.animate([{ transform: "scale(0)" }, ...peak, { transform: "scale(1)" }], {
    delay: delay / speed,
    duration: S.check.ms / speed,
    easing: easing(S.check.ease, crisp),
    fill: "backwards",
  });
}

/** A fixed 400 px ring drawn like the opening's wave, centred on the moon (C pulse, round 4b). */
function makeWave(x: number, y: number): HTMLElement {
  const el = document.createElement("div");
  el.className = styles.wave ?? "";
  el.setAttribute("aria-hidden", "true");
  el.style.left = `${x - WAVE_BOX / 2}px`;
  el.style.top = `${y - WAVE_BOX / 2}px`;
  el.style.setProperty("--wave-band", String(OPENING_C.waveBand));
  el.style.viewTransitionName = WAVE_NAME;
  return el;
}

/**
 * The theme change of Réglages › Thèmes. `choose(id, card)`: the card rises and is squashed, at the
 * impact the theme changes — revealed in a circle from the card's moon behind the C pulse's wave
 * (View Transitions: the old page frozen, the new one live, canvas included), or by the 0.9 s
 * cross-fade (Eco, « Fondu », no View Transitions, engine in CSS fallback), or directly (reduced
 * motion, « Direct »). Clicks are ignored until it ends.
 */
export function useThemeSwap(): (id: string, card: HTMLElement) => void {
  const { theme, setThemeId } = useTheme();
  const busy = useRef(false);

  return useCallback(
    (id: string, card: HTMLElement) => {
      if (busy.current || id === theme.id) return;
      const settings = hubStore.getState().settings;
      const { speed, style } = currentMotion();
      const crisp = style === "crisp";
      const { way, card: withCard } = swapWay({
        setting: WAYS[settings?.themeTransition ?? "wave"] ?? "wave",
        eco: isEco(settings?.quality),
        reduced: prefersReducedMotion(),
        viewTransitions: typeof document.startViewTransition === "function",
        engineFallback: document.documentElement.dataset.glassFallback !== undefined,
      });
      if (way === "direct") {
        setThemeId(id, { instant: true });
        return;
      }
      busy.current = true;
      window.setTimeout(() => (busy.current = false), S.end / speed);
      if (withCard) playCard(card, speed, way === "wave", crisp);
      const checkDelay = S.check.at - S.impact;

      window.setTimeout(() => {
        if (way === "fade") {
          flushSync(() => setThemeId(id));
          popCheck(card, speed, checkDelay, crisp);
          return;
        }
        const moon = part(card, "moon")?.getBoundingClientRect();
        const box = card.getBoundingClientRect();
        const x = moon ? moon.left + moon.width / 2 : box.left + box.width / 2;
        const y = moon ? moon.top + moon.height / 2 : box.top + box.height / 2;
        const geo = waveGeometry(x, y, (moon?.width ?? 20) / 2, {
          w: innerWidth,
          h: innerHeight,
        });
        // Named before the capture: the old page is frozen without the card, whose own picture
        // stays live above it (one card, never a frozen copy under the live one).
        card.style.viewTransitionName = CARD_NAME;
        let wave: HTMLElement | null = null;
        const vt = document.startViewTransition(() => {
          flushSync(() => setThemeId(id, { instant: true }));
          // Only in the new page, under the card (inserted before the app's root).
          wave = makeWave(x, y);
          document.body.prepend(wave);
          popCheck(card, speed, checkDelay, crisp);
        });
        const root = document.documentElement;
        const ms = S.wave.ms / speed;
        const ease = easing(S.wave.ease);
        void vt.ready
          .then(() => {
            root.animate(
              { clipPath: geo.clip },
              {
                duration: ms,
                easing: ease,
                fill: "both",
                pseudoElement: "::view-transition-new(root)",
              },
            );
            const move = (s: number) =>
              `translate(${x - WAVE_BOX / 2}px, ${y - WAVE_BOX / 2}px) scale(${s})`;
            root.animate(
              [
                { transform: move(geo.scale[0]), opacity: OPENING_C.wave },
                { opacity: OPENING_C.wave, offset: S.wave.full },
                { transform: move(geo.scale[1]), opacity: 0 },
              ],
              {
                duration: ms,
                easing: ease,
                fill: "both",
                pseudoElement: `::view-transition-group(${WAVE_NAME})`,
              },
            );
            const origin = `${x}px ${y}px`;
            root.animate(
              [
                { transform: "scale(1)", transformOrigin: origin, easing: "ease-out" },
                {
                  transform: `scale(${S.recoil.scale})`,
                  transformOrigin: origin,
                  offset: 0.2,
                  easing: easing(S.recoil.ease, crisp),
                },
                { transform: "scale(1)", transformOrigin: origin },
              ],
              {
                duration: S.recoil.ms / speed,
                pseudoElement: "::view-transition-image-pair(root)",
              },
            );
          })
          .catch(() => {}); // skipped (another transition): the theme is applied anyway
        void vt.finished.finally(() => {
          card.style.viewTransitionName = "";
          (wave as HTMLElement | null)?.remove();
        });
      }, S.impact / speed);
    },
    [theme.id, setThemeId],
  );
}
