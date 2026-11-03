//! Kysland's music mode (2026-11-03): what the music does, read from the sound the PC plays
//! (loopback.rs). Every 5.3 ms (256 samples at 48 kHz), the spectrum of the last 1024 samples
//! (spectrum.rs) gives the hits of the kick, the snare, the hi-hat and the crash with their
//! velocity (onset.rs), three continuous levels (continuous.rs: the sub-bass, the melody and its
//! pitch) and where the song is (form.rs). Plain arithmetic, no model; nothing is kept.
//!
//! A band's flux is the mean rise of its bins on a log scale, gated: the gate follows the band's
//! own level (−20 dB under it) but never sits under 2 % of the whole sound's level, so a quiet
//! song reacts like a loud one and an empty band stays quiet.

use serde::{Deserialize, Serialize};
use specta::Type;

use super::beat::WINDOW;
use super::continuous::{Continuous, Follow};
use super::form::Form;
use super::onset::{median, Onset};
use super::spectrum::{bins, flux, mean, rms, Spectrum, QUIET};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum HitKind {
    Kick,
    Snare,
    Hat,
    Crash,
}

/// One hit: which instrument, and how hard (0–1, against the band's recent hits).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Type)]
pub struct MusicHit {
    pub kind: HitKind,
    pub velocity: f32,
}

/// Where the song is (`Unknown` while it cannot be told).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Section {
    Drop,
    Break,
    Build,
    #[default]
    Unknown,
}

/// The continuous side of the analysis, all 0–1 but `gap` and `section`.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Levels {
    pub sub: f32,
    pub melody: f32,
    pub pitch: f32,
    pub build: f32,
    pub gap: bool,
    pub section: Section,
}

/// One analysis every 256 samples at 48 kHz (5.3 ms); other rates keep the duration.
const HOP_48K: f32 = 256.0;
/// The bands (Hz): kick, snare, hi-hat, crash; and the whole sound.
const DRUMS: [&[(f32, f32)]; 4] = [
    &[(40.0, 120.0)],
    &[(150.0, 250.0), (1500.0, 5000.0)],
    &[(7000.0, 14_000.0)],
    &[(4000.0, 16_000.0)],
];
const ALL: (f32, f32) = (30.0, 16_000.0);
/// The least time between two hits (s): kick, snare, hi-hat, crash.
const REFRACTORY_S: [f32; 4] = [0.11, 0.11, 0.05, 0.9];
/// The least flux that can be a hit (mean log rise per bin).
const FLOORS: [f32; 4] = [0.25, 0.2, 0.2, 0.2];
/// A kick: its band at least this many times its mean level of the last second (a bass note,
/// or the kick's tail beating with the bass, rises too but is not louder than the kicks)…
const KICK_LOUD: f32 = 1.4;
/// …and a flux at least this share of its recent kicks' (the others: 20 %).
const KICK_SHARE: f32 = 0.35;
/// A snare under this velocity in the same analysis as a kick is the kick's click.
const KICK_MASKS: f32 = 0.5;
/// A band's gate: this share of its own level, and at least this share of the whole sound's.
const GATE: f32 = 0.1;
const GATE_ALL: f32 = 0.02;
/// A crash: a rise in the snare's and the hi-hat's bands too, and a crash-band flux this many
/// times the band's usual hit (fewer with a higher sensitivity)…
const CRASH_OVER: f32 = 1.8;
/// …of which this many are remembered (at least 3 before any crash of the band).
const CRASH_MEMORY: usize = 8;

struct Drum {
    bins: Vec<(usize, usize)>,
    level: f32,
    onset: Onset,
}

pub struct Analyzer {
    rate: f32,
    decimate: usize,
    sum: f32,
    summed: usize,
    hop: usize,
    hop_s: f32,
    ring: Vec<f32>,
    head: usize,
    heard: usize,
    fresh: usize,
    hop_energy: f32,
    samples: u64,
    spectrum: Spectrum,
    primed: bool,
    since_kick: f32,
    drums: [Drum; 4],
    crash_peaks: Vec<f32>,
    crash_over: f32,
    since_crash: f32,
    all: (usize, usize),
    all_level: f32,
    levels: Follow,
    continuous: Continuous,
    form: Form,
}

