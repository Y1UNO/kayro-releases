import { burst, type Edge } from "../../src/features/capri/capri";
import { t } from "./messages";

/**
 * Step 20: a preview of Kysland on the installer's first screens, in a small screen: the island
 * comes out of the bezel, plays music (a turning record, dancing bars), glitches in Capri, opens
 * into its panel, and closes again — a loop of 9 s (CSS), the Capri bursts drawn on a canvas.
 * Static with « reduce motion »; nothing runs while it is not shown.
 */
const LOOP_MS = 9000;
/** When in the loop the Capri bursts (ms), and for how long: as the music settles, as it closes. */
const BURSTS: readonly [number, number][] = [
  [3600, 800],
  [7000, 520],
];
const SCREEN = { width: 260, height: 170 };

function node(tag: string, cls: string, ...kids: Node[]): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  e.append(...kids);
  return e;
}

export interface Preview {
  el: HTMLElement;
  /** Shown (and animated) or not. */
  setActive: (on: boolean) => void;
}

export function kyslandPreview(version: string, reduced: boolean): Preview {
  const canvas = document.createElement("canvas");
  canvas.className = "kys-fx";
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(SCREEN.width * dpr);
  canvas.height = Math.round(SCREEN.height * dpr);
  const bars = node("span", "kys-bars", ...Array.from({ length: 5 }, () => node("i", "")));
  const open = node(
    "div",
    "kys-open",
    node("span", "kys-search"),
    node("span", "kys-cover"),
    node("span", "kys-line a"),
    node("span", "kys-line b"),
    node("span", "kys-prog"),
  );
  const island = node(
    "div",
    "kys-island",
    node("span", "kys-sh l"),
    node("span", "kys-sh r"),
    node("span", "kys-vinyl"),
    bars,
    open,
  );
  const screen = node("div", "kys-screen", canvas, island);
  const name = node("p", "kys-name");
  name.textContent = t("kysName");
  name.dataset.text = t("kysName");
  const sub = node("p", "kys-sub");
  sub.textContent = t("kysSub", { version });
  const el = node("div", "kys", screen, name, sub);
  el.setAttribute("aria-hidden", "true");
  if (reduced) el.dataset.still = "";

  // The top edge of the small screen, where the island meets the bezel.
  const top: Edge = { vertical: false, at: 2, from: 70, to: 190, sides: 1 };
  let timers: number[] = [];
  let stops: (() => void)[] = [];
  let interval = 0;
  let active = false;
  const loop = () => {
    for (const [at, ms] of BURSTS) {
      timers.push(
        window.setTimeout(() => {
          stops.push(burst(canvas, [top], ms));
          name.classList.add("glitching");
          timers.push(window.setTimeout(() => name.classList.remove("glitching"), ms));
        }, at),
      );
    }
  };
  const stop = () => {
    timers.forEach((id) => window.clearTimeout(id));
    window.clearInterval(interval);
    stops.forEach((s) => s());
    timers = [];
    stops = [];
    name.classList.remove("glitching");
  };
  return {
    el,
    setActive(on) {
      if (on === active) return;
      active = on;
      if (!on) {
        delete el.dataset.active;
        stop();
        return;
      }
      // Shown again, every CSS animation starts over: in step with the bursts.
      el.dataset.active = "";
      if (reduced) return;
      loop();
      interval = window.setInterval(loop, LOOP_MS);
    },
  };
}
