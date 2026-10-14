import type { ModePassage, VeilFade } from "../../ipc/bindings";
import type { PassagePlan } from "./passage";

/** A window built for a passage that is never shown comes in anyway after this long; a page whose
 *  « in » does not come is not left faded out longer either. */
export const ENTER_FALLBACK_MS = 2500;

export interface Size {
  w: number;
  h: number;
}

/** What the driver does to the page and tells the core (DOM and IPC: usePassage.ts). */
export interface PassageIo {
  plan(): PassagePlan;
  size(): Size;
  /** Fades the whole page out; resolves once faded (or at its time limit) with the native veil. */
  fadeOut(p: PassagePlan): Promise<VeilFade | null>;
  /** The page has faded out for passage `id`. */
  faded(id: number, veil: VeilFade | null): void;
  /** The window's new size (when `resized`) is laid out and painted. */
  settled(before: Size, resized: boolean): Promise<void>;
  /** The next frame. */
  frame(): Promise<void>;
  /** The page comes back; `instant`: at once, nothing animated. */
  comeIn(p: PassagePlan, instant: boolean): void;
  /** The opening plays (or is about to) at this window's first show: it brings the page in. */
  openingOwnsEntrance(): boolean;
  /** The page takes no input (faded out, its window changing): keyboard and pointer go nowhere. */
  setInert(on: boolean): void;
}

/** Resolves on the next `resize` of `target` or after `ms`, and removes its listener either way. */
export function resizeOrTimeout(
  target: Pick<EventTarget, "addEventListener" | "removeEventListener">,
  ms: number,
): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      target.removeEventListener("resize", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    target.addEventListener("resize", done);
  });
}

/**
 * Resolves after `frames` frames in a row with no `resize` of `target` (a resize starts the count
 * again), or after `ms`. Step 13: a mode change resizes the window twice, 25–35 ms apart; each
 * resize rebuilds the glass engine's buffers (6–29 ms), and the page came back after the first one,
 * so the second one's slow frames fell in its fade-in. They now pass while the page is dark.
 */
export function quietFrames(
  target: Pick<EventTarget, "addEventListener" | "removeEventListener">,
  frame: () => Promise<void>,
  frames: number,
  ms: number,
): Promise<void> {
  return new Promise((resolve) => {
    let count = 0;
    let over = false;
    const reset = () => void (count = 0);
    const done = () => {
      if (over) return;
      over = true;
      clearTimeout(timer);
      target.removeEventListener("resize", reset);
      resolve();
    };
    const timer = setTimeout(done, ms);
    target.addEventListener("resize", reset);
    const next = (): void =>
      void frame().then(() => {
        if (over) return;
        if (++count >= frames) done();
        else next();
      });
    next();
  });
}

/** The core said the size changes, and the page does not have it yet: wait for it. */
export function waitsForSize(before: Size, now: Size, resized: boolean): boolean {
  return resized && now.w === before.w && now.h === before.h;
}

/**
 * The page's side of a passage between display modes (round 4b), without the DOM. « out »: fade
 * out, then tell the core; « in »: once the window has its new size, come back. Only the « in » of
 * the last « out » counts (a passage replaced by a newer one is not brought back twice). A page
 * built for a passage (`entering`) comes in on its first show, at once when the opening plays.
 */
export class PassageDriver {
  private live = true;
  private size: Size;
  private back: ReturnType<typeof setTimeout> | undefined;
  /** Id of the last « out » not brought back yet (−1: none). */
  private lastOut = -1;
  private entering: boolean;

  constructor(
    private readonly label: "main" | "widget",
    private readonly io: PassageIo,
    entering: boolean,
  ) {
    this.size = io.size();
    this.entering = entering;
    if (!entering) return;
    if (io.plan().instant) this.shown();
    else this.back = setTimeout(() => this.shown(), ENTER_FALLBACK_MS);
  }

  onPassage(e: ModePassage): void {
    if (!this.live || e.label !== this.label) return;
    const p = this.io.plan();
    if (e.step === "out") {
      this.lastOut = e.id;
      this.size = this.io.size();
      clearTimeout(this.back);
      if (p.instant) return this.io.faded(e.id, null);
      // Nothing to click or type into while the page is away (review B8).
      this.io.setInert(true);
      void this.io.fadeOut(p).then((veil) => this.io.faded(e.id, veil));
      this.back = setTimeout(() => this.come(this.io.plan(), false), ENTER_FALLBACK_MS);
      return;
    }
    if (e.id !== this.lastOut) return;
    clearTimeout(this.back);
    void this.io.settled(this.size, e.resized).then(() => this.come(p, false));
  }

  /** The core showed this window: a page built for a passage comes in (once). */
  shown(): void {
    if (!this.entering || !this.live) return;
    this.entering = false;
    clearTimeout(this.back);
    const instant = this.io.openingOwnsEntrance();
    void this.io.frame().then(() => this.come(this.io.plan(), instant));
  }

  dispose(): void {
    this.live = false;
    clearTimeout(this.back);
    this.io.setInert(false);
  }

  private come(p: PassagePlan, instant: boolean): void {
    if (!this.live) return;
    this.lastOut = -1;
    this.io.setInert(false);
    this.io.comeIn(p, instant);
  }
}
