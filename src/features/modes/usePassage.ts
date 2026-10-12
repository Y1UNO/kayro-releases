import { useEffect } from "react";
import { currentMotion } from "../../design/motion/current";
import { prefersReducedMotion } from "../../fx/motionPref";
import { desktopIpc } from "../../ipc/commands";
import { onModePassage, onWindowVisibility } from "../../ipc/events";
import { hubStore } from "../../store";
import { cascadeDelay, parseRgb, passagePlan, veilFade, type PassagePlan } from "./passage";

/** The cards that rise back after a passage (carousel slots or grid cells of the home screen). */
const CARDS = "[data-home-layer] [data-app-id]";
/** A window built for a passage that is never shown comes in anyway after this long. */
const ENTER_FALLBACK_MS = 2500;
/** After the core's « in », how long to wait for the new size before coming back anyway. */
const RESIZE_WAIT_MS = 300;

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

function plan(): PassagePlan {
  const eco = hubStore.getState().settings?.quality === "eco";
  return passagePlan(currentMotion(), eco, prefersReducedMotion());
}

/**
 * The colour the page fades to: `main`'s opaque background; for the transparent widget, the same
 * theme colour (`--bg-mid`), which `main` will show.
 */
function fadedColor(label: "main" | "widget"): [number, number, number] {
  const fallback: [number, number, number] = [15, 10, 22];
  if (label === "main") {
    return parseRgb(getComputedStyle(document.documentElement).backgroundColor) ?? fallback;
  }
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;width:0;height:0;background:var(--bg-mid)";
  document.body.append(probe);
  const rgb = parseRgb(getComputedStyle(probe).backgroundColor);
  probe.remove();
  return rgb ?? fallback;
}

/** Waits for the window's new size (if it changes) to be laid out and painted. */
async function settled(before: { w: number; h: number }): Promise<void> {
  if (innerWidth === before.w && innerHeight === before.h) {
    await Promise.race([
      new Promise<void>((r) => window.addEventListener("resize", () => r(), { once: true })),
      wait(RESIZE_WAIT_MS),
    ]);
  }
  await frame();
  await frame();
}

/** The page comes back: the whole page fades in, the cards of the home screen rise in a cascade. */
function comeIn(label: "main" | "widget", p: PassagePlan): void {
  const body = document.body;
  for (const a of body.getAnimations()) a.cancel();
  body.style.opacity = "";
  if (p.instant) return;
  if (label === "widget") {
    body.animate(
      [
        { opacity: 0, transform: `scale(${p.widgetFrom})` },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: p.in.duration, easing: p.in.easing },
    );
    return;
  }
  body.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: p.in.duration,
    easing: p.in.easing,
  });
  document.querySelectorAll<HTMLElement>(CARDS).forEach((card, i) =>
    card.animate(
      [{ transform: `translateY(${p.cascade.rise}px)` }, { transform: "translateY(0px)" }],
      {
        duration: p.cascade.duration,
        delay: cascadeDelay(p, i),
        easing: p.cascade.easing,
        // Added to the card's own transform (its place in the carousel).
        composite: "add",
        fill: "backwards",
      },
    ),
  );
}

/**
 * The page's side of a passage between display modes (round 4b). « out »: the whole page fades
 * out on the window's opaque background (the widget's, transparent, onto the desktop), then the
 * core is told, with the colour and timing of its native veil (between `main` and the widget);
 * « in »: once the window has its new size, the page comes back. A page built for a passage
 * (`?enter=1`, see main.tsx) comes in on its first show.
 */
export function usePassage(label: "main" | "widget"): void {
  useEffect(() => {
    let live = true;
    let size = { w: innerWidth, h: innerHeight };
    let back = 0;

    const off = onModePassage((e) => {
      if (!live || e.label !== label) return;
      const p = plan();
      if (e.step === "out") {
        size = { w: innerWidth, h: innerHeight };
        if (p.instant) return void desktopIpc.passageFaded(e.id);
        // Between `main` and the widget, the core fades a native veil of this colour (round 4b).
        const veil = veilFade(currentMotion(), label, fadedColor(label));
        const body = document.body;
        const from = getComputedStyle(body).opacity;
        for (const a of body.getAnimations()) a.cancel();
        const fade = body.animate([{ opacity: from }, { opacity: 0 }], {
          duration: p.out.duration,
          easing: p.out.easing,
          fill: "forwards",
        });
        void Promise.race([fade.finished.catch(() => {}), wait(p.out.duration + 80)]).then(
          () => void desktopIpc.passageFaded(e.id, veil),
        );
        // Never left faded out if the core's « in » does not come.
        window.clearTimeout(back);
        back = window.setTimeout(() => live && comeIn(label, plan()), ENTER_FALLBACK_MS);
        return;
      }
      window.clearTimeout(back);
      void settled(size).then(() => live && comeIn(label, p));
    });

    // Built for a passage: faded out from the start (main.tsx), in on the first show.
    let offShown: Promise<() => void> | null = null;
    if (document.documentElement.dataset.entering !== undefined) {
      let done = false;
      const enter = () => {
        if (done || !live) return;
        done = true;
        delete document.documentElement.dataset.entering;
        void frame().then(() => comeIn(label, plan()));
      };
      if (plan().instant) enter();
      offShown = onWindowVisibility(({ visible }) => visible && enter());
      back = window.setTimeout(enter, ENTER_FALLBACK_MS);
    }

    return () => {
      live = false;
      window.clearTimeout(back);
      void off.then((u) => u());
      void offShown?.then((u) => u());
    };
  }, [label]);
}
