//! Kysland's music mode (2026-11-03): the continuous levels, all 0–1. The sub-bass (30–60 Hz;
//! attack 10 ms, release 120 ms); the melody (250–2000 Hz, drum hits taken out by a 48 ms median;
//! attack 40 ms, release 300 ms), which the disc's strings follow; and its pitch (the centroid of
//! 250–4000 Hz on a log scale). Each against an automatic gain (the band's loudest of the last
//! seconds), never below a share of the whole sound's level: an empty band stays low.

use super::beat::WINDOW;
use super::onset::median;
use super::spectrum::{bins, rms, QUIET};

const SUB: (f32, f32) = (30.0, 60.0);
const MELODY: (f32, f32) = (250.0, 2000.0);
const PITCH: (f32, f32) = (250.0, 4000.0);
/// The sub-bass and the melody are worth something from this share of the whole sound's level.
const SUB_ALL: f32 = 0.5;
const MELODY_ALL: f32 = 0.2;
/// Their automatic gains forget with this time constant (s).
const GAIN_TAU_S: f32 = 3.5;

/// A one-pole follower, quicker up than down (per-analysis shares).
#[derive(Clone, Copy)]
pub struct Follow {
    up: f32,
    down: f32,
}

impl Follow {
    pub fn new(hop_s: f32, attack_s: f32, release_s: f32) -> Self {
        Self {
            up: 1.0 - (-hop_s / attack_s).exp(),
            down: 1.0 - (-hop_s / release_s).exp(),
        }
    }

    pub fn step(self, value: &mut f32, target: f32) {
        let share = if target > *value { self.up } else { self.down };
        *value += (target - *value) * share;
    }
}

/// The median of the last 9 values (48 ms): a click stays 4 analyses in the window, a note more.
fn median9(recent: &mut [f32; 9], value: f32) -> f32 {
    recent.rotate_left(1);
    recent[8] = value;
    let mut sorted = *recent;
    median(&mut sorted)
}

pub struct Continuous {
    hz: f32,
    gain_decay: f32,
    sub_bins: (usize, usize),
    sub_gain: f32,
    sub: f32,
    sub_follow: Follow,
    melody_bins: (usize, usize),
    melody_recent: [f32; 9],
    melody_gain: f32,
    melody: f32,
    melody_follow: Follow,
    pitch_bins: (usize, usize),
    pitch_recent: [f32; 9],
    pitch: f32,
    pitch_share: f32,
}

impl Continuous {
    pub fn new(rate: f32, hop_s: f32) -> Self {
        Self {
            hz: rate / WINDOW as f32,
            gain_decay: (-hop_s / GAIN_TAU_S).exp(),
            sub_bins: bins(rate, SUB),
            sub_gain: QUIET,
            sub: 0.0,
            sub_follow: Follow::new(hop_s, 0.01, 0.12),
            melody_bins: bins(rate, MELODY),
            melody_recent: [0.0; 9],
            melody_gain: QUIET,
            melody: 0.0,
            melody_follow: Follow::new(hop_s, 0.04, 0.3),
            pitch_bins: bins(rate, PITCH),
            pitch_recent: [0.0; 9],
            pitch: 0.0,
            pitch_share: 1.0 - (-hop_s / 0.08).exp(),
        }
    }

    /// The sub-bass, the melody and its pitch.
    pub fn levels(&self) -> (f32, f32, f32) {
        (self.sub, self.melody, self.pitch)
    }

    /// One analysis: its magnitudes, and the whole sound's level (their slow RMS).
    pub fn update(&mut self, mags: &[f32], all_level: f32) {
        let sub_now = rms(mags, self.sub_bins);
        self.sub_gain = (self.sub_gain * self.gain_decay)
            .max(sub_now)
            .max(SUB_ALL * all_level)
            .max(QUIET);
        let target = (sub_now / self.sub_gain).clamp(0.0, 1.0);
        self.sub_follow.step(&mut self.sub, target);

        let melody_now = median9(&mut self.melody_recent, rms(mags, self.melody_bins));
        self.melody_gain = (self.melody_gain * self.gain_decay)
            .max(melody_now)
            .max(MELODY_ALL * all_level)
            .max(QUIET);
        let target = (melody_now / self.melody_gain).clamp(0.0, 1.0);
        self.melody_follow.step(&mut self.melody, target);

        // The pitch moves only while something plays there (else it stays where it was).
        let (a, b) = self.pitch_bins;
        let (mut power, mut moment) = (0.0, 0.0);
        for (k, m) in mags.iter().enumerate().take(b + 1).skip(a) {
            power += m * m;
            moment += m * m * k as f32 * self.hz;
        }
        let present = (power / (b + 1 - a) as f32).sqrt() >= MELODY_ALL * all_level;
        if present && power > QUIET * QUIET {
            let centroid = (moment / power).max(PITCH.0);
            let target = ((centroid / PITCH.0).ln() / (PITCH.1 / PITCH.0).ln()).clamp(0.0, 1.0);
            let target = median9(&mut self.pitch_recent, target);
            self.pitch += (target - self.pitch) * self.pitch_share;
        }
    }
}
