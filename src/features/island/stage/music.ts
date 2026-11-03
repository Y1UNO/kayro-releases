/**
 * Kysland's music mode (the lab's contract, SPEC §2): what the scenes read of the music. Each hit
 * (kick, snare, hi-hat, crash) is kept with its time and strength; envelopes are computed from
 * its age at once (no smoothing between the sound and the motion): kick `v·e^(−age/0.11)`,
 * snare `/0.13`, hat `/0.05`, crash `/0.45`, the cymbal's tail `e^(−age/1.4)` shimmering. The
 * sub is pumped down by each kick. The melody (the user's addition, 2026-11-03) and its register
 * are continuous, for the strings. Hits come from the analysed sound or the test track
 * (`demo.ts`). Times in s.
 */

import { Tempo } from "./tempo";

export type HitKind = "kick" | "snare" | "hat" | "crash";
export type Section = "drop" | "break" | "build" | "unknown";

export interface Levels {
  /** The sub (0–1, before the kick's pump), a build's tension (0–1), a silence before a drop. */
  sub: number;
  build: number;
  gap: boolean;
  section: Section;
  /** The melody (0–1, smooth) and its register (0 low – 1 high). */
  melody: number;
  pitch: number;
}

const KINDS: readonly HitKind[] = ["kick", "snare", "hat", "crash"];

/**
 * The analysed sound measures each hit against its band's recent hits (a steady beat reads about
 * 1); the test track plays its hi-hats at .45–.75 and its snares at .9: the same strengths here.
 * The kick is also weighed against the melody (2026-11-03, the user and Thomas: the bass stood
 * out too much over the rest): curved down (`v^1.4`), a third weaker under a full melody.
 */
const HEARD: Record<HitKind, number> = { kick: 1, snare: 0.9, hat: 0.6, crash: 1 };

/**
 * The analysis starts cold each time the island shows (its gains at their floor: its first hits
 * read full, a first crash is often false): its hits grow from a quarter to their strength over
 * this long (s), and no crash counts before (2026-11-03: the light burst at the start).
 */
const WARM_S = 2.5;

export class Music {
  t = 0;
  readonly last: Record<HitKind, number> = { kick: -99, snare: -99, hat: -99, crash: -99 };
  readonly vel: Record<HitKind, number> = { kick: 0, snare: 0, hat: 0, crash: 0 };
  kick = 0;
  snare = 0;
  hat = 0;
  crash = 0;
  tail = 0;
  sub = 0;
  build = 0;
  gap = false;
  section: Section = "unknown";
  melody = 0;
  pitch = 0.5;
  /** The song's tempo, from its kicks. */
  readonly tempo = new Tempo();
  /** The light's trails turn one way, then the other after each crash. */
  turn = 1;
  /** Told of each hit as it happens (the scenes move at once). */
  listen: (kind: HitKind, v: number) => void = () => {};
  private subRaw = 0;
  private heardAt = -99;
  private warmFrom = 0;

  /** A hit now, of strength `v` (0–1). */
  hit(kind: HitKind, v: number): void {
    if (!KINDS.includes(kind) || !(v > 0)) return;
    this.last[kind] = this.t;
    this.vel[kind] = Math.min(1, v);
    if (kind === "crash") this.turn = -this.turn;
    if (kind === "kick") this.tempo.beat(this.t);
    this.listen(kind, this.vel[kind]);
    this.envelopes();
  }

  /** A frame of the analysed sound: its hits (at the test track's strengths), then its levels. */
  heard(f: Levels & { hits: { kind: HitKind; velocity: number }[] }): void {
    if (this.t - this.heardAt > 1) this.warmFrom = this.t;
    this.heardAt = this.t;
    const warm = Math.min(1, (this.t - this.warmFrom) / WARM_S);
    for (const h of f.hits) {
      if (warm < 1 && h.kind === "crash") continue;
      const v =
        h.kind === "kick" ? h.velocity ** 1.4 * (1 - 0.33 * Math.min(1, this.melody)) : h.velocity;
      this.hit(h.kind, v * HEARD[h.kind] * (0.25 + 0.75 * warm));
    }
    this.levels(f);
  }

  levels(l: Levels): void {
    this.subRaw = l.sub;
    this.build = l.build;
    this.gap = l.gap;
    this.section = l.section;
    this.melody = l.melody;
    this.pitch = l.pitch;
  }

  /** Time moves on `dt` s. */
  advance(dt: number): void {
    this.t += Math.max(0, dt);
    this.envelopes();
  }

  /** Silence (paused, or the mode ends): everything falls back at once. */
  quiet(): void {
    for (const k of KINDS) this.vel[k] = 0;
    this.levels({ sub: 0, build: 0, gap: false, section: "unknown", melody: 0, pitch: this.pitch });
    this.envelopes();
  }

  private envelopes(): void {
    const age = (k: HitKind) => Math.max(0, this.t - this.last[k]);
    const { vel } = this;
    this.kick = vel.kick * Math.exp(-age("kick") / 0.11);
    this.snare = vel.snare * Math.exp(-age("snare") / 0.13);
    this.hat = vel.hat * Math.exp(-age("hat") / 0.05);
    const ca = age("crash");
    this.crash = vel.crash * Math.exp(-ca / 0.45);
    this.tail = vel.crash * Math.exp(-ca / 1.4) * (0.5 + 0.5 * Math.sin(ca * 88));
    const duck = 1 - 0.85 * Math.exp(-age("kick") / 0.09);
    this.sub = this.subRaw * duck;
  }
}