impl Analyzer {
    pub fn new(rate: u32) -> Self {
        let rate = rate.max(8000) as f32;
        let decimate = ((rate / 48_000.0).round() as usize).max(1);
        let rate = rate / decimate as f32;
        let hop = ((rate * HOP_48K / 48_000.0).round() as usize).clamp(64, WINDOW);
        let hop_s = hop as f32 / rate;
        let kick_top = bins(rate, DRUMS[0][0]).1;
        let drums = std::array::from_fn(|i| {
            let mut ranges: Vec<_> = DRUMS[i].iter().map(|&b| bins(rate, b)).collect();
            if i == 1 {
                // The snare's body starts above the kick's band (they share a bin at 47 Hz each).
                let low = &mut ranges[0];
                low.0 = low.0.max(kick_top + 1);
                low.1 = low.1.max(low.0);
            }
            // The crash's own refractory time is the analyzer's (drops share it).
            let onset = Onset::new(hop_s, if i == 3 { 0.0 } else { REFRACTORY_S[i] }, FLOORS[i]);
            Drum {
                bins: ranges,
                level: 0.0,
                onset: if i == 0 {
                    onset.kick(KICK_LOUD, KICK_SHARE)
                } else {
                    onset
                },
            }
        });
        Self {
            rate,
            decimate,
            sum: 0.0,
            summed: 0,
            hop,
            hop_s,
            ring: vec![0.0; WINDOW],
            head: 0,
            heard: 0,
            fresh: 0,
            hop_energy: 0.0,
            samples: 0,
            spectrum: Spectrum::new(),
            primed: false,
            since_kick: f32::INFINITY,
            drums,
            crash_peaks: Vec::with_capacity(CRASH_MEMORY),
            crash_over: CRASH_OVER,
            since_crash: f32::INFINITY,
            all: bins(rate, ALL),
            all_level: 0.0,
            levels: Follow::new(hop_s, 0.3, 3.0),
            continuous: Continuous::new(rate, hop_s),
            form: Form::new(hop_s),
        }
    }

    /// Detection sensitivities (kick, snare, hi-hat, crash), 0.5–2: higher finds more hits.
    pub fn set_senses(&mut self, senses: [f32; 4]) {
        for (drum, sense) in self.drums.iter_mut().zip(senses) {
            drum.onset.set_sensitivity(sense);
        }
        self.crash_over = 1.0 + (CRASH_OVER - 1.0) / senses[3].clamp(0.5, 2.0);
    }

    /// The sound taken so far (s).
    pub fn time(&self) -> f64 {
        self.samples as f64 / f64::from(self.rate)
    }

    pub fn levels(&self) -> Levels {
        let (sub, melody, pitch) = self.continuous.levels();
        Levels {
            sub,
            melody,
            pitch,
            build: self.form.build(),
            gap: self.form.gap(),
            section: self.form.section(),
        }
    }

    /// Takes the next mono samples; each complete analysis appends its hits to `hits`.
    pub fn push(&mut self, samples: &[f32], hits: &mut Vec<MusicHit>) {
        for &s in samples {
            let mut s = if s.is_finite() {
                s.clamp(-4.0, 4.0)
            } else {
                0.0
            };
            if self.decimate > 1 {
                self.sum += s;
                self.summed += 1;
                if self.summed < self.decimate {
                    continue;
                }
                s = self.sum / self.decimate as f32;
                (self.sum, self.summed) = (0.0, 0);
            }
            self.ring[self.head] = s;
            self.head = (self.head + 1) % WINDOW;
            self.heard = (self.heard + 1).min(WINDOW);
            self.samples += 1;
            self.hop_energy += s * s;
            self.fresh += 1;
            if self.fresh >= self.hop {
                self.fresh = 0;
                self.analyse(hits);
            }
        }
    }

