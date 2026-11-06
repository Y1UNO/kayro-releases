//! Synthetic sounds for the music analysis' tests: kicks (a decaying 55 Hz sine, or one swept
//! from 150 Hz with a click), snares and hi-hats (noise held to their bands), crashes (wide
//! noise), tones, a plucked bass, and a whole song (bass, pad, lead, drums, a mix's bed).

use std::f32::consts::{PI, TAU};
use std::sync::OnceLock;

use super::{Analyzer, HitKind, Levels, MusicHit};

pub const RATE: f32 = 48_000.0;

pub fn at(s: f32) -> usize {
    (s * RATE) as usize
}

/// Noise held to `lo`–`hi` Hz (a sum of sines at random frequencies and phases), RMS about 0.7.
pub fn band_noise(seed: u64, lo: f32, hi: f32, seconds: f32) -> Vec<f32> {
    let mut x = seed;
    let mut rnd = move || {
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        (x >> 40) as f32 / (1u64 << 24) as f32
    };
    let parts: Vec<(f32, f32)> = (0..64)
        .map(|_| (lo + (hi - lo) * rnd(), rnd() * TAU))
        .collect();
    let scale = (1.0 / parts.len() as f32).sqrt();
    (0..at(seconds))
        .map(|i| {
            let t = i as f32 / RATE;
            parts
                .iter()
                .map(|(f, p)| (TAU * f * t + p).sin())
                .sum::<f32>()
                * scale
        })
        .collect()
}

/// A 1 ms attack, an exponential decay, and a 10 ms fade at the end (a cut would be a click).
pub fn decay(sound: &[f32], tau_s: f32) -> Vec<f32> {
    let (attack, fade) = (at(0.001) as f32, at(0.01) as f32);
    let end = sound.len() as f32;
    sound
        .iter()
        .enumerate()
        .map(|(i, s)| {
            let i = i as f32;
            let tail = ((end - i) / fade).min(1.0);
            s * (i / attack).min(1.0) * (-i / RATE / tau_s).exp() * (0.5 - 0.5 * (PI * tail).cos())
        })
        .collect()
}

fn sine(hz: f32, seconds: f32) -> Vec<f32> {
    (0..at(seconds))
        .map(|i| (TAU * hz * i as f32 / RATE).sin())
        .collect()
}

/// A plucked bass: eight harmonics, falling 1/n.
fn saw(hz: f32, seconds: f32) -> Vec<f32> {
    (0..at(seconds))
        .map(|i| {
            let t = i as f32 / RATE;
            (1..=8)
                .map(|n| (TAU * hz * n as f32 * t).sin() / n as f32)
                .sum::<f32>()
                * 0.6
        })
        .collect()
}

pub struct Kit {
    pub kick: Vec<f32>,
    /// A kick swept from 150 Hz to 50 Hz in 40 ms, with a click.
    pub real_kick: Vec<f32>,
    pub snare: Vec<f32>,
    pub hat: Vec<f32>,
    pub crash: Vec<f32>,
}

pub fn kit() -> &'static Kit {
    static KIT: OnceLock<Kit> = OnceLock::new();
    KIT.get_or_init(|| {
        let wires = decay(&band_noise(7, 1500.0, 5000.0, 0.5), 0.08);
        let snare = decay(&sine(200.0, 0.5), 0.05)
            .iter()
            .zip(&wires)
            .map(|(b, w)| 0.5 * b + w)
            .collect();
        let swept: Vec<f32> = (0..at(0.6))
            .map(|i| {
                let t = i as f32 / RATE;
                (TAU * (50.0 * t + 3.0 * (1.0 - (-t / 0.03).exp()))).sin()
            })
            .collect();
        let click = decay(&band_noise(5, 2000.0, 6000.0, 0.02), 0.003);
        let mut real_kick = decay(&swept, 0.12);
        for (k, c) in real_kick.iter_mut().zip(&click) {
            *k += 0.15 * c;
        }
        Kit {
            kick: decay(&sine(55.0, 0.9), 0.15),
            real_kick,
            snare,
            hat: decay(&band_noise(3, 7000.0, 14_000.0, 0.15), 0.02),
            crash: decay(&band_noise(11, 2000.0, 16_000.0, 2.5), 0.6),
        }
    })
}

pub struct Mix(pub Vec<f32>);

impl Mix {
    pub fn new(seconds: f32) -> Self {
        Self(vec![0.0; at(seconds)])
    }

    pub fn add(&mut self, from_s: f32, sound: &[f32], gain: f32) {
        let start = at(from_s);
        for (o, s) in self.0.iter_mut().skip(start).zip(sound) {
            *o += s * gain;
        }
    }

    pub fn tone(&mut self, from_s: f32, to_s: f32, hz: f32, amp: f32) {
        let fade = at(0.01) as f32;
        let (a, b) = (at(from_s), at(to_s).min(self.0.len()));
        for i in a..b {
            let edge = ((i - a) as f32 / fade).min((b - i) as f32 / fade).min(1.0);
            self.0[i] += amp * edge * (TAU * hz * i as f32 / RATE).sin();
        }
    }

