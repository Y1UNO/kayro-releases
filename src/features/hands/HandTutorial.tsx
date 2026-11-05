import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../fx/useReducedMotion";
import { t, type MessageKey } from "../../i18n";
import { drawHand, type Look } from "./handDraw";
import { cssColor, inkHand, type InkColors } from "./handInk";
import type { RightFinger } from "./handPose";
import { MiniScreen, noEls, paintScreen, type ScreenEls } from "./MiniScreen";
import { LOOP_S, SCENE_KEY, SCENES, sceneStart, tutorialAt } from "./tutorialScript";
import css from "./HandTutorial.module.css";

const W = 250;
const H = 210;
/** With reduced motion: each scene still, this long (s). */
const STILL_S = 4;
const LOOK: Look = { yaw: 0, pitch: 0.22 };

/**
 * The tutorial of the hands (Réglages › Mains, step 22), in motion design: five scenes on one
 * clock (tutorialScript.ts). The hand (WebGL2, handInk.ts; without it the 2D hand of
 * handDraw.ts) does the gesture, the little screen beside it shows what it does, the scene's
 * title and sentence rise in (the settings' cascade), the bar of steps fills and jumps to a scene
 * when clicked. It pauses under the pointer, out of view and with the window hidden. Reduced
 * motion: each scene still, in turn.
 */
export function HandTutorial({ right }: { right: RightFinger }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const els = useRef(noEls());
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const clock = useRef(0);
  const paused = useRef(false);
  const reduced = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [flat, setFlat] = useState(false);
  const jump = useRef<(i: number) => void>(() => {});
  const keepEls = useCallback((e: ScreenEls) => {
    els.current = e;
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    // The hand is ray-marched per pixel: at most 1.5 pixels per CSS pixel.
    const dpr = Math.min(flat ? 2 : 1.5, window.devicePixelRatio || 1);
    el.width = Math.round(W * dpr);
    el.height = Math.round(H * dpr);
    const ink = flat ? null : inkHand(el);
    if (!flat && !ink) {
      setFlat(true);
      return;
    }
    const ctx = ink ? null : el.getContext("2d");
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    const root = document.documentElement;
    const colors: InkColors = {
      top: cssColor(root, "var(--bg-top)", [0.08, 0.1, 0.19]),
      bottom: cssColor(root, "var(--bg-bottom)", [0.02, 0.03, 0.06]),
      a: cssColor(el, "var(--grad-a)", [0.64, 0.69, 0.87]),
      b: cssColor(el, "var(--grad-b)", [0.45, 0.51, 0.74]),
    };

    let shown = true;
    let raf = 0;
    let timer = 0;
    let last = performance.now();
    const paint = (time: number) => {
      const s = tutorialAt(time, right);
      const look = { yaw: LOOK.yaw + s.turn, pitch: LOOK.pitch, roll: s.roll };
      if (ink?.lost()) {
        stop();
        setFlat(true);
        return;
      }
      if (ink) ink.draw(s.hand, look, time, colors, s.camera);
      else if (ctx) drawHand(ctx, W, H, s.hand, look);
      paintScreen(els.current, s, s.hand.phase);
      fills.current.forEach((f, i) => {
        if (f) f.style.scale = `${i < s.scene ? 1 : i === s.scene ? s.progress : 0} 1`;
      });
      setScene(s.scene);
    };
    const tick = (now: number) => {
      if (!paused.current)
        clock.current = (clock.current + Math.min(0.1, (now - last) / 1000)) % LOOP_S;
      last = now;
      paint(clock.current);
      raf = requestAnimationFrame(tick);
    };
    const stillTick = () => {
      const i = SCENES.findIndex((s) => clock.current >= s.start && clock.current < s.end);
      paint(SCENE_KEY[Math.max(0, i)] ?? 0);
      timer = window.setTimeout(() => {
        if (!paused.current) clock.current = sceneStart((Math.max(0, i) + 1) % SCENES.length);
        stillTick();
      }, STILL_S * 1000);
    };
    const start = () => {
      if (raf || timer || !shown || document.hidden) return;
      last = performance.now();
      if (reduced) stillTick();
      else raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      raf = 0;
      timer = 0;
    };
    const seen = new IntersectionObserver(([e]) => {
      shown = e?.isIntersecting ?? true;
      if (shown) start();
      else stop();
    });
    seen.observe(el);
    const visibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", visibility);
    paint(reduced ? (SCENE_KEY[0] ?? 0) : clock.current);
    start();
    // A step clicked: the clock jumps there (and, still, the scene is painted at once).
    jump.current = (i: number) => {
      clock.current = sceneStart(i);
      if (reduced) {
        stop();
        start();
      }
    };
    return () => {
      stop();
      ink?.dispose();
      seen.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [right, reduced, flat]);

  const id = SCENES[scene]?.id ?? "move";
  const key = id === "right" ? (right === "middle" ? "rightMiddle" : "rightRing") : id;
  return (
    <div
      className={css.tutorial}
      onPointerEnter={() => (paused.current = true)}
      onPointerLeave={() => (paused.current = false)}
    >
      <div className={css.stage}>
        <canvas
          key={flat ? "flat" : "ink"}
          ref={canvas}
          className={css.canvas}
          style={{ width: W, height: H }}
          aria-hidden
        />
        <MiniScreen onEls={keepEls} />
      </div>
      <div key={scene} className={css.caption} data-cascade="">
        <span className={css.eyebrow}>
          {t("hands.tuto.step", { n: scene + 1, total: SCENES.length })}
        </span>
        <span className={css.title}>{t(`hands.tuto.${id}.title` as MessageKey)}</span>
        <span className={css.text}>{t(`hands.tuto.${key}.text` as MessageKey)}</span>
      </div>
      <ol className={css.steps}>
        {SCENES.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              aria-label={t(`hands.tuto.${s.id}.title` as MessageKey)}
              aria-current={i === scene || undefined}
              onClick={() => jump.current(i)}
            >
              <span
                ref={(el) => {
                  fills.current[i] = el;
                }}
              />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