    fn analyse(&mut self, hits: &mut Vec<MusicHit>) {
        let energy = self.hop_energy / self.hop as f32;
        self.hop_energy = 0.0;
        if self.heard < WINDOW {
            return; // a full window first: the first analysis must not see the start as a hit
        }
        self.spectrum.take(&self.ring, self.head);
        let mags = &self.spectrum.mags;
        let all_now = rms(mags, self.all);
        // Silence, or the first sound after it (barely in the window yet): the rises start there.
        let silent = all_now < QUIET;
        if silent || !self.primed {
            if !silent {
                self.all_level = self.all_level.max(all_now);
                for d in &mut self.drums {
                    d.level = d.level.max(mean(mags, &d.bins));
                }
            }
            self.spectrum.restart();
            self.primed = !silent;
        }
        let (mags, reference) = (&self.spectrum.mags, &self.spectrum.reference);
        self.levels.step(&mut self.all_level, all_now);
        // The whole sound now counts too: a sound after a silence does not light the empty bands.
        let floor = (GATE_ALL * self.all_level.max(all_now)).max(QUIET);
        let mut peaks = [None; 4];
        for (d, peak) in self.drums.iter_mut().zip(&mut peaks) {
            let level = mean(mags, &d.bins);
            self.levels.step(&mut d.level, level);
            let gate = (GATE * d.level).max(floor);
            *peak = d.onset.push(flux(mags, reference, &d.bins, gate), level);
        }
        self.since_crash += self.hop_s;
        self.since_kick = if peaks[0].is_some() {
            0.0
        } else {
            self.since_kick + self.hop_s
        };
        let crashed = peaks[3].is_some_and(|p| self.crash(p.flux));
        let kinds = [HitKind::Kick, HitKind::Snare, HitKind::Hat];
        for (kind, peak) in kinds.into_iter().zip(peaks) {
            // A crash rings through the snare's and the hi-hat's bands: one gesture, the crash's.
            // A kick's click reaches the snare's band: a weak snare with a kick is the kick.
            let masked = (crashed && kind != HitKind::Kick)
                || (kind == HitKind::Snare
                    && self.since_kick <= self.hop_s * 1.5
                    && peak.is_some_and(|p| p.velocity < KICK_MASKS));
            if let Some(p) = peak.filter(|_| !masked) {
                let velocity = p.velocity;
                hits.push(MusicHit { kind, velocity });
            }
        }
        if let Some(p) = peaks[3].filter(|_| crashed) {
            let velocity = p.velocity.max(0.6);
            hits.push(MusicHit {
                kind: HitKind::Crash,
                velocity,
            });
        }
        self.continuous.update(&self.spectrum.mags, self.all_level);
        let (a, b) = self.drums[3].bins[0];
        let hi = self.spectrum.mags[a..=b].iter().map(|m| m * m).sum::<f32>() / (b + 1 - a) as f32;
        let dropped = self.form.push(energy, hi, peaks[0].is_some());
        if dropped && !crashed && self.since_crash >= REFRACTORY_S[3] {
            self.since_crash = 0.0;
            hits.push(MusicHit {
                kind: HitKind::Crash,
                velocity: 1.0,
            });
        }
        self.spectrum.keep();
    }

    /// A peak of the crash band: a crash when the band's usual hits are far below it and the
    /// snare's and the hi-hat's bands rose with it (a cymbal is wide; a hi-hat is not).
    fn crash(&mut self, flux: f32) -> bool {
        let usual = if self.crash_peaks.len() >= 3 {
            let mut recent = self.crash_peaks.clone();
            median(&mut recent)
        } else {
            f32::INFINITY
        };
        if self.crash_peaks.len() == CRASH_MEMORY {
            self.crash_peaks.remove(0);
        }
        self.crash_peaks.push(flux);
        let wide = self.drums[1].onset.active() && self.drums[2].onset.active();
        let crash = wide && flux >= self.crash_over * usual && self.since_crash >= REFRACTORY_S[3];
        if crash {
            self.since_crash = 0.0;
        }
        crash
    }
}

#[cfg(test)]
#[path = "music_sounds.rs"]
mod sounds;

#[cfg(test)]
#[path = "music_tests.rs"]
mod tests;