    /// A groove at 120 BPM: kick on the beats, snare on 2 and 4, hi-hat on the eighths.
    pub fn groove(&mut self, from_s: f32, to_s: f32, gain: f32) {
        let k = kit();
        let mut t = from_s;
        let mut beat = 0;
        while t < to_s - 0.01 {
            self.add(t, &k.kick, 0.8 * gain);
            if beat % 2 == 1 {
                self.add(t, &k.snare, 0.5 * gain);
            }
            self.add(t, &k.hat, 0.15 * gain);
            self.add(t + 0.25, &k.hat, 0.12 * gain);
            t += 0.5;
            beat += 1;
        }
    }
}

/// A 16 s song at 120 BPM and where its kicks, snares and hi-hats are: a bass plucked on the
/// eighths (quieter than the kick), a pad, a lead, the drums; `real`: the swept kick, and a bed
/// in the presence and the air (a mix's voices and reverb).
pub struct Song {
    pub mix: Mix,
    pub kicks: Vec<f32>,
    pub snares: Vec<f32>,
    pub hats: Vec<f32>,
}

pub fn song(real: bool) -> Song {
    let k = kit();
    let mut s = Song {
        mix: Mix::new(16.0),
        kicks: Vec::new(),
        snares: Vec::new(),
        hats: Vec::new(),
    };
    let (bed, air) = if real {
        let bed = decay(&band_noise(9, 1500.0, 5000.0, 2.0), 1000.0);
        (bed, decay(&band_noise(13, 7000.0, 14_000.0, 2.0), 1000.0))
    } else {
        (Vec::new(), Vec::new())
    };
    for bar in 0..8 {
        let t0 = 0.25 + 2.0 * bar as f32;
        let root = [55.0, 43.65, 49.0, 65.4][bar % 4];
        let pluck = decay(&saw(root, 0.3), 0.12);
        s.mix.add(t0, &bed, 0.03);
        s.mix.add(t0, &air, 0.01);
        for e in 0..8 {
            let t = t0 + 0.25 * e as f32;
            s.mix.add(t + 0.01, &pluck, 0.35);
            s.mix.add(t, &k.hat, 0.12);
            s.hats.push(t);
        }
        for b in 0..4 {
            let t = t0 + 0.5 * b as f32;
            s.mix.add(t, if real { &k.real_kick } else { &k.kick }, 0.8);
            s.kicks.push(t);
            if b % 2 == 1 {
                s.mix.add(t, &k.snare, 0.45);
                s.snares.push(t);
            }
        }
        for hz in [220.0, 261.6, 329.6] {
            s.mix.tone(t0, t0 + 2.0, hz * root / 55.0, 0.04);
        }
        for n in 0..4 {
            let hz = [440.0, 523.3, 659.3, 587.3][(n + bar) % 4];
            let from = t0 + 0.5 * n as f32 + 0.1;
            s.mix.tone(from, from + 0.3, hz, 0.06);
        }
    }
    s
}

#[derive(Default)]
pub struct Run {
    pub hits: Vec<(f32, MusicHit)>,
    pub levels: Vec<(f32, Levels)>,
}

impl Run {
    /// The hits of one kind: when they came out (s) and their velocity.
    pub fn of(&self, kind: HitKind) -> Vec<(f32, f32)> {
        self.hits
            .iter()
            .filter(|(_, h)| h.kind == kind)
            .map(|(t, h)| (*t, h.velocity))
            .collect()
    }

    /// The levels from `from_s` to `to_s`.
    pub fn between(&self, from_s: f32, to_s: f32) -> impl Iterator<Item = &Levels> {
        self.levels
            .iter()
            .filter(move |(t, _)| *t >= from_s && *t < to_s)
            .map(|(_, l)| l)
    }

    /// Of `truth`, how many came out within 40 ms; and how many hits match none.
    pub fn score(&self, kind: HitKind, truth: &[f32]) -> (usize, usize) {
        let found = self.of(kind);
        let near = |f: f32, t: f32| f >= t && f < t + 0.04;
        let hit = truth
            .iter()
            .filter(|t| found.iter().any(|(f, _)| near(*f, **t)))
            .count();
        let stray = found
            .iter()
            .filter(|(f, _)| !truth.iter().any(|t| near(*f, *t)))
            .count();
        (hit, stray)
    }
}

/// Analyses `signal` (48 kHz) by blocks of 256 samples, noting when each hit came out.
pub fn run(signal: &[f32]) -> Run {
    let mut a = Analyzer::new(48_000);
    let (mut out, mut hits) = (Run::default(), Vec::new());
    for chunk in signal.chunks(256) {
        a.push(chunk, &mut hits);
        let t = a.time() as f32;
        out.hits.extend(hits.drain(..).map(|h| (t, h)));
        out.levels.push((t, a.levels()));
    }
    out
}

pub fn gaps(times: &[(f32, f32)]) -> Vec<f32> {
    times.windows(2).map(|w| w[1].0 - w[0].0).collect()
}
