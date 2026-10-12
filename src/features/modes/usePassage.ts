import { useEffect } from "react";
import { currentMotion } from "../../design/motion/current";
import { prefersReducedMotion } from "../../fx/motionPref";
import { desktopIpc } from "../../ipc/commands";
import { onModePassage, onWindowVisibility } from "../../ipc/events";
import { hubStore } from "../../store";
import { openingOwnsEntrance } from "../opening/useOpening";
import { cascadeDelay, parseRgb, passagePlan, veilFade, type PassagePlan } from "./passage";
import {
  PassageDriver,
  resizeOrTimeout,
  waitsForSize,
  type PassageIo,
  type Size,
} from "./passageDriver";

/** The cards that rise back after a passage (carousel slots or grid cells of the home screen). */
const CARDS = "[data-home-layer] [data-app-id]";
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

/** Waits for the window's new size (when the core says it changes) to be laid out and painted. */
async function settled(before: Size, resized: boolean): Promise<void> {
  const now = { w: innerWidth, h: innerHeight };
  if (waitsForSize(before, now, resized)) await resizeOrTimeout(window, RESIZE_WAIT_MS);
  await frame();
  await frame();
}

/**
 * The page comes back: the whole page fades in, the cards of the home screen rise in a cascade.
 * `instant`: at once (the opening brings the page in itself).
 */
function comeIn(label: "main" | "widget", p: PassagePlan, instant: boolean): void {
  delete document.documentElement.dataset.entering;
  const body = document.body;
  for (const a of body.getAnimations()) a.cancel();
  body.style.opacity = "";
  if (p.instant || instant) return;
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

/** Fades the whole page out on the window's background; resolves with the native veil. */
async function fadeOut(label: "main" | "widget", p: PassagePlan) {
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
  await Promise.race([fade.finished.catch(() => {}), wait(p.out.duration + 80)]);
  return veil;
}

function domIo(label: "main" | "widget"): PassageIo {
  return {
    plan,
    size: () => ({ w: innerWidth, h: innerHeight }),
    fadeOut: (p) => fadeOut(label, p),
    faded: (id, veil) => void desktopIpc.passageFaded(id, veil),
    settled,
    frame,
    comeIn: (p, instant) => comeIn(label, p, instant),
    openingOwnsEntrance,
  };
}

/**
 * The page's side of a passage between display modes (round 4b). « out »: the whole page fades
 * out on the window's opaque background (the widget's, transparent, onto the desktop), then the
 * core is told, with the colour and timing of its native veil (between `main` and the widget);
 * « in »: once the window has its new size, the page comes back. A page built for a passage
 * (`?enter=1`, see main.tsx) comes in on its first show. The logic: passageDriver.ts.
 */
export function usePassage(label: "main" | "widget"): void {
  useEffect(() => {
    const entering = document.documentElement.dataset.entering !== undefined;
    const driver = new PassageDriver(label, domIo(label), entering);
    const off = onModePassage((e) => driver.onPassage(e));
    const offShown = entering
      ? onWindowVisibility(({ visible }) => visible && driver.shown())
      : null;
    return () => {
      driver.dispose();
      void off.then((u) => u());
      void offShown?.then((u) => u());
    };
  }, [label]);
}
