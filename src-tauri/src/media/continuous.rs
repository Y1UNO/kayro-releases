//! Kysland's music mode (2026-11-03): the continuous levels, all 0–1. The sub-bass (30–60 Hz;
//! attack 10 ms, release 120 ms); the melody (250–2000 Hz, drum hits taken out by a 48 ms median;
//! attack 40 ms, release 300 ms), which the disc's strings follow; and its pitch (the centroid of
//! 250–4000 Hz on a log scale). Each against an automatic gain (the band's loudest of the last
//! seconds), never below a share of the whole sound's level: an empty band stays low.
//!
//! The voice and the instruments (2026-11-03, one string each, without AI): a voice is almost
//! always in the middle of the stereo, the instruments wider. The voice is what of 300–3400 Hz
//! the sides do not explain (`mid² − 2·side²`), drum hits taken out by the same median; the
//! melody then is the rest of 250–5000 Hz, middle and sides. A mono song (sides under 2 % of the
//! middle) cannot tell them apart: no voice, the melody as before.

use super::beat::WINDOW;
use super::onset::median;
use super::spectrum::{bins, rms, QUIET};

const SUB: (f32, f32) = (30.0, 60.0);
const MELODY: (f32, f32) = (250.0, 2000.0);
const PITCH: (f32, f32) = (250.0, 4000.0);
const VOICE: (f32, f32) = (300.0, 3400.0);
const WIDE: (f32, f32) = (250.0, 5000.0);
/// What of the middle the sides explain: a wide sound has as much in its sides as its middle.
const SIDE_WEIGHT: f32 = 2.0;
/// Under this share of the middle's power in its sides, the song is mono.
const STEREO: f32 = 0.02;
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
    voice_bins: (usize, usize),
    wide_bins: (usize, usize),
    voice_recent: [f32; 9],
    voice_gain: f32,
    voice: f32,
    voice_follow: Follow,
    width: f32,
    width_share: f32,
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
            voice_bins: bins(rate, VOICE),
            wide_bins: bins(rate, WIDE),
            voice_recent: [0.0; 9],
            voice_gain: QUIET,
            voice: 0.0,
            voice_follow: Follow::new(hop_s, 0.06, 0.35),
            width: 0.0,
            width_share: 1.0 - (-hop_s / 0.5).exp(),
        }
    }

    /// The sub-bass, the melody, the voice and the melody's pitch.
    pub fn levels(&self) -> (f32, f32, f32, f32) {
        (self.sub, self.melody, self.voice, self.pitch)
    }

    /// The voice's and the instruments' levels now (RMS), from the middle and the sides.
    fn split(&mut self, mags: &[f32], side: &[f32]) -> (f32, f32) {
        let (a, b) = self.wide_bins;
        let (mut mid, mut wide) = (0.0f32, 0.0f32);
        for k in a..=b {
            mid += mags[k] * mags[k];
            wide += side[k] * side[k];
        }
        let share = if mid > QUIET * QUIET { wide / mid } else { 0.0 };
        self.width += (share - self.width) * self.width_share;
        if self.width < STEREO {
            return (0.0, rms(mags, self.melody_bins));
        }
        let (va, vb) = self.voice_bins;
        let centre: f32 = (va..=vb)
            .map(|k| (mags[k] * mags[k] - SIDE_WEIGHT * side[k] * side[k]).max(0.0))
            .sum();
        let rest = (mid - centre).max(0.0) + wide;
        let voice = (centre / (vb + 1 - va) as f32).sqrt();
        (voice, (rest / (b + 1 - a) as f32).sqrt())
    }

    /// One analysis: its magnitudes and its sides' (the same length), and the whole sound's
    /// level (their slow RMS).
    pub fn update(&mut self, mags: &[f32], side: &[f32], all_level: f32) {
        let sub_now = rms(mags, self.sub_bins);
        self.sub_gain = (self.sub_gain * self.gain_decay)
            .max(sub_now)
            .max(SUB_ALL * all_level)
            .max(QUIET);
        let target = (sub_now / self.sub_gain).clamp(0.0, 1.0);
        self.sub_follow.step(&mut self.sub, target);

        let (voice_raw, melody_raw) = self.split(mags, side);
        let voice_now = median9(&mut self.voice_recent, voice_raw);
        self.voice_gain = (self.voice_gain * self.gain_decay)
            .max(voice_now)
            .max(MELODY_ALL * all_level)
            .max(QUIET);
        let target = (voice_now / self.voice_gain).clamp(0.0, 1.0);
        self.voice_follow.step(&mut self.voice, target);

        let melody_now = median9(&mut self.melody_recent, melody_raw);
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
