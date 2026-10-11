import type { FanCardEls } from "./fanRender";

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

  /** Ref callbacks for the components (stable functions). */
  readonly bind = {
    fan: (e: HTMLElement | null) => void (this.found.fan = e),
    area: (e: HTMLElement | null) => void (this.found.area = e),
    ask: (e: HTMLElement | null) => void (this.found.ask = e),
    title: (e: HTMLElement | null) => void (this.found.title = e),
    back: (e: HTMLElement | null) => void (this.found.back = e),
    bottom: (e: HTMLElement | null) => void (this.found.bottom = e),
    card: (i: number, els: FanCardEls | null) => void (this.cards[i] = els),
  };

  /** The elements of now: the carousel stage, or the grid / empty state faded as a whole. */
  get(): LinkEls {
    const f = this.found;
    const stage = f.area?.querySelector<HTMLElement>("[data-carousel-stage]") ?? null;
    return {
      fan: f.fan,
      cards: this.cards,
      stage,
      body: stage ? null : (f.area?.querySelector<HTMLElement>("[data-home-layer]") ?? null),
      ask: f.ask,
      title: f.title,
      back: f.back,
      bottom: f.bottom,
    };
  }
}
