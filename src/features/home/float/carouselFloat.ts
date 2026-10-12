/**
 * Floating of the carousel's app cards (round 5, « sous-catégories » of R5-Flottaison.txt): each
 * visible card rises and falls on its own rhythm (cardFloat.ts) at the settings' level. Written on
 * the card's float box (`[data-float]`, transform only) — its slot keeps the position and the
 * hover lift, the card its tilt and press. The glass engine reads the rocking and the height
 * (setGlassFloat: its ground shadow tightens and pales). Paused — eased to rest — on the hovered
 * card, while scrolling fast, wheeling or dragging; at once for a category sequence. One frame
 * loop only while the level is not « Aucune »: 30 i/s while the cards only float (a slow sine),
 * the full cadence (60, 30 in Eco) as soon as anything else moves (hover, wheel, a pause easing).
 */
import { setGlassFloat } from "../../../design/glass/glassRegistry";
import { FLOAT_RHYTHM as R } from "../../../design/motion/tokens5";
import { frameLoop, type FrameLoop } from "../../../fx/loop";
import { floatAt, seed, seedOfKey } from "./cardFloat";

export interface CarouselFloatConfig {
  /** Amplitude (px, ±): 0 = no floating, no loop. */
  amp: number;
  tilt: number;
  period: number;
  /** Cadence while anything else moves; `idleFps` while the cards only float. */
  fps: number;
  idleFps: number;
}

const DEG = Math.PI / 180;
/** After a wheel step, the cards stay at rest this long (ms). */
const WHEEL_PAUSE_MS = 300;

interface Box {
  el: HTMLElement;
  slot: HTMLElement;
  card: HTMLElement | null;
  key: number;
  gain: number;
}

export class CarouselFloat {
  private off: (() => void) | null = null;
  private boxes: Box[] = [];
  private hovered: Element | null = null;
  private wheelAt = -1e9;
  /** Cadence of the running loop. */
  private rate = 0;
  dragging = false;

  constructor(
    private readonly stage: HTMLElement,
    private config: CarouselFloatConfig,
    private readonly loop: () => FrameLoop = frameLoop,
  ) {}

  setConfig(c: CarouselFloatConfig): void {
    this.config = c;
    if (c.amp <= 0) this.stop();
    else this.restart(this.rate === c.idleFps ? c.idleFps : c.fps);
  }

  /** The cards mounted now (after every render of the carousel). */
  refresh(): void {
    const old = new Map(this.boxes.map((b) => [b.el, b]));
    this.boxes = [...this.stage.querySelectorAll<HTMLElement>("[data-float]")].map((el) => {
      const slot = el.parentElement as HTMLElement;
      const card = el.querySelector<HTMLElement>("[data-stage]");
      const key = seedOfKey(slot.dataset.appId ?? "");
      const was = old.get(el);
      return { el, slot, card, key, gain: was && was.key === key ? was.gain : 0 };
    });
    for (const [el, b] of old) if (!this.boxes.some((x) => x.el === el)) this.rest(b);
    this.start();
  }

  hover(card: Element | null): void {
    this.hovered = card;
    if (card) this.restart(this.config.fps);
  }

  wheel(now = performance.now()): void {
    this.wheelAt = now;
    this.restart(this.config.fps);
  }

  /** Cadence of the running loop (tests, bench). */
  get fps(): number {
    return this.off ? this.rate : 0;
  }

  dispose(): void {
    this.stop();
  }

  private start(rate = this.config.fps): void {
    if (this.off || this.config.amp <= 0 || this.boxes.length === 0) return;
    this.rate = rate;
    this.off = this.loop().subscribe((dt, now) => this.tick(dt, now), rate);
  }

  /** Runs at `rate` from now on (no change when it already does). */
  private restart(rate: number): void {
    if (this.off && this.rate === rate) return;
    this.off?.();
    this.off = null;
    this.start(rate);
  }

  private stop(): void {
    this.off?.();
    this.off = null;
    for (const b of this.boxes) this.rest(b);
  }

  private rest(b: Box): void {
    b.gain = 0;
    b.el.style.transform = "";
    if (b.card) setGlassFloat(b.card, null);
  }

  /** Writes every box for time `now`; exported for the tests. */
  tick(dt: number, now: number): void {
    const st = this.stage;
    // A category sequence poses the cards itself: back to rest at once.
    if (st.dataset.seq !== undefined) {
      for (const b of this.boxes) if (b.gain > 0) this.rest(b);
      return;
    }
    const paused =
      st.dataset.fast !== undefined || this.dragging || now - this.wheelAt < WHEEL_PAUSE_MS;
    const k = 1 - Math.exp(-dt / (R.pauseMs / 3));
    const c = this.config;
    let settled = !paused && this.hovered === null;
    for (const b of this.boxes) {
      if (b.slot.dataset.hidden !== undefined) {
        if (b.gain > 0) this.rest(b);
        continue;
      }
      const target = paused || b.card === this.hovered ? 0 : 1;
      b.gain += (target - b.gain) * k;
      if (Math.abs(target - b.gain) > 0.002) settled = false;
      if (b.gain < 0.002 && target === 0) {
        if (b.el.style.transform) this.rest(b);
        continue;
      }
      // Each app its own period factor, start and rocking side (its id's seed).
      const f = floatAt(
        b.key,
        now,
        c.amp * b.gain,
        c.tilt * b.gain,
        c.period,
        seed(b.key, 2) * c.period,
      );
      b.el.style.transform = `translateY(${f.dy.toFixed(2)}px) rotate(${f.rot.toFixed(3)}deg)`;
      if (b.card) setGlassFloat(b.card, { rot: f.rot * DEG, elev: f.elev });
    }
    // Only floating: the slow cadence; anything else (hover, wheel, a pause easing): the full one.
    this.restart(settled ? c.idleFps : c.fps);
  }
}
