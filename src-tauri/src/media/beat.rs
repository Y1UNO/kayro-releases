//! Step 20 (Kysland): the beat of the music, as five levels (0–1) from the bass to the treble,
//! for the island's bars. A 1024-point FFT of the last samples played, summed in bands, each band
//! with its own automatic gain (loud or quiet music fills the bars alike), quick to rise and slow
//! to fall. A band also jumps with what is *new* in it (its rise above its recent average): a
//! steady sound (the treble's hiss, a held note) sits lower and every hit kicks, so the treble
//! bars move as much as the bass ones (2026-11-02). Pure: tested on synthetic tones.

/// The bars, from the bass up.
pub const BARS: usize = 5;
/// Samples per analysis.
pub const WINDOW: usize = 1024;
/// The bands' edges (Hz).
const EDGES: [f32; BARS + 1] = [40.0, 140.0, 400.0, 1200.0, 3500.0, 10_000.0];
/// How fast a band's automatic gain forgets a loud passage, per analysis.
const GAIN_DECAY: f32 = 0.985;
/// Below this a band is silence (its gain does not go lower).
const FLOOR: f32 = 1e-3;
/// A falling bar keeps this much of itself per analysis.
const FALL: f32 = 0.72;
/// How much of a band's recent average each analysis takes (about 0.2 s of memory).
const AVERAGE: f32 = 0.15;
/// The level's share of the band's loudness (the rest: what is new in it).
const STEADY: f32 = 0.45;
/// What is new in a band, as a share of its peak, is worth this much.
const ONSET: f32 = 2.2;

pub struct Analyzer {
    rate: f32,
    peaks: [f32; BARS],
    averages: [f32; BARS],
    levels: [f32; BARS],
}

/// An in-place radix-2 FFT of `re`/`im` (their length a power of two). Also the music mode's
/// (music.rs): each twiddle is computed once per stage, not once per butterfly.
pub(crate) fn fft(re: &mut [f32], im: &mut [f32]) {
    let n = re.len();
    let mut j = 0;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j |= bit;
        if i < j {
            re.swap(i, j);
            im.swap(i, j);
        }
    }
    let mut len = 2;
    while len <= n {
        let angle = -2.0 * std::f32::consts::PI / len as f32;
        for k in 0..len / 2 {
            let (s, c) = (angle * k as f32).sin_cos();
            for start in (0..n).step_by(len) {
                let (a, b) = (start + k, start + k + len / 2);
                let (xr, xi) = (re[b] * c - im[b] * s, re[b] * s + im[b] * c);
                re[b] = re[a] - xr;
                im[b] = im[a] - xi;
                re[a] += xr;
                im[a] += xi;
            }
        }
        len <<= 1;
    }
}

impl Analyzer {
    pub fn new(rate: u32) -> Self {
        Self {
            rate: rate.max(8000) as f32,
            peaks: [FLOOR; BARS],
            averages: [0.0; BARS],
            levels: [0.0; BARS],
        }
    }

    /// The bars for the last `WINDOW` samples of `samples` (fewer: padded with silence).
    pub fn levels(&mut self, samples: &[f32]) -> [f32; BARS] {
        let tail = &samples[samples.len().saturating_sub(WINDOW)..];
        let mut re = vec![0f32; WINDOW];
        let mut im = vec![0f32; WINDOW];
        for (i, s) in tail.iter().enumerate() {
            let hann = 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / WINDOW as f32).cos();
            re[i] = s * hann;
        }
        fft(&mut re, &mut im);
        let hz = self.rate / WINDOW as f32;
        for b in 0..BARS {
            let from = ((EDGES[b] / hz) as usize).max(1);
            let to = ((EDGES[b + 1] / hz) as usize).min(WINDOW / 2).max(from + 1);
            let energy = (from..to)
                .map(|k| re[k] * re[k] + im[k] * im[k])
                .sum::<f32>();
            let value = (energy / (to - from) as f32).sqrt();
            self.peaks[b] = (self.peaks[b] * GAIN_DECAY).max(value).max(FLOOR);
            let peak = self.peaks[b];
            let new = ((value - self.averages[b]).max(0.0) / peak * ONSET).min(1.0);
            self.averages[b] += (value - self.averages[b]) * AVERAGE;
            let level = if value < FLOOR {
                0.0
            } else {
                STEADY * (value / peak).sqrt() + new.sqrt()
            };
            self.levels[b] = level.max(self.levels[b] * FALL).clamp(0.0, 1.0);
        }
        self.levels
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tone(hz: f32, rate: f32, n: usize, amp: f32) -> Vec<f32> {
        (0..n)
            .map(|i| amp * (2.0 * std::f32::consts::PI * hz * i as f32 / rate).sin())
            .collect()
    }

    #[test]
    fn a_bass_note_lifts_the_first_bar_and_a_high_one_the_last() {
        let mut a = Analyzer::new(48_000);
        let bass = a.levels(&tone(80.0, 48_000.0, WINDOW, 0.5));
        assert!(bass[0] > 0.9 && bass[4] < 0.3, "{bass:?}");
        let mut b = Analyzer::new(48_000);
        let high = b.levels(&tone(6000.0, 48_000.0, WINDOW, 0.5));
        assert!(high[4] > 0.9 && high[0] < 0.3, "{high:?}");
    }

    #[test]
    fn silence_lets_the_bars_fall_and_quiet_music_still_fills_them() {
        let mut a = Analyzer::new(48_000);
        a.levels(&tone(80.0, 48_000.0, WINDOW, 0.5));
        let mut last = [1.0; BARS];
        for _ in 0..30 {
            last = a.levels(&vec![0.0; WINDOW]);
        }
        assert!(last.iter().all(|l| *l < 0.01), "{last:?}");
        let mut quiet = Analyzer::new(48_000);
        let q = quiet.levels(&tone(300.0, 48_000.0, WINDOW, 0.02));
        assert!(q[1] > 0.9, "{q:?}");
    }

    #[test]
    fn a_steady_sound_sits_lower_and_a_new_hit_kicks_again() {
        let mut a = Analyzer::new(48_000);
        let hiss = tone(6000.0, 48_000.0, WINDOW, 0.1);
        let mut held = [0.0; BARS];
        for _ in 0..40 {
            held = a.levels(&hiss);
        }
        assert!(held[4] > 0.3 && held[4] < 0.6, "{held:?}");
        for _ in 0..10 {
            a.levels(&vec![0.0; WINDOW]);
        }
        let hit = a.levels(&hiss);
        assert!(hit[4] > 0.9, "{hit:?}");
    }
}
