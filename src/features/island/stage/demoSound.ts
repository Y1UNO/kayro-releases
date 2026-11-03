import { BAR, BEAT, hitsAt, leadAt } from "./demo";
import type { HitKind } from "./music";

/**
 * Kysland's music mode: the lab's test track, synthesised (WebAudio) and scheduled 140 ms ahead
 * on the audio clock: a pitched kick with a click, a noise snare with a body, hi-hats, a crash
 * (noise and metallic partials), a riser in the build, pads in the break, a sub that ducks under
 * each kick, and the lead (2026-11-03). `heard()` says which time of the track is coming out of
 * the speakers now (the visuals follow it). Only for the demo mode. Times in s.
 */

const SIXTEENTH = BEAT / 4;
const STEPS = 12 * 16;
const NOTE: Record<string, number> = { A: 55, F: 43.65, G: 49 };
const subNote = (b: number) =>
  b < 8 ? ["A", "A", "F", "G"][b % 4]! : b === 8 ? "F" : b === 9 ? "G" : "A";

export class DemoSound {
  private start = 0;
  private next = 0;
  private timer = 0;
  private long: AudioScheduledSourceNode[] = [];
  private constructor(
    private c: AudioContext,
    private bus: AudioNode,
    private noise: AudioBuffer,
    private subG: GainNode,
    private subO: OscillatorNode,
    private subO2: OscillatorNode,
  ) {}

  /** Starts the sound at time `t` of the track (null: no audio here). */
  static start(t: number): DemoSound | null {
    const AC = window.AudioContext;
    if (!AC) return null;
    const c = new AC({ latencyHint: "interactive" });
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    const mg = c.createGain();
    mg.gain.value = 0.8;
    comp.connect(mg).connect(c.destination);
    const len = c.sampleRate * 3;
    const noise = c.createBuffer(1, len, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const subG = c.createGain();
    subG.gain.value = 0;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 380;
    const subO = c.createOscillator();
    const subO2 = c.createOscillator();
    subO2.type = "sawtooth";
    const g2 = c.createGain();
    g2.gain.value = 0.16;
    subO.connect(subG);
    subO2.connect(g2).connect(lp).connect(subG);
    subG.connect(comp);
    subO.start();
    subO2.start();
    const s = new DemoSound(c, comp, noise, subG, subO, subO2);
    void c.resume().catch(() => undefined);
    s.sync(t);
    s.timer = window.setInterval(() => s.schedule(), 25);
    s.schedule();
    return s;
  }

  /** The track's time coming out of the speakers now. */
  heard(): number {
    return this.out() - this.start;
  }

  stop(): void {
    window.clearInterval(this.timer);
    const now = this.c.currentTime;
    this.subG.gain.cancelScheduledValues(now);
    this.subG.gain.setValueAtTime(0, now);
    for (const n of this.long) {
      try {
        n.stop(now + 0.01);
      } catch {
        // Already stopped.
      }
    }
    this.long = [];
    void this.c.close().catch(() => undefined);
  }

  private out(): number {
    const c = this.c;
    const ts = c.getOutputTimestamp?.();
    if (ts && ts.contextTime && ts.performanceTime) {
      return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
    }
    return c.currentTime - (c.outputLatency || c.baseLatency || 0);
  }

  private sync(t: number): void {
    this.start = this.out() - t;
    this.next = Math.floor(t / SIXTEENTH) + 1;
  }

  private schedule(): void {
    const c = this.c;
    const horizon = c.currentTime + 0.14;
    while (this.start + this.next * SIXTEENTH < horizon) {
      const s = this.next;
      const w = Math.max(c.currentTime + 0.002, this.start + s * SIXTEENTH);
      const ls = ((s % STEPS) + STEPS) % STEPS;
      const bar = ls >> 4;
      const st = ls & 15;
      let kick = false;
      for (const [kind, v] of hitsAt(ls)) {
        this.voice(kind, w, v);
        if (kind === "kick") kick = true;
      }
      this.sub(ls, w, kick);
      if (bar === 10 && st === 0) this.riser(w);
      if ((bar === 8 || bar === 9) && st === 0) {
        this.pad(w, bar === 8 ? [220, 261.63, 329.63] : [196, 246.94, 293.66], BAR);
      }
      if (bar < 8 && st % 2 === 0) this.lead(w, leadAt(bar, st >> 1));
      this.next++;
    }
    if (this.long.length > 80) this.long.splice(0, this.long.length - 80);
  }

  private noiseAt(w: number, dur: number): AudioBufferSourceNode {
    const s = this.c.createBufferSource();
    s.buffer = this.noise;
    s.start(w, Math.random() * 2, dur);
    return s;
  }

  private voice(kind: HitKind, w: number, v: number): void {
    const { c, bus } = this;
    if (kind === "kick") {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.setValueAtTime(155, w);
      o.frequency.exponentialRampToValueAtTime(44, w + 0.12);
      g.gain.setValueAtTime(0.0001, w);
      g.gain.exponentialRampToValueAtTime(v, w + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, w + 0.45);
      o.connect(g).connect(bus);
      o.start(w);
      o.stop(w + 0.5);
      this.burst(w, 0.03, "highpass", 2500, 0.22 * v, 0.025);
    } else if (kind === "snare") {
      this.burst(w, 0.25, "bandpass", 1900, 0.55 * v, 0.2, 0.7);
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(220, w);
      o.frequency.exponentialRampToValueAtTime(170, w + 0.06);
      const og = c.createGain();
      og.gain.setValueAtTime(0.32 * v, w);
      og.gain.exponentialRampToValueAtTime(0.001, w + 0.09);
      o.connect(og).connect(bus);
      o.start(w);
      o.stop(w + 0.1);
    } else if (kind === "hat") {
      const d = v > 0.6 ? 0.16 : 0.045;
      this.burst(w, d + 0.02, "highpass", 7200, 0.2 * v, d);
    } else this.crash(w, v);
  }

  /** Filtered noise for `dur` s, `gain` fading over `fade` s. */
  private burst(
    w: number,
    dur: number,
    type: BiquadFilterType,
    f: number,
    gain: number,
    fade: number,
    q?: number,
  ): void {
    const { c, bus } = this;
    const n = this.noiseAt(w, dur);
    const flt = c.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = f;
    if (q !== undefined) flt.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, w);
    g.gain.exponentialRampToValueAtTime(0.001, w + fade);
    n.connect(flt).connect(g).connect(bus);
  }

