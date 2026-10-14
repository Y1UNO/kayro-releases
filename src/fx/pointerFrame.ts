import { liveCadence } from "./cadenceCap";
import { frameLoop, type FrameLoop, type Unsubscribe } from "./loop";

/**
 * Pointer work done once per frame (step 13). A mouse can send far more positions per second than
 * the screen shows images; the handlers only keep the latest position per key, and the work
 * (measuring a box, writing styles, telling a director) runs on the frame loop, at the pointer's
 * cadence (`CADENCE.pointerOnly`, the glass engine's grid: both change on the same frames), before
 * the engine. The loop stays subscribed a little after the last move, then lets go.
 */
export type PointerWork<K> = (key: K, el: HTMLElement, x: number, y: number) => void;

/** Frames without a move before the subscription ends. */
const IDLE_FRAMES = 30;

export class PointerFrame<K> {
  private readonly pending = new Map<K, { el: HTMLElement; x: number; y: number }>();
  private off: Unsubscribe | null = null;
  private idle = 0;

  constructor(
    private readonly work: PointerWork<K>,
    private readonly loop: () => FrameLoop = frameLoop,
    private readonly fps: () => number = () => liveCadence().pointer,
  ) {}

  /** Keeps the latest position of `key` (no work here). */
  push(key: K, el: HTMLElement, x: number, y: number): void {
    this.pending.set(key, { el, x, y });
    this.idle = 0;
    if (!this.off) this.off = this.loop().subscribe(() => this.flush(), this.fps(), true);
  }

  /** Forgets a pending position (the pointer left: nothing may re-apply it afterwards). */
  cancel(key: K): void {
    this.pending.delete(key);
  }

  /** Runs the pending work now (the loop calls it; tests too). */
  flush(): void {
    if (this.pending.size === 0) {
      if (++this.idle >= IDLE_FRAMES) this.dispose();
      return;
    }
    const batch = [...this.pending];
    this.pending.clear();
    for (const [key, p] of batch) this.work(key, p.el, p.x, p.y);
    this.off?.setFps?.(this.fps());
  }

  dispose(): void {
    this.off?.();
    this.off = null;
    this.pending.clear();
  }
}
