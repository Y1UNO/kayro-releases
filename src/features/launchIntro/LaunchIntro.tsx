import { playSound } from "../../sound";
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useStore } from "zustand";
import { holdDialogCap } from "../../fx/cadenceCap";
import { frameLoop } from "../../fx/loop";
import { t } from "../../i18n";
import { createScene } from "./cinema/createScene";
import { PAINT } from "./gommage";
import { endLaunch, launchIntro, type Intro } from "./launchStore";
import styles from "./LaunchIntro.module.css";

/**
 * The launch sequence of the app's ambience (30/10: « Sceau », seal.ts; « Gommage », gommage.ts):
 * its scene draws on its own WebGL2 canvas over the hub, every
 * frame on the shared loop while it plays, nothing left once it ends. The game was started
 * behind the hub at once; the scene holds until its window is up (at most `TIMING.ceiling`), then
 * plays its finale and the hub hides. A click, Échap, Entrée or Espace jumps to the finale (a
 * second one ends at once). The scene under it runs at the dialogs' cadence meanwhile.
 */
export function LaunchIntro() {
  const playing = useStore(launchIntro, (s) => s.playing);
  return playing
    ? createPortal(<Sequence key={playing.since} intro={playing} />, document.body)
    : null;
}

function Sequence({ intro }: { intro: Intro }) {
  const root = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const host = root.current;
    if (!host) return;
    const start = intro.since;
    const cinema = createScene(intro.style, { ...intro, host });
    if (!cinema) {
      // No WebGL2: the game was started anyway; the hub just steps aside.
      endLaunch(true);
      return;
    }
    let skipAt: number | null = null;
    let ended = false;
    // Dev pages only (stripped from the build): draws the scene frozen at a moment.
    let frozen: { t: number; landed: number | null } | null = null;
    if (import.meta.env.DEV)
      Object.assign(window, {
        __launchDraw: (t: number, landed: number | null = null) => {
          frozen = { t, landed };
          skipAt = null;
          cinema.play(t, landed, null);
        },
      });
    const release = holdDialogCap();
    const onResize = () => cinema.resize();
    const finish = (hide: boolean) => {
      if (ended) return;
      ended = true;
      off();
      endLaunch(hide);
    };
    const skip = () => {
      if (skipAt === null) skipAt = performance.now() - start;
      else finish(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!["Escape", "Enter", " "].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      skip();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey, true);
    host.addEventListener("pointerdown", skip);
    let finaleHeard = false;
    const unsubscribe = frameLoop().subscribe((_dt, now) => {
      const p = launchIntro.getState().playing;
      if (!p) return;
      if (p.failed) return finish(false);
      // Already open: no need to wait for it, the finale plays at once.
      if (p.existing && skipAt === null && !frozen) skipAt = now - start;
      const tt = frozen?.t ?? now - start;
      const landed = frozen ? frozen.landed : p.landedAt === null ? null : p.landedAt - start;
      const f = cinema.play(tt, landed, skipAt);
      if (f.finale && !finaleHeard && !frozen) {
        finaleHeard = true;
        playSound("launchFinale");
      }
      if (caption.current) caption.current.style.opacity = String(f.caption);
      if (hint.current) hint.current.style.opacity = String(f.hint);
      if (f.done && !frozen) finish(true);
    });
    function off() {
      unsubscribe();
      release();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey, true);
      host?.removeEventListener("pointerdown", skip);
    }
    return () => {
      if (!ended) off();
      cinema.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one sequence per start (`since`)
  }, [intro.since]);

  return (
    <div
      ref={root}
      className={styles.root}
      data-style={intro.style}
      style={
        { "--paint-gold": rgb(PAINT.gold), "--paint-cream": rgb(PAINT.cream) } as CSSProperties
      }
      role="status"
      aria-label={t("home.launchIntro.label", { name: intro.app.name })}
    >
      <div ref={caption} className={styles.caption} aria-hidden="true">
        {intro.app.name}
      </div>
      <div ref={hint} className={styles.hint} aria-hidden="true">
        {t("home.launchIntro.skip")}
      </div>
    </div>
  );
}

const rgb = (c: readonly number[]) => `rgb(${c.map((x) => Math.round(x * 255)).join(" ")})`;