  private crash(w: number, v: number): void {
    const { c, bus } = this;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 4200;
    const pk = c.createBiquadFilter();
    pk.type = "peaking";
    pk.frequency.value = 8500;
    pk.gain.value = 6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, w);
    g.gain.exponentialRampToValueAtTime(0.36 * v, w + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, w + 2.4);
    n.connect(hp).connect(pk).connect(g).connect(bus);
    n.start(w);
    n.stop(w + 2.5);
    this.long.push(n);
    const mg = c.createGain();
    mg.gain.setValueAtTime(0.045 * v, w);
    mg.gain.exponentialRampToValueAtTime(0.001, w + 1.6);
    const mh = c.createBiquadFilter();
    mh.type = "highpass";
    mh.frequency.value = 6000;
    mh.connect(mg).connect(bus);
    for (const f of [2873, 3361, 4129, 5011, 5897, 7213]) {
      const o = c.createOscillator();
      o.type = "square";
      o.frequency.value = f;
      o.connect(mh);
      o.start(w);
      o.stop(w + 1.7);
      this.long.push(o);
    }
  }

  private riser(w: number): void {
    const { c, bus } = this;
    const dur = 2 * BAR - BEAT;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 4;
    bp.frequency.setValueAtTime(300, w);
    bp.frequency.exponentialRampToValueAtTime(7500, w + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, w);
    g.gain.exponentialRampToValueAtTime(0.2, w + dur);
    g.gain.setValueAtTime(0, w + dur + 0.005);
    n.connect(bp).connect(g).connect(bus);
    n.start(w);
    n.stop(w + dur + 0.02);
    this.long.push(n);
  }

  private pad(w: number, notes: number[], dur: number): void {
    const { c, bus } = this;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(500, w);
    lp.frequency.linearRampToValueAtTime(1400, w + dur * 0.7);
    const g = c.createGain();
    g.gain.setValueAtTime(0, w);
    g.gain.linearRampToValueAtTime(0.055, w + dur * 0.45);
    g.gain.linearRampToValueAtTime(0, w + dur);
    lp.connect(g).connect(bus);
    for (const f of notes) {
      for (const dt of [-7, 7]) {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = dt;
        o.connect(lp);
        o.start(w);
        o.stop(w + dur + 0.05);
        this.long.push(o);
      }
    }
  }

  /** The lead: a soft triangle note, quick attack, short decay. */
  private lead(w: number, f: number): void {
    const { c, bus } = this;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, w);
    g.gain.exponentialRampToValueAtTime(0.06, w + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, w + 0.24);
    o.connect(lp).connect(g).connect(bus);
    o.start(w);
    o.stop(w + 0.26);
  }

  private sub(ls: number, w: number, kick: boolean): void {
    const bar = ls >> 4;
    const st = ls & 15;
    const sec = bar < 8 ? "drop" : bar < 10 ? "break" : "build";
    const G = this.subG.gain;
    if (st === 0) {
      const f = NOTE[subNote(bar)]!;
      this.subO.frequency.setValueAtTime(f, w);
      this.subO2.frequency.setValueAtTime(f * 2, w);
    }
    if (sec === "break" && st === 0 && bar === 8) {
      G.cancelScheduledValues(w);
      G.setValueAtTime(0.06, w);
      G.linearRampToValueAtTime(0.5, w + BAR * 1.1);
      G.linearRampToValueAtTime(0.12, w + BAR * 2);
    }
    if (bar === 11 && st === 0) {
      G.cancelScheduledValues(w);
      G.setTargetAtTime(0, w, 0.03);
    }
    if (kick && (sec === "drop" || bar === 10)) {
      const L = sec === "drop" ? 0.5 : 0.38;
      G.cancelScheduledValues(w);
      G.setValueAtTime(L * 0.1, w);
      G.setTargetAtTime(L, w + 0.012, 0.07);
    }
  }
}
