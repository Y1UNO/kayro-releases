import type { FanCardEls } from "./fanRender";

/** Centre of an element in the viewport (CSS px). */
export function centre(el: HTMLElement | null): { x: number; y: number } {
  const r = el?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 };
}

/** What the director moves; read when a sequence starts (the DOM of that moment). */
export interface LinkEls {
  fan: HTMLElement | null;
  cards: readonly (FanCardEls | null)[];
  stage: HTMLElement | null;
  /** Grid or empty state: faded as a whole (no deck). */
  body: HTMLElement | null;
  ask: HTMLElement | null;
  title: HTMLElement | null;
  back: HTMLElement | null;
  bottom: HTMLElement | null;
}

const NONE: readonly (FanCardEls | null)[] = [];

type Named = "fan" | "area" | "ask" | "title" | "back" | "bottom";

/** Elements of the home screen the category director moves, registered by ref callbacks. */
export class LinkElements {
  private readonly found: Record<Named, HTMLElement | null> = {
    fan: null,
    area: null,
    ask: null,
    title: null,
    back: null,
    bottom: null,
  };
  readonly cards: (FanCardEls | null)[] = [];
  /**
   * The fan is mounted but put away (`display: none`, step 13): for the director it is not there.
   * Kept mounted after a link, so that "All categories" does not mount it in its click.
   */
  parked = false;

  /** The fan cards on screen (none while the fan is put away). */
  shown(): readonly (FanCardEls | null)[] {
    return this.parked ? NONE : this.cards;
  }

  /** Ref callbacks for the components (stable functions). */
  readonly bind = {
    fan: (e: HTMLElement | null) => void (this.found.fan = e),
    area: (e: HTMLElement | null) => void (this.found.area = e),
    ask: (e: HTMLElement | null) => void (this.found.ask = e),
    title: (e: HTMLElement | null) => void (this.found.title = e),
    back: (e: HTMLElement | null) => void (this.found.back = e),
    bottom: (e: HTMLElement | null) => void (this.found.bottom = e),
    card: (i: number, els: FanCardEls | null) => void (this.cards[i] = els),
    parked: (on: boolean) => void (this.parked = on),
  };

  /** The elements of now: the carousel stage, or the grid / empty state faded as a whole. */
  get(): LinkEls {
    const f = this.found;
    const stage = f.area?.querySelector<HTMLElement>("[data-carousel-stage]") ?? null;
    return {
      fan: this.parked ? null : f.fan,
      cards: this.shown(),
      stage,
      body: stage ? null : (f.area?.querySelector<HTMLElement>("[data-home-layer]") ?? null),
      ask: f.ask,
      title: f.title,
      back: f.back,
      bottom: f.bottom,
    };
  }
}
