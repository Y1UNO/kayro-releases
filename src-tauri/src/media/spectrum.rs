//! Kysland's music mode (2026-11-03): the spectrum of the last 1024 samples (Hann window, FFT,
//! magnitudes scaled so that a full-scale sine reads 1) and, bin by bin, the loudest of the 4
//! analyses before: a rise counts from there, so a bin that wavers (two harmonics of a bass in
//! one bin, 47 Hz wide) never rises. With the helpers of the bands: their bins, mean, RMS, and
//! their flux on a log scale.

use super::beat::{fft, WINDOW};

pub const BINS: usize = WINDOW / 2;
/// Under this (a full-scale sine: 1) nothing is heard.
pub const QUIET: f32 = 1e-6;
/// How many analyses back a rise counts from (21 ms: a wavering faster than 50 Hz never rises).
const PAST: usize = 4;

pub struct Spectrum {
    window: Vec<f32>,
    norm: f32,
    re: Vec<f32>,
    im: Vec<f32>,
    pub mags: Vec<f32>,
    past: Vec<f32>,
    past_next: usize,
    pub reference: Vec<f32>,
}

impl Spectrum {
    pub fn new() -> Self {
        let window: Vec<f32> = (0..WINDOW)
            .map(|i| 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / WINDOW as f32).cos())
            .collect();
        Self {
            norm: 2.0 / window.iter().sum::<f32>(),
            window,
            re: vec![0.0; WINDOW],
            im: vec![0.0; WINDOW],
            mags: vec![0.0; BINS],
            past: vec![0.0; BINS * PAST],
            past_next: 0,
            reference: vec![0.0; BINS],
        }
    }

    /// The magnitudes of `ring` (`WINDOW` samples, the oldest at `head`), and their reference.
    pub fn take(&mut self, ring: &[f32], head: usize) {
        for (i, (re, im)) in self.re.iter_mut().zip(&mut self.im).enumerate() {
            *re = ring[(head + i) % WINDOW] * self.window[i];
            *im = 0.0;
        }
        fft(&mut self.re, &mut self.im);
        for (k, m) in self.mags.iter_mut().enumerate() {
            *m = (self.re[k] * self.re[k] + self.im[k] * self.im[k]).sqrt() * self.norm;
        }
        for (k, r) in self.reference.iter_mut().enumerate() {
            *r = (0..PAST)
                .map(|p| self.past[p * BINS + k])
                .fold(0.0, f32::max);
        }
    }

    /// Silence, or the first sound after it: nothing rises in this analysis.
    pub fn restart(&mut self) {
        for slot in self.past.chunks_mut(BINS) {
            slot.copy_from_slice(&self.mags);
        }
        self.reference.copy_from_slice(&self.mags);
    }

    /// Keeps this analysis among the ones the next rises count from.
    pub fn keep(&mut self) {
        let slot = self.past_next * BINS;
        self.past[slot..slot + BINS].copy_from_slice(&self.mags);
        self.past_next = (self.past_next + 1) % PAST;
    }
}

/// The bins of a band (inclusive), at `rate` (Hz).
pub fn bins(rate: f32, (lo, hi): (f32, f32)) -> (usize, usize) {
    let hz = rate / WINDOW as f32;
    let from = ((lo / hz).round() as usize).clamp(1, BINS - 1);
    let to = ((hi / hz).round() as usize).clamp(from, BINS - 1);
    (from, to)
}

pub fn mean(mags: &[f32], bins: &[(usize, usize)]) -> f32 {
    let (mut sum, mut n) = (0.0, 0);
    for &(a, b) in bins {
        sum += mags[a..=b].iter().sum::<f32>();
        n += b + 1 - a;
    }
    sum / n.max(1) as f32
}

pub fn rms(mags: &[f32], (a, b): (usize, usize)) -> f32 {
    (mags[a..=b].iter().map(|m| m * m).sum::<f32>() / (b + 1 - a) as f32).sqrt()
}

/// A bin on its band's log scale: `ln(mag / gate)` well above the gate, about 0 under it. Taken
/// on the power (`½ ln(1 + (mag / gate)²)`) for a sharp knee: what stays 10 dB under the gate (a
/// kick's attack in the snare's band) adds almost nothing.
fn lift(mag: f32, inv_gate: f32) -> f32 {
    let x = mag * inv_gate;
    0.5 * (x * x).ln_1p()
}

/// The mean rise of [`lift`] over a band's bins, from `reference` to `mags`.
pub fn flux(mags: &[f32], reference: &[f32], bins: &[(usize, usize)], gate: f32) -> f32 {
    let inv = 1.0 / gate;
    let (mut sum, mut n) = (0.0, 0);
    for &(a, b) in bins {
        for k in a..=b {
            sum += (lift(mags[k], inv) - lift(reference[k], inv)).max(0.0);
        }
        n += b + 1 - a;
    }
    sum / n.max(1) as f32
}
