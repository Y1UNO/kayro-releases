import { TAU } from "./motion";

/**
 * Kysland's « Disk »: the round label in the disc's middle, the album's cover drawn once into a
 * canvas of its own (cheap to turn every frame); without a cover, the album's colour. A new
 * cover while one shows waits (`next`) for the disc to shut its label, then takes its place.
 */

type Make = (w: number, h: number) => HTMLCanvasElement;

export class Labels {
  /** What shows (null: the plain label), what waits for the label to shut. */
  cover: HTMLCanvasElement | null = null;
  next: HTMLCanvasElement | "plain" | null = null;
  private plain: HTMLCanvasElement | null = null;
  private plainOf = "";
  private shown: string | null | undefined = undefined;
  private loads = 0;

  /** `size`: the label's side in device px; `out`: a label shows (a new one then waits). */
  constructor(
    private size: number,
    private make: Make,
    private out: () => boolean,
  ) {}

  /** The cover to show (none: the album's colour). */
  ask(src: string | null): void {
    if (src === this.shown) return;
    this.shown = src;
    const id = ++this.loads;
    if (!src) {
      this.put("plain");
      return;
    }
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    void img
      .decode()
      .then(() => {
        if (id !== this.loads) return;
        const c = this.round((g, d) => {
          const k = Math.max(d / img.naturalWidth, d / img.naturalHeight);
          const [w, h] = [img.naturalWidth * k, img.naturalHeight * k];
          g.drawImage(img, (d - w) / 2, (d - h) / 2, w, h);
        });
        this.put(c);
      })
      .catch(() => undefined);
  }

  private put(c: HTMLCanvasElement | "plain"): void {
    if (c === "plain" && !this.cover && !this.next) return;
    if (this.next !== "plain") this.drop(this.next);
    if (this.out()) {
      this.next = c;
      return;
    }
    this.next = null;
    this.drop(this.cover);
    this.cover = c === "plain" ? null : c;
  }

  /** The label is shut: the one waiting takes its place. */
  swap(): void {
    if (!this.next) return;
    this.drop(this.cover);
    this.cover = this.next === "plain" ? null : this.next;
    this.next = null;
  }

  /** What to draw now (`accent`: the album's colour, « r g b »). */
  now(accent: string): HTMLCanvasElement {
    return this.cover ?? this.plainOf_(accent);
  }

  dispose(): void {
    this.loads++;
    this.drop(this.cover);
    if (this.next !== "plain") this.drop(this.next);
    this.drop(this.plain);
    [this.cover, this.next, this.plain] = [null, null, null];
  }

  private drop(c: HTMLCanvasElement | null): void {
    if (!c) return;
    c.width = 0;
    c.height = 0;
  }

  private plainOf_(a: string): HTMLCanvasElement {
    if (this.plain && this.plainOf === a) return this.plain;
    this.plain = this.round((g, d) => {
      const r = g.createRadialGradient(d * 0.38, d * 0.32, 0, d / 2, d / 2, d * 0.62);
      r.addColorStop(0, `rgb(${a})`);
      r.addColorStop(1, `rgb(${a} / 0.35)`);
      g.fillStyle = "#000";
      g.fillRect(0, 0, d, d);
      g.fillStyle = r;
      g.fillRect(0, 0, d, d);
    });
    this.plainOf = a;
    return this.plain;
  }

  /** A round label `paint` fills (clipped to its circle, a soft dark rim at its edge). */
  private round(paint: (g: CanvasRenderingContext2D, d: number) => void): HTMLCanvasElement {
    const d = this.size;
    const c = this.make(d, d);
    const g = c.getContext("2d");
    if (!g) return c;
    g.beginPath();
    g.arc(d / 2, d / 2, d / 2, 0, TAU);
    g.clip();
    paint(g, d);
    const edge = g.createRadialGradient(d / 2, d / 2, d * 0.42, d / 2, d / 2, d / 2);
    edge.addColorStop(0, "rgb(0 0 0 / 0)");
    edge.addColorStop(1, "rgb(0 0 0 / 0.45)");
    g.fillStyle = edge;
    g.fillRect(0, 0, d, d);
    return c;
  }
}
